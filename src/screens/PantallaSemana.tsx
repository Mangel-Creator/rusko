import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type PanResponderGestureState } from 'react-native';
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BotonFlotante, Pantalla, Selector, Tarjeta, Texto, Titulo, type Opcion } from '@/components';
import { leerAjuste, guardarAjuste } from '@/data/ajustes';
import { useDensidad } from '@/data/densidad';
import { borrarEvento, guardarEvento, useEventos, type Evento } from '@/data/eventos';
import { useEnergia } from '@/data/energia';
import { useEpocas, type Epoca } from '@/data/epocas';
import { usePerfil } from '@/data/perfil';
import {
  cargaDelDia,
  colocarEnCarriles,
  duracionTarea,
  eventosDelDia,
  intervaloDe,
  minutosDeJornada,
  tareasPendientes,
  ventanaDelDia,
} from '@/services/agenda';
import {
  epocaActiva,
  esDorada,
  eventoDeBloque,
  imprescindiblesDelDia,
  planDeHoy,
  PREFIJO_EPOCA,
  ventanaEpoca,
  type PlanEpoca,
} from '@/services/epoca';
import { festivoDelDia } from '@/services/festivos';
import {
  DIAS_SEMANA_LETRA,
  claveDia,
  fechaDesdeClave,
  formatearDiaCorto,
  formatearDuracion,
  horaDesdeMinutos,
  inicioDeSemana,
  minutosDelDia,
  nombreMes,
  numeroSemana,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';
import { acentos, alturaTactil, cifras, colores, colorEvento, colorTipo, duracion, espacio, fuentes, radio, tamanos } from '@/theme';

import { dejarBorrador } from '@/services/captura/borrador';
import { DURACION_POR_DEFECTO, horaParaHueco, huecosParaPlan } from '@/services/planes/sugerencias';

import { MarcaFestivo } from './calendario/MarcaFestivo';
import { MenuEvento } from './calendario/MenuEvento';
import { RejillaMes } from './calendario/RejillaMes';
import { RejillaSemana } from './calendario/RejillaSemana';
import { nuevoEvento, rangoHoras } from './calendario/textos';
import { useAhora } from './calendario/useAhora';
import { HuecoPlan } from './planes/HuecoPlan';

const ALTURA_BARRA = 44;
// Al cambiar de día, lo de ese día aparece con un fundido corto para que se note el
// cambio. No se anima al abrir la pantalla ni con "reducir movimiento" activado.
const CAMBIO_DE_DIA = FadeIn.duration(160);

// Cómo se ve el calendario, como en Google Calendar. Se recuerda (organizy:vistaCalendario).
type Vista = 'dia' | '3dias' | 'semana' | 'mes';
const OPCIONES_VISTA: Opcion<Vista>[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: '3dias', etiqueta: '3 días' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
];

const ETIQUETA_ATRAS: Record<Vista, string> = {
  dia: 'Semana anterior',
  '3dias': 'Días anteriores',
  semana: 'Semana anterior',
  mes: 'Mes anterior',
};
const ETIQUETA_ADELANTE: Record<Vista, string> = {
  dia: 'Semana siguiente',
  '3dias': 'Días siguientes',
  semana: 'Semana siguiente',
  mes: 'Mes siguiente',
};

// Semanas enteras (de lunes a domingo) que cubren el mes de ese día: 5 o 6.
function diasDelMes(dia: ClaveDia): ClaveDia[] {
  const fecha = fechaDesdeClave(dia);
  const primero = claveDia(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
  const ultimo = claveDia(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0));
  const desde = claveDia(inicioDeSemana(fechaDesdeClave(primero)));
  const dias: ClaveDia[] = [];
  for (let d = desde; d <= ultimo || dias.length % 7 !== 0; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

// El día 1 del mes que está a "meses" de ese día (o hoy, si es el mes de hoy).
function otroMes(dia: ClaveDia, meses: number, hoy: ClaveDia): ClaveDia {
  const fecha = fechaDesdeClave(dia);
  const destino = claveDia(new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1));
  return destino.slice(0, 7) === hoy.slice(0, 7) ? hoy : destino;
}
let vistaEnMemoria: Vista | null = null;

function useVista(): [Vista, (vista: Vista) => void] {
  const [vista, setVista] = useState<Vista>(vistaEnMemoria ?? 'semana');
  useEffect(() => {
    if (vistaEnMemoria) return;
    leerAjuste<Vista>('vistaCalendario', 'semana').then((guardada) => {
      vistaEnMemoria = OPCIONES_VISTA.some((o) => o.valor === guardada) ? guardada : 'semana';
      setVista(vistaEnMemoria);
    });
  }, []);
  const cambiar = (nueva: Vista) => {
    vistaEnMemoria = nueva;
    setVista(nueva);
    guardarAjuste('vistaCalendario', nueva);
  };
  return [vista, cambiar];
}

export function PantallaSemana() {
  const ahora = useAhora();
  const hoy = claveDia(ahora);
  const [elegido, setElegido] = useState<ClaveDia>(hoy);
  const { perfil } = usePerfil();
  const { eventos } = useEventos();
  const { epocas, registro, planesDelDia } = useEpocas();
  const [energiaHoy] = useEnergia(hoy);
  const [vista, setVista] = useVista();
  // Lo tocado en el calendario (abre la hoja con "Eliminar") y lo recién borrado ("Deshacer").
  const [tocado, setTocado] = useState<{ evento: Evento; dia: ClaveDia } | null>(null);
  const [borrado, setBorrado] = useState<Evento | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tocar = (evento: Evento, dia: ClaveDia) => setTocado({ evento, dia });
  const borrar = (evento: Evento) => {
    borrarEvento(evento.id);
    setBorrado(evento);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setBorrado(null), 6000);
  };
  const deshacer = () => {
    if (borrado) guardarEvento(borrado);
    setBorrado(null);
  };
  const crearA = (dia: ClaveDia, minuto: number) => {
    const propuesta = dejarBorrador({
      titulo: '',
      fecha: dia,
      horaInicio: horaDesdeMinutos(minuto),
      horaFin: horaDesdeMinutos(Math.min(minuto + 60, 23 * 60 + 59)),
    });
    router.push({ pathname: '/evento', params: { fecha: dia, propuesta } });
  };

  const lunes = claveDia(inicioDeSemana(fechaDesdeClave(elegido)));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  // Lo que enseña la rejilla: la semana entera o el día elegido y los dos siguientes.
  const diasRejilla = vista === '3dias' ? [0, 1, 2].map((i) => sumarDias(elegido, i)) : dias;
  const pasoDias = vista === '3dias' ? 3 : 7;
  const diasMes = vista === 'mes' ? diasDelMes(elegido) : [];
  const jornada = minutosDeJornada(perfil);

  // Época dorada (fase 4b): los días de una época usan su horario para la carga y
  // la línea de horas, y enseñan sus bloques de estudio (de hoy en adelante, el
  // plan; los días pasados, lo que se hizo) y lo que no quiere dejar de hacer. Si es
  // solo plan de estudio (sin Época dorada), los bloques van en el horario de siempre.
  const planes = new Map<string, PlanEpoca>();
  const planDe = (epoca: Epoca) => {
    const guardado = planes.get(epoca.id);
    if (guardado) return guardado;
    const plan = planDeHoy({
      epoca,
      eventos,
      registro,
      planesDelDia,
      hoy,
      energias: { [hoy]: energiaHoy },
      ahora: minutosDelDia(ahora),
    });
    planes.set(epoca.id, plan);
    return plan;
  };
  const delDiaConEpoca = (dia: ClaveDia) => {
    const epoca = epocaActiva(epocas, dia);
    const propios = eventosDelDia(eventos, dia);
    if (!epoca) return { epoca: null, eventos: propios, ventana: ventanaDelDia(perfil), jornada };
    const bloques =
      dia >= hoy
        ? planDe(epoca).bloques.filter((b) => b.dia === dia && b.estado !== 'saltado')
        : registro.filter((r) => r.epocaId === epoca.id && r.dia === dia && r.estado === 'hecho');
    const todos = [
      ...propios,
      ...imprescindiblesDelDia(epoca, dia),
      ...bloques.map((b) => eventoDeBloque(epoca, b)),
    ].sort((a, b) => intervaloDe(a).inicio - intervaloDe(b).inicio);
    if (!esDorada(epoca)) return { epoca, eventos: todos, ventana: ventanaDelDia(perfil), jornada };
    const ventana = ventanaEpoca(epoca);
    return { epoca, eventos: todos, ventana, jornada: ventana.fin - ventana.inicio };
  };
  const fechaElegida = fechaDesdeClave(elegido);

  // La tira de días sigue al dedo y, al cambiar de semana, sale por un lado y la
  // nueva entra por el otro (también con las flechas).
  const desplazamiento = useSharedValue(0);
  const anchoTira = useSharedValue(360);
  const estiloTira = useAnimatedStyle(() => ({ transform: [{ translateX: desplazamiento.get() }] }));
  // Días que avanza cada flecha o deslizamiento (3 en "3 días", 7 en el resto; en "Mes",
  // un mes). Va en valores compartidos porque el gesto se crea una sola vez.
  const paso = useSharedValue(7);
  const porMeses = useSharedValue(false);
  useEffect(() => paso.set(pasoDias), [paso, pasoDias]);
  useEffect(() => porMeses.set(vista === 'mes'), [porMeses, vista]);
  const cambiarSemana = (semanas: number) => {
    const ancho = anchoTira.get();
    desplazamiento.set(withTiming(-semanas * ancho, { duration: duracion.corta }));
    setTimeout(() => {
      setElegido((actual) =>
        porMeses.get() ? otroMes(actual, semanas, claveDia(new Date())) : sumarDias(actual, paso.get() * semanas),
      );
      desplazamiento.set(semanas * ancho);
      desplazamiento.set(withTiming(0, { duration: duracion.normal }));
    }, duracion.corta);
  };
  const volverASuSitio = () => desplazamiento.set(withTiming(0, { duration: duracion.corta }));
  // Deslizar a los lados sobre la cabecera (mes, "Semana N", leyenda y tira de días)
  // cambia de semana. Se pide en la fase de captura para ganar a los días, que son
  // botones, y no se suelta para que el scroll vertical no lo corte a medias. Las dos
  // funciones solo usan cosas que no cambian entre pintadas, así que vale la primera.
  const [deslizar] = useState(() => {
    const esHorizontal = (g: PanResponderGestureState) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => esHorizontal(g),
      onMoveShouldSetPanResponderCapture: (_, g) => esHorizontal(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => desplazamiento.set(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) cambiarSemana(1);
        else if (g.dx > 50) cambiarSemana(-1);
        else volverASuSitio();
      },
      onPanResponderTerminate: () => volverASuSitio(),
    });
  });

  const diaElegido = delDiaConEpoca(elegido);
  const delDia = diaElegido.eventos;
  const hitosElegido = diaElegido.epoca?.hitos.filter((h) => h.fecha === elegido) ?? [];
  const tareas = eventos.filter((e) => e.flexible && e.fecha === elegido);
  const huecosPlan = huecosParaPlan(delDia.map(intervaloDe), diaElegido.ventana, elegido, ahora);
  const tituloMes = nombreMes(fechaDesdeClave(vista === '3dias' || vista === 'mes' ? elegido : sumarDias(lunes, 3)));

  return (
    <View style={estilos.contenedor}>
      <Pantalla contentContainerStyle={estilos.contenido}>
        <View style={estilos.zonaDeslizable} {...deslizar.panHandlers}>
          <View style={estilos.cabecera}>
            <View style={estilos.textos}>
              {/* Los meses largos ("Septiembre") un poco más pequeños, para que quepan con "Hoy". */}
              <Titulo numberOfLines={1} style={tituloMes.length > 8 && estilos.mesLargo}>
                {tituloMes}
              </Titulo>
              <Texto secundario>
                {vista === 'mes' ? fechaElegida.getFullYear() : `Semana ${numeroSemana(fechaElegida)}`}
              </Texto>
            </View>
            {/* "Hoy" va junto a las flechas para que las cuatro vistas quepan en una fila. */}
            {!diasRejillaOElegido(vista, diasRejilla, elegido).includes(hoy) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Volver a hoy"
                onPress={() => setElegido(hoy)}
                style={({ pressed }) => [estilos.botonHoy, pressed && estilos.pulsado]}>
                <Texto fuerte pequeno>
                  Hoy
                </Texto>
              </Pressable>
            ) : null}
            <BotonIcono icono="chevron-back" etiqueta={ETIQUETA_ATRAS[vista]} onPress={() => cambiarSemana(-1)} />
            <BotonIcono icono="chevron-forward" etiqueta={ETIQUETA_ADELANTE[vista]} onPress={() => cambiarSemana(1)} />
          </View>

          <Selector opciones={OPCIONES_VISTA} valor={vista} alCambiar={setVista} />

          {vista === 'mes' ? (
            <View style={estilos.marcoRejilla}>
              <Animated.View
                style={estiloTira}
                onLayout={(e) => {
                  anchoTira.set(e.nativeEvent.layout.width);
                }}>
                <RejillaMes
                  dias={diasMes.map((dia) => {
                    const conEpoca = delDiaConEpoca(dia);
                    return {
                      dia,
                      cosas: [...conEpoca.eventos, ...eventos.filter((e) => e.flexible && e.fecha === dia)],
                      hayHito: conEpoca.epoca?.hitos.some((h) => h.fecha === dia) ?? false,
                    };
                  })}
                  mes={fechaElegida.getMonth()}
                  hoy={hoy}
                  alTocarDia={(dia) => {
                    setElegido(dia);
                    setVista('dia');
                  }}
                />
              </Animated.View>
            </View>
          ) : vista !== 'dia' ? (
            <View style={estilos.marcoRejilla}>
              <Animated.View
                style={estiloTira}
                onLayout={(e) => {
                  anchoTira.set(e.nativeEvent.layout.width);
                }}>
                <RejillaSemana
                  dias={diasRejilla.map((dia) => {
                    const conEpoca = delDiaConEpoca(dia);
                    const minutosTareas = tareasPendientes(eventos, dia, hoy).reduce((t, e) => t + duracionTarea(e), 0);
                    return {
                      dia,
                      eventos: conEpoca.eventos,
                      tareas: eventos.filter((e) => e.flexible && e.fecha === dia),
                      hayHito: conEpoca.epoca?.hitos.some((h) => h.fecha === dia) ?? false,
                      carga: cargaDelDia(conEpoca.eventos.map(intervaloDe), minutosTareas, conEpoca.jornada),
                    };
                  })}
                  ventana={ventanaDelDia(perfil)}
                  hoy={hoy}
                  minutoAhora={minutosDelDia(ahora)}
                  alTocarDia={(dia) => {
                    setElegido(dia);
                    setVista('dia');
                  }}
                  alTocarEvento={tocar}
                  alTocarHueco={crearA}
                />
              </Animated.View>
            </View>
          ) : (
          <Tarjeta style={estilos.marcoTira}>
            <Animated.View
              style={[estilos.tira, estiloTira]}
              onLayout={(e) => {
                anchoTira.set(e.nativeEvent.layout.width);
              }}>
            {dias.map((dia, i) => {
              const conEpoca = delDiaConEpoca(dia);
              const ocupados = conEpoca.eventos.map(intervaloDe);
              const hayHito = conEpoca.epoca?.hitos.some((h) => h.fecha === dia) ?? false;
              const minutosTareas = tareasPendientes(eventos, dia, hoy).reduce((t, e) => t + duracionTarea(e), 0);
              const carga = cargaDelDia(ocupados, minutosTareas, conEpoca.jornada);
              const esElegido = dia === elegido;
              const fecha = fechaDesdeClave(dia);
              const festivo = festivoDelDia(dia, perfil?.festivos);
              return (
                <Pressable
                  key={dia}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatearDiaCorto(fecha)}, ${Math.round(carga.proporcion * 100)} % ocupado${hayHito ? ', con examen o entrega' : ''}${festivo ? `, festivo: ${festivo.nombre}` : ''}`}
                  accessibilityState={{ selected: esElegido }}
                  onPress={() => setElegido(dia)}
                  style={({ pressed }) => [estilos.dia, pressed && estilos.pulsado]}>
                  <Texto pequeno secundario>
                    {DIAS_SEMANA_LETRA[i]}
                  </Texto>
                  <View style={[estilos.numero, festivo && estilos.numeroFestivo, esElegido && estilos.numeroElegido]}>
                    <Texto
                      fuerte
                      style={[
                        festivo && estilos.numeroTextoFestivo,
                        esElegido && estilos.numeroTextoElegido,
                        !esElegido && dia === hoy && estilos.numeroHoy,
                      ]}>
                      {fecha.getDate()}
                    </Texto>
                  </View>
                  <View style={[estilos.marcaHito, hayHito && estilos.marcaHitoVisible]} />
                  <View style={estilos.barraFondo}>
                    <View
                      style={[
                        estilos.barra,
                        {
                          height: Math.min(carga.proporcion, 1) * ALTURA_BARRA,
                          backgroundColor: carga.alta ? colores.aviso : colores.cargaNormal,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
            </Animated.View>
          </Tarjeta>
          )}
        </View>

        {vista === 'dia' ? (
        <View style={estilos.leyenda}>
          <Leyenda color={colorTipo.cliente} texto="Clientes" />
          <Leyenda color={colorTipo.amigos} texto="Amigos" />
          <Leyenda color={colorTipo.yo} texto="Yo" />
        </View>
        ) : null}

        {vista === 'dia' ? (
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={elegido} entering={CAMBIO_DE_DIA} style={estilos.contenidoDia}>
            <Titulo nivel={2} style={estilos.seccion}>
              {elegido === hoy ? `Hoy, ${formatearDiaCorto(fechaElegida)}` : formatearDiaCorto(fechaElegida)}
            </Titulo>
            <MarcaFestivo dia={elegido} />

            {hitosElegido.map((h) => (
              <Texto key={h.id} fuerte style={estilos.hito}>
                ★ {h.nombre} a las {h.hora}
              </Texto>
            ))}
            {delDia.length === 0 && tareas.length === 0 ? (
              <Texto secundario>Este día lo tienes libre.</Texto>
            ) : null}
            {delDia.length > 0 ? (
              <LineaDeHoras
                eventos={delDia}
                ventana={diaElegido.ventana}
                minutoAhora={elegido === hoy ? minutosDelDia(ahora) : null}
                alTocar={(evento) => tocar(evento, elegido)}
              />
            ) : null}

            {/* Huecos de 2 h o más: "Proponer plan" abre el formulario con esa hora (fase 8). */}
            {huecosPlan.map((hueco) => (
              <HuecoPlan
                key={hueco.inicio}
                hueco={hueco}
                alProponer={() =>
                  router.push({
                    pathname: '/plan-nuevo',
                    params: {
                      dia: elegido,
                      hora: horaParaHueco(hueco, elegido, perfil, DURACION_POR_DEFECTO.amigos),
                    },
                  })
                }
              />
            ))}

            {tareas.length > 0 ? (
              <>
                <Titulo nivel={3} style={estilos.seccion}>
                  Sin hora fija
                </Titulo>
                {tareas.map((tarea) => (
                  <Pressable
                    key={tarea.id}
                    accessibilityRole="button"
                    onPress={() => tocar(tarea, elegido)}
                    style={({ pressed }) => [
                    estilos.tarea,
                    { borderLeftColor: colorEvento(tarea) },
                    pressed && estilos.pulsado,
                  ]}>
                    <Ionicons
                      name={tarea.hecha ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={colores.texto}
                    />
                    <Texto style={[estilos.textos, tarea.hecha && estilos.tachada]}>{tarea.titulo}</Texto>
                    <Texto pequeno secundario>
                      {formatearDuracion(duracionTarea(tarea))}
                    </Texto>
                  </Pressable>
                ))}
              </>
            ) : null}
          </Animated.View>
        </LayoutAnimationConfig>
        ) : null}
      </Pantalla>
      <BotonFlotante etiqueta="Añadir evento" onPress={() => nuevoEvento(elegido)} />
      <MenuEvento tocado={tocado} alCerrar={() => setTocado(null)} alBorrar={borrar} />
      {borrado ? (
        <View style={estilos.aviso} accessibilityLiveRegion="polite">
          <Texto numberOfLines={1} style={estilos.textos}>
            Borrado: {borrado.titulo || 'Sin título'}
          </Texto>
          <Pressable accessibilityRole="button" onPress={deshacer} style={estilos.deshacer}>
            <Texto fuerte style={estilos.textoDeshacer}>
              Deshacer
            </Texto>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type PropsLinea = {
  eventos: Evento[];
  ventana: { inicio: number; fin: number };
  minutoAhora: number | null;
  alTocar: (evento: Evento) => void;
};

// Día con su línea de horas: cada evento ocupa la altura de lo que dura.
function LineaDeHoras({ eventos, ventana, minutoAhora, alTocar }: PropsLinea) {
  const tramos = eventos.map(intervaloDe);
  const desde = Math.floor(Math.min(ventana.inicio, ...tramos.map((t) => t.inicio)) / 60) * 60;
  const hasta = Math.ceil(Math.max(ventana.fin, ...tramos.map((t) => t.fin)) / 60) * 60;
  const { medidas } = useDensidad();
  const y = (minuto: number) => ((minuto - desde) / 60) * medidas.pxPorHora;
  const horas = Array.from({ length: (hasta - desde) / 60 + 1 }, (_, i) => desde + i * 60);

  return (
    <View style={[estilos.linea, { height: y(hasta) }]}>
      {horas.map((minuto) => (
        <View key={minuto} style={[estilos.marcaHora, { top: y(minuto) }]}>
          <Texto pequeno secundario style={estilos.etiquetaHora}>
            {horaDesdeMinutos(minuto)}
          </Texto>
          <View style={estilos.rayaHora} />
        </View>
      ))}

      <View style={estilos.zonaEventos}>
        {colocarEnCarriles(eventos, intervaloDe).map(({ elemento: evento, carril, carriles }) => {
          const { inicio, fin } = intervaloDe(evento);
          const ancho = 100 / carriles;
          return (
            <Pressable
              key={evento.id}
              accessibilityRole="button"
              accessibilityLabel={`${rangoHoras(evento)}, ${evento.titulo}${evento.foco ? ', protegido' : ''}`}
              onPress={() => alTocar(evento)}
              style={({ pressed }) => [
                estilos.bloque,
                evento.foco ? estilos.bloqueFoco : { borderLeftColor: colorEvento(evento) },
                evento.id.startsWith(`${PREFIJO_EPOCA}bloque:`) && estilos.bloqueEpoca,
                {
                  top: y(inicio) + 1,
                  height: Math.max(y(fin) - y(inicio) - 2, 26),
                  left: `${carril * ancho}%`,
                  width: `${ancho}%`,
                },
                pressed && estilos.pulsado,
              ]}>
              <Texto pequeno fuerte numberOfLines={1} style={evento.foco && estilos.textoClaro}>
                {evento.titulo}
              </Texto>
              {y(fin) - y(inicio) >= 40 ? (
                <Texto pequeno numberOfLines={1} style={evento.foco ? estilos.textoClaro : estilos.secundario}>
                  {evento.foco ? `Protegido · ${rangoHoras(evento)}` : rangoHoras(evento)}
                </Texto>
              ) : null}
            </Pressable>
          );
        })}
        {minutoAhora !== null && minutoAhora >= desde && minutoAhora <= hasta ? (
          <View style={[estilos.ahora, { top: y(minutoAhora) }]} accessibilityLabel="Ahora" />
        ) : null}
      </View>
    </View>
  );
}

// ¿Se ve hoy? En "Día", si es el elegido; en "Mes", si es de ese mes; en las otras, si está en la rejilla.
function diasRejillaOElegido(vista: Vista, diasRejilla: ClaveDia[], elegido: ClaveDia): ClaveDia[] {
  if (vista === 'mes') return diasDelMes(elegido).filter((d) => d.slice(0, 7) === elegido.slice(0, 7));
  return vista === 'dia' ? [elegido] : diasRejilla;
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <View style={estilos.leyendaItem}>
      <View style={[estilos.punto, { backgroundColor: color }]} />
      <Texto pequeno secundario>
        {texto}
      </Texto>
    </View>
  );
}

type PropsIcono = {
  icono: 'chevron-back' | 'chevron-forward';
  etiqueta: string;
  onPress: () => void;
};

function BotonIcono({ icono, etiqueta, onPress }: PropsIcono) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [estilos.botonIcono, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={22} color={colores.texto} />
    </Pressable>
  );
}

const ANCHO_HORAS = 48;

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  contenido: { paddingBottom: 120 }, // deja sitio al botón "+"
  // Mismo gap que Pantalla, que separa sus hijos directos.
  zonaDeslizable: { gap: espacio.l - 4 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  textos: { flex: 1 },
  botonIcono: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.normal,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.7 },
  leyenda: { flexDirection: 'row', gap: espacio.m },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
  botonHoy: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    justifyContent: 'center',
  },
  marcoTira: { overflow: 'hidden' },
  marcoRejilla: { overflow: 'hidden' },
  mesLargo: { fontSize: 28, lineHeight: 34, letterSpacing: -0.9 },
  aviso: {
    position: 'absolute',
    left: espacio.m,
    right: espacio.m + 72, // sin tapar el botón "+"
    bottom: espacio.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingLeft: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  deshacer: { minHeight: alturaTactil, paddingHorizontal: espacio.m, justifyContent: 'center' },
  textoDeshacer: { color: colores.principal },
  tira: { flexDirection: 'row', paddingHorizontal: espacio.xs, gap: 0 },
  dia: { flex: 1, alignItems: 'center', gap: espacio.xs, paddingVertical: espacio.xs },
  numero: {
    width: 36,
    height: 36,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroElegido: { backgroundColor: colores.principal },
  numeroFestivo: { backgroundColor: acentos.azul.suave },
  numeroTextoFestivo: { color: acentos.azul.color },
  numeroTextoElegido: { color: colores.textoOscuro },
  numeroHoy: { color: colores.principal },
  barraFondo: {
    width: 8,
    height: ALTURA_BARRA,
    borderRadius: radio.chip,
    backgroundColor: colores.fondo,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: { width: '100%', borderRadius: radio.chip },
  seccion: { marginTop: espacio.s },
  contenidoDia: { gap: espacio.m },
  linea: { position: 'relative', marginTop: espacio.s },
  marcaHora: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -9,
  },
  etiquetaHora: { width: ANCHO_HORAS, ...cifras, fontFamily: fuentes.hora, fontSize: 12 },
  rayaHora: { flex: 1, height: 1, backgroundColor: colores.borde },
  zonaEventos: { position: 'absolute', top: 0, bottom: 0, left: ANCHO_HORAS, right: 0 },
  bloque: {
    position: 'absolute',
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4, // barra del color de su tipo
    overflow: 'hidden',
  },
  bloqueFoco: { backgroundColor: colores.acentoSuave, borderLeftColor: colores.principal },
  // Bloques de estudio de la Época dorada: como un bloque de foco, con la barra dorada.
  bloqueEpoca: { borderLeftColor: colores.dorado },
  marcaHito: { width: 6, height: 6, borderRadius: 3 },
  marcaHitoVisible: { backgroundColor: colores.dorado },
  hito: { marginTop: -espacio.s },
  textoClaro: { color: colores.principal },
  secundario: { color: colores.textoSecundario, fontSize: tamanos.pequeno },
  ahora: { position: 'absolute', left: -4, right: 0, height: 2, backgroundColor: colores.principal },
  tarea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: alturaTactil + 8,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4, // barra del color de su tipo
  },
  tachada: { textDecorationLine: 'line-through' },
});
