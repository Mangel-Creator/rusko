// Las 17 comunidades autónomas y las dos ciudades autónomas, en el orden de la tabla
// del BOE. El código ISO es el que devuelve OpenStreetMap ("ISO3166-2-lvl4") al buscar
// un municipio: así se sabe la comunidad sin preguntarla.

export type CodigoComunidad =
  | 'and'
  | 'ara'
  | 'ast'
  | 'bal'
  | 'can'
  | 'cnt'
  | 'clm'
  | 'cyl'
  | 'cat'
  | 'ext'
  | 'gal'
  | 'mad'
  | 'mur'
  | 'nav'
  | 'pvs'
  | 'rio'
  | 'val'
  | 'ceu'
  | 'mel';

type DatosComunidad = { codigo: CodigoComunidad; nombre: string; iso: string };

export const COMUNIDADES: readonly DatosComunidad[] = [
  { codigo: 'and', nombre: 'Andalucía', iso: 'ES-AN' },
  { codigo: 'ara', nombre: 'Aragón', iso: 'ES-AR' },
  { codigo: 'ast', nombre: 'Asturias', iso: 'ES-AS' },
  { codigo: 'bal', nombre: 'Illes Balears', iso: 'ES-IB' },
  { codigo: 'can', nombre: 'Canarias', iso: 'ES-CN' },
  { codigo: 'cnt', nombre: 'Cantabria', iso: 'ES-CB' },
  { codigo: 'clm', nombre: 'Castilla-La Mancha', iso: 'ES-CM' },
  { codigo: 'cyl', nombre: 'Castilla y León', iso: 'ES-CL' },
  { codigo: 'cat', nombre: 'Cataluña', iso: 'ES-CT' },
  { codigo: 'ext', nombre: 'Extremadura', iso: 'ES-EX' },
  { codigo: 'gal', nombre: 'Galicia', iso: 'ES-GA' },
  { codigo: 'mad', nombre: 'Madrid', iso: 'ES-MD' },
  { codigo: 'mur', nombre: 'Murcia', iso: 'ES-MC' },
  { codigo: 'nav', nombre: 'Navarra', iso: 'ES-NC' },
  { codigo: 'pvs', nombre: 'País Vasco', iso: 'ES-PV' },
  { codigo: 'rio', nombre: 'La Rioja', iso: 'ES-RI' },
  { codigo: 'val', nombre: 'Comunitat Valenciana', iso: 'ES-VC' },
  { codigo: 'ceu', nombre: 'Ceuta', iso: 'ES-CE' },
  { codigo: 'mel', nombre: 'Melilla', iso: 'ES-ML' },
];

export function nombreComunidad(codigo: CodigoComunidad): string {
  return COMUNIDADES.find((c) => c.codigo === codigo)?.nombre ?? codigo;
}

export function comunidadDesdeIso(iso: string | undefined): CodigoComunidad | null {
  return COMUNIDADES.find((c) => c.iso === iso)?.codigo ?? null;
}

// Partes de una comunidad con alguna fiesta distinta (notas de la tabla del BOE): cada
// isla de Canarias tiene la suya y el Valle de Arán cambia una de Cataluña.
// null = el resto de la comunidad.
export const SUBZONAS: Partial<Record<CodigoComunidad, { valor: string; etiqueta: string }[]>> = {
  can: [
    { valor: 'tenerife', etiqueta: 'Tenerife' },
    { valor: 'gran-canaria', etiqueta: 'Gran Canaria' },
    { valor: 'lanzarote', etiqueta: 'Lanzarote o La Graciosa' },
    { valor: 'fuerteventura', etiqueta: 'Fuerteventura' },
    { valor: 'la-palma', etiqueta: 'La Palma' },
    { valor: 'la-gomera', etiqueta: 'La Gomera' },
    { valor: 'el-hierro', etiqueta: 'El Hierro' },
  ],
  cat: [{ valor: 'aran', etiqueta: 'Valle de Arán' }],
};
