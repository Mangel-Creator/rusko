import type { Destino } from './tipos';

// Avisos web (26/10/2026): al tocar el aviso, el navegador abre esta dirección de la
// app (relativa a su raíz: "/rusko/" en la web publicada). Es lo mismo que hace el
// móvil con atenderRespuesta, pero sin botones: en la web los avisos no los llevan.
export function urlDeDestino(destino: Destino): string {
  switch (destino.pantalla) {
    case 'hoy':
      return '/';
    case 'alarmas':
      return '/alarmas';
    case 'evento':
      return `/evento?id=${encodeURIComponent(destino.id)}`;
    case 'mapa':
      return `/mapa?evento=${encodeURIComponent(destino.id)}&dia=${destino.dia}`;
    case 'plan':
      return `/plan?id=${encodeURIComponent(destino.id)}`;
    case 'resumenes':
      return '/resumenes';
  }
}
