import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';

import { AccionesRapidas, AvisoPantallaInicio, Boton, BotonInicial, Casilla, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { useDensidad } from '@/data/densidad';
import { useEnergia } from '@/data/energia';
import { marcarHecha, moverTareas, useEventos, type Evento } from '@/data/eventos';
import { usePerfil, type Perfil } from '@/data/perfil';
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
  type Siguiente,
} from '@/services/agenda';
import { esDorada, imprescindiblesDelDia, ventanaEpoca } from '@/services/epoca';
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
import { colores, colorEvento, espacio, fuentes, radio } from '@/theme';

import { CapturaRapida } from './captura/CapturaRapida';
import { ConfirmacionMovidas } from './calendario/ConfirmacionMovidas';
import { DesdeSiri } from './siri/DesdeSiri';
import { FilaEvento } from './calendario/FilaEvento';
import { SalidaSiguiente } from './calendario/SalidaSiguiente';
import { abrirEvento, nuevoEvento, rangoHoras } from './calendario/textos';
import { useAhora } from './calendario/useAhora';
import { PlanDeHoy } from './epoca/PlanDeHoy';
import { ResumenFinEpoca } from './epoca/ResumenFinEpoca';
import { useEpocaActiva } from './epoca/useEpoca';

// Las filas se recolocan deslizándose (por ejemplo, al marcar una tarea como hecha)
// en vez de saltar. Con "reducir movimiento" activado en el móvil, cambian sin animar.
const RECOLOCAR = LinearTransition.duration(220);
const APARECER = FadeIn.duration(180);
const DESAPARECER = FadeOut.duration(120);

type FilaTareaLista = { tarea: Evento; detalle: string; apagada?: boolean };

