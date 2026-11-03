import { examenGuardado, estimarHoras, type PerfilEstudio, type TemaMedido } from './perfilEstudio';
import {
  propuestaDeCuestionario,
  type AsignaturaCuestionario,
  type HabitosCuestionario,
  type PropuestaEpoca,
  type RespuestasCuestionario,
  type TemaPropuesto,
} from './validarIA';

// Plan de estudio sin IA (03/11/2026): con las respuestas del cuestionario y su
// perfil de estudio, la app prepara sola el plan que antes hacía la IA, con las
// mismas reglas (guías del COIE de la UNED): temas en orden, repasos sin mirar
// cada 2 o 3 temas, lo propio de cada tipo de examen, simulacro y repaso final,
// y consejos según sus hábitos. Gratis e igual para lo mismo. La IA solo entra
// si escribe algo en "¿Algo más?" (services/epoca/ia.ts > cuestionarioConIA).
// Funciones puras, con pruebas en __tests__.

const MAX_TEMAS = 20;
const MAX_CONSEJOS = 6;

// Horas "de base" de cada pieza: luego todo se escala a las horas que calcula
// estimarHoras, así que solo importan las proporciones.
const BASE_TEMA = 3;
const MIN_PAGINA = { baja: 4, media: 6, alta: 9 } as const;

type Pieza = { nombre: string; base: number; estudio?: boolean };

const IDIOMA = /\b(a2|b1|b2|c1|c2|cambridge|eoi|aptis|toefl|ielts|delf|dalf|goethe|dele|toeic)\b/i;
const CAMBRIDGE = /\b(cambridge|first|advanced|proficiency|fce|cae|cpe)\b/i;

function esIdioma(a: AsignaturaCuestionario, ficha: string): boolean {
  return IDIOMA.test(a.nombre) || /\b(reading|listening|speaking|writing)\b/i.test(ficha);
}

// "1. Estadística descriptiva" → "Estadística descriptiva". Una línea por tema.
export function temasDelTexto(indice: string): string[] {
  return indice
    .split(/\n|;/)
    .map((l) =>
      l
        .replace(/^\s*(tema|t|unidad|cap[ií]tulo)?\s*\d+\s*[.):\-–]?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 1)
    .slice(0, 60);
}

type Unidad = { corto: string; nombre: string; peso: number };

// Lo que va a estudiar, en orden: sus apuntes medidos, su índice o "Tema N".
function unidades(a: AsignaturaCuestionario, apuntes: TemaMedido[] | undefined): Unidad[] {
  if (apuntes && apuntes.length > 0) {
    const pesos = apuntes.map((t) => t.paginas * MIN_PAGINA[t.densidad]);
    const media = pesos.reduce((s, p) => s + p, 0) / pesos.length || 1;
    return apuntes.map((t, i) => ({ corto: `T${i + 1}`, nombre: t.nombre, peso: pesos[i] / media }));
  }
  const delIndice = temasDelTexto(a.indice);
  if (delIndice.length > 0) {
    return delIndice.map((n, i) => ({ corto: `T${i + 1}`, nombre: `T${i + 1}: ${n}`.slice(0, 60), peso: 1 }));
  }
  return Array.from({ length: Math.max(1, a.temas) }, (_, i) => ({ corto: `T${i + 1}`, nombre: `Tema ${i + 1}`, peso: 1 }));
}

// Junta temas seguidos en n grupos ("Temas 4-6") para no pasar de MAX_TEMAS.
function agrupar(lista: Unidad[], n: number): Unidad[][] {
  const grupos: Unidad[][] = [];
  for (let g = 0; g < n; g++) {
    grupos.push(lista.slice(Math.round((g * lista.length) / n), Math.round(((g + 1) * lista.length) / n)));
  }
  return grupos.filter((g) => g.length > 0);
}

const rango = (g: Unidad[]) => (g.length === 1 ? g[0].corto : `${g[0].corto}-${g[g.length - 1].corto}`);

