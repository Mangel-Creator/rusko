import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';

import { AvisoPantallaInicio, Boton, BotonInicial, Casilla, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
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
import { imprescindiblesDelDia, ventanaEpoca } from '@/services/epoca';
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
import { cifras, colores, colorEvento, espacio, fuentes, radio, tamanos } from '@/theme';

import { CapturaRapida } from './captura/CapturaRapida';
import { ConfirmacionMovidas } from './calendario/ConfirmacionMovidas';
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

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

type FilaTareaLista = { tarea: Evento; detalle: string; apagada?: boolean };

// Hoy (26/10/2026, lo pidió el usuario: "quita todo y que solo aparezcan las cosas que
// tienes ese día"): la fecha, la captura rápida siempre a mano y, debajo, lo de hoy por
// orden de hora. Lo siguiente sale en su sitio como la tarjeta naranja. Luego las tareas
// del día y, si hay época dorada, su estudio. Planes y Alarmas, en los dos círculos de arriba.
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
  const ventana = epoca ? ventanaEpoca(epoca) : ventanaDelDia(perfil);
  const desde = Math.max(ventana.inicio, Math.ceil(minutosDelDia(ahora) / 15) * 15);
  const quedan = { inicio: desde, fin: ventana.fin };

  // Tareas de hoy, ordenadas por la matriz de Eisenhower y colocadas en los huecos libres.
  const pendientes = ordenarPorPrioridad(tareasPendientes(eventos, hoy, hoy));
  const reparto = repartirTareas(pendientes, duracionTarea, calcularHuecos(ocupados, quedan, 15), energia, rindeMas);
  const hechasHoy = eventos.filter((e) => e.flexible && e.hecha && e.fecha === hoy);
  const siguiente = siguienteEvento(eventos, ahora);
  const siguienteHoy = siguiente && siguiente.dia === hoy ? siguiente : null;
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
        {/* Cabecera: la fecha en grande, Planes y Alarmas a un toque y el Perfil. */}
        <View style={estilos.cabecera}>
          <View style={estilos.cabeceraTextos}>
            <Texto secundario style={estilos.saludo}>
              {saludoSegunHora(ahora, nombre)}
            </Texto>
            <Titulo style={estilos.fecha}>{formatearDiaCorto(ahora)}</Titulo>
          </View>
          <BotonRedondo icono="people-outline" etiqueta="Planes" onPress={() => router.push('/planes')} />
          <BotonRedondo icono="alarm-outline" etiqueta="Alarmas" onPress={() => router.push('/alarmas')} />
          <BotonInicial nombre={nombre} onPress={() => router.push('/perfil')} />
        </View>

        <CapturaRapida hoy={hoy} escucharAlAbrir={escucharAlAbrir} alRellenarAMano={() => nuevoEvento(hoy)} />
        <ResumenFinEpoca epocas={epocas} registro={registro} hoy={hoy} />

        {!cargado ? (
          <Texto secundario>Cargando tu día…</Texto>
        ) : (
          <>
            <ConfirmacionMovidas />

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
                      {siguienteHoy && siguienteHoy.evento.id === evento.id ? (
                        <TarjetaSiguiente siguiente={siguienteHoy} hoy={hoy} perfil={perfil} ahora={ahora} />
                      ) : (
                        <FilaEvento evento={evento} pasado={intervaloDe(evento).fin <= minutoActual} />
                      )}
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

// Círculo con icono de la cabecera (Planes, Alarmas).
function BotonRedondo({ icono, etiqueta, onPress }: { icono: NombreIcono; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [estilos.redondo, pressed && estilos.redondoPulsado]}>
      <Ionicons name={icono} size={22} color={colores.texto} />
    </Pressable>
  );
}

// Lo siguiente (o lo que está en curso): la tarjeta destacada de Hoy, con degradado
// naranja y la hora en grande, como el saldo de una cuenta. Texto oscuro encima.
type PropsSiguiente = {
  siguiente: Siguiente;
  hoy: string;
  perfil: Perfil | null;
  ahora: Date;
};

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
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  cabeceraTextos: { flex: 1, gap: 2 },
  saludo: { fontFamily: fuentes.textoMedio },
  // La fecha, grande y apretada, como el titular de la página.
  fecha: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    textTransform: 'capitalize',
  },
  redondo: {
    width: 44,
    height: 44,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redondoPulsado: {
    backgroundColor: colores.borde,
    transform: [{ scale: 0.96 }],
  },
  seccion: { gap: espacio.m, marginTop: espacio.s },
  vacio: { alignItems: 'center', gap: espacio.s, paddingVertical: espacio.xl },
  centrado: { textAlign: 'center' },
  siguiente: {},
  siguienteTextos: { gap: 2 },
  cuando: {
    color: colores.textoOscuro,
    fontFamily: fuentes.textoFuerte,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  cifra: {
    ...cifras,
    color: colores.textoOscuro,
    fontFamily: fuentes.tituloFuerte,
    fontSize: tamanos.cifra + 8,
    lineHeight: tamanos.cifra + 14,
    letterSpacing: -2,
  },
  hasta: {
    ...cifras,
    color: colores.textoOscuro,
    fontFamily: fuentes.textoMedio,
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
