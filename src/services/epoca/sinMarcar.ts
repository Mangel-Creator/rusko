import type { BloqueGuardado, Epoca, PlanesDelDia, RegistroBloque } from '@/data/epocas/tipos';
import { sumarDias, type ClaveDia } from '@/services/fechas';

// Lo que el plan tenía previsto en días pasados y no se marcó ni como hecho ni
// como saltado (se le olvidó, o no lo hizo). Mientras tanto ya se ha repartido
// solo en los días que quedan; al marcarlo, "Lo hice" lo descuenta y "No lo hice"
// guarda el motivo. Función pura, con pruebas.

// Cuántos días atrás se pregunta: más lejos ya no se acuerda nadie.
export const DIAS_SIN_MARCAR = 7;

export type DiaSinMarcar = { dia: ClaveDia; bloques: BloqueGuardado[] };

export function sinMarcar(
  epoca: Epoca,
  planesDelDia: PlanesDelDia,
  registro: RegistroBloque[],
  hoy: ClaveDia,
): DiaSinMarcar[] {
  const marcados = new Set(registro.filter((r) => r.epocaId === epoca.id).map((r) => r.id));
  const hitos = new Set(epoca.hitos.map((h) => h.id));
  const dias: DiaSinMarcar[] = [];
  const desde = sumarDias(hoy, -DIAS_SIN_MARCAR);
  for (let dia = sumarDias(hoy, -1); dia >= desde && dia >= epoca.inicio; dia = sumarDias(dia, -1)) {
    if (dia > epoca.fin) continue;
    const bloques = (planesDelDia[`${epoca.id}:${dia}`] ?? []).filter((b) => !marcados.has(b.id) && hitos.has(b.hitoId));
    if (bloques.length > 0) dias.push({ dia, bloques });
  }
  return dias;
}