function nombreGrupo(g: Unidad[]): string {
  if (g.length === 1) return g[0].nombre;
  const [desde, hasta] = [g[0].corto.slice(1), g[g.length - 1].corto.slice(1)];
  return g.length === 2 ? `Temas ${desde} y ${hasta}` : `Temas ${desde}-${hasta}`;
}

function piezasExamen(a: AsignaturaCuestionario, h: HabitosCuestionario, estudio: PerfilEstudio): Pieza[] {
  const guardado = examenGuardado(estudio, a.nombre);
  const ficha = guardado.ficha?.texto ?? '';
  const rapido = h.entender === 'rapido';
  const practica = rapido ? 1.25 : 1;

  if (a.tipoExamen === 'trabajo') {
    return [
      { nombre: 'Buscar información', base: 2.5 },
      { nombre: 'Hacer el guion', base: 1.5 },
      { nombre: 'Redactar', base: 4.5 },
      { nombre: 'Revisar y entregar', base: 1.5 },
    ];
  }

  const piezas: Pieza[] = [];
  const final = (estudiado: number) =>
    estudiado * (a.avance === 'casi' ? 0.45 : h.cerca === 'agobio' ? 0.38 : 0.27);

  if (esIdioma(a, ficha)) {
    const destrezas = ['Reading', ...(CAMBRIDGE.test(`${a.nombre} ${ficha}`) ? ['Use of English'] : []), 'Writing', 'Listening', 'Speaking'];
    for (const d of destrezas) {
      const nombre = d === 'Writing' ? 'Writing con plantillas y textos corregidos' : d === 'Speaking' ? 'Speaking grabándote o con alguien' : `${d} con el formato del examen`;
      piezas.push({ nombre, base: BASE_TEMA, estudio: true });
    }
    piezas.push({ nombre: 'Simulacro completo con el tiempo oficial', base: 3 * practica });
    piezas.push({ nombre: 'Segundo simulacro completo', base: 3 * practica });
    const estudiado = piezas.reduce((t, p) => t + p.base, 0);
    piezas.push({ nombre: 'Repaso final de tus fallos y plantillas', base: final(estudiado) });
    return piezas;
  }

  if (a.avance === 'nada') {
    piezas.push({
      nombre: a.anteriores ? 'Organizar el material y ver exámenes de otros años' : 'Organizar el material y ver el temario',
      base: 0.75,
    });
  }

  // Lo propio de cada tipo de examen, antes del simulacro y del repaso final.
  const extras: Pieza[] = [];
  if (a.tipoExamen === 'test' && !a.anteriores) extras.push({ nombre: 'Tests de práctica', base: 1.5 * practica });
  if (a.tipoExamen === 'test-resta') extras.push({ nombre: 'Practicar cuándo dejar en blanco', base: 1 * practica });
  if (a.tipoExamen === 'desarrollo') {
    extras.push({ nombre: 'Esquemas-guion de cada tema', base: 1.5 });
    extras.push({ nombre: 'Práctica de desarrollo por escrito', base: 2 * practica });
  }
  if (a.tipoExamen === 'cortas') extras.push({ nombre: 'Practicar respuestas breves y precisas', base: 1.5 * practica });
  if (a.tipoExamen === 'oral') extras.push({ nombre: 'Exponer en voz alta', base: 1.5 * practica });
  const simulacro: Pieza | null = a.anteriores
    ? { nombre: 'Simulacro con un examen de otros años', base: 2 * practica }
    : ficha
      ? { nombre: 'Simulacro con el formato del examen', base: 2 * practica }
      : null;

  const lista = unidades(a, guardado.apuntes?.temas);
  const largo = lista.length > 30; // oposiciones o temarios largos
  const cada = a.tipoExamen === 'problemas' || h.memorizar === 'cuesta' ? 2 : 3;
  const fijas = piezas.length + extras.length + (simulacro ? 1 : 0) + (largo ? 1 : 0) + 1;
  // Cuántos grupos de temas caben con sus repasos intermedios.
  let grupos = Math.min(lista.length, MAX_TEMAS - fijas);
  while (grupos > 1 && grupos + Math.floor((grupos - 1) / cada) > MAX_TEMAS - fijas) grupos--;

  const porRepasar: Unidad[] = [];
  const lectura = rapido ? 0.85 : 1;
  const repaso = h.memorizar === 'cuesta' ? 0.75 : 0.6;
  const repasoNombre =
    a.tipoExamen === 'problemas' ? 'Problemas' : h.autoexamen === 'no-gusta' ? 'Repaso' : 'Preguntas';
  agrupar(lista, grupos).forEach((g, i, todos) => {
    const peso = g.reduce((t, u) => t + u.peso, 0);
    const cuesta = h.entender === 'cuesta' && i < 2 ? 1.2 : 1;
    piezas.push({ nombre: nombreGrupo(g), base: BASE_TEMA * peso * lectura * cuesta, estudio: true });
    porRepasar.push(...g);
    if ((i + 1) % cada === 0 && i < todos.length - 1) {
      piezas.push({ nombre: `${repasoNombre} ${rango(porRepasar)}`, base: repaso * porRepasar.length * practica });
      porRepasar.length = 0;
    }
  });
  const estudiado = piezas.filter((p) => p.estudio).reduce((t, p) => t + p.base, 0);
  if (largo) piezas.push({ nombre: 'Segunda vuelta a todo el temario', base: estudiado * 0.15 });
  piezas.push(...extras);
  if (simulacro) piezas.push(simulacro);
  piezas.push({ nombre: 'Repaso final con tus esquemas y fichas', base: final(estudiado) });
  return piezas;
}

