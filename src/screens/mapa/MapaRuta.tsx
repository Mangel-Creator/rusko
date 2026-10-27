import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';

import type { Punto } from '@/services/rutas';
import { coloresMapa, fuentes } from '@/theme';

import { CENTRO_POR_DEFECTO, puntosDeTramo, puntosVisibles, type PropsMapa } from './tipos';

// Mapa del móvil con react-native-maps (viene en Expo Go, sin claves): en el iPhone
// es el mapa de Apple y en Android el de Google. "showsTraffic" pinta el tráfico de
// todas las carreteras, como Waze. Encima va la ruta elegida con sus tramos de
// tráfico, las alternativas en gris y, si los has pedido, los parkings ("P").
// En la web se usa MapaRuta.web.tsx.
//
// Estilo "navegador" (27/10/2026, el usuario lo quería así, con una imagen de ejemplo):
// ruta blanca con halo cian y marcas cian. El mapa de Apple no deja cambiar sus colores
// (la web sí lo pinta de azul marino): aquí va oscuro y "apagado" (mutedStandard), que
// quita colores y detalles para que destaquen la ruta y el tráfico. Sin brújula ni
// sitios de interés.

// Halo de la ruta: el cian de las marcas al 25 %.
const HALO_RUTA = `${coloresMapa.halo}40`;

function aLatLng([latitude, longitude]: Punto): LatLng {
  return { latitude, longitude };
}

export function MapaRuta({
  ubicacion,
  destino,
  rutas,
  elegida,
  alElegir,
  parkings,
  parkingElegido,
  centroInicial,
  style,
}: PropsMapa) {
  const mapa = useRef<MapView>(null);
  const ruta = rutas[elegida];

  // Encuadra la ruta (o tu posición y el destino) cada vez que cambian.
  const visibles = puntosVisibles({ ubicacion, destino, rutas, parkings });
  const huella = `${visibles.length}:${visibles[0]?.join()}:${visibles[visibles.length - 1]?.join()}`;
  useEffect(() => {
    if (visibles.length === 0) return;
    if (visibles.length === 1) {
      mapa.current?.animateToRegion({ ...aLatLng(visibles[0]), latitudeDelta: 0.05, longitudeDelta: 0.05 });
      return;
    }
    mapa.current?.fitToCoordinates(visibles.map(aLatLng), {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
    // Solo al cambiar la huella (no en cada pintado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella]);

  const centro = ubicacion ?? destino ?? centroInicial ?? CENTRO_POR_DEFECTO;

  return (
    <View style={[estilos.contenedor, style]}>
      <MapView
        ref={mapa}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...aLatLng(centro),
          latitudeDelta: ubicacion || destino || centroInicial ? 0.08 : 6,
          longitudeDelta: ubicacion || destino || centroInicial ? 0.08 : 6,
        }}
        userInterfaceStyle="dark"
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsUserLocation
        showsTraffic
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}>
        {rutas.map((r, i) =>
          i === elegida ? null : (
            <Polyline
              key={`alternativa-${i}`}
              coordinates={r.puntos.map(aLatLng)}
              strokeColor={coloresMapa.rutaAlternativa}
              strokeWidth={5}
              tappable
              onPress={() => alElegir(i)}
              zIndex={1}
            />
          ),
        )}
        {ruta ? (
          <Polyline
            coordinates={ruta.puntos.map(aLatLng)}
            strokeColor={HALO_RUTA}
            strokeWidth={14}
            zIndex={2}
          />
        ) : null}
        {ruta ? (
          <Polyline coordinates={ruta.puntos.map(aLatLng)} strokeColor={coloresMapa.ruta} strokeWidth={5} zIndex={2} />
        ) : null}
        {ruta?.tramos.map((t, i) => (
          <Polyline
            key={`tramo-${i}`}
            coordinates={puntosDeTramo(ruta, t.desde, t.hasta).map(aLatLng)}
            strokeColor={t.nivel === 'atasco' ? coloresMapa.atasco : coloresMapa.denso}
            strokeWidth={5}
            zIndex={3}
          />
        ))}
        {parkings.map((p) => (
          <Marker
            // Con la clave cambia al elegirlo: tracksViewChanges={false} no lo repintaría.
            key={`${p.id}:${p.id === parkingElegido}`}
            coordinate={aLatLng(p.punto)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={p.nombre}
            description={p.direccion}>
            <View style={[estilos.parking, p.id === parkingElegido && estilos.parkingElegido]}>
              <Text style={estilos.letraP}>P</Text>
            </View>
          </Marker>
        ))}
        {ruta && !ubicacion ? (
          // Salida (si no se sabe dónde estás, la ruta sale de casa): un aro cian.
          <Marker coordinate={aLatLng(ruta.puntos[0])} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={estilos.salida} />
          </Marker>
        ) : null}
        {destino ? (
          // Destino: chincheta cian con un aro en la base.
          <Marker
            coordinate={aLatLng(destino)}
            anchor={{ x: 0.5, y: 0.9 }}
            tracksViewChanges={false}
            title="Destino">
            <View style={estilos.destino}>
              <Ionicons name="location" size={36} color={coloresMapa.halo} />
              <View style={estilos.destinoAro} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { overflow: 'hidden', backgroundColor: coloresMapa.fondo },
  // "P" blanca en un cuadrado azul, como las señales de aparcamiento.
  parking: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: coloresMapa.parking,
    borderWidth: 2,
    borderColor: coloresMapa.bordeParking,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingElegido: { width: 34, height: 34, borderRadius: 8, borderWidth: 3 },
  letraP: { color: coloresMapa.bordeParking, fontFamily: fuentes.textoFuerte, fontSize: 14 },
  salida: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: coloresMapa.halo,
    backgroundColor: coloresMapa.fondo,
  },
  destino: { width: 40, height: 46, alignItems: 'center' },
  destinoAro: {
    width: 22,
    height: 8,
    marginTop: -6,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: coloresMapa.halo,
  },
});
