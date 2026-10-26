import type { Adelantos, AjustesAlarmas, Alarma } from '@/data/alarmas';
import type { AjustesAvisos } from '@/data/avisos';
import type { CorreoResumido } from '@/data/correos';
import type { Evento } from '@/data/eventos/tipos';
import type { Hora, Perfil } from '@/data/perfil';
import type { Plan } from '@/data/planes';
import type { Salida } from '@/data/salidas';
import {
  calcularHuecos,
  cargaDelDia,
  duracionTarea,
  eventosDelDia,
  fraseResumen,
  intervaloDe,
  minutosDeJornada,
  NOMBRE_CASA,
  resolverLugar,
  tareasPendientes,
  unirConY,
  ventanaDelDia,
} from '@/services/agenda';
import {
  adelantoDe,
  alarmasDeSalida,
  claveAdelanto,
  minutoDormir,
  motivoAdelanto,
  suenaElDia,
} from '@/services/alarmas/calculo';
import { tituloAlarma } from '@/services/alarmas/definiciones';
import { esDorada, estadoEpoca } from '@/services/epoca';
import {
  claveDia,
  fechaDesdeClave,
  formatearDuracion,
  horaDesdeMinutos,
  minutosDesdeHora,
  saludoSegunHora,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

import { avisosDePlazos } from './correos';
import { avisosDeEpoca, type EpocaParaAvisos } from './epoca';
import { avisosDePlanes } from './planes';
import { TIPOS_ALARMA, type AvisoPlanificado } from './tipos';

// Qué avisos hay que programar en los próximos días. Funciones puras (sin
// expo-notifications), con pruebas en __tests__.
//
// Cómo funciona: para cada día se llama a cada "generador" que esté activado
// en los ajustes; cada uno devuelve sus avisos de ese día. Luego se quitan los
// que ya han pasado, se ordenan por hora y se quedan los primeros MAX_AVISOS.
//
// Para añadir un tipo de aviso nuevo (fase 4b: inicio de bloque, hora de dormir...):
//   1. Añade el tipo en tipos.ts y su interruptor en data/avisos.ts.
//   2. Escribe su generador (ctx, dia) => AvisoPlanificado[] y añádelo a GENERADORES.

// iOS solo guarda 64 notificaciones programadas a la vez: dejamos margen.
export const MAX_AVISOS = 60;
// Días que se programan por adelantado. Se reprograma cada vez que se abre la app.
export const DIAS_A_PROGRAMAR = 7;

export const FRASE_DIA_JUSTO = 'Hoy va justo, mejor no metas nada más.';

export type ContextoAvisos = {
  ahora: Date;
  eventos: Evento[];
  perfil: Perfil;
  ajustes: AjustesAvisos;
  // Época dorada de estos días con su plan (fase 4b). Sin época, no cambia nada.
  epoca?: EpocaParaAvisos | null;
  // Horas de salida calculadas con el tráfico (fase 6, data/salidas.ts).
  salidas?: Salida[];
  // Nombre de la app con la que se abre la ruta al tocar el "Sal ya" ("Waze").
  navegador?: string;
  // Planes con votación (fase 8), para "Recordar a todos 3 h antes".
  planes?: Plan[];
  // Resúmenes de correo (fase 11): los plazos con su tarea en el calendario.
  correos?: CorreoResumido[];
  // Alarmas (fase 7). comoAvisos: en Expo Go (o sin alarmas de verdad) el despertador,
  // la inteligente y las de salida van como avisos con sonido; en la app propia las
  // programa nativo.ts y aquí solo queda el aviso de la hora de dormir.
  alarmas?: {
    lista: Alarma[];
    ajustes: AjustesAlarmas;
    adelantos: Adelantos;
    comoAvisos: boolean;
  };
};

type Generador = {
  activo: (ajustes: AjustesAvisos) => boolean;
  generar: (ctx: ContextoAvisos, dia: ClaveDia) => AvisoPlanificado[];
};

// Fecha de un día a cierta hora, en minutos desde medianoche. Admite minutos
// negativos o de más de 24 h (pasa al día anterior o al siguiente).
export function momento(dia: ClaveDia, minutos: number): Date {
  const fecha = fechaDesdeClave(dia);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, minutos);
}