// Escala las piezas a las horas del examen, en medias horas, y cuadra la suma.
function repartir(piezas: Pieza[], horas: number): TemaPropuesto[] {
  const total = piezas.reduce((t, p) => t + p.base, 0) || 1;
  const temas = piezas.map((p) => ({ nombre: p.nombre, horas: Math.max(0.5, Math.round(((p.base * horas) / total) * 2) / 2) }));
  const diferencia = horas - temas.reduce((t, x) => t + x.horas, 0);
  const mayor = temas.reduce((m, t, i) => (t.horas > temas[m].horas ? i : m), 0);
  temas[mayor] = { ...temas[mayor], horas: Math.max(0.5, temas[mayor].horas + diferencia) };
  return temas;
}

export function planLocal(r: RespuestasCuestionario, estudio: PerfilEstudio): PropuestaEpoca {
  const h = r.habitos;
  const estimadas: Record<string, number> = {};
  const hitos = r.asignaturas.map((a) => {
    const horas = estimarHoras(a, { habitos: h, ritmo: estudio.ritmo }, examenGuardado(estudio, a.nombre).apuntes?.temas);
    const temas = repartir(piezasExamen(a, h, estudio), horas);
    // Con pocas horas y muchas piezas de media hora, la suma puede pasarse: manda la suma.
    estimadas[a.id] = temas.reduce((t, x) => t + x.horas, 0);
    return { nombre: a.nombre, fecha: a.fecha, hora: a.hora, dificultad: a.dificultad, horasPreparacion: estimadas[a.id], temas };
  });
  const base: PropuestaEpoca = {
    nombre: null,
    tipo: null,
    inicio: null,
    fin: null,
    lugar: null,
    diasVas: null,
    horasDia: null,
    rindeMas: null,
    // Sin decir cuánto aguanta: bloques cortos si le cuesta arrancar o le distrae el móvil.
    descanso: h.arrancar === 'cuesta' || h.distraccion === 'movil' ? '25-5' : '50-10',
    diaLibre: null,
    levantarse: null,
    acostarse: null,
    imprescindibles: [],
    hitos,
    notas: null,
    consejos: consejosLocales(r, estudio),
    finde: null,
    cargaLejos: null,
  };
  return propuestaDeCuestionario(r, base, estimadas);
}

