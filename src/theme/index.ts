import type { TextStyle } from 'react-native';

// Tema de Organizy: todos los colores, letras y medidas salen de aquí.
// Si quieres cambiar un color, cámbialo en este archivo y se actualiza en toda la app.
// El porqué de cada decisión está en BRIEF.md (raíz del repositorio).

export const colores = {
  // Modo oscuro cálido (rediseño 'fintech' del 26/10/2026): fondo casi negro, superficies
  // un punto más claras y nada de sombras. Las tarjetas se separan por el color de fondo.
  fondo: '#0F0D0C',
  tarjeta: '#1A1714',
  elevado: '#24201C', // un nivel más arriba: botón secundario, casillas, chips
  texto: '#F5F1EC',
  textoSecundario: '#A39A90', // 6,4:1 sobre la tarjeta
  borde: '#2E2924', // separadores sutiles; decorativo
  bordeCampo: '#7A6F64', // borde de los campos de texto: se ve dónde escribir (3,6:1)
  // Texto oscuro para lo que va sobre un fondo vivo (naranja, dorado, WhatsApp, degradados).
  textoOscuro: '#0F0D0C',

  // 'Tinta': cajas destacadas oscuras (alarma inteligente, aviso del mapa, burbujas).
  // En modo oscuro es la superficie elevada, con el texto claro de siempre encima.
  tinta: '#24201C',
  tintaSuave: '#2E2924',
  textoSobreTinta: '#F5F1EC',
  textoSecundarioSobreTinta: '#A39A90',

  // Naranja: solo acciones clave (botón principal, '+', pestaña activa, interruptores,
  // hoy) y cifras destacadas. Encima, texto oscuro.
  principal: '#FF6B1A',
  principalHover: '#FF8A47',
  principalPulsado: '#E0560A',
  textoSobrePrincipal: '#0F0D0C',
  // Naranja al 12 % sobre el fondo: lo elegido (chips, casillas, iconos activos).
  acentoSuave: '#2C180E',

  // Rojo: errores, avisos ('pisa tu bloque de foco') y días muy cargados.
  aviso: '#FF4D4F',

  // Colores por tipo de evento. Cada color significa una sola cosa: el violeta es solo
  // Clientes, el verde solo Amigos y el blanco cálido solo Yo. (Clientes dejó el naranja
  // el 26/10/2026: el naranja pasó a ser el color de pulsar.)
  clientes: '#9C8BFF',
  amigos: '#2BC48A',
  yo: '#D9D1C7',

  // Barrita de carga en Semana cuando el día va normal y borde de los huecos libres
  cargaNormal: '#7A6F64',

  // Ámbar: solo para la Época dorada (franja, bloques de estudio, días con hito).
  // Encima va texto oscuro (colores.textoOscuro).
  dorado: '#FFB020',

  // Verde de WhatsApp: solo el botón 'Enviar por WhatsApp' (excepción elegida por el
  // usuario el 26/09/2026, como los colores del tráfico en el Mapa). Encima va texto
  // oscuro (colores.textoOscuro).
  whatsapp: '#25D366',

} as const;

// Degradados de las tarjetas destacadas: lo único llamativo de cada pantalla.
// Encima, siempre texto oscuro (colores.textoOscuro).
export const degradados = {
  naranja: ['#FF6B1A', '#FFB020'], // naranja → ámbar: 'Lo siguiente' en Hoy
  teja: ['#FF6B1A', '#C2361B'], // naranja → rojo teja
} as const;

// Recuadros de la pestaña Correo por importancia (27/10/2026, a petición del usuario):
// rojo muy importante, naranja importante, azul medio y blanco poco. Otra excepción a
// 'cada color significa una sola cosa', solo dentro de la bandeja de Correo. Los dos de
// arriba van rellenos con texto oscuro (5,9:1 y 6,8:1) para que salten a la vista; azul y
// blanco van en tinte oscuro con borde de su color y el texto claro de siempre (14:1),
// para que lo poco importante no deslumbre.
export const coloresNivel = {
  3: { fondo: '#FF4D4F', borde: '#FF4D4F', texto: colores.textoOscuro, secundario: '#2A0E0E', boton: 'rgba(15,13,12,0.14)' },
  2: { fondo: '#FF6B1A', borde: '#FF6B1A', texto: colores.textoOscuro, secundario: '#2A1206', boton: 'rgba(15,13,12,0.14)' },
  1: { fondo: '#16233A', borde: '#6EA8FF', texto: colores.texto, secundario: '#A9B8D0', boton: '#22355A' },
  0: { fondo: colores.tarjeta, borde: '#D9D1C7', texto: colores.texto, secundario: colores.textoSecundario, boton: colores.elevado },
} as const;

export type NivelCorreo = keyof typeof coloresNivel;

// Acentos de color (28/10/2026, el usuario: "dale algo más de color, solo hay negro y
// naranja"): la misma paleta de los recuadros de Correo para los iconos redondos de las
// acciones rápidas de Hoy, los apartados de Perfil y la pestaña activa de la barra.
// Icono del color sobre un círculo de su tinte oscuro (el color al ~16 % sobre el fondo).
export const acentos = {
  naranja: { color: colores.principal, suave: '#3A1E0F' },
  rojo: { color: '#FF4D4F', suave: '#3A1719' },
  azul: { color: '#6EA8FF', suave: '#16233A' },
  blanco: { color: colores.texto, suave: colores.elevado },
} as const;

