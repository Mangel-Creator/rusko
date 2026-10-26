import { Platform } from 'react-native';

// Alarmas al Reloj del iPhone (26/10/2026; sustituye al Atajo manual "Organizy alarma").
// En la web no puede sonar nada con la web cerrada, pero la app Atajos sí crea alarmas
// en el Reloj. La persona crea una vez el Atajo "Organizy alarmas" y una automatización
// que lo ejecuta cada noche: lee su enlace personal (función alarmas-reloj), borra las
// alarmas de Organizy que haya en el Reloj y crea las de las próximas 24 horas.
// Las del Reloj suenan aunque el móvil esté en silencio.

export const NOMBRE_ATAJO = 'Organizy alarmas';
export const HORA_AUTOMATIZACION = '22:00';

// Ejecuta el Atajo ahora (enlace oficial de Apple), por si cambias algo después de las 22:00.
export function enlaceEjecutarAtajo(): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(NOMBRE_ATAJO)}`;
}

// La web abierta en un iPhone o iPad (donde existe la app Atajos).
export function esWebDeIphone(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

// Cómo crear el Atajo, una sola vez (la guía del usuario lo cuenta con más detalle).
export const PASOS_ATAJO = [
  `Abre la app Atajos, toca el "+" de arriba a la derecha y llámalo exactamente: ${NOMBRE_ATAJO}`,
  'Añade "Obtener contenido de URL" y pega tu enlace (el de "Copiar mi enlace").',
  'Añade "Si". Elige "Contenido de URL", la condición "empieza por" y escribe: Organizy',
  'Dentro del "Si", añade "Buscar alarmas", toca "Añadir filtro" y pon: Etiqueta, empieza por, Organizy.',
  'Debajo, "Eliminar alarmas" (borra las que puso Organizy la noche anterior).',
  'Añade "Dividir texto": el texto es "Contenido de URL" y el separador, "Saltos de línea".',
  'Añade "Repetir con cada" con el "Texto dividido".',
  'Dentro, otro "Si": "Elemento de repetición", "contiene", y escribe la barra |',
  'Dentro de ese "Si": "Dividir texto" (el "Elemento de repetición", separador personalizado |), "Obtener elemento de la lista" con "Primer elemento", otro con "Último elemento" del mismo "Texto dividido" y "Crear alarma": la hora es el primer elemento y la etiqueta, el último.',
  'Toca "OK". Luego, en la pestaña Automatización: "+", "Hora del día", 22:00, "Diariamente", "Ejecutar inmediatamente" y elige este Atajo.',
] as const;
