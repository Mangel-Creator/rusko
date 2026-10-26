import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';

import {
  AccionesRapidas,
  AvisoPantallaInicio,
  Boton,
  BotonInicial,
  Casilla,
  Pantalla,
  Selector,
  Tarjeta,
  Texto,
  Titulo,
} from '@/components';
import { useCorreos } from '@/data/correos';
import { useDensidad } from '@/data/densidad';
import { useEnergia } from '@/data/energia';
import { useAgenda } from '@/data/agenda';
import { useEmpresa } from '@/data/empresa';
import { moverTareas, type Evento } from '@/data/eventos';
import { usePerfil, type MomentoDelDia, type Perfil } from '@/data/perfil';
import {
  DATOS_CUADRANTE,
  calcularHuecos,
  duracionTarea,
  eventosDelDia,
  intervaloDe,
  ordenarPorPrioridad,
  repartirTareas,
  resolverLugar,
  siguienteEvento,
  tareasPendientes,
  ventanaDelDia,
  type Energia,
  type Intervalo,
  type Siguiente,
} from '@/services/agenda';
import { contarNuevos } from '@/services/correo/correos';
import { marcarHechaDeAgenda } from '@/services/empresa';
import { todoElDiaDeEmpresa } from '@/services/empresa/calendario';
import { anunciosSinLeer, totalSinLeer } from '@/services/empresa/chat';
import { NOMBRE_CLASE } from '@/services/empresa/textos';
import { imprescindiblesDelDia, textoQuedan, ventanaEpoca } from '@/services/epoca';
import {
  claveDia,
  fechaDesdeClave,
  formatearDiaCorto,
  formatearDuracion,
  horaDesdeMinutos,
  minutosDelDia,
  saludoSegunHora,
  sumarDias,
} from '@/services/fechas';
import { cifras, colorBaldosa, colores, colorEvento, espacio, fuentes, radio, tamanos } from '@/theme';

import { CapturaRapida } from './captura/CapturaRapida';
import { ConfirmacionMovidas } from './calendario/ConfirmacionMovidas';
import { FilaEvento } from './calendario/FilaEvento';
import { SalidaSiguiente } from './calendario/SalidaSiguiente';
import { TarjetaHueco } from './calendario/TarjetaHueco';
import { OPCIONES_ENERGIA, abrirEvento, nuevoEvento, rangoHoras } from './calendario/textos';
import { useAhora } from './calendario/useAhora';
import { PlanDeHoy } from './epoca/PlanDeHoy';
import { ResumenFinEpoca } from './epoca/ResumenFinEpoca';
import { useEpocaActiva } from './epoca/useEpoca';
import { PanelHoy, type DatosBaldosa, type Vista } from './hoy/PanelHoy';
import { MatrizTareas, useModoTareas, type ModoTareas } from './tareas/MatrizTareas';

const NOMBRE_MOMENTO: Record<MomentoDelDia, string> = {
  manana: 'por la mañana',
  tarde: 'por la tarde',
  noche: 'por la noche',
};

// Las tareas van ordenadas por la matriz de Eisenhower: lo importante, primero.
function explicacionEnergia(energia: Energia, rindeMas: MomentoDelDia): string {
  if (energia === 'a-tope') return `Te las coloco ${NOMBRE_MOMENTO[rindeMas]}, cuando rindes más. Lo importante, primero.`;
  if (energia === 'normal') return 'Repartidas entre tus huecos libres. Lo importante, primero.';
  return 'Hoy vas tranqui: como mucho 2, las más importantes.';
}

const OPCIONES_MODO_TAREAS: { valor: ModoTareas; etiqueta: string }[] = [
  { valor: 'horas', etiqueta: 'Por horas' },
  { valor: 'matriz', etiqueta: 'Matriz' },
];

