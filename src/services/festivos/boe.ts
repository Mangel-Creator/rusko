import type { CodigoComunidad } from './comunidades';

// Fiestas laborales nacionales y de cada comunidad, copiadas de la tabla oficial que
// publica el BOE cada otoño para el año siguiente:
// - 2026: Resolución de 17/10/2025 (BOE-A-2025-21667, BOE de 28/10/2025).
// - 2027: Resolución de 8/10/2026 (BOE-A-2026-21254, BOE de 13/10/2026).
// Para añadir un año: copia su tabla aquí y sus fiestas de isla (Canarias) y de Arán
// en FIESTAS_SUBZONA. Los años que no estén se calculan con calcularNacionales (index.ts).
//
// "en": 'todas' si es fiesta en toda España; si no, las comunidades donde lo es.

export type FiestaBoe = {
  dia: string; // "MM-DD"
  nombre: string;
  en: 'todas' | CodigoComunidad[];
};

export const FIESTAS_BOE: Record<number, FiestaBoe[]> = {
  2026: [
    { dia: '01-01', nombre: 'Año Nuevo', en: 'todas' },
    { dia: '01-06', nombre: 'Epifanía del Señor', en: 'todas' },
    { dia: '02-28', nombre: 'Día de Andalucía', en: ['and'] },
    { dia: '03-02', nombre: 'Lunes siguiente al Día de les Illes Balears', en: ['bal'] },
    { dia: '03-19', nombre: 'San José', en: ['gal', 'mur', 'nav', 'pvs', 'val'] },
    { dia: '03-20', nombre: 'Fiesta del Eid Fitr', en: ['mel'] },
    { dia: '04-02', nombre: 'Jueves Santo', en: ['and', 'ara', 'ast', 'bal', 'can', 'cnt', 'clm', 'cyl', 'ext', 'gal', 'mad', 'mur', 'nav', 'pvs', 'rio', 'ceu', 'mel'] },
    { dia: '04-03', nombre: 'Viernes Santo', en: 'todas' },
    { dia: '04-06', nombre: 'Lunes de Pascua', en: ['bal', 'clm', 'cat', 'nav', 'pvs', 'rio', 'val'] },
    { dia: '04-23', nombre: 'San Jorge/Día de Aragón', en: ['ara'] },
    { dia: '04-23', nombre: 'Fiesta de Castilla y León', en: ['cyl'] },
    { dia: '05-01', nombre: 'Fiesta del Trabajo', en: 'todas' },
    { dia: '05-02', nombre: 'Fiesta de la Comunidad de Madrid', en: ['mad'] },
    { dia: '05-27', nombre: 'Fiesta Sacrificio-Eidul Adha', en: ['ceu'] },
    { dia: '05-27', nombre: 'Fiesta Sacrificio-Aid al Adha', en: ['mel'] },
    { dia: '05-30', nombre: 'Día de Canarias', en: ['can'] },
    { dia: '06-04', nombre: 'Corpus Christi', en: ['clm'] },
    { dia: '06-09', nombre: 'Día de la Región de Murcia', en: ['mur'] },
    { dia: '06-09', nombre: 'Día de la Rioja', en: ['rio'] },
    { dia: '06-24', nombre: 'San Juan', en: ['cat', 'gal', 'val'] },
    { dia: '07-25', nombre: 'Santiago Apóstol/Día Nacional de Galicia', en: ['gal', 'pvs'] },
    { dia: '07-28', nombre: 'Día de las Instituciones de Cantabria', en: ['cnt'] },
    { dia: '08-05', nombre: 'Nuestra Señora de África', en: ['ceu'] },
    { dia: '08-15', nombre: 'Asunción de la Virgen', en: 'todas' },
    { dia: '09-02', nombre: 'Día de Ceuta', en: ['ceu'] },
    { dia: '09-08', nombre: 'Día de Asturias', en: ['ast'] },
    { dia: '09-08', nombre: 'Día de Extremadura', en: ['ext'] },
    { dia: '09-11', nombre: 'Fiesta Nacional de Cataluña', en: ['cat'] },
    { dia: '09-15', nombre: 'La Bien Aparecida', en: ['cnt'] },
    { dia: '10-09', nombre: 'Día de la Comunitat Valenciana', en: ['val'] },
    { dia: '10-12', nombre: 'Fiesta Nacional de España', en: 'todas' },
    { dia: '11-02', nombre: 'Día siguiente a Todos los Santos', en: ['and', 'ara', 'ast', 'can', 'clm', 'cyl', 'ext', 'mad', 'nav'] },
    { dia: '12-07', nombre: 'Lunes siguiente al Día de la Constitución Española', en: ['and', 'ara', 'ast', 'cnt', 'cyl', 'ext', 'mad', 'mur', 'rio', 'mel'] },
    { dia: '12-08', nombre: 'Inmaculada Concepción', en: 'todas' },
    { dia: '12-25', nombre: 'Natividad del Señor', en: 'todas' },
    { dia: '12-26', nombre: 'San Esteban', en: ['bal', 'cat'] },
  ],
  2027: [
    { dia: '01-01', nombre: 'Año Nuevo', en: 'todas' },
    { dia: '01-06', nombre: 'Epifanía del Señor', en: 'todas' },
    { dia: '03-01', nombre: 'Día de Andalucía', en: ['and'] },
    { dia: '03-01', nombre: 'Día de les Illes Balears', en: ['bal'] },
    { dia: '03-10', nombre: 'Fiesta del Eid Fitr', en: ['mel'] },
    { dia: '03-19', nombre: 'San José', en: ['gal', 'mad', 'mur', 'nav', 'val'] },
    { dia: '03-25', nombre: 'Jueves Santo', en: ['and', 'ara', 'ast', 'bal', 'can', 'cnt', 'clm', 'cyl', 'ext', 'gal', 'mad', 'mur', 'nav', 'pvs', 'rio', 'ceu', 'mel'] },
    { dia: '03-26', nombre: 'Viernes Santo', en: 'todas' },
    { dia: '03-29', nombre: 'Lunes de Pascua', en: ['bal', 'cat', 'nav', 'pvs', 'rio', 'val'] },
    { dia: '04-23', nombre: 'San Jorge/Día de Aragón', en: ['ara'] },
    { dia: '04-23', nombre: 'Fiesta de Castilla y León', en: ['cyl'] },
    { dia: '05-01', nombre: 'Fiesta del Trabajo', en: 'todas' },
    { dia: '05-17', nombre: 'Día de las Letras Gallegas', en: ['gal'] },
    { dia: '05-17', nombre: 'Eidul Adha-Fiesta Sacrificio', en: ['ceu'] },
    { dia: '05-17', nombre: 'Fiesta Sacrificio-Aid Al Adha', en: ['mel'] },
    { dia: '05-27', nombre: 'Corpus Christi', en: ['clm'] },
    { dia: '05-31', nombre: 'Día de Castilla-La Mancha', en: ['clm'] },
    { dia: '06-09', nombre: 'Día de la Región de Murcia', en: ['mur'] },
    { dia: '06-09', nombre: 'Día de La Rioja', en: ['rio'] },
    { dia: '06-24', nombre: 'Día de San Juan', en: ['cat'] },
    { dia: '07-28', nombre: 'Día de las Instituciones de Cantabria', en: ['cnt'] },
    { dia: '08-05', nombre: 'Nuestra Señora de África', en: ['ceu'] },
    { dia: '08-16', nombre: 'Lunes siguiente a asunción de la Virgen', en: ['and', 'ara', 'ast', 'can', 'cyl', 'mad'] },
    { dia: '09-08', nombre: 'Día de Asturias', en: ['ast'] },
    { dia: '09-08', nombre: 'Día de Extremadura', en: ['ext'] },
    { dia: '09-11', nombre: 'Fiesta Nacional de Cataluña', en: ['cat'] },
    { dia: '09-15', nombre: 'La Bien Aparecida', en: ['cnt'] },
    { dia: '10-07', nombre: 'Aniversario 1er Gobierno Euskadi', en: ['pvs'] },
    { dia: '10-09', nombre: 'Día de la Comunitat Valenciana', en: ['val'] },
    { dia: '10-11', nombre: 'Sustitución 15 de agosto', en: ['ext'] },
    { dia: '10-12', nombre: 'Fiesta Nacional de España', en: 'todas' },
    { dia: '11-01', nombre: 'Todos los Santos', en: 'todas' },
    { dia: '12-06', nombre: 'Día de la Constitución Española', en: 'todas' },
    { dia: '12-08', nombre: 'Inmaculada Concepción', en: 'todas' },
    { dia: '12-25', nombre: 'Natividad del Señor', en: 'todas' },
  ],
};

