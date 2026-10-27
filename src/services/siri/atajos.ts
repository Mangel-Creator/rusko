// Siri con Atajos (27/10/2026): cómo se crean, una sola vez, los dos Atajos. Siri los
// ejecuta diciendo su nombre ("Oye Siri, apunta en Rusko"). Lo mismo, con más detalle,
// en la guía del usuario "Fase 09 - Siri con Atajos.md".

export const NOMBRE_APUNTAR = 'Apunta en Rusko';
export const NOMBRE_ALARMA = 'Alarma en Rusko';

// La etiqueta del Reloj empieza por "Organizy" para que el Atajo de cada noche
// ("Organizy alarmas") la gestione como las demás de Rusko.
const ETIQUETA_RELOJ = 'Organizy · Alarma de Siri';

export const PASOS_APUNTAR = [
  `En la app Atajos, toca el "+" de arriba a la derecha y llámalo exactamente: ${NOMBRE_APUNTAR}`,
  'Añade "Solicitar entrada" (búscalo escribiendo "entrada"). Tipo: Texto. Pregunta: ¿Qué apunto?',
  'Añade "Obtener contenido de URL" y pega tu enlace (el de "Copiar mi enlace").',
  'Toca la flecha de esa acción: Método, POST. Cuerpo de la solicitud, JSON. "Añadir nuevo campo", Texto: la clave es texto y el valor, la variable "Entrada proporcionada".',
  'Añade "Mostrar resultado" con "Contenido de URL": es lo que Siri te contesta.',
  'Toca "OK". Pruébalo: "Oye Siri, apunta en Rusko".',
] as const;

export const PASOS_ALARMA = [
  `Otro Atajo nuevo, llamado exactamente: ${NOMBRE_ALARMA}`,
  'Añade "Solicitar entrada". Tipo: Hora. Pregunta: ¿A qué hora?',
  `Añade "Crear alarma": la hora es "Entrada proporcionada" y la etiqueta, ${ETIQUETA_RELOJ}`,
  'Añade "Formatear fecha" con "Entrada proporcionada". Formato de fecha: Personalizado, y escribe: yyyy-MM-dd HH:mm xxx',
  'Añade "Obtener contenido de URL" con el mismo enlace. Método POST, cuerpo JSON y un campo de Texto: la clave es cuando y el valor, "Fecha formateada".',
  'Añade "Mostrar resultado" con "Contenido de URL".',
  'Toca "OK". Pruébalo: "Oye Siri, alarma en Rusko".',
] as const;
