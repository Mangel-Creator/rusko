import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';

import type { Punto } from '@/services/rutas';
import { colores, coloresMapa, fuentes } from '@/theme';

import { CENTRO_POR_DEFECTO, puntosDeTramo, puntosVisibles, type PropsMapa } from './tipos';

// Mapa del móvil con react-native-maps (viene en Expo Go, sin claves): en el iPhone
// es el mapa de Apple y en Android el de Google. "showsTraffic" pinta el tráfico de
// todas las carreteras, como Waze. Encima va la ruta elegida con sus tramos de
// tráfico, las alternativas en gris y, si los has pedido, los parkings ("P").
// En la web se usa MapaRuta.web.tsx.

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
        showsUserLocation
        showsTraffic
        showsPointsOfInterests={false}
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
          <Polyline coordinates={ruta.puntos.map(aLatLng)} strokeColor={coloresMapa.ruta} strokeWidth={6} zIndex={2} />
        ) : null}
        {ruta?.tramos.map((t, i) => (
          <Polyline
            key={`tramo-${i}`}
            coordinates={puntosDeTramo(ruta, t.desde, t.hasta).map(aLatLng)}
            strokeColor={t.nivel === 'atasco' ? coloresMapa.atasco : coloresMapa.denso}
            strokeWidth={6}
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
        {destino ? <Marker coordinate={aLatLng(destino)} pinColor={colores.principal} title="Destino" /> : null}
      </MapView>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { overflow: 'hidden', backgroundColor: colores.borde },
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
});
