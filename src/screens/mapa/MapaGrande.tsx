import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, type ComponentProps } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Texto, Titulo } from '@/components';
import { formatearHora } from '@/services/fechas';
import {
  distanciaCorta,
  horaDeLlegada,
  textoDistancia,
  textoDuracion,
  textoInstruccion,
  textoRetraso,
  type Instruccion,
} from '@/services/rutas';
import { cambiarVoz, terminarNavegacion, useNavegacion } from '@/services/rutas/motorNavegacion';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { useAhora } from '../calendario/useAhora';
import { MapaRuta } from './MapaRuta';
import type { PropsMapa } from './tipos';

// El mapa a pantalla completa (fase 6), en dos modos:
//   - "ver": el mapa en grande con las rutas y el botón "Empezar".
//   - navegando (cuando hay una navegación activa): el mapa va contigo, arriba la
//     siguiente indicación y abajo lo que queda. Mientras está abierto, la pantalla
//     no se apaga (expo-keep-awake).

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

function iconoManiobra(i: Instruccion | null): NombreIcono {
  const m = i?.maniobra ?? '';
  if (m.startsWith('ARRIVE')) return 'flag';
  if (m.startsWith('ROUNDABOUT')) return 'refresh';
  if (m.includes('UTURN')) return 'arrow-undo';
  if (m === 'TURN_LEFT' || m === 'SHARP_LEFT') return 'arrow-back';
  if (m === 'TURN_RIGHT' || m === 'SHARP_RIGHT') return 'arrow-forward';
  if (m.endsWith('LEFT')) return 'return-up-back';
  if (m.endsWith('RIGHT') || m === 'TAKE_EXIT') return 'return-up-forward';
  return 'arrow-up';
}

type Props = PropsMapa & {
  visible: boolean;
  nombreDestino: string;
  alCerrar: () => void;
  alEmpezar: (() => void) | null; // null si no se puede navegar (sin ruta)
};

