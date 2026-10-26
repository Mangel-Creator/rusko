import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { textoDistancia, textoDuracion, textoRadares, textoRetraso, type Ruta } from '@/services/rutas';
import { alturaTactil, cifras, colores, coloresMapa, espacio, fuentes, radio, tamanos } from '@/theme';

import type { Destino } from './destinos';

// Piezas pequeñas de la pantalla Mapa.

// Leyenda: Atasco, Denso y Radar.
export function Leyenda() {
  return (
    <View style={estilos.leyenda} accessibilityRole="text" accessibilityLabel="Leyenda: rojo atasco, amarillo denso, círculo negro radar">
      <View style={estilos.elemento}>
        <View style={[estilos.linea, { backgroundColor: coloresMapa.atasco }]} />
        <Texto pequeno>Atasco</Texto>
      </View>
      <View style={estilos.elemento}>
        <View style={[estilos.linea, { backgroundColor: coloresMapa.denso }]} />
        <Texto pequeno>Denso</Texto>
      </View>
      <View style={estilos.elemento}>
        <View style={estilos.radar} />
        <Texto pequeno>Radar</Texto>
      </View>
    </View>
  );
}

// Un destino propuesto bajo el buscador.
export function FilaDestino({ destino, alPulsar }: { destino: Destino; alPulsar: () => void }) {
  const icono = destino.cita ? 'calendar-outline' : destino.id === 'casa' ? 'home-outline' : 'location-outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${destino.nombre}. ${destino.detalle}`}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={20} color={colores.textoSecundario} />
      <View style={estilos.filaTextos}>
        <Texto fuerte numberOfLines={1}>
          {destino.nombre}
        </Texto>
        {destino.detalle ? (
          <Texto pequeno secundario numberOfLines={1}>
            {destino.detalle}
          </Texto>
        ) : null}
      </View>
    </Pressable>
  );
}

type PropsTarjetaRuta = { ruta: Ruta; radares: number; elegida: boolean; numero: number; alPulsar: () => void };

// Una de las rutas: duración, retraso por el tráfico, distancia y radares.
export function TarjetaRuta({ ruta, radares, elegida, numero, alPulsar }: PropsTarjetaRuta) {
  const retraso = textoRetraso(ruta.retrasoSeg);
  const detalle = `${textoDistancia(ruta.distanciaM)} · ${textoRadares(radares)}`;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: elegida }}
      accessibilityLabel={`Ruta ${numero}: ${textoDuracion(ruta.duracionSeg)}${retraso ? `, ${retraso} por el tráfico` : ''}, ${detalle}`}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.ruta,
        { borderLeftColor: elegida ? colores.principal : colores.borde },
        pressed && estilos.pulsado,
      ]}>
      <View style={estilos.rutaArriba}>
        <Texto style={estilos.duracion}>{textoDuracion(ruta.duracionSeg)}</Texto>
        {retraso ? <Texto style={estilos.retraso}>{retraso}</Texto> : <Texto pequeno secundario>Sin retrasos</Texto>}
      </View>
      <Texto pequeno secundario>
        {detalle}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  leyenda: { flexDirection: 'row', gap: espacio.m, alignItems: 'center', flexWrap: 'wrap' },
  elemento: { flexDirection: 'row', gap: espacio.xs, alignItems: 'center' },
  linea: { width: 18, height: 5, borderRadius: radio.chip },
  radar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: coloresMapa.radar,
    borderWidth: 2,
    borderColor: coloresMapa.bordeRadar,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s + 4,
    minHeight: alturaTactil + 8,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande - 4,
  },
  filaTextos: { flex: 1 },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  ruta: {
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
    borderRadius: radio.grande - 4,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s + 2,
    minHeight: alturaTactil + 12,
    gap: 2,
  },
  rutaArriba: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  duracion: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: tamanos.grande, lineHeight: 24 },
  retraso: { ...cifras, fontFamily: fuentes.hora, fontSize: tamanos.normal, color: colores.aviso },
});
