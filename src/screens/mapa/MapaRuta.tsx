import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';

import type { Punto } from '@/services/rutas';
import { cifras, colores, coloresMapa, fuentes } from '@/theme';

import { CENTRO_POR_DEFECTO, marcasDeRadares, puntosDeTramo, puntosVisibles, type PropsMapa } from './tipos';

// Mapa del móvil con react-native-maps (viene en Expo Go, sin claves): en el iPhone
// es el mapa de Apple y en Android el de Google. "showsTraffic" pinta el tráfico de
// todas las carreteras, como Waze. Encima va la ruta elegida con sus tramos de
// tráfico, las alternativas en gris y los radares.
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
  radares,
  centroInicial,
  seguir,
  style,
}: PropsMapa) {
  const mapa = useRef<MapView>(null);
  const ruta = rutas[elegida];

  // Navegando: la cámara va contigo, de cerca y un poco inclinada.
  const aqui = seguir ? ubicacion : null;
  useEffect(() => {
    if (!aqui) return;
    mapa.current?.animateCamera({ center: aLatLng(aqui), zoom: 17, pitch: 40 }, { duration: 800 });
  }, [aqui]);

  // Encuadra la ruta (o tu posición y el destino) cada vez que cambian.
  const visibles = puntosVisibles({ ubicacion, destino, rutas });
  const huella = `${visibles.length}:${visibles[0]?.join()}:${visibles[visibles.length - 1]?.join()}`;
  useEffect(() => {
    if (seguir || visibles.length === 0) return;
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
        {marcasDeRadares(radares).map((m) => (
          <Marker
            key={m.clave}
            coordinate={aLatLng(m.punto)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={m.titulo}
            description={m.detalle}>
            <View style={[estilos.radar, m.limite ? estilos.radarConLimite : null]}>
              {m.limite ? <Text style={estilos.limite}>{m.limite}</Text> : null}
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
  radar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: coloresMapa.radar,
    borderWidth: 3,
    borderColor: coloresMapa.bordeRadar,
  },
  // Con límite: más grande, con el número dentro (como una señal).
  radarConLimite: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  limite: { color: coloresMapa.bordeRadar, ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 11 },
});
