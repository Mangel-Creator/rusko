import type { ClaveDia } from '@/services/fechas';

// Tipos de los avisos (notificaciones locales). Sin nada de expo-notifications:
// así la planificación se puede probar con Jest.

// Tipos de aviso que existen. Para añadir uno, añádelo aquí y crea su generador
// en planificar.ts. Los "epoca-..." son de la Época dorada (services/avisos/epoca.ts)
// y "salida" es el "Sal ya" de la fase 6. Los de la fase 7: "alarma" (despertador e
// inteligente, en Expo Go), "alarma-salida" y "dormir" (aviso suave, en todos los niveles).
export type TipoAviso =
  | 'evento'
  | 'resumen-manana'
  | 'cierre-dia'
  | 'epoca-salir'
  | 'epoca-bloque'
  | 'epoca-descanso'
  | 'epoca-dormir'
  | 'salida'
  | 'alarma'
  | 'alarma-salida'
  | 'dormir'
  | 'plan-recordatorio' // "Recordar a todos 3 h antes" (fase 8)
  | 'plazo-correo' // la víspera de un plazo que llegó por correo (fase 11)
  | 'recordatorio-correo'; // "Recuérdamelo" de un correo, a la hora elegida (27/10/2026)

// Los que van primero al recortar a MAX_AVISOS: una alarma nunca se queda fuera.
export const TIPOS_ALARMA: readonly TipoAviso[] = ['alarma', 'alarma-salida'];

// Adónde lleva la app al tocar el aviso.
export type Destino =
  | { pantalla: 'hoy' }
  | { pantalla: 'alarmas' }
  | { pantalla: 'evento'; id: string }
  | { pantalla: 'mapa'; id: string; dia: ClaveDia } // la ruta hasta ese evento (fase 6)
  | { pantalla: 'plan'; id: string } // un plan con votación (fase 8)
  | { pantalla: 'resumenes' }; // resúmenes de correo (fase 11)

// Botones dentro de la notificación. Cada categoría se registra una vez al
// arrancar (services/avisos/programar.ts).
export type CategoriaAviso = 'cierre-dia' | 'salida' | 'alarma' | 'alarma-salida' | 'plan';

export const ACCION_A_MANANA = 'a-manana';
export const ACCION_ABRIR = 'abrir';
// "Sal ya" (fase 6): abre WhatsApp con "Voy con unos 10 min de retraso, lo siento".
export const ACCION_RETRASO = 'avisar-retraso';
// Alarmas (fase 7).
export const ACCION_POSPONER = 'posponer';
export const ACCION_PARAR = 'parar';
export const ACCION_COMO_LLEGAR = 'como-llegar';
export const MINUTOS_POSPONER = 5;
// Recordatorio de un plan (fase 8): abre WhatsApp con el recordatorio escrito.
export const ACCION_WHATSAPP = 'whatsapp';

export type AvisoPlanificado = {
  // Único y estable, por ejemplo "evento:<id>:2026-09-24" o "resumen-manana:2026-09-24".
  id: string;
  tipo: TipoAviso;
  dia: ClaveDia; // día al que se refiere (el cierre de la noche es del día que termina)
  cuando: Date;
  titulo: string;
  cuerpo: string;
  destino: Destino;
  categoria?: CategoriaAviso;
  mensaje?: string; // texto para WhatsApp (recordatorio de un plan)
};

// Lo que se guarda dentro de la notificación para saber qué hacer al tocarla.
// "plan-voto" es el push que manda el servidor cuando alguien vota (fase 8) y
// "correo", el que manda el ayudante de Gmail del usuario (fase 11).
export type DatosAviso = {
  tipo: TipoAviso | 'prueba' | 'plan-voto' | 'correo';
  dia: ClaveDia;
  destino: Destino;
  mensaje?: string;
};