// Hoy (26/10/2026, lo pidió el usuario: "quita todo y que solo aparezcan las cosas que
// tienes ese día"): la fecha, la captura rápida siempre a mano y, debajo, lo de hoy por
// orden de hora. Arriba, el cuadro naranja con el día y lo siguiente. Luego las tareas
// del día y, si hay época dorada, su estudio. Arriba, la fecha, el saludo y las acciones
// rápidas (Apuntar, Dictar, Planes y Alarmas), como antes (lo pidió el usuario el 27/10).
export function PantallaHoy() {
  const ahora = useAhora();
  const hoy = claveDia(ahora);
  const { perfil } = usePerfil();
  const { cargado, eventos } = useEventos();
  const [energia] = useEnergia(hoy);
  // Época dorada activa (fase 4b): cambia el horario del día y añade su plan.
  const { epoca, plan, epocas, registro } = useEpocaActiva(hoy, eventos, energia);
  const { medidas } = useDensidad();
  const separacion = { gap: medidas.separacion };

  // /?voz=1 (accesos directos, widget y Atajo; fase 9): empieza a escuchar.
  // Se quita de la dirección para que no vuelva a pasar al volver a Hoy.
  const { voz } = useLocalSearchParams<{ voz?: string }>();
  const [escucharAlAbrir, setEscucharAlAbrir] = useState<number | undefined>(undefined);
  const [vozAtendida, setVozAtendida] = useState(false);
  // "Apuntar" pone el cursor en la captura rápida (cambia el número cada vez).
  const [enfocar, setEnfocar] = useState<number | undefined>(undefined);
  if ((voz === '1') !== vozAtendida) {
    setVozAtendida(voz === '1');
    if (voz === '1') setEscucharAlAbrir((n) => (n ?? 0) + 1);
  }
  useEffect(() => {
    if (voz === '1') router.replace('/');
  }, [voz]);

  const nombre = perfil?.nombre ?? '';
  const rindeMas = perfil?.rindeMas ?? 'manana';

  // Lo de hoy con hora. Durante una época, lo que no quiere dejar de hacer cuenta como un
  // evento más y los bloques de estudio ocupan su tiempo al repartir las tareas.
  const delDia = [...eventosDelDia(eventos, hoy), ...(epoca ? imprescindiblesDelDia(epoca, hoy) : [])].sort(
    (a, b) => intervaloDe(a).inicio - intervaloDe(b).inicio,
  );
  const bloquesHoy = (plan?.bloques ?? []).filter((b) => b.dia === hoy && b.estado !== 'saltado');
  const ocupados = [...delDia.map(intervaloDe), ...bloquesHoy.map((b) => ({ inicio: b.inicio, fin: b.descansoFin }))];
  // Un plan de estudio sin Época dorada no cambia el horario de la persona.
  const ventana = epoca && esDorada(epoca) ? ventanaEpoca(epoca) : ventanaDelDia(perfil);
  const desde = Math.max(ventana.inicio, Math.ceil(minutosDelDia(ahora) / 15) * 15);
  const quedan = { inicio: desde, fin: ventana.fin };

  // Tareas de hoy, ordenadas por la matriz de Eisenhower y colocadas en los huecos libres.
  const pendientes = ordenarPorPrioridad(tareasPendientes(eventos, hoy, hoy));
  const reparto = repartirTareas(pendientes, duracionTarea, calcularHuecos(ocupados, quedan, 15), energia, rindeMas);
  const hechasHoy = eventos.filter((e) => e.flexible && e.hecha && e.fecha === hoy);
  const siguiente = siguienteEvento(eventos, ahora);
  const minutoActual = minutosDelDia(ahora);

  const filasTareas: FilaTareaLista[] = [
    ...reparto.colocadas.map((c) => ({
      tarea: c.tarea,
      detalle: `A las ${horaDesdeMinutos(c.inicio)} · ${formatearDuracion(duracionTarea(c.tarea))}`,
    })),
    ...reparto.sinHueco.map((tarea) => ({
      tarea,
      detalle: `Sin hueco hoy · ${formatearDuracion(duracionTarea(tarea))}`,
    })),
    ...reparto.paraManana.map((tarea) => ({
      tarea,
      detalle: 'Mejor mañana',
      apagada: true,
    })),
    ...hechasHoy.map((tarea) => ({ tarea, detalle: 'Hecha', apagada: true })),
  ];
  const nada = delDia.length === 0 && filasTareas.length === 0 && bloquesHoy.length === 0;

  return (
    <View style={estilos.contenedor}>
      <Pantalla contentContainerStyle={estilos.contenido}>
        {/* Cabecera: el saludo y el Perfil, y debajo el cuadro naranja con el día. */}
        <View style={estilos.cabecera}>
          <View style={estilos.cabeceraFila}>
            <Texto secundario style={estilos.fecha}>
              {saludoSegunHora(ahora, nombre)}
            </Texto>
            <BotonInicial nombre={nombre} onPress={() => router.push('/perfil')} />
          </View>
          <TarjetaDia siguiente={cargado ? siguiente : null} hoy={hoy} perfil={perfil} ahora={ahora} />
        </View>

        {/* Acciones rápidas, como en una app de banco: lo que más se hace, a un toque. */}
        <AccionesRapidas
          acciones={[
            {
              clave: 'apuntar',
              icono: 'add',
              texto: 'Apuntar',
              etiqueta: 'Apuntar algo',
              alPulsar: () => setEnfocar((n) => (n ?? 0) + 1),
            },
            {
              clave: 'dictar',
              icono: 'mic-outline',
              texto: 'Dictar',
              etiqueta: 'Apuntar algo con la voz',
              alPulsar: () => setEscucharAlAbrir((n) => (n ?? 0) + 1),
            },
            { clave: 'planes', icono: 'people-outline', texto: 'Planes', etiqueta: 'Abrir los planes', alPulsar: () => router.push('/planes') },
            { clave: 'alarmas', icono: 'alarm-outline', texto: 'Alarmas', etiqueta: 'Abrir las alarmas', alPulsar: () => router.push('/alarmas') },
          ]}
        />

        <CapturaRapida
          hoy={hoy}
          escucharAlAbrir={escucharAlAbrir}
          enfocar={enfocar}
          alRellenarAMano={() => nuevoEvento(hoy)}
        />
        <ResumenFinEpoca epocas={epocas} registro={registro} hoy={hoy} />

        {!cargado ? (
          <Texto secundario>Cargando tu día…</Texto>
        ) : (
          <>
            <ConfirmacionMovidas />
            <DesdeSiri />

            {nada ? (
              <View style={estilos.vacio}>
                <Ionicons name="sunny-outline" size={40} color={colores.textoSecundario} />
                <Texto secundario style={estilos.centrado}>
                  Hoy no tienes nada. Apunta algo arriba, por ejemplo «mañana pádel por la tarde».
                </Texto>
              </View>
            ) : null}

            {delDia.length > 0 ? (
              <LayoutAnimationConfig skipEntering>
                <View style={separacion}>
                  {delDia.map((evento) => (
                    <Animated.View key={evento.id} layout={RECOLOCAR} entering={APARECER} exiting={DESAPARECER}>
                      <FilaEvento evento={evento} pasado={intervaloDe(evento).fin <= minutoActual} />
                    </Animated.View>
                  ))}
                </View>
              </LayoutAnimationConfig>
            ) : null}

            {epoca && plan && bloquesHoy.length > 0 ? (
              <View style={estilos.seccion}>
                <Titulo nivel={2}>Estudio de hoy</Titulo>
                <PlanDeHoy
                  epoca={epoca}
                  plan={plan}
                  registro={registro}
                  perfil={perfil}
                  ahora={ahora}
                  energia={energia}
                />
              </View>
            ) : null}

            {filasTareas.length > 0 ? (
              <View style={estilos.seccion}>
                <Titulo nivel={2}>Tareas</Titulo>
                <LayoutAnimationConfig skipEntering>
                  <View style={separacion}>
                    {filasTareas.map((fila) => (
                      <Animated.View key={fila.tarea.id} layout={RECOLOCAR} entering={APARECER} exiting={DESAPARECER}>
                        <FilaTarea {...fila} />
                      </Animated.View>
                    ))}
                    {reparto.paraManana.length > 0 ? (
                      <Animated.View key="pasar-a-manana" layout={RECOLOCAR}>
                        <Boton
                          variante="secundario"
                          titulo={`Pasar el resto a mañana (${reparto.paraManana.length})`}
                          onPress={() =>
                            moverTareas(
                              reparto.paraManana.map((t) => t.id),
                              sumarDias(hoy, 1),
                            )
                          }
                        />
                      </Animated.View>
                    ) : null}
                  </View>
                </LayoutAnimationConfig>
              </View>
            ) : null}
          </>
        )}
        {/* Solo en la web del móvil: cómo guardarla en la pantalla de inicio. Abajo, para no tapar el día. */}
        <AvisoPantallaInicio />
      </Pantalla>
    </View>
  );
}