// "1 cliente" / "2 clientes"
function contar(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

// Las filas se recolocan deslizándose (por ejemplo, al marcar una tarea como hecha)
// en vez de saltar. Con "reducir movimiento" activado en el móvil, cambian sin animar.
const RECOLOCAR = LinearTransition.duration(220);
const APARECER = FadeIn.duration(180);
const DESAPARECER = FadeOut.duration(120);

type FilaTareaLista = { tarea: Evento; detalle: string; apagada?: boolean };

const TITULO_VISTA: Record<Vista, string> = {
  cliente: 'Clientes de hoy',
  amigos: 'Planes con amigos',
  yo: 'Para ti',
  tareas: 'Tareas',
  estudio: 'Estudio de hoy',
  dia: 'Todo el día',
  empresa: 'Hoy en la empresa',
};

// Hoy (rediseño del 26/09/2026, "mucho más visual"): cabecera oscura con el saludo y
// lo siguiente, y un panel de casillas grandes con icono y número. Al tocar una, su
// lista sale debajo. La captura rápida está plegada: se abre con el "+".
export function PantallaHoy() {
  const ahora = useAhora();
  const hoy = claveDia(ahora);
  const { perfil } = usePerfil();
  // La agenda: tus eventos y, con el plan empresa, tus turnos, sus eventos y tus tareas asignadas.
  const { cargado, eventos } = useAgenda();
  const empresa = useEmpresa();
  const correo = useCorreos();
  const [energia, setEnergia] = useEnergia(hoy);
  // Época dorada activa (fase 4b): cambia el horario del día y añade su plan.
  const { epoca, plan, epocas, registro } = useEpocaActiva(hoy, eventos, energia);
  const { medidas } = useDensidad();
  const separacion = { gap: medidas.separacion };
  const [vista, setVista] = useState<Vista | null>(null);
  const [capturaAbierta, setCapturaAbierta] = useState(false);
  const [modoTareas, setModoTareas] = useModoTareas();

  // /?voz=1 (accesos directos, widget y Atajo; fase 9): abre la captura y empieza a
  // escuchar. Se quita de la dirección para que no vuelva a pasar al volver a Hoy.
  const { voz } = useLocalSearchParams<{ voz?: string }>();
  const [escucharAlAbrir, setEscucharAlAbrir] = useState<number | undefined>(undefined);
  const [vozAtendida, setVozAtendida] = useState(false);
  if ((voz === '1') !== vozAtendida) {
    setVozAtendida(voz === '1');
    if (voz === '1') {
      setCapturaAbierta(true);
      setEscucharAlAbrir((n) => (n ?? 0) + 1);
    }
  }
  useEffect(() => {
    if (voz === '1') router.replace('/');
  }, [voz]);

  const nombre = perfil?.nombre ?? '';
  const saludo = saludoSegunHora(ahora, nombre);

  const rindeMas = perfil?.rindeMas ?? 'manana';

  // Huecos a partir de ahora (redondeado al cuarto de hora) dentro del horario del perfil.
  // Durante una época, lo que no quiere dejar de hacer cuenta como un evento más
  // y los bloques de estudio (con su descanso) ocupan su tiempo.
  const delDia = [...eventosDelDia(eventos, hoy), ...(epoca ? imprescindiblesDelDia(epoca, hoy) : [])].sort(
    (a, b) => intervaloDe(a).inicio - intervaloDe(b).inicio,
  );
  const bloquesHoy = (plan?.bloques ?? []).filter((b) => b.dia === hoy && b.estado !== 'saltado');
  const ocupados = [...delDia.map(intervaloDe), ...bloquesHoy.map((b) => ({ inicio: b.inicio, fin: b.descansoFin }))];
  const ventana = epoca ? ventanaEpoca(epoca) : ventanaDelDia(perfil);
  const desde = Math.max(ventana.inicio, Math.ceil(minutosDelDia(ahora) / 15) * 15);
  const quedan = { inicio: desde, fin: ventana.fin };
  const huecos = calcularHuecos(ocupados, quedan);

  // Ordenadas por la matriz de Eisenhower: las importantes cogen antes los huecos (y con
  // energía "Tranqui" son las que se quedan hoy).
  const pendientes = ordenarPorPrioridad(tareasPendientes(eventos, hoy, hoy));
  const reparto = repartirTareas(pendientes, duracionTarea, calcularHuecos(ocupados, quedan, 15), energia, rindeMas);
  const hechasHoy = eventos.filter((e) => e.flexible && e.hecha && e.fecha === hoy);
  const siguiente = siguienteEvento(eventos, ahora);
  const minutoActual = minutosDelDia(ahora);

  // Lista del día: eventos y huecos libres mezclados por orden de hora.
  const lista = [
    ...delDia.map((evento) => ({ inicio: intervaloDe(evento).inicio, evento, hueco: null })),
    ...huecos.map((hueco) => ({ inicio: hueco.inicio, evento: null, hueco })),
  ].sort((a, b) => a.inicio - b.inicio);

  // Todas las tareas en una sola lista, para que al marcar una se deslice a su sitio.
  const filasTareas: FilaTareaLista[] = [
    ...reparto.colocadas.map((c) => ({
      tarea: c.tarea,
      detalle: `A las ${horaDesdeMinutos(c.inicio)} · ${formatearDuracion(duracionTarea(c.tarea))}`,
    })),
    ...reparto.sinHueco.map((tarea) => ({
      tarea,
      detalle: `Sin hueco hoy · ${formatearDuracion(duracionTarea(tarea))}`,
    })),
    ...reparto.paraManana.map((tarea) => ({ tarea, detalle: 'Mejor mañana', apagada: true })),
  ];
  const filasHechas: FilaTareaLista[] = hechasHoy.map((tarea) => ({ tarea, detalle: 'Hecha', apagada: true }));

  // --- Casillas del panel ---
  const normales = delDia.filter((e) => !e.foco);
  const deTipo = (tipo: Evento['tipo']) => delDia.filter((e) => e.tipo === tipo && !e.empresa && (tipo === 'yo' || !e.foco));
  const nClientes = normales.filter((e) => e.tipo === 'cliente').length;
  const nAmigos = normales.filter((e) => e.tipo === 'amigos').length;
  const nYo = deTipo('yo').length;
  const bloquesDeHoy = (plan?.bloques ?? []).filter((b) => b.dia === hoy);
  const bloquesHechos = bloquesDeHoy.filter((b) => b.estado === 'hecho').length;

  const correosNuevos = contarNuevos(correo.correos);

  // Plan empresa (fase 15): lo de la empresa de hoy.
  const datosEmpresa = empresa.modo && empresa.situacion.fase === 'dentro' ? empresa.situacion.datos : null;
  const esperandoEmpresa = empresa.modo && empresa.situacion.fase !== 'dentro';
  const deEmpresaHoy = delDia.filter((e) => e.empresa);
  const todoElDiaEmpresa = datosEmpresa ? todoElDiaDeEmpresa(datosEmpresa, hoy) : [];
  const tareasEmpresa = [...filasTareas, ...filasHechas].filter((f) => f.tarea.empresa);
  const nEmpresa = deEmpresaHoy.length + todoElDiaEmpresa.length + tareasEmpresa.filter((f) => !f.tarea.hecha).length;

  // Plan empresa (fase 15): su casilla ocupa el sitio de "planes con amigos", que no sale.
  const baldosasEmpresa: DatosBaldosa[] = datosEmpresa
    ? [
        {
          clave: 'empresa',
          icono: 'business-outline',
          colores: colorBaldosa.empresa,
          numero: String(nEmpresa),
          etiqueta: `hoy en ${datosEmpresa.empresa.nombre}`,
          lectura: `${nEmpresa} ${contar(nEmpresa, 'cosa', 'cosas')} de la empresa hoy. Ver la lista`,
        },
      ]
    : esperandoEmpresa
      ? [
          {
            clave: 'empresa',
            icono: 'business-outline',
            colores: colorBaldosa.empresa,
            etiqueta: 'Plan empresa',
            lectura: 'Plan empresa. Abrir',
          },
        ]
      : [];

  const baldosas: DatosBaldosa[] = [
    {
      clave: 'cliente',
      icono: 'briefcase-outline',
      colores: colorBaldosa.cliente,
      numero: String(nClientes),
      etiqueta: contar(nClientes, 'cliente', 'clientes'),
      lectura: `${nClientes} ${contar(nClientes, 'cliente', 'clientes')} hoy. Ver la lista`,
    },
    ...(empresa.modo
      ? baldosasEmpresa
      : [
          {
            clave: 'amigos' as const,
            icono: 'people-outline' as const,
            colores: colorBaldosa.amigos,
            numero: String(nAmigos),
            etiqueta: contar(nAmigos, 'plan con amigos', 'planes con amigos'),
            lectura: `${nAmigos} ${contar(nAmigos, 'plan con amigos', 'planes con amigos')} hoy. Ver la lista`,
          },
        ]),
    {
      clave: 'tareas',
      icono: 'checkbox-outline',
      colores: colorBaldosa.neutro,
      numero: String(pendientes.length),
      etiqueta: contar(pendientes.length, 'tarea', 'tareas'),
      lectura: `${pendientes.length} ${contar(pendientes.length, 'tarea pendiente', 'tareas pendientes')}. Ver la lista`,
    },
    epoca
      ? {
          clave: 'estudio',
          icono: 'school-outline',
          colores: colorBaldosa.estudio,
          numero: `${bloquesHechos}/${bloquesDeHoy.length}`,
          etiqueta: 'bloques de estudio',
          lectura: `${bloquesHechos} de ${bloquesDeHoy.length} bloques de estudio hechos. Ver el plan`,
        }
      : {
          clave: 'yo',
          icono: 'person-outline',
          colores: colorBaldosa.yo,
          numero: String(nYo),
          etiqueta: contar(nYo, 'cosa tuya', 'cosas tuyas'),
          lectura: `${nYo} ${contar(nYo, 'cosa tuya', 'cosas tuyas')} hoy. Ver la lista`,
        },
    {
      clave: 'dia',
      icono: 'calendar-outline',
      colores: colorBaldosa.neutro,
      etiqueta: 'Todo el día',
      lectura: 'Todo el día, por horas. Ver la lista',
    },
    {
      clave: 'epoca',
      icono: epoca ? 'star' : 'star-outline',
      colores: colorBaldosa.estudio,
      etiqueta: epoca ? `Época dorada · ${textoQuedan(epoca, hoy)}` : 'Época dorada',
      lectura: epoca ? `Época dorada, ${textoQuedan(epoca, hoy)}. Abrir` : 'Época dorada. Abrir',
    },
    // Resúmenes de correo (fase 11). Va la última y ocupa toda la fila.
    correo.conexion || correo.cuentas.length > 0
      ? {
          clave: 'resumenes',
          icono: correosNuevos > 0 ? 'mail-unread-outline' : 'mail-outline',
          colores: colorBaldosa.neutro,
          numero: String(correosNuevos),
          etiqueta: contar(correosNuevos, 'correo nuevo', 'correos nuevos'),
          lectura: `${correosNuevos} ${contar(correosNuevos, 'correo nuevo', 'correos nuevos')}. Ver los resúmenes`,
        }
      : {
          clave: 'resumenes',
          icono: 'mail-outline',
          colores: colorBaldosa.neutro,
          etiqueta: 'Resúmenes de tu correo',
          lectura: 'Resúmenes de tu correo. Conectar Gmail',
        },
  ];

  const pulsarBaldosa = (clave: DatosBaldosa['clave']) => {
    if (clave === 'epoca') {
      router.push('/epoca');
      return;
    }
    if (clave === 'resumenes') {
      router.push('/resumenes');
      return;
    }
    if (clave === 'empresa' && !datosEmpresa) {
      router.navigate('/trabajo');
      return;
    }
    setVista((actual) => (actual === clave ? null : clave));
  };

  const selectorEnergia = (
    <Selector etiqueta="¿Cómo vas de energía?" opciones={OPCIONES_ENERGIA} valor={energia} alCambiar={setEnergia} />
  );

  // Filas de eventos (con sus huecos si es "Todo el día"), con las animaciones de siempre.
  const listaEventos = (items: typeof lista, vacio: string) =>
    items.length === 0 ? (
      <Texto secundario>{vacio}</Texto>
    ) : (
      <LayoutAnimationConfig skipEntering>
        <View style={separacion}>
          {items.map((item) => (
            <Animated.View
              key={item.evento ? item.evento.id : `hueco-${item.inicio}`}
              layout={RECOLOCAR}
              entering={APARECER}
              exiting={DESAPARECER}>
              {item.evento ? (
                <FilaEvento evento={item.evento} pasado={intervaloDe(item.evento).fin <= minutoActual} />
              ) : (
                <TarjetaHueco hueco={item.hueco as Intervalo} />
              )}
            </Animated.View>
          ))}
        </View>
      </LayoutAnimationConfig>
    );
  const soloEventos = (tipo: Evento['tipo']) =>
    deTipo(tipo).map((evento) => ({ inicio: intervaloDe(evento).inicio, evento, hueco: null }));

  return (
    <View style={estilos.contenedor}>
      <Pantalla contentContainerStyle={estilos.contenido}>
        {/* Cabecera: fecha, saludo gigante y lo siguiente en la tarjeta naranja. */}
        <View style={estilos.cabecera}>
          <View style={estilos.cabeceraFila}>
            <Texto secundario style={estilos.fecha}>
              {formatearDiaCorto(ahora)}
            </Texto>
            <BotonInicial nombre={nombre} onPress={() => router.push('/perfil')} />
          </View>
          <Titulo style={estilos.saludo}>{saludo}</Titulo>
          {cargado && siguiente ? <TarjetaSiguiente siguiente={siguiente} hoy={hoy} perfil={perfil} ahora={ahora} /> : null}
        </View>

        {/* Acciones rápidas, como en una app de banco: lo que más se hace, a un toque. */}
        <AccionesRapidas
          acciones={[
            {
              clave: 'apuntar',
              icono: capturaAbierta ? 'close' : 'add',
              texto: capturaAbierta ? 'Cerrar' : 'Apuntar',
              etiqueta: capturaAbierta ? 'Cerrar la captura rápida' : 'Apuntar algo',
              alPulsar: () => setCapturaAbierta((abierta) => !abierta),
            },
            {
              clave: 'dictar',
              icono: 'mic-outline',
              texto: 'Dictar',
              etiqueta: 'Apuntar algo con la voz',
              alPulsar: () => {
                setCapturaAbierta(true);
                setEscucharAlAbrir((n) => (n ?? 0) + 1);
              },
            },
            { clave: 'semana', icono: 'calendar-outline', texto: 'Semana', alPulsar: () => router.navigate('/semana') },
            { clave: 'mapa', icono: 'navigate-outline', texto: 'Mapa', etiqueta: 'Abrir el mapa', alPulsar: () => router.navigate('/mapa') },
          ]}
        />

        <CapturaRapida
          hoy={hoy}
          plegada={!capturaAbierta}
          escucharAlAbrir={escucharAlAbrir}
          alRellenarAMano={() => {
            setCapturaAbierta(false);
            nuevoEvento(hoy);
          }}
        />
        <ResumenFinEpoca epocas={epocas} registro={registro} hoy={hoy} />

        {cargado ? (
          <>
            <ConfirmacionMovidas />
            <PanelHoy baldosas={baldosas} elegida={vista} alPulsar={pulsarBaldosa} />

            {vista ? (
              <Animated.View key={vista} entering={APARECER} style={estilos.vista}>
                <Titulo nivel={2}>{TITULO_VISTA[vista]}</Titulo>

                {vista === 'dia' ? listaEventos(lista, 'Nada con hora por hoy.') : null}
                {vista === 'cliente' ? listaEventos(soloEventos('cliente'), 'Hoy no tienes clientes.') : null}
                {vista === 'amigos' ? listaEventos(soloEventos('amigos'), 'Hoy no hay planes con amigos.') : null}
                {vista === 'yo' ? listaEventos(soloEventos('yo'), 'Hoy no tienes nada tuyo con hora.') : null}

                {vista === 'empresa' && datosEmpresa ? (
                  <>
                    {todoElDiaEmpresa.map((e) => (
                      <Texto key={e.id} fuerte>
                        {NOMBRE_CLASE[e.clase]}: {e.titulo}
                      </Texto>
                    ))}
                    {listaEventos(
                      deEmpresaHoy.map((evento) => ({ inicio: intervaloDe(evento).inicio, evento, hueco: null })),
                      'Hoy no tienes turno ni eventos de empresa.',
                    )}
                    {tareasEmpresa.length > 0 ? (
                      <View style={separacion}>
                        {tareasEmpresa.map((fila) => (
                          <FilaTarea key={fila.tarea.id} {...fila} />
                        ))}
                      </View>
                    ) : null}
                    {anunciosSinLeer(datosEmpresa).length > 0 ? (
                      <Boton
                        variante="secundario"
                        titulo={`${anunciosSinLeer(datosEmpresa).length} ${contar(anunciosSinLeer(datosEmpresa).length, 'aviso', 'avisos')} sin leer`}
                        onPress={() => router.push('/empresa-avisos')}
                      />
                    ) : null}
                    {totalSinLeer(datosEmpresa) > 0 ? (
                      <Boton
                        variante="secundario"
                        titulo={`${totalSinLeer(datosEmpresa)} ${contar(totalSinLeer(datosEmpresa), 'mensaje', 'mensajes')} sin leer en el chat`}
                        onPress={() => router.push('/empresa-chat')}
                      />
                    ) : null}
                    <Boton variante="secundario" titulo={`Abrir ${datosEmpresa.empresa.nombre}`} onPress={() => router.navigate('/trabajo')} />
                  </>
                ) : null}

                {vista === 'estudio' && epoca && plan ? (
                  <>
                    {selectorEnergia}
                    <PlanDeHoy epoca={epoca} plan={plan} registro={registro} perfil={perfil} ahora={ahora} energia={energia} />
                  </>
                ) : null}

                {vista === 'tareas' ? (
                  <>
                    <Selector
                      etiqueta="Ver"
                      opciones={OPCIONES_MODO_TAREAS}
                      valor={modoTareas}
                      alCambiar={setModoTareas}
                    />
                    {modoTareas === 'horas' ? selectorEnergia : null}
                    {pendientes.length + hechasHoy.length === 0 ? (
                      <Texto secundario>No te queda ninguna tarea. Bien.</Texto>
                    ) : modoTareas === 'matriz' ? (
                      pendientes.length === 0 ? (
                        <Texto secundario>Hoy ya lo has hecho todo. Bien.</Texto>
                      ) : (
                        <MatrizTareas tareas={pendientes} />
                      )
                    ) : (
                      <>
                        <Texto pequeno secundario>
                          {explicacionEnergia(energia, rindeMas)}
                        </Texto>
                        <LayoutAnimationConfig skipEntering>
                          <View style={separacion}>
                            {filasTareas.map((fila) => (
                              <Animated.View
                                key={fila.tarea.id}
                                layout={RECOLOCAR}
                                entering={APARECER}
                                exiting={DESAPARECER}>
                                <FilaTarea {...fila} />
                              </Animated.View>
                            ))}
                            {reparto.paraManana.length > 0 ? (
                              <Animated.View key="pasar-a-manana" layout={RECOLOCAR}>
                                <Boton
                                  variante="secundario"
                                  titulo={`Pasar el resto a mañana (${reparto.paraManana.filter((t) => !t.empresa).length})`}
                                  onPress={() =>
                                    moverTareas(
                                      // Las de la empresa tienen su fecha límite: no se mueven.
                                      reparto.paraManana.filter((t) => !t.empresa).map((t) => t.id),
                                      sumarDias(hoy, 1),
                                    )
                                  }
                                />
                              </Animated.View>
                            ) : null}
                            {filasHechas.map((fila) => (
                              <Animated.View
                                key={fila.tarea.id}
                                layout={RECOLOCAR}
                                entering={APARECER}
                                exiting={DESAPARECER}>
                                <FilaTarea {...fila} />
                              </Animated.View>
                            ))}
                          </View>
                        </LayoutAnimationConfig>
                      </>
                    )}
                  </>
                ) : null}
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Texto secundario>Cargando tu día…</Texto>
        )}
        {/* Solo en la web del móvil: cómo guardarla en la pantalla de inicio. Abajo, para no tapar el día. */}
        <AvisoPantallaInicio />
      </Pantalla>
    </View>
  );
}

// Lo siguiente (o lo que está en curso): la tarjeta destacada de Hoy, con degradado
// naranja y la hora en grande, como el saldo de una cuenta. Texto oscuro encima.
type PropsSiguiente = { siguiente: Siguiente; hoy: string; perfil: Perfil | null; ahora: Date };

function TarjetaSiguiente({ siguiente, hoy, perfil, ahora }: PropsSiguiente) {
  const { evento, dia, enCurso } = siguiente;
  const cuando = enCurso
    ? 'Ahora mismo'
    : dia === hoy
      ? 'Lo siguiente'
      : dia === sumarDias(hoy, 1)
        ? 'Mañana'
        : formatearDiaCorto(fechaDesdeClave(dia));
  // Nombre del sitio (Casa, Trabajo...) y debajo su dirección.
  const lugar = resolverLugar(evento.lugar, perfil);

  return (
    <Tarjeta destacada="naranja" style={estilos.siguiente}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cuando}: ${evento.titulo}, ${rangoHoras(evento)}`}
        onPress={() => abrirEvento(evento.id)}
        style={({ pressed }) => [estilos.siguienteTextos, pressed && estilos.pulsado]}>
        <Texto pequeno style={estilos.cuando}>
          {cuando}
        </Texto>
        <View style={estilos.cifraFila}>
          <Texto style={estilos.cifra}>{evento.horaInicio}</Texto>
          <Texto style={estilos.hasta}>hasta {evento.horaFin}</Texto>
        </View>
        <Titulo nivel={3} style={estilos.sobreDegradado}>
          {evento.titulo}
        </Titulo>
        {lugar ? (
          <Texto pequeno style={estilos.sobreDegradado}>
            {[lugar.nombre, lugar.direccion].filter(Boolean).join(' · ')}
          </Texto>
        ) : null}
      </Pressable>
      {/* "Sal a las 10:05 · 18 min en coche" y "Cómo llegar" (fase 6). */}
      <SalidaSiguiente evento={evento} dia={dia} enCurso={enCurso} ahora={ahora} />
    </Tarjeta>
  );
}

function FilaTarea({ tarea, detalle, apagada }: FilaTareaLista) {
  const { medidas } = useDensidad();
  return (
    <View
      style={[
        estilos.tarea,
        { borderLeftColor: apagada ? colores.borde : colorEvento(tarea) },
        { minHeight: medidas.altoFila, paddingVertical: Math.max(medidas.rellenoFila - 4, 0) },
        apagada && estilos.apagada,
      ]}>
      <Casilla
        marcada={tarea.hecha}
        alCambiar={(hecha) => marcarHechaDeAgenda(tarea.id, hecha)}
        etiqueta={`Marcar como hecha: ${tarea.titulo}`}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => abrirEvento(tarea.id)}
        style={({ pressed }) => [estilos.tareaTextos, pressed && estilos.pulsado]}>
        <Texto
          fuerte
          style={[
            { fontSize: medidas.texto, lineHeight: medidas.interlineado },
            apagada && estilos.textoApagado,
            tarea.hecha && estilos.tachada,
          ]}>
          {tarea.titulo}
        </Texto>
        <Texto pequeno secundario>
          {tarea.empresa ? 'Empresa · ' : ''}
          {detalle}
          {tarea.cuadrante && !apagada ? (
            <Texto pequeno style={tarea.cuadrante === 'hazlo' ? estilos.hazlo : undefined}>
              {' · '}
              {DATOS_CUADRANTE[tarea.cuadrante].nombre}
            </Texto>
          ) : null}
        </Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  contenido: { paddingBottom: espacio.xxl, gap: espacio.l - 4 },
  cabecera: { gap: espacio.m, paddingBottom: espacio.s },
  cabeceraFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  fecha: { fontFamily: fuentes.textoMedio, textTransform: 'capitalize' },
  // Saludo gigante y apretado, como el titular de una página.
  saludo: { fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  vista: { gap: espacio.m, marginTop: espacio.s },
  siguiente: { marginTop: espacio.xs },
  siguienteTextos: { gap: 2 },
  cuando: { color: colores.textoOscuro, fontFamily: fuentes.textoFuerte, textTransform: 'uppercase', letterSpacing: 0.6 },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  cifra: {
    ...cifras,
    color: colores.textoOscuro,
    fontFamily: fuentes.tituloFuerte,
    fontSize: tamanos.cifra + 8,
    lineHeight: tamanos.cifra + 14,
    letterSpacing: -2,
  },
  hasta: { ...cifras, color: colores.textoOscuro, fontFamily: fuentes.textoMedio },
  sobreDegradado: { color: colores.textoOscuro },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  tarea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    paddingRight: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande - 4,
    borderLeftWidth: 4, // raya del color de su tipo
  },
  tareaTextos: { flex: 1, minHeight: 44, justifyContent: 'center' },
  // Sin opacidad, para que el texto siga pasando el contraste mínimo.
  apagada: { backgroundColor: 'transparent' },
  textoApagado: { color: colores.textoSecundario },
  tachada: { textDecorationLine: 'line-through' },
  // "Hazlo ya" en granate, como los demás avisos. Los otros cuadrantes, en gris.
  hazlo: { color: colores.aviso, fontFamily: fuentes.textoMedio },
});
