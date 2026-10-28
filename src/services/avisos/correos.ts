import type { CorreoResumido } from '@/data/correos';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { asuntoCorto, textoTienes } from '@/services/correo/correos';
import { claveDia, fechaDesdeClave, minutosDesdeHora, sumarDias, type ClaveDia } from '@/services/fechas';

import type { AvisoPlanificado } from './tipos';

// Plazos que llegaron por correo (fase 11): la víspera, a la hora de levantarse, un
// aviso "Tienes que pagar el IBI mañana". Solo si su tarea sigue en el calendario sin
// hacer (si la borras o la marcas, no hay aviso). El aviso de cuando llega el correo
// no es de aquí: lo manda el ayudante de Gmail al momento.

export function avisosDePlazos(
  correos: CorreoResumido[] = [],
  eventos: Evento[],
  perfil: Perfil,
  dia: ClaveDia,
): AvisoPlanificado[] {
  const manana = sumarDias(dia, 1);
  return correos.flatMap((correo) => {
    if (correo.noEsPlazo || correo.fechaLimite !== manana || !correo.eventoId) return [];
    const tarea = eventos.find((e) => e.id === correo.eventoId);
    if (!tarea || tarea.hecha) return [];
    const fecha = fechaDesdeClave(dia);
    return [
      {
        id: `plazo-correo:${correo.id}:${dia}`,
        tipo: 'plazo-correo' as const,
        dia,
        cuando: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, minutosDesdeHora(perfil.horario.levantarse)),
        titulo: textoTienes(tarea.titulo, manana, dia, tarea.flexible ? null : tarea.horaInicio),
        cuerpo: `Del correo de ${correo.de}. ${tarea.flexible ? 'Lo tienes en las tareas.' : 'Está en tu calendario.'}`,
        destino: { pantalla: 'evento' as const, id: tarea.id },
      },
    ];
  });
}

// "Recuérdamelo" de un correo (recordarCorreo): un aviso a la hora elegida, que abre la
// pestaña Correo. Los quitados de Rusko no avisan.
export function avisosDeRecordatorios(correos: CorreoResumido[] = [], dia: ClaveDia): AvisoPlanificado[] {
  return correos.flatMap((correo) => {
    if (!correo.recordatorio || correo.oculto) return [];
    const cuando = new Date(correo.recordatorio);
    if (Number.isNaN(cuando.getTime()) || claveDia(cuando) !== dia) return [];
    return [
      {
        id: `recordatorio-correo:${correo.id}`,
        tipo: 'recordatorio-correo' as const,
        dia,
        cuando,
        titulo: `${correo.de}: ${asuntoCorto(correo.titulo || correo.asunto, 50)}`,
        cuerpo: 'Me pediste que te lo recordara.',
        destino: { pantalla: 'resumenes' as const },
      },
    ];
  });
}