export type Acento = keyof typeof acentos;

// Color de cada tipo de evento (Cliente, Amigos, Yo)
export const colorTipo = {
  cliente: colores.clientes,
  amigos: colores.amigos,
  yo: colores.yo,
} as const;

// Colores del tráfico: la única excepción a 'cada color significa una sola cosa', y
// solo dentro del mapa (es el código que todo el mundo reconoce en la carretera).
export const coloresMapa = {
  atasco: '#D0312D', // rojo: tramo con atasco
  denso: '#F2B01E', // amarillo: tráfico denso
  // Estilo "navegador" en modo claro (27/10/2026, a petición del usuario): fondo gris
  // azulado muy claro y apagado, la ruta en azul vivo con un borde azul oscuro y los
  // puntos en el mismo azul. Es la única parte clara de la app.
  fondo: '#EEF2F7', // fondo del mapa (antes de cargar las piezas)
  ruta: '#2F6BFF', // la ruta elegida, tu posición y el destino
  bordeRuta: '#1546C9', // borde de la ruta, para que se lea sobre el mapa claro
  rutaAlternativa: '#9DB0CF', // las otras rutas, en azul grisáceo
  blanco: '#FFFFFF', // centro de las marcas y bordes
  texto: '#1B2433', // texto y botones sobre el mapa
  textoSecundario: '#5B6577',
  parking: '#3D6BFF', // "P" de los parkings cerca del destino, en azul como las señales
  bordeParking: '#FFFFFF',
} as const;

// Botones para entrar con Google o Microsoft (BotonEntrarCon): los colores que exigen
// sus normas de marca (tema claro) y los del logo de Microsoft. Otra excepción a 'cada
// color significa una sola cosa' (29/09/2026), solo en esos botones y en el logo de cada
// cuenta vinculada: sin ellos, Google y Microsoft pueden rechazar la app en su revisión.
export const coloresMarca = {
  googleFondo: '#FFFFFF',
  googleBorde: '#747775',
  googleTexto: '#1F1F1F',
  microsoftFondo: '#FFFFFF',
  microsoftBorde: '#8C8C8C',
  microsoftTexto: '#5E5E5E',
  microsoftRojo: '#F25022',
  microsoftVerde: '#7FBA00',
  microsoftAzul: '#00A4EF',
  microsoftAmarillo: '#FFB900',
} as const;

// En modo oscuro todo va sobre fondo oscuro: los colores de tipo valen tal cual.
// (Se mantiene el nombre para no tocar las pantallas que lo usan.)
export const colorTipoSobreTinta = colorTipo;

// Iconos de tipo: círculo con el color del tipo al 14 % sobre la tarjeta y el icono
// en el color del tipo. Mismo significado que colorTipo.
export const colorBaldosa = {
  cliente: { fondo: '#2C2735', icono: colores.clientes },
  amigos: { fondo: '#1C2F25', icono: colores.amigos },
  yo: { fondo: colores.elevado, icono: colores.texto },
  estudio: { fondo: '#3A2C16', icono: colores.dorado }, // Época dorada
  neutro: { fondo: colores.elevado, icono: colores.texto }, // tareas, todo el día
} as const;

// Color de la barra de un evento: el de su tipo.
export function colorEvento(evento: { tipo: keyof typeof colorTipo }): string {
  return colorTipo[evento.tipo];
}

export function colorEventoSobreTinta(evento: { tipo: keyof typeof colorTipoSobreTinta }): string {
  return colorEvento(evento);
}

// Inter para todo. Titulares muy gruesos (700-800) y apretados; las horas y cifras
// llevan números tabulares (todas las cifras igual de anchas, como en un reloj).
export const fuentes = {
  titulo: 'Inter_700Bold',
  tituloFuerte: 'Inter_800ExtraBold',
  texto: 'Inter_400Regular',
  textoMedio: 'Inter_500Medium',
  textoFuerte: 'Inter_600SemiBold',
  hora: 'Inter_500Medium',
  horaFuerte: 'Inter_700Bold',
} as const;

// Para horas y cifras: que no bailen de una fila a otra.
export const cifras: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const tamanos = {
  pequeno: 14,
  normal: 16,
  grande: 18,
  titulo: 24,
  tituloGrande: 34,
  cifra: 44, // horas y números destacados
} as const;

export const espacio = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

// Esquinas muy redondeadas: tarjetas de 24 y botones en píldora.
export const radio = {
  pequeno: 12, // campos, filas pequeñas
  normal: 16, // casillas
  grande: 24, // tarjetas
  chip: 999, // redondo del todo: botones, chips, interruptores y barras
} as const;

// Duración de las transiciones: rápidas y sin rebotes.
export const duracion = { corta: 150, normal: 200, larga: 250 } as const;

// Altura mínima de cualquier cosa que se pueda pulsar
export const alturaTactil = 44;

export const tema = { colores, colorTipo, colorTipoSobreTinta, degradados, fuentes, cifras, tamanos, espacio, radio, duracion, alturaTactil };