// ---------- Consejos según sus respuestas ----------

const POR_TIPO: Partial<Record<AsignaturaCuestionario['tipoExamen'], string>> = {
  'test-resta': 'En el test que resta, usa los simulacros para saber cuándo te compensa arriesgar y cuándo dejar en blanco.',
  desarrollo: 'En el desarrollo, primero un esquema, luego el desarrollo y una conclusión. Practica a mano y con tiempo.',
  problemas: 'Haz los problemas tú solo, al nivel y a la velocidad del examen. Leer los resueltos no basta.',
  cortas: 'En las preguntas cortas, ve al grano: la idea clave y un ejemplo.',
  oral: 'Explica cada tema en voz alta, como si se lo contaras a alguien.',
  trabajo: 'Deja un día entre redactar y revisar: así ves los fallos.',
};

export function consejosLocales(r: RespuestasCuestionario, estudio: PerfilEstudio): string[] {
  const h = r.habitos;
  const lista: string[] = [];
  if (r.asignaturas.some((a) => esIdioma(a, examenGuardado(estudio, a.nombre).ficha?.texto ?? ''))) {
    lista.push('Haz al menos 2 simulacros completos con el tiempo oficial. El Writing, con plantillas y que alguien te lo corrija.');
  }
  for (const a of r.asignaturas) {
    const c = POR_TIPO[a.tipoExamen];
    if (c && !lista.includes(c)) lista.push(c);
  }
  if (h.arrancar === 'cuesta') lista.push('Para arrancar, un reto de 10 minutos con temporizador. Empieza por lo que más te cuesta.');
  if (h.sintesis === 'releo' || h.repasos === 'no' || h.autoexamen === 'no-probado') {
    lista.push('Releer da sensación de saber, pero no se queda. Haz fichas de pregunta y respuesta y repásalas sin mirar.');
  }
  if (h.distraccion === 'movil') lista.push('El móvil, en otra habitación mientras estudias. En los descansos, sí.');
  if (h.distraccion === 'ruido') lista.push('Busca un sitio tranquilo, o usa tapones.');
  if (h.distraccion === 'cansancio') lista.push('Deja lo difícil para cuando rindes más y duerme bien: cansado se te queda la mitad.');
  if (h.constancia === 'nunca') lista.push('Estudiar en el mismo sitio y a la misma hora crea el hábito.');
  if (h.lejos === 'no' || h.lejos === 'a-medias') {
    lista.push('Al principio el plan te pone menos. Lo importante es no saltarte ningún día, aunque sea poco.');
  }
  if (h.mezclar === 'una' && r.asignaturas.length > 1) lista.push('Temas nuevos de una asignatura al día, pero los repasos mezclados.');
  if (h.memoria === 'viendo') lista.push('Repite los esquemas de memoria en un folio y compáralos con los tuyos.');
  if (h.memoria === 'escuchando') lista.push('Grábate explicando cada tema y escúchalo en ratos muertos.');
  if (h.memoria === 'haciendo') lista.push('Aprende haciendo: ejercicios y fichas desde el primer tema.');
  if (h.imprevistos === 'a-menudo') lista.push('Si se te tuerce un día, no lo recuperes todo de golpe: pásalo al siguiente hueco.');
  if (h.nervios === 'algo' || h.nervios === 'mucho') {
    lista.push('Haz los simulacros con el tiempo del examen. La víspera, solo 1 o 2 horas de repaso ligero, nada nuevo.');
  }
  // Para todos, si hay sitio.
  lista.push('Para cada tema: ojéalo, hazte preguntas, léelo, subraya solo lo clave, haz el esquema y repítelo sin mirar.');
  lista.push('Repasa espaciado: al día siguiente, a los 3 días y a la semana.');
  return lista.slice(0, MAX_CONSEJOS);
}
