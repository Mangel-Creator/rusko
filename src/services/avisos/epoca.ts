import type { Epoca } from '@/data/epocas/tipos';
import type { Perfil } from '@/data/perfil';
import { NOMBRE_CASA, resolverLugar } from '@/services/agenda';
import {
  esDorada,
  estadoEpoca,
  lugarDelDia,
  textoHoras,
  ventanaEpoca,
  type BloquePlan,
  type PlanEpoca,
} from '@/services/epoca';
import { fechaDesdeClave, horaDesdeMinutos, sumarDias, type ClaveDia } from '@/services/fechas';

import type { AvisoPlanificado } from './tipos';

// Avisos de la Época dorada (fase 4b). Función pura, con pruebas en
// services/epoca/__tests__. Se registra en GENERADORES (planificar.ts).
//
//   - Hora de salir hacia el sitio de estudio (primer bloque menos lo que tarda en llegar).
//   - Inicio de cada bloque.
//   - Fin del descanso, si justo después empieza otro bloque.
//   - "Hora de ir a dormir" a la hora de acostarse de la época.
// Cada uno se apaga desde la sección de la época (Epoca.avisos).

export type EpocaParaAvisos = { epoca: Epoca; plan: PlanEpoca };

function momento(dia: ClaveDia, minutos: number): Date {
  const fecha = fechaDesdeClave(dia);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, minutos);
}

function nombreHito(epoca: Epoca, id: string): string {
  return epoca.hitos.find((h) => h.id === id)?.nombre ?? 'tu plan';
}

function tramo(b: BloquePlan): string {
  return `${horaDesdeMinutos(b.inicio)} – ${horaDesdeMinutos(b.fin)}`;
}

export function avisosDeEpoca(
  datos: EpocaParaAvisos | null | undefined,
  perfil: Perfil,
  dia: ClaveDia,
): AvisoPlanificado[] {
  if (!datos || estadoEpoca(datos.epoca, dia) !== 'activa') return [];
  const { epoca, plan } = datos;
  const base = { dia, destino: { pantalla: 'hoy' as const } };
  const avisos: AvisoPlanificado[] = [];
  const bloques = plan.bloques.filter((b) => b.dia === dia && b.estado === 'pendiente');

  const primero = bloques[0];
  const lugar = resolverLugar(lugarDelDia(epoca, dia), perfil);
  if (epoca.avisos.salir && primero && lugar && lugar.nombre !== NOMBRE_CASA) {
    avisos.push({
      ...base,
      id: `epoca-salir:${dia}`,
      tipo: 'epoca-salir',
      cuando: momento(dia, primero.inicio - epoca.ritmo.trayectoMin),
      titulo: `Hora de salir hacia ${lugar.nombre ?? lugar.direccion}`,
      cuerpo: `Tu primer bloque empieza a las ${horaDesdeMinutos(primero.inicio)} (${nombreHito(epoca, primero.hitoId)}).`,
    });
  }

  bloques.forEach((bloque, i) => {
    const descanso = bloque.descansoFin - bloque.fin;
    if (epoca.avisos.inicioBloque) {
      avisos.push({
        ...base,
        id: `epoca-bloque:${bloque.id}`,
        tipo: 'epoca-bloque',
        cuando: momento(dia, bloque.inicio),
        titulo: `Empieza tu bloque: ${nombreHito(epoca, bloque.hitoId)}`,
        cuerpo: `${tramo(bloque)}${descanso > 0 ? ` · luego ${descanso} min de descanso` : ''}`,
      });
    }
    const siguiente = bloques[i + 1];
    if (epoca.avisos.finDescanso && descanso > 0 && siguiente && siguiente.inicio === bloque.descansoFin) {
      avisos.push({
        ...base,
        id: `epoca-descanso:${bloque.id}`,
        tipo: 'epoca-descanso',
        cuando: momento(dia, bloque.descansoFin),
        titulo: 'Se acabó el descanso',
        cuerpo: `Sigue con ${nombreHito(epoca, siguiente.hitoId)} hasta las ${horaDesdeMinutos(siguiente.fin)}.`,
      });
    }
  });

  // Solo con Época dorada: un plan de estudio no cambia la hora de acostarse.
  if (epoca.avisos.dormir && esDorada(epoca)) {
    const manana = plan.bloques.filter((b) => b.dia === sumarDias(dia, 1) && b.estado === 'pendiente');
    const minutosManana = manana.reduce((t, b) => t + (b.fin - b.inicio), 0);
    avisos.push({
      ...base,
      id: `epoca-dormir:${dia}`,
      tipo: 'epoca-dormir',
      cuando: momento(dia, ventanaEpoca(epoca).fin),
      titulo: 'Hora de ir a dormir',
      cuerpo:
        minutosManana > 0
          ? `Mañana tienes ${manana.length} ${manana.length === 1 ? 'bloque' : 'bloques'} (${textoHoras(minutosManana)}). Descansar también cuenta.`
          : 'Mañana no tienes bloques. Toca descansar.',
    });
  }
  return avisos;
}
