import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { claveDia } from '@/services/fechas';

import {
  ACCION_A_MANANA,
  ACCION_ABRIR,
  ACCION_COMO_LLEGAR,
  ACCION_PARAR,
  ACCION_POSPONER,
  ACCION_RETRASO,
  ACCION_WHATSAPP,
  MINUTOS_POSPONER,
  type AvisoPlanificado,
  type DatosAviso,
} from './tipos';

// Notificaciones locales en el móvil (Android e iOS) con expo-notifications.
// En la web se usa programar.web.ts, que no hace nada: el navegador no puede
// programar avisos con la web cerrada.

export const avisosDisponibles = true;

const CANAL = 'avisos'; // Android: todas las notificaciones van en un canal
const PREFIJO_PRUEBA = 'prueba:';
// Alarma pospuesta 5 min (fase 7): tampoco se borra al reprogramar.
const PREFIJO_POSPUESTA = 'pospuesta:';

let preparado: Promise<void> | null = null;

// Se llama una vez al arrancar: cómo se muestran los avisos con la app abierta,
// el canal de Android y los botones del cierre del día.
export function prepararAvisos(): Promise<void> {
  if (!preparado) {
    preparado = (async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Avisos',
          // Existe (expo-notifications 58), pero la regla no sigue el "export *" de su build nuevo.
          // eslint-disable-next-line import/namespace
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      // iOS no deja que un botón de la notificación ejecute la app por detrás
      // (y menos en Expo Go), así que "Sí, a mañana" abre la app, pasa las
      // tareas al momento y enseña Hoy con la confirmación.
      await Notifications.setNotificationCategoryAsync('cierre-dia', [
        { identifier: ACCION_A_MANANA, buttonTitle: 'Sí, a mañana', options: { opensAppToForeground: true } },
        { identifier: ACCION_ABRIR, buttonTitle: 'Abrir', options: { opensAppToForeground: true } },
      ]);
      // "Sal ya" (fase 6): el botón abre la app y esta abre WhatsApp con el mensaje
      // escrito. Nunca se envía solo: la persona elige a quién y lo manda ella.
      await Notifications.setNotificationCategoryAsync('salida', [
        { identifier: ACCION_RETRASO, buttonTitle: 'Avisar de retraso', options: { opensAppToForeground: true } },
      ]);
      // Alarmas en Expo Go (fase 7). "Posponer" abre la app para programar el aviso
      // otra vez (iOS no deja ejecutar código desde el botón con la app cerrada);
      // "Parar" solo quita el aviso.
      const posponer = {
        identifier: ACCION_POSPONER,
        buttonTitle: `Posponer ${MINUTOS_POSPONER} min`,
        options: { opensAppToForeground: true },
      };
      const parar = { identifier: ACCION_PARAR, buttonTitle: 'Parar', options: { opensAppToForeground: false } };
      await Notifications.setNotificationCategoryAsync('alarma', [posponer, parar]);
      await Notifications.setNotificationCategoryAsync('alarma-salida', [
        posponer,
        parar,
        { identifier: ACCION_COMO_LLEGAR, buttonTitle: 'Cómo llegar', options: { opensAppToForeground: true } },
      ]);
      // Recordatorio de un plan (fase 8): el botón abre la app y esta abre WhatsApp con
      // el recordatorio escrito para el grupo.
      await Notifications.setNotificationCategoryAsync('plan', [
        { identifier: ACCION_WHATSAPP, buttonTitle: 'Recordar por WhatsApp', options: { opensAppToForeground: true } },
      ]);
      // Recordatorio a un cliente (fase 10): igual, pero en el chat de ese cliente.
      await Notifications.setNotificationCategoryAsync('cliente', [
        { identifier: ACCION_WHATSAPP, buttonTitle: 'Enviar por WhatsApp', options: { opensAppToForeground: true } },
      ]);
    })().catch(() => {});
  }
  return preparado;
}

function contenido(titulo: string, cuerpo: string, datos: DatosAviso, categoria?: string) {
  return {
    title: titulo,
    body: cuerpo,
    data: datos as unknown as Record<string, unknown>,
    sound: 'default' as const,
    ...(categoria ? { categoryIdentifier: categoria } : {}),
  };
}

