import 'leaflet/dist/leaflet.css';

import type * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';

import { coloresMapa, fuentes } from '@/theme';

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

// Estilo "navegador" en modo claro (27/10/2026, el usuario lo quería así): fondo claro y
// apagado, ruta en azul vivo con borde azul oscuro y marcas en el mismo azul. Con la
// clave, el estilo normal de TomTom y su tráfico; sin ella, el mapa de OpenStreetMap
// apagado con un filtro (CARTO y Stadia, que dan fondos así hechos, piden cuenta y clave).
const ATRIBUCION_OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ATRIBUCION_TOMTOM = '© <a href="https://www.tomtom.com">TomTom</a>';

// Los botones + y − y la atribución de Leaflet vienen cuadrados: se pasan al estilo de
// la app (redondos, blancos y sin sombra). Se añade una vez al documento.
const CSS_MAPA = `
.organizy-mapa { background: ${coloresMapa.fondo}; font-family: ${fuentes.texto}, sans-serif; }
.organizy-fondo-osm { filter: grayscale(0.85) sepia(0.15) hue-rotate(180deg) brightness(1.06) contrast(0.92); }
.organizy-mapa .leaflet-bar { border: none; box-shadow: none; }
.organizy-mapa .leaflet-bar a, .organizy-mapa .leaflet-bar a:first-child, .organizy-mapa .leaflet-bar a:last-child {
  width: 40px; height: 40px; line-height: 40px; margin-bottom: 8px;
  border: 1px solid rgba(27, 36, 51, 0.12); border-radius: 20px; background: ${coloresMapa.blanco}; color: ${coloresMapa.texto};
  font: 400 22px ${fuentes.texto}, sans-serif;
}
.organizy-mapa .leaflet-bar a:hover { background: ${coloresMapa.fondo}; color: ${coloresMapa.ruta}; }
.organizy-mapa .leaflet-bar a.leaflet-disabled { color: ${coloresMapa.textoSecundario}; }
.organizy-mapa .leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.85); color: ${coloresMapa.textoSecundario};
  border-radius: 8px 0 0 0; font-size: 10px;
}
.organizy-mapa .leaflet-control-attribution a { color: ${coloresMapa.texto}; }
.organizy-mapa .leaflet-tooltip {
  background: ${coloresMapa.blanco}; color: ${coloresMapa.texto}; border: none; border-radius: 10px;
  box-shadow: 0 1px 4px rgba(27, 36, 51, 0.18); font: 500 13px ${fuentes.texto}, sans-serif;
}
`;

function ponerEstilos() {
  if (document.getElementById('organizy-mapa-css')) return;
  const estilo = document.createElement('style');
  estilo.id = 'organizy-mapa-css';
  estilo.textContent = CSS_MAPA;
  document.head.appendChild(estilo);
}

// Marcas en azul: tu posición (punto con aro), la salida (aro) y el destino (chincheta
// con aros en la base).
function iconoPosicion(Lf: typeof L) {
  return Lf.divIcon({
    className: '',
    iconSize: [30, 30],
    html: `<div style="width:30px;height:30px;border-radius:15px;background:rgba(47,107,255,.18);display:flex;align-items:center;justify-content:center"><div style="width:16px;height:16px;border-radius:8px;box-sizing:border-box;background:${coloresMapa.ruta};border:3px solid ${coloresMapa.blanco};box-shadow:0 1px 3px rgba(0,0,0,.3)"></div></div>`,
  });
}

function iconoSalida(Lf: typeof L) {
  return Lf.divIcon({
    className: '',
    iconSize: [18, 18],
    html: `<div style="width:18px;height:18px;border-radius:9px;box-sizing:border-box;border:4px solid ${coloresMapa.ruta};background:${coloresMapa.blanco}"></div>`,
  });
}

function iconoDestino(Lf: typeof L) {
  return Lf.divIcon({
    className: '',
    iconSize: [40, 52],
    iconAnchor: [20, 44],
    html: `<svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="44" rx="15" ry="6" fill="none" stroke="${coloresMapa.ruta}" stroke-opacity=".35" stroke-width="1.5"/><ellipse cx="20" cy="44" rx="8" ry="3.2" fill="none" stroke="${coloresMapa.ruta}" stroke-width="1.5"/><path d="M20 4c-6.6 0-12 5.2-12 11.7C8 24.5 20 40 20 40s12-15.5 12-24.3C32 9.2 26.6 4 20 4z" fill="${coloresMapa.ruta}" stroke="${coloresMapa.bordeRuta}" stroke-width="1"/><circle cx="20" cy="15.5" r="4.5" fill="${coloresMapa.blanco}"/></svg>`,
  });
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
        Lf.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${CLAVE_MAPA}&language=es-ES`, {
          maxZoom: 19,
          attribution: ATRIBUCION_TOMTOM,
        }).addTo(m);
        Lf.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${CLAVE_MAPA}`, {
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
      Lf.polyline(r.puntos, { color: coloresMapa.rutaAlternativa, weight: 5, opacity: 0.9 })
        .on('click', () => alElegir(i))
        .addTo(c.rutas);
    });
    const ruta = rutas[elegida];
    if (ruta) {
      // Ruta azul con un borde más oscuro por debajo, como en los navegadores.
      Lf.polyline(ruta.puntos, { color: coloresMapa.bordeRuta, weight: 9 }).addTo(c.rutas);
      Lf.polyline(ruta.puntos, { color: coloresMapa.ruta, weight: 6 }).addTo(c.rutas);
      for (const t of ruta.tramos) {
        Lf.polyline(puntosDeTramo(ruta, t.desde, t.hasta), {
          color: t.nivel === 'atasco' ? coloresMapa.atasco : coloresMapa.denso,
          weight: 6,
        }).addTo(c.rutas);
      }
      // Salida: un aro azul (si no se sabe dónde estás, la ruta sale de casa).
      if (!ubicacion) Lf.marker(ruta.puntos[0], { icon: iconoSalida(Lf), keyboard: false }).addTo(c.marcas);
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
    if (ubicacion) Lf.marker(ubicacion, { icon: iconoPosicion(Lf), keyboard: false }).addTo(c.marcas);
    if (destino) Lf.marker(destino, { icon: iconoDestino(Lf), keyboard: false }).addTo(c.marcas);
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
  contenedor: { overflow: 'hidden', backgroundColor: coloresMapa.fondo, zIndex: 0 },
});