export function MapaGrande({ visible, nombreDestino, alCerrar, alEmpezar, ...mapa }: Props) {
  const navegacion = useNavegacion();
  const insets = useSafeAreaInsets();
  const navegando = navegacion.activa;
  const ruta = mapa.rutas[mapa.elegida];

  return (
    <Modal
      visible={visible || navegando}
      animationType="slide"
      onRequestClose={navegando ? terminarNavegacion : alCerrar}
      supportedOrientations={['portrait']}>
      <View style={estilos.pantalla}>
        {navegando ? (
          <>
            <MantenerEncendida />
            <MapaRuta
              {...mapa}
              style={StyleSheet.absoluteFill}
              rutas={navegacion.ruta ? [navegacion.ruta] : []}
              elegida={0}
              radares={navegacion.radares.map((r) => r.radar)}
              ubicacion={navegacion.posicion ?? mapa.ubicacion}
              destino={navegacion.destino}
              seguir
            />
          </>
        ) : (
          <MapaRuta {...mapa} style={StyleSheet.absoluteFill} />
        )}

        {/* Arriba: la siguiente indicación o el botón para cerrar. */}
        <View style={[estilos.arriba, { paddingTop: insets.top + espacio.s }]} pointerEvents="box-none">
          {navegando ? (
            <BannerIndicacion />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar el mapa grande"
              onPress={alCerrar}
              style={({ pressed }) => [estilos.cerrar, pressed && estilos.pulsado]}>
              <Ionicons name="contract" size={20} color={colores.texto} />
              <Texto fuerte>Cerrar</Texto>
            </Pressable>
          )}
        </View>

        {/* Abajo: lo que queda y los botones. */}
        <View style={[estilos.abajo, { paddingBottom: insets.bottom + espacio.m }]}>
          {navegando ? (
            <PanelNavegacion />
          ) : (
            <>
              <Titulo nivel={3} numberOfLines={1}>
                {nombreDestino}
              </Titulo>
              {ruta ? (
                <Texto secundario>
                  {textoDuracion(ruta.duracionSeg)}
                  {textoRetraso(ruta.retrasoSeg) ? ` (${textoRetraso(ruta.retrasoSeg)} por el tráfico)` : ''} ·{' '}
                  {textoDistancia(ruta.distanciaM)}
                </Texto>
              ) : null}
              {alEmpezar ? <Boton titulo="Empezar" onPress={alEmpezar} /> : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Mientras se navega, la pantalla no se apaga sola. Si el navegador no lo permite
// (algunos no dejan), se sigue navegando igual, sin errores.
const ETIQUETA_ENCENDIDA = 'organizy-navegacion';

function MantenerEncendida() {
  useEffect(() => {
    activateKeepAwakeAsync(ETIQUETA_ENCENDIDA).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(ETIQUETA_ENCENDIDA))
        .catch(() => {});
    };
  }, []);
  return null;
}

function BannerIndicacion() {
  const { guia, recalculando, error } = useNavegacion();
  const siguiente = guia?.siguiente ?? null;
  let titulo = 'Buscando tu posición…';
  let detalle: string | null = null;
  if (recalculando || guia?.fueraDeRuta) titulo = 'Recalculando…';
  else if (guia?.llegado) titulo = 'Has llegado';
  else if (siguiente && guia) {
    titulo = distanciaCorta(guia.distanciaASiguienteM);
    detalle = textoInstruccion(siguiente);
  }
  const radar = guia?.proximoRadar && guia.distanciaARadarM <= 1000 ? guia.proximoRadar : null;

  return (
    <View style={estilos.banner} accessibilityLiveRegion="polite">
      <View style={estilos.bannerFila}>
        <Ionicons name={iconoManiobra(guia?.llegado ? null : siguiente)} size={36} color={colores.textoSobreTinta} />
        <View style={estilos.bannerTextos}>
          <Texto style={estilos.bannerDistancia}>{titulo}</Texto>
          {detalle ? <Texto style={estilos.bannerTexto}>{detalle}</Texto> : null}
        </View>
      </View>
      {radar && guia ? (
        <Texto style={estilos.bannerRadar}>
          {radar.radar.tipo === 'tramo' ? 'Tramo de velocidad media' : 'Radar'} a {distanciaCorta(guia.distanciaARadarM)}
          {radar.radar.limite ? ` · ${radar.radar.limite} km/h` : ''}
        </Texto>
      ) : null}
      {error ? <Texto style={estilos.bannerRadar}>{error}</Texto> : null}
    </View>
  );
}

function PanelNavegacion() {
  const { guia, voz, enFondo, nombreDestino } = useNavegacion();
  const ahora = useAhora();
  const quedan = guia
    ? `${textoDuracion(guia.restanteSeg)} · ${distanciaCorta(guia.restanteM)} · llegas a las ${formatearHora(horaDeLlegada(ahora, guia.restanteSeg))}`
    : nombreDestino;
  return (
    <>
      <Texto fuerte style={estilos.quedan}>
        {quedan}
      </Texto>
      <View style={estilos.botones}>
        <View style={estilos.boton}>
          <Boton
            variante="secundario"
            titulo={voz ? 'Voz: sí' : 'Voz: no'}
            accessibilityLabel={voz ? 'Quitar la voz' : 'Poner la voz'}
            onPress={() => cambiarVoz(!voz)}
          />
        </View>
        <View style={estilos.boton}>
          <Boton titulo="Terminar" onPress={terminarNavegacion} />
        </View>
      </View>
      {enFondo ? null : (
        <Texto pequeno secundario>
          {Platform.OS === 'web'
            ? 'La pantalla se queda encendida mientras navegas. Si bloqueas el móvil, el navegador deja de darte indicaciones.'
            : 'La pantalla se queda encendida mientras navegas. Con el móvil bloqueado, Expo Go deja de darte indicaciones (la app propia sí seguirá).'}
        </Texto>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.borde },
  // El botón "Cerrar" va a la derecha: a la izquierda están los botones de zoom de la web.
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: espacio.m, alignItems: 'flex-end' },
  cerrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.chip,
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  banner: {
    alignSelf: 'stretch',
    backgroundColor: colores.tinta,
    borderRadius: radio.grande,
    padding: espacio.m,
    gap: espacio.xs,
  },
  bannerFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  bannerTextos: { flex: 1 },
  bannerDistancia: {
    color: colores.textoSobreTinta,
    ...cifras, fontFamily: fuentes.horaFuerte,
    fontSize: tamanos.tituloGrande,
    lineHeight: 36,
  },
  bannerTexto: { color: colores.textoSobreTinta, fontSize: tamanos.grande, lineHeight: 24 },
  bannerRadar: { color: colores.textoSecundarioSobreTinta, ...cifras, fontFamily: fuentes.hora, fontSize: tamanos.pequeno },
  abajo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colores.fondo,
    borderTopLeftRadius: radio.grande,
    borderTopRightRadius: radio.grande,
    paddingHorizontal: espacio.l,
    paddingTop: espacio.m,
    gap: espacio.s,
  },
  quedan: { ...cifras, fontFamily: fuentes.horaFuerte },
  botones: { flexDirection: 'row', gap: espacio.s },
  boton: { flex: 1 },
});
