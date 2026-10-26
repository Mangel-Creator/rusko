# Brief de diseño — Organizy

Decidido con el usuario (`/diseno`). Sirve para que cualquier sesión retome el diseño
sin repetir la entrevista. Los valores reales viven en `src/theme/index.ts`; este
archivo explica el porqué.

## Historia

- 24/09/2026 — Versión 1, "cuaderno cálido": crema, títulos en Fraunces y tarjetas
  blancas redondeadas con borde.
- 25/09/2026 — El usuario la probó en el móvil: funcionaba, pero "se nota mucho que
  es hecho por una IA". Lo que más le chirriaba: **todas las tarjetas iguales**.
  Vio tres direcciones dibujadas y eligió la **"agenda nocturna" (C) con la paleta de
  colores de siempre**, y un **tono más cercano** en toda la app.
- 26/10/2026 — **Rediseño "fintech" oscuro con paleta naranja** (lo pidió el usuario con
  unas reglas cerradas): modo oscuro cálido, Inter, botones en píldora, tarjetas de 24 sin
  sombra, una tarjeta destacada con degradado naranja → ámbar y listas tipo movimientos.
  **Es la vigente**; sus reglas están en `CLAUDE.md` > "Diseño". Lo de abajo (agenda
  nocturna) queda como historia, salvo el **tono**, que sigue igual.

## Objetivo y público

App para organizar el día de alguien que mezcla vida personal, amigos y clientes.
Para cualquier persona, en español de España, móvil primero (web en GitHub Pages
y app en Expo Go). Tiene que leerse de un vistazo.

## Dirección visual: agenda nocturna

- **Hoy empieza con una cabecera oscura** (`tinta`) a todo lo ancho: fecha, saludo,
  resumen del día y la tarjeta "Lo siguiente". Es lo que distingue la app a primera
  vista. La franja de la hora y la batería va del mismo color (`Pantalla colorArriba`)
  y en blanco mientras Hoy está a la vista.
- **Filas planas, no tarjetas**: cada evento o tarea es una fila blanca sin borde con
  una **barra de 4 px a la izquierda del color de su tipo**. Sin esquinas redondeadas
  en las filas con barra. Los huecos libres, con borde discontinuo.
- **Horas en letra de reloj** (IBM Plex Mono): las cifras quedan alineadas de una fila
  a otra, como en un horario.
- Resto de cajas (formularios, avisos): blancas, planas, sin borde. Solo los campos de
  texto llevan borde (`bordeCampo`), para que se vea dónde escribir.
- **Esquinas más rectas**: 6 px en chips y campos, 8 en botones, 10 en cajas; el "+"
  es un cuadrado de esquinas suaves (14). Redondo del todo solo lo que es redondo:
  interruptores, barras de progreso y de carga, la inicial de Perfil.
- Solo modo claro, sin degradados; la única sombra es la del "+", que flota.

### Hoy como panel de casillas (26/09/2026)

El usuario veía la app "muy muy supercargada" y la quería "mucho más visual". Hoy apilaba
diez bloques casi todos de texto. Vio tres dibujos (línea del día, una cosa grande, panel
de iconos) y eligió **el panel de iconos con las dos casillas de acceso de la "una cosa
grande"**:

- Cabecera oscura: fecha, saludo y "Lo siguiente". La frase de resumen desaparece: lo
  dicen los números de las casillas.
- Seis casillas grandes, de dos en dos: icono en un cuadrado de color suave del tipo
  (`colorBaldosa`), número grande y etiqueta corta. Clientes, planes con amigos, tareas,
  cosas tuyas (o bloques de estudio con época), "Todo el día" y "Época dorada".
- Al tocar una, su lista sale debajo y la casilla se pone en tinta. Así se enseña una
  sola cosa cada vez.
- La captura rápida, plegada detrás del "+". La energía, solo donde sirve (tareas y estudio).

Y los formularios, empezando por la Época dorada ("un coñazo y largos"): lo esencial con
casillas de icono (`SelectorVisual`) y lo opcional plegado en "Más ajustes" (`Plegable`)
con una línea de resumen. Valores por defecto en vez de preguntas: nombre automático,
empieza hoy, bloques de 50 + 10.

### Época dorada en Hoy (25/09/2026)

El usuario veía la Época dorada amontonada: cada bloque repetía el examen y la dirección
entera de la biblioteca, cada descanso tenía su línea y el aviso en rojo, las barras y
"Tu día" iban seguidos. Pidió rebajarlo y meter **cada cosa en un rectángulo
redondeado** para separarla del resto del día. Por eso, aquí las filas planas ceden
a cajas: cuenta atrás, "Plan de hoy" (sitio y tipo de bloque una sola vez arriba; cada
bloque en una línea con una raya fina entre ellos), aviso de "no caben" (icono granate,
texto normal, sin negrita roja) y "Cómo vas" (barras de progreso).

