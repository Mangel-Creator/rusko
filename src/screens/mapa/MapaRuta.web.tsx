import 'leaflet/dist/leaflet.css';

import type * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';

import { colores, coloresMapa, fuentes } from '@/theme';

import { CENTRO_POR_DEFECTO, puntosDeTramo, puntosVisibles, type PropsMapa } from './tipos';

// Mapa de la web con Leaflet. Leaflet necesita el navegador, así que se carga al
// montar el componente (no al compilar la web estática).
//
// Capa de tráfico de todas las carreteras: TomTom, con una clave
// PÚBLICA restringida a la web de Organizy y solo a mapas (EXPO_PUBLIC_TOMTOM_MAPA_KEY).
// Esa clave no sirve para calcular rutas (eso va por el servidor) y, como la cuenta de
// TomTom no tiene tarjeta, no puede generar gasto. Sin ella no hay capa de tráfico
// (solo los tramos de la ruta).

const CLAVE_MAPA = process.env.EXPO_PUBLIC_TOMTOM_MAPA_KEY ?? '';

// Fondo oscuro (27/10/2026, el usuario lo quería "más moderno, no de cartografía"):
// con la clave, el estilo nocturno de TomTom y su tráfico para fondos oscuros; sin
// ella, el mapa de OpenStreetMap pasado a oscuro con un filtro (CARTO y Stadia, que lo
// dan ya oscuro, piden cuenta y clave). Los dos van algo apagados para que destaquen
// la ruta y el tráfico.
const ATRIBUCION_OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ATRIBUCION_TOMTOM = '© <a href="https://www.tomtom.com">TomTom</a>';

// Los botones + y − y la atribución de Leaflet vienen blancos y cuadrados: se pasan al
// estilo de la app (redondos y oscuros). Se añade una vez al documento.
const CSS_MAPA = `
.organizy-mapa { background: ${colores.fondo}; font-family: ${fuentes.texto}, sans-serif; }
.organizy-fondo-osm { filter: invert(1) hue-rotate(180deg) grayscale(0.85) brightness(0.8) contrast(1.15); }
.organizy-fondo-tomtom { filter: grayscale(0.7) brightness(0.9); }
.organizy-mapa .leaflet-bar { border: none; box-shadow: none; }
.organizy-mapa .leaflet-bar a, .organizy-mapa .leaflet-bar a:first-child, .organizy-mapa .leaflet-bar a:last-child {
  width: 40px; height: 40px; line-height: 40px; margin-bottom: 8px;
  border: none; border-radius: 20px; background: ${colores.elevado}; color: ${colores.texto};
  font: 400 22px ${fuentes.texto}, sans-serif;
}
.organizy-mapa .leaflet-bar a:hover { background: ${colores.tintaSuave}; color: ${colores.texto}; }
.organizy-mapa .leaflet-bar a.leaflet-disabled { background: ${colores.tarjeta}; color: ${colores.textoSecundario}; }
.organizy-mapa .leaflet-control-attribution {
  background: rgba(15, 13, 12, 0.7); color: ${colores.textoSecundario};
  border-radius: 8px 0 0 0; font-size: 10px;
}
.organizy-mapa .leaflet-control-attribution a { color: ${colores.texto}; }
.organizy-mapa .leaflet-tooltip {
  background: ${colores.elevado}; color: ${colores.texto}; border: none; border-radius: 10px;
  box-shadow: none; font: 500 13px ${fuentes.texto}, sans-serif;
}
.organizy-mapa .leaflet-tooltip-top:before { border-top-color: ${colores.elevado}; }
.organizy-mapa .leaflet-tooltip-bottom:before { border-bottom-color: ${colores.elevado}; }
.organizy-mapa .leaflet-tooltip-left:before { border-left-color: ${colores.elevado}; }
.organizy-mapa .leaflet-tooltip-right:before { border-right-color: ${colores.elevado}; }
`;

function ponerEstilos() {
  if (document.getElementById('organizy-mapa-css')) return;
  const estilo = document.createElement('style');
  estilo.id = 'organizy-mapa-css';
  estilo.textContent = CSS_MAPA;
  document.head.appendChild(estilo);
}