// 10 -> "En 10 min", 60 -> "En 1 hora", 90 -> "En 1 h 30 min"
export function textoAntelacion(minutos: number): string {
  if (minutos === 60) return 'En 1 hora';
  if (minutos % 60 === 0) return `En ${minutos / 60} horas`;
  if (minutos > 60) return `En ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  return `En ${minutos} min`;
}

// Antelación del aviso de un evento: la suya o la del perfil. 0 = sin aviso.
export function antelacionDe(evento: Evento, perfil: Perfil): number {
  return evento.avisoMin ?? perfil.antelacionAvisoMin;
}

// --- Aviso antes de cada evento ---

// "Oficina", "casa" o la dirección escrita a mano.
function textoLugar(evento: Evento, perfil: Perfil): string | null {
  const lugar = resolverLugar(evento.lugar, perfil);
  if (!lugar) return null;
  if (lugar.nombre === NOMBRE_CASA) return 'casa';
  return lugar.nombre ?? lugar.direccion;
}

function avisosDeEventos({ eventos, perfil }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  return eventosDelDia(eventos, dia).flatMap((evento) => {
    const antelacion = antelacionDe(evento, perfil);
    if (antelacion <= 0) return [];
    const lugar = textoLugar(evento, perfil);
    return [
      {
        id: `evento:${evento.id}:${dia}`,
        tipo: 'evento' as const,
        dia,
        cuando: momento(dia, intervaloDe(evento).inicio - antelacion),
        titulo: `${textoAntelacion(antelacion)}: ${evento.titulo}${lugar ? ` en ${lugar}` : ''}`,
        cuerpo: `${evento.horaInicio} – ${evento.horaFin}${evento.foco ? ' · Bloque de foco' : ''}`,
        destino: { pantalla: 'evento' as const, id: evento.id },
      },
    ];
  });
}

// --- Resumen de la mañana ---

// La misma frase que en Hoy, calculada para todo el día (desde que te levantas).
export function fraseDeLaManana(eventos: Evento[], perfil: Perfil, dia: ClaveDia): string {
  const delDia = eventosDelDia(eventos, dia);
  const ocupados = delDia.map(intervaloDe);
  const pendientes = tareasPendientes(eventos, dia, dia);
  const huecos = calcularHuecos(ocupados, ventanaDelDia(perfil));
  const frase = fraseResumen({ eventos: delDia, tareasPendientes: pendientes.length, huecos });
  const minutosTareas = pendientes.reduce((total, t) => total + duracionTarea(t), 0);
  const carga = cargaDelDia(ocupados, minutosTareas, minutosDeJornada(perfil));
  return carga.alta ? `${frase} ${FRASE_DIA_JUSTO}` : frase;
}

function avisoResumenManana({ eventos, perfil }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  const cuando = momento(dia, minutosDesdeHora(perfil.horario.levantarse));
  const nombre = perfil.nombre.trim();
  return [
    {
      id: `resumen-manana:${dia}`,
      tipo: 'resumen-manana',
      dia,
      cuando,
      titulo: saludoSegunHora(cuando, nombre),
      cuerpo: fraseDeLaManana(eventos, perfil, dia),
      destino: { pantalla: 'hoy' },
    },
  ];
}

// --- Cierre del día ---

// Minuto del cierre: una hora antes de acostarse. Si te acuestas después de
// medianoche, cae en la madrugada del día siguiente (más de 24 h).
export function minutoCierre(perfil: Perfil): number {
  const levantarse = minutosDesdeHora(perfil.horario.levantarse);
  let acostarse = minutosDesdeHora(perfil.horario.acostarse);
  if (acostarse <= levantarse) acostarse += 24 * 60;
  return acostarse - 60;
}

export function horaCierre(perfil: Perfil): Hora {
  return horaDesdeMinutos(minutoCierre(perfil));
}

// "Llamar al taller, Comprar pan, Pagar la luz y 2 más"
export function listaTareas(titulos: string[], maximo = 3): string {
  if (titulos.length <= maximo) return unirConY(titulos);
  return `${titulos.slice(0, maximo).join(', ')} y ${titulos.length - maximo} más`;
}

export function textoCierre(titulos: string[]): string {
  if (titulos.length === 1) return `Te quedó 1 cosa: ${titulos[0]}. ¿La paso a mañana?`;
  return `Te quedaron ${titulos.length} cosas: ${listaTareas(titulos)}. ¿Las paso a mañana?`;
}

export const FRASE_BUENAS_NOCHES = 'No te queda nada pendiente. ¡A descansar!';

function avisoCierreDia({ eventos, perfil, ajustes }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  const pendientes = tareasPendientes(eventos, dia, dia);
  const base = {
    id: `cierre-dia:${dia}`,
    tipo: 'cierre-dia' as const,
    dia,
    cuando: momento(dia, minutoCierre(perfil)),
    destino: { pantalla: 'hoy' as const },
  };
  if (pendientes.length > 0) {
    return [
      {
        ...base,
        titulo: 'Cierre del día',
        cuerpo: textoCierre(pendientes.map((t) => t.titulo)),
        categoria: 'cierre-dia',
      },
    ];
  }
  if (ajustes.cierreSinPendientes === 'nada') return [];
  const nombre = perfil.nombre.trim();
  return [{ ...base, titulo: `Buenas noches${nombre ? `, ${nombre}` : ''}`, cuerpo: FRASE_BUENAS_NOCHES }];
}

// --- "Sal ya" (fase 6) ---

// "Sal ya: Reunión con Laura" / "18 min en coche hasta Oficina para llegar a las 10:30."
// A la hora de salir calculada con el tráfico previsto (y 5 min de margen). Se vuelve
// a calcular cada vez que se abre la app (services/rutas/actualizar.ts).
export function textoAvisoSalida(salida: Salida): { titulo: string; cuerpo: string } {
  const minutos = Math.max(1, Math.ceil(salida.duracionSeg / 60));
  const llegada = new Date(salida.llegada);
  const hora = horaDesdeMinutos(llegada.getHours() * 60 + llegada.getMinutes());
  const como = salida.modo === 'a-pie' ? 'a pie' : `en ${salida.modo}`;
  return {
    titulo: `Sal ya: ${salida.titulo}`,
    cuerpo: `${formatearDuracion(minutos)} ${como} hasta ${salida.lugar} para llegar a las ${hora}.`,
  };
}

// Al tocarlo se abre directamente Waze (o la app elegida) con el sitio puesto
// (26/10/2026): "... para llegar a las 10:30. Toca para ir con Waze."
function avisosDeSalida({ salidas = [], alarmas, navegador }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  // Si la cita tiene alarma de salida (fase 7), suena la alarma y no hace falta el aviso.
  const conAlarma = new Set(alarmas?.ajustes.salidas ?? []);
  return salidas
    .filter((s) => s.dia === dia && !conAlarma.has(s.eventoId))
    .map((s) => {
      const { titulo, cuerpo } = textoAvisoSalida(s);
      return {
        id: `salida:${s.clave}`,
        tipo: 'salida' as const,
        dia,
        cuando: new Date(s.salida),
        titulo,
        cuerpo: navegador ? `${cuerpo} Toca para ir con ${navegador}.` : cuerpo,
        destino: { pantalla: 'mapa' as const, id: s.eventoId, dia: s.dia },
        categoria: 'salida' as const,
      };
    });
}

// --- Alarmas (fase 7) ---

// Despertador e inteligente como avisos con sonido (Expo Go). La inteligente, a la hora
// adelantada si el tráfico lo pide; si no hay datos, a su hora de siempre.
function avisosDeAlarmas({ alarmas }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  if (!alarmas?.comoAvisos) return [];
  return alarmas.lista
    .filter((alarma) => suenaElDia(alarma, dia))
    .map((alarma) => {
      const adelanto = adelantoDe(alarma, dia, alarmas.adelantos);
      const destino = alarmas.adelantos[claveAdelanto(alarma.id, dia)]?.destino ?? 'el trabajo';
      return {
        id: `alarma:${alarma.id}:${dia}`,
        tipo: 'alarma' as const,
        dia,
        cuando: momento(dia, minutosDesdeHora(alarma.hora) - adelanto),
        titulo: tituloAlarma(alarma),
        cuerpo: adelanto > 0 ? `${motivoAdelanto(adelanto, destino)}.` : `Son las ${alarma.hora}.`,
        destino: { pantalla: 'alarmas' as const },
        categoria: 'alarma' as const,
      };
    });
}

// Alarma de salida como aviso (Expo Go): a la hora de salir, con "Cómo llegar".
function avisosDeAlarmaSalida(ctx: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  const { alarmas, salidas = [], ahora } = ctx;
  if (!alarmas?.comoAvisos) return [];
  return alarmasDeSalida(salidas, alarmas.ajustes.salidas, ahora)
    .filter((s) => s.dia === dia)
    .map((s) => ({
      id: `alarma-salida:${s.clave}`,
      tipo: 'alarma-salida' as const,
      dia,
      cuando: new Date(s.salida),
      ...textoAvisoSalida(s),
      destino: { pantalla: 'mapa' as const, id: s.eventoId, dia: s.dia },
      categoria: 'alarma-salida' as const,
    }));
}

// Aviso suave antes de acostarse. En los días de Época dorada no: la época ya tiene
// su "Hora de ir a dormir" con su propio horario.
function avisoDormir({ alarmas, perfil, epoca }: ContextoAvisos, dia: ClaveDia): AvisoPlanificado[] {
  if (!alarmas?.ajustes.dormir) return [];
  if (epoca && esDorada(epoca.epoca) && estadoEpoca(epoca.epoca, dia) === 'activa') return [];
  const antes = alarmas.ajustes.dormirAntesMin;
  return [
    {
      id: `dormir:${dia}`,
      tipo: 'dormir',
      dia,
      cuando: momento(dia, minutoDormir(perfil, antes)),
      titulo: `En ${formatearDuracion(antes)}, a dormir`,
      cuerpo: `Te acuestas a las ${perfil.horario.acostarse}. Ve dejando el móvil.`,
      destino: { pantalla: 'hoy' },
    },
  ];
}

// --- Todos juntos ---

const GENERADORES: Generador[] = [
  { activo: (a) => a.eventos, generar: avisosDeEventos },
  { activo: (a) => a.resumenManana, generar: avisoResumenManana },
  { activo: (a) => a.cierreDia, generar: avisoCierreDia },
  // Época dorada: cada aviso se apaga desde la sección de la época (Epoca.avisos).
  { activo: () => true, generar: (ctx, dia) => avisosDeEpoca(ctx.epoca, ctx.perfil, dia) },
  { activo: (a) => a.salida, generar: avisosDeSalida },
  // Alarmas: se encienden y apagan desde la pestaña Alarmas, no desde Perfil.
  { activo: () => true, generar: avisosDeAlarmas },
  { activo: () => true, generar: avisosDeAlarmaSalida },
  { activo: () => true, generar: avisoDormir },
  // Planes: cada plan tiene su interruptor "Recordar a todos 3 h antes" (Plan.recordar).
  { activo: () => true, generar: (ctx, dia) => avisosDePlanes(ctx.planes, ctx.eventos, dia) },
  // Plazos que llegaron por correo (fase 11): la víspera, a la hora de levantarse.
  { activo: (a) => a.plazosCorreo, generar: (ctx, dia) => avisosDePlazos(ctx.correos, ctx.eventos, ctx.perfil, dia) },
];

// Para probar desde Perfil: el resumen o el cierre de hoy tal cual llegarían,
// aunque su hora no sea ahora (y el cierre, aunque no quede nada pendiente).
// El "Sal ya" se prueba con la próxima salida calculada o, si no hay ninguna, con
// una de ejemplo (que al tocarla abre Hoy).
export function avisoDeHoy(tipo: 'resumen-manana' | 'cierre-dia' | 'salida', ctx: ContextoAvisos): AvisoPlanificado {
  const hoy = claveDia(ctx.ahora);
  if (tipo === 'salida') {
    const proxima = [...(ctx.salidas ?? [])].sort((a, b) => a.salida.localeCompare(b.salida))[0];
    if (proxima) return avisosDeSalida({ ...ctx, salidas: [proxima] }, proxima.dia)[0];
    const llegada = new Date(ctx.ahora.getTime() + 25 * 60000);
    const ejemplo = avisosDeSalida(
      {
        ...ctx,
        salidas: [
          {
            clave: 'ejemplo',
            eventoId: 'ejemplo',
            dia: hoy,
            titulo: 'Cita de ejemplo',
            lugar: 'Oficina',
            llegada: llegada.toISOString(),
            salida: ctx.ahora.toISOString(),
            duracionSeg: 18 * 60,
            retrasoSeg: 0,
            modo: 'coche',
            calculadaEl: ctx.ahora.toISOString(),
            origen: [0, 0],
          },
        ],
      },
      hoy,
    )[0];
    return { ...ejemplo, destino: { pantalla: 'hoy' } };
  }
  if (tipo === 'resumen-manana') return avisoResumenManana(ctx, hoy)[0];
  return avisoCierreDia({ ...ctx, ajustes: { ...ctx.ajustes, cierreSinPendientes: 'buenas-noches' } }, hoy)[0];
}

export function planificarAvisos(ctx: ContextoAvisos, dias = DIAS_A_PROGRAMAR): AvisoPlanificado[] {
  const hoy = claveDia(ctx.ahora);
  const activos = GENERADORES.filter((g) => g.activo(ctx.ajustes));
  const avisos: AvisoPlanificado[] = [];
  // Se empieza por ayer: si te acuestas después de medianoche, el cierre de
  // ayer puede no haber llegado todavía. Lo que ya ha pasado se quita abajo.
  for (let n = -1; n < dias; n++) {
    const dia = sumarDias(hoy, n);
    for (const generador of activos) avisos.push(...generador.generar(ctx, dia));
  }
  const futuros = avisos
    .filter((a) => a.cuando.getTime() > ctx.ahora.getTime())
    .sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  // Las alarmas se reservan su sitio antes de recortar: con muchos eventos, una alarma
  // de dentro de unos días se quedaría fuera y no sonaría. El resto rellena hasta MAX_AVISOS.
  const esAlarma = (a: AvisoPlanificado) => TIPOS_ALARMA.includes(a.tipo);
  const alarmas = futuros.filter(esAlarma).slice(0, MAX_AVISOS);
  const resto = futuros.filter((a) => !esAlarma(a)).slice(0, MAX_AVISOS - alarmas.length);
  return [...alarmas, ...resto].sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
}