// El cuadro naranja de arriba (27/10/2026, lo pidió el usuario): el día en grande
// ("Martes 27 oct"), como el saldo de una cuenta, y debajo lo siguiente que tienes
// (aunque sea mañana), con "Cómo llegar". Texto oscuro encima del degradado.
type PropsDia = {
  siguiente: Siguiente | null;
  hoy: string;
  perfil: Perfil | null;
  ahora: Date;
};

function TarjetaDia({ siguiente, hoy, perfil, ahora }: PropsDia) {
  const dia = formatearDiaCorto(ahora);
  const titular = dia.charAt(0).toLocaleUpperCase('es-ES') + dia.slice(1).toLocaleLowerCase('es-ES');
  return (
    <Tarjeta destacada="naranja" style={estilos.siguiente}>
      <Titulo style={estilos.cifra}>{titular}</Titulo>
      {siguiente ? (
        <LoSiguiente siguiente={siguiente} hoy={hoy} perfil={perfil} ahora={ahora} />
      ) : (
        <Texto style={estilos.sobreDegradado}>No tienes nada más apuntado.</Texto>
      )}
    </Tarjeta>
  );
}

function LoSiguiente({ siguiente, hoy, perfil, ahora }: PropsDia & { siguiente: Siguiente }) {
  const { evento, dia, enCurso } = siguiente;
  const cuando = enCurso
    ? 'Ahora mismo'
    : dia === hoy
      ? 'Lo siguiente'
      : dia === sumarDias(hoy, 1)
        ? 'Mañana'
        : formatearDiaCorto(fechaDesdeClave(dia));
  // Nombre del sitio (Casa, Trabajo...) y su dirección.
  const lugar = resolverLugar(evento.lugar, perfil);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cuando}: ${evento.titulo}, ${rangoHoras(evento)}`}
        onPress={() => abrirEvento(evento.id)}
        style={({ pressed }) => [estilos.siguienteTextos, pressed && estilos.pulsado]}>
        <Texto pequeno style={estilos.cuando}>
          {cuando} · {rangoHoras(evento)}
        </Texto>
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
    </>
  );
}

function FilaTarea({ tarea, detalle, apagada }: FilaTareaLista) {
  const { medidas } = useDensidad();
  return (
    <View
      style={[
        estilos.tarea,
        { borderLeftColor: apagada ? colores.borde : colorEvento(tarea) },
        {
          minHeight: medidas.altoFila,
          paddingVertical: Math.max(medidas.rellenoFila - 4, 0),
        },
        apagada && estilos.apagada,
      ]}>
      <Casilla
        marcada={tarea.hecha}
        alCambiar={(hecha) => marcarHecha(tarea.id, hecha)}
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
  fecha: { fontFamily: fuentes.textoMedio },
  seccion: { gap: espacio.m, marginTop: espacio.s },
  vacio: { alignItems: 'center', gap: espacio.s, paddingVertical: espacio.xl },
  centrado: { textAlign: 'center' },
  siguiente: { gap: espacio.s },
  siguienteTextos: { gap: 2 },
  cuando: {
    color: colores.textoOscuro,
    fontFamily: fuentes.textoFuerte,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // El día, en grande y apretado, como el saldo de una cuenta.
  cifra: {
    color: colores.textoOscuro,
    fontFamily: fuentes.tituloFuerte,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.6,
  },
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