## Paleta (la de siempre, más los tonos de la cabecera)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `fondo` | `#F4F1EA` | Fondo de pantalla | — |
| `tarjeta` | `#FFFFFF` | Filas y cajas | — |
| `texto` | `#1A1C24` | Texto principal; "Yo"; bloques de foco | 15 : 1 |
| `textoSecundario` | `#5E5A52` | Texto de apoyo | 6.1 : 1 |
| `borde` | `#DDD6C8` | Separadores; decorativo | — |
| `bordeCampo` | `#958D81` | Borde de los campos de texto | 3.3 : 1 |
| `tinta` | `#1A1C24` | Cabecera oscura de Hoy | — |
| `tintaSuave` | `#2E313C` | "Lo siguiente" dentro de la cabecera | — |
| `textoSecundarioSobreTinta` | `#B9BCC8` | Fecha y detalles en la cabecera | 6.8 : 1 |
| `principal` | `#2B4BD8` | Pulsar: botón principal, "+", pestaña activa, hoy | 6.8 : 1 con blanco |
| `aviso` | `#A1172F` | Errores, avisos, días muy cargados | 7.8 : 1 |
| `clientes` / `amigos` / `yo` | `#C4461E` / `#16734F` / `#1A1C24` | Barra de cada tipo | ≥ 3 : 1 |
| `colorTipoSobreTinta` | `#F2956C` / `#5CC495` / `#E4E6EC` | La misma barra sobre la cabecera oscura | ≥ 4.8 : 1 |
| `cargaNormal` | `#8A8374` | Barrita de carga normal, borde de huecos, barra de filas pasadas | 3.8 : 1 |

Regla: **cada color significa una sola cosa** (azul = pulsar, naranja = Clientes,
verde = Amigos, negro = Yo, granate = aviso). Dos excepciones, las dos decididas por el
usuario (ver CLAUDE.md):
- Dentro del Mapa, la carretera pintada según el tráfico, estilo Waze.
- Los botones "Enviar por WhatsApp" van en el verde de WhatsApp (`colores.whatsapp`,
  `#25D366`, con texto oscuro encima), solo esos botones. Es la marca que todo el mundo
  reconoce, igual que los colores del tráfico.

## Tipografía: IBM Plex

| Uso | Letra | Tamaño / interlineado |
|---|---|---|
| Título nivel 1 | IBM Plex Sans 600 | 30 / 36, interletrado −0.5 |
| Título nivel 2 | IBM Plex Sans 600 | 22 / 28, interletrado −0.2 |
| Título nivel 3 | IBM Plex Sans 600 | 18 / 24 |
| Texto | IBM Plex Sans 400 (500 para etiquetas, 600 para destacar) | 16 / 22 |
| Texto pequeño | IBM Plex Sans 400 | 13 / 18 |
| Horas | IBM Plex Mono 500 (600 en la hora de inicio) | el del texto |

## Tono: cercano, sin pasarse

Como una persona de confianza que te echa una mano: tuteo, frases cortas y algún giro
coloquial suave. Sin emojis, sin exclamaciones de colega, sin "por favor".

| En vez de | Mejor |
|---|---|
| Buenos días, Miguel | ¿Qué toca hoy, Miguel? (tarde: "¿Qué queda hoy…?"; noche: "¿Qué tal el día…?") |
| ¿Con cuánta energía vas hoy? | ¿Cómo vas de energía? |
| Hoy: 2 clientes, 1 plan con amigos… | Tienes 2 clientes y un plan con amigos. Tu mejor hueco: de 16:00 a 21:00. |
| Siguiente / Ahora | Lo siguiente / Ahora mismo |
| Escribe tu municipio o barrio. | Dime dónde vives, que lo uso para el tráfico. |
| Esto pisa tu bloque de foco. ¿Seguro? | Ojo, esto pisa tu bloque de foco. ¿Lo guardo igual? |
| No se puede deshacer. | Luego no hay vuelta atrás. |
| Cambios guardados. | Guardado. |

## Densidad y movimiento (se mantienen)

- Cada persona elige en Perfil > "Cómo se ve": Con aire, Equilibrado (por defecto) o
  Compacto. Afecta a las listas de Hoy y a la línea de horas de Semana.
- Alguna animación suave, sin excesos: la casilla salta al marcarla, las filas se
  recolocan deslizándose, Semana hace un fundido al cambiar de día y los botones se
  hunden al pulsarlos. Nada se anima al abrir una pantalla y todo respeta "reducir
  movimiento".
- Filas apagadas (eventos pasados, tareas hechas) sin opacidad: pierden el fondo
  blanco, el texto pasa a gris y la barra a `cargaNormal`.

## Alarmas: tarjeta de alarma inteligente

Pedida para la fase 7. Es la misma idea que la cabecera de Hoy: lo importante, en
oscuro.

- Fondo `tinta`, esquinas de 10 px, sin borde ni sombra.
- **Hora nueva** muy grande: IBM Plex Mono 600, 56 px, blanca.
- **Hora original tachada** al lado, más pequeña: IBM Plex Mono 500, 20 px,
  `textoSecundarioSobreTinta` (8,9 : 1), con `textDecorationLine: 'line-through'`.
  Nunca con opacidad.
- **Motivo** en una línea debajo ("20 min antes: hay atasco en la M-30"), en blanco.
  Si hace falta un acento, la barra izquierda de 4 px en `colorTipoSobreTinta.yo`.
- El azul `principal` no se lee sobre la tinta (2,2 : 1). Si hay un interruptor dentro
  de la tarjeta, que vaya fuera de ella o en blanco sobre `tintaSuave`.
- Movimiento: cuando la hora cambia, la nueva entra con un fundido corto y la antigua
  se tacha. Nada de pulsos ni parpadeos.

## Cómo se construye

- Colores, letras y medidas en `src/theme/index.ts`. Letras con
  `@expo-google-fonts/ibm-plex-sans` e `@expo-google-fonts/ibm-plex-mono`.
- Revisión en la web a 375 px: contraste medido (también sobre la cabecera oscura),
  nada que se salga por los lados, zonas de toque de 44 px, y luego
  `npx tsc --noEmit`, `npx expo lint` y `npm test`.