// Sustituye todos los avisos programados por estos. Devuelve cuántos quedan.
export async function programarAvisos(avisos: AvisoPlanificado[]): Promise<number> {
  await prepararAvisos();
  const programados = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of programados) {
    // El aviso de prueba se deja: llega en unos segundos.
    if (!n.identifier.startsWith(PREFIJO_PRUEBA) && !n.identifier.startsWith(PREFIJO_POSPUESTA)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  for (const aviso of avisos) {
    await Notifications.scheduleNotificationAsync({
      identifier: aviso.id,
      content: contenido(
        aviso.titulo,
        aviso.cuerpo,
        { tipo: aviso.tipo, dia: aviso.dia, destino: aviso.destino, mensaje: aviso.mensaje, telefono: aviso.telefono },
        aviso.categoria,
      ),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: aviso.cuando, channelId: CANAL },
    });
  }
  return avisos.length;
}

export async function contarAvisosProgramados(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

// Para probar desde Perfil que los avisos llegan (en 5 segundos). Sin aviso,
// uno genérico; con aviso (por ejemplo el cierre de hoy), ese mismo con sus botones.
export async function enviarAvisoDePrueba(aviso?: AvisoPlanificado): Promise<void> {
  await prepararAvisos();
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIJO_PRUEBA}${Date.now()}`,
    content: aviso
      ? contenido(
          aviso.titulo,
          aviso.cuerpo,
          { tipo: aviso.tipo, dia: aviso.dia, destino: aviso.destino, mensaje: aviso.mensaje, telefono: aviso.telefono },
          aviso.categoria,
        )
      : contenido('Aviso de prueba', 'Si ves esto, los avisos de Organizy funcionan.', {
          tipo: 'prueba',
          dia: claveDia(new Date()),
          destino: { pantalla: 'hoy' },
        }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
      channelId: CANAL,
    },
  });
}

// Posponer una alarma (fase 7): el mismo aviso, con sus botones, dentro de 5 minutos.
// Devuelve la hora a la que sonará.
export async function posponerAviso(
  titulo: string,
  cuerpo: string,
  datos: DatosAviso,
  categoria: string | null,
): Promise<Date> {
  await prepararAvisos();
  const cuando = new Date(Date.now() + MINUTOS_POSPONER * 60000);
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIJO_POSPUESTA}${Date.now()}`,
    content: contenido(titulo, cuerpo, datos, categoria ?? undefined),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando, channelId: CANAL },
  });
  return cuando;
}

export type AccionAviso = 'tocar' | 'a-manana' | 'abrir' | 'retraso' | 'posponer' | 'parar' | 'como-llegar' | 'whatsapp';

export type RespuestaAviso = {
  accion: AccionAviso;
  datos: DatosAviso;
  // El aviso tal cual, para poder posponerlo.
  titulo: string;
  cuerpo: string;
  categoria: string | null;
};

const ACCIONES: Record<string, AccionAviso> = {
  [ACCION_A_MANANA]: 'a-manana',
  [ACCION_ABRIR]: 'abrir',
  [ACCION_RETRASO]: 'retraso',
  [ACCION_POSPONER]: 'posponer',
  [ACCION_PARAR]: 'parar',
  [ACCION_COMO_LLEGAR]: 'como-llegar',
  [ACCION_WHATSAPP]: 'whatsapp',
};

function traducir(respuesta: Notifications.NotificationResponse): RespuestaAviso | null {
  const { content } = respuesta.notification.request;
  const datos = content.data as unknown as DatosAviso | undefined;
  if (!datos?.destino) return null;
  return {
    accion: ACCIONES[respuesta.actionIdentifier] ?? 'tocar',
    datos,
    titulo: content.title ?? '',
    cuerpo: content.body ?? '',
    categoria: content.categoryIdentifier ?? null,
  };
}

// Avisa cada vez que el usuario toca un aviso o uno de sus botones, también el
// que abrió la app si estaba cerrada. Devuelve la función para dejar de escuchar.
export function escucharRespuestas(alResponder: (respuesta: RespuestaAviso) => void): () => void {
  const atender = (respuesta: Notifications.NotificationResponse | null) => {
    if (!respuesta) return;
    // Se borra para no atenderla dos veces (por ejemplo, al volver a montar).
    Notifications.clearLastNotificationResponse();
    const traducida = traducir(respuesta);
    if (traducida) alResponder(traducida);
  };
  atender(Notifications.getLastNotificationResponse());
  const suscripcion = Notifications.addNotificationResponseReceivedListener(atender);
  return () => suscripcion.remove();
}