// Fiestas que solo valen en una parte de la comunidad (notas de la misma tabla).
// "quita": la fiesta de la comunidad que deja de serlo allí.
export type FiestaSubzona = { dia: string; nombre: string; quita?: string };

export const FIESTAS_SUBZONA: Record<number, Partial<Record<string, FiestaSubzona>>> = {
  2026: {
    'el-hierro': { dia: '09-24', nombre: 'Nuestra Señora de los Reyes' },
    fuerteventura: { dia: '09-18', nombre: 'Nuestra Señora de la Peña' },
    'gran-canaria': { dia: '09-08', nombre: 'Nuestra Señora del Pino' },
    'la-gomera': { dia: '10-05', nombre: 'Nuestra Señora de Guadalupe' },
    'la-palma': { dia: '08-05', nombre: 'Nuestra Señora de las Nieves' },
    lanzarote: { dia: '09-15', nombre: 'Nuestra Señora de los Volcanes' },
    tenerife: { dia: '02-02', nombre: 'Virgen de la Candelaria' },
    aran: { dia: '06-17', nombre: 'Fiesta de Arán', quita: '12-26' },
  },
  2027: {
    'el-hierro': { dia: '09-24', nombre: 'Nuestra Señora de los Reyes' },
    fuerteventura: { dia: '09-17', nombre: 'Nuestra Señora de la Peña' },
    'gran-canaria': { dia: '09-08', nombre: 'Nuestra Señora del Pino' },
    'la-gomera': { dia: '10-04', nombre: 'Nuestra Señora de Guadalupe' },
    'la-palma': { dia: '08-05', nombre: 'Nuestra Señora de las Nieves' },
    lanzarote: { dia: '09-15', nombre: 'Nuestra Señora de los Volcanes' },
    tenerife: { dia: '02-02', nombre: 'Virgen de la Candelaria' },
    aran: { dia: '06-17', nombre: 'Fiesta de Arán', quita: '03-29' },
  },
};