type Capas = { rutas: L.LayerGroup; parkings: L.LayerGroup; marcas: L.LayerGroup };

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
  const contenedor = useRef<HostInstance>(null);
  const [leaflet, setLeaflet] = useState<typeof L | null>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<Capas | null>(null);

  // Crear el mapa una vez.
  useEffect(() => {
    let cancelado = false;
    let observador: ResizeObserver | null = null;
    import('leaflet').then((modulo) => {
      const Lf = (modulo as unknown as { default?: typeof L }).default ?? (modulo as unknown as typeof L);
      const nodo = contenedor.current as unknown as HTMLElement | null;
      if (cancelado || !nodo) return;
      const centro = ubicacion ?? destino ?? centroInicial ?? CENTRO_POR_DEFECTO;
      const m = Lf.map(nodo, { zoomControl: true, attributionControl: true }).setView(
        centro,
        ubicacion || destino || centroInicial ? 13 : 6,
      );
      ponerEstilos();
      nodo.classList.add('organizy-mapa');
      m.attributionControl.setPrefix(false);
      if (CLAVE_MAPA) {
        Lf.tileLayer(`https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${CLAVE_MAPA}&language=es-ES`, {
          maxZoom: 19,
          className: 'organizy-fondo-tomtom',
          attribution: ATRIBUCION_TOMTOM,
        }).addTo(m);
        Lf.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0-dark/{z}/{x}/{y}.png?key=${CLAVE_MAPA}`, {
          maxZoom: 19,
          opacity: 0.9,
        }).addTo(m);
      } else {
        Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          className: 'organizy-fondo-osm',
          attribution: ATRIBUCION_OSM,
        }).addTo(m);
      }
      capas.current = {
        rutas: Lf.layerGroup().addTo(m),
        parkings: Lf.layerGroup().addTo(m),
        marcas: Lf.layerGroup().addTo(m),
      };
      mapa.current = m;
      // Si cambia el tamaño, Leaflet se recoloca.
      observador = new ResizeObserver(() => m.invalidateSize());
      observador.observe(nodo);
      setLeaflet(Lf);
    });
    return () => {
      cancelado = true;
      observador?.disconnect();
      mapa.current?.remove();
      mapa.current = null;
      capas.current = null;
    };
    // Solo al montar: lo demás se actualiza en los efectos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rutas, tramos de tráfico, parkings y marcas.
  useEffect(() => {
    const Lf = leaflet;
    const c = capas.current;
    if (!Lf || !c) return;
    c.rutas.clearLayers();
    c.parkings.clearLayers();
    c.marcas.clearLayers();

    rutas.forEach((r, i) => {
      if (i === elegida) return;
      Lf.polyline(r.puntos, { color: coloresMapa.rutaAlternativa, weight: 6, opacity: 0.9 })
        .on('click', () => alElegir(i))
        .addTo(c.rutas);
    });
    const ruta = rutas[elegida];
    if (ruta) {
      Lf.polyline(ruta.puntos, { color: coloresMapa.ruta, weight: 7 }).addTo(c.rutas);
      for (const t of ruta.tramos) {
        Lf.polyline(puntosDeTramo(ruta, t.desde, t.hasta), {
          color: t.nivel === 'atasco' ? coloresMapa.atasco : coloresMapa.denso,
          weight: 7,
        }).addTo(c.rutas);
      }
    }
    // Parkings: "P" blanca en un cuadrado azul, como las señales; el elegido, más grande.
    for (const pk of parkings) {
      const lado = pk.id === parkingElegido ? 34 : 26;
      const icono = Lf.divIcon({
        className: '',
        iconSize: [lado, lado],
        html: `<div style="width:${lado}px;height:${lado}px;border-radius:6px;box-sizing:border-box;background:${coloresMapa.parking};border:2px solid ${coloresMapa.bordeParking};color:${coloresMapa.bordeParking};font:600 14px ${fuentes.textoFuerte},sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4)">P</div>`,
      });
      Lf.marker(pk.punto, { icon: icono, keyboard: false })
        .bindTooltip(`${pk.nombre} · ${pk.direccion}`)
        .addTo(c.parkings);
    }
    if (ubicacion) {
      Lf.circleMarker(ubicacion, {
        radius: 8,
        color: '#FFFFFF',
        weight: 3,
        fillColor: colores.principal,
        fillOpacity: 1,
      }).addTo(c.marcas);
    }
    if (destino) {
      Lf.circleMarker(destino, {
        radius: 10,
        color: colores.principal,
        weight: 4,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
      }).addTo(c.marcas);
    }
  }, [leaflet, rutas, elegida, alElegir, parkings, parkingElegido, ubicacion, destino]);

  // Encuadrar la ruta (o tu posición y el destino) al cambiar.
  const visibles = puntosVisibles({ ubicacion, destino, rutas, parkings });
  const huella = `${visibles.length}:${visibles[0]?.join()}:${visibles[visibles.length - 1]?.join()}`;
  useEffect(() => {
    const m = mapa.current;
    if (!leaflet || !m || visibles.length === 0) return;
    if (visibles.length === 1) m.setView(visibles[0], 14);
    else m.fitBounds(leaflet.latLngBounds(visibles), { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet, huella]);

  return <View ref={contenedor} style={[estilos.contenedor, style]} />;
}

const estilos = StyleSheet.create({
  contenedor: { overflow: 'hidden', backgroundColor: colores.borde, zIndex: 0 },
});
