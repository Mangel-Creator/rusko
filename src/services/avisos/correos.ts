import type { CorreoResumido } from '@/data/correos';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { fechaDesdeClave, minutosDesdeHora, sumarDias, type ClaveDia } from '@/services/fechas';

import type { AvisoPlanificado } from './tipos';

// Plazos que llegaron por correo (fase 11): la víspera, a la hora de levantarse, un
// aviso "Mañana: Pagar el IBI". Solo si su tarea sigue en el calendario sin
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
        titulo: `Mañana: ${tarea.titulo}`,
        cuerpo: `Del correo de ${correo.de}. Lo tienes en las tareas.`,
        destino: { pantalla: 'evento' as const, id: tarea.id },
      },
    ];
  });
}
