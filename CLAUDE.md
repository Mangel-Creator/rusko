@AGENTS.md

# Rusko (antes Organizy)

App para organizar el día a día de una persona que mezcla vida personal, amigos y clientes:
calendario, avisos, planes, tráfico, alarmas, correo y estudio. En español de España.

> **Este archivo es el resumen vigente.** El detalle de cada fase y todas las decisiones, también
> las anuladas, está en `docs/historia.md` (no se carga solo: búscalo con grep por la fase o la
> palabra cuando haga falta). Las secciones de abajo dicen "→ historia: <sección>".

## Para quién y dónde funciona

- **Solo para el usuario** (23/10/2026): nada de venta, precios, marketing ni planes de pago. Quitados
  de la app el **Plan empresa** (fase 15) y los **recordatorios a clientes por WhatsApp** (fase 10);
  no los vuelvas a programar sin que lo pida. Sus tablas de Supabase y la columna `cliente` y la tabla
  `empresa_copia` de SQLite siguen, sin uso.
- **Solo web** (28/10/2026, manda sobre todo lo demás): el usuario usa la web instalada como app en el
  ordenador y en el iPhone. **Nada de Expo Go ni app nativa**: no pruebes ni arregles nada para Expo Go,
  iOS o Android (ni túnel, ni `scripts\comprobar-expo-go.ps1`, ni el workflow `expo-go.yml`, ni QR); no
  escribas variantes `.native.ts` nuevas ni código "para cuando haya app propia". Lo nativo que existe
  se deja como está. Expo sigue siendo la herramienta con la que se construye la web.
- **Web**: https://mangel-creator.github.io/rusko/ (`baseUrl` `/rusko` en `app.json`; en desarrollo
  `http://localhost:8081/`). Se publica sola con `.github/workflows/pages.yml` al subir a `main`. El
  repositorio `Mangel-Creator/organizy` es solo una redirección de `/organizy/…` a `/rusko/…`: no borrarlo.
- **`+html.tsx` tiene que pintar `headNodes` y `bodyNodes` de `useServerDocumentContext()`** (SDK 58):
  sin ellos la web sale en blanco.
- **La web se actualiza sola** (`services/actualizacionWeb.ts`): al abrirla o volver tras 30 s compara el
  archivo principal publicado y recarga una vez por versión.
- **Nombre**: todo texto que vea el usuario dice **Rusko**. No se han cambiado (hasta que lo diga): la
  carpeta, `slug`, `scheme`, bundle id `com.mangelcreator.organizy`, proyecto de Expo, tablas de
  Supabase, prefijo `organizy:` de AsyncStorage, el nombre de las copias ni la etiqueta "Organizy" de
  las alarmas del Reloj y su Atajo "Organizy alarmas".
- **Datos**: cada usuario solo ve lo suyo, guardado en su dispositivo. **Excepciones aceptadas** (lo
  demás no sale del dispositivo): (1) planes con votación, se borran a los 7 días; (2) correo vinculado:
  refresh token cifrado y 7 días de títulos y resúmenes; (3) avisos de la web: hora y texto de los
  próximos 7 días, y alarmas del Reloj de 14 días; (4) lo dicho a Siri, hasta que Rusko lo recoge (máx. 7
  días); (5) copia en la nube de quien tenga cuenta (`copias_nube`); (6) planes de empresa y WhatsApp
  Business, ya quitados. Las frases a la IA pasan por el servidor sin guardarse.
- **Lo que no puede la web**: alarma que suene con el móvil bloqueado, widget, voz sin abrir la app.
  Se ocultan o se explica la alternativa (Atajos del iPhone).

## Normas de trabajo

- El usuario es principiante: explícale en español sencillo y paso a paso.
- Si algo no se puede hacer como se pide, dilo antes de empezar y propón la alternativa más sencilla.
- Si tiene que hacer algo fuera del código (cuenta, clave, instalar), para y explícaselo paso a paso.
  Nunca le pidas contraseñas ni claves: las escribe él (panel de Supabase o su terminal).
- Nunca escribas claves secretas en el código ni las subas a git.
- No rehagas lo que ya funciona. Cambios pequeños y probados.
- Antes de dar algo por terminado: `npx tsc --noEmit`, `npx expo lint` y `npm test` sin errores, y
  verlo en la web (`http://localhost:8081/` a tamaño móvil o la web publicada).
- **Al terminar cada parte**: sube a `main` y comprueba con `gh run list` que la web se ha publicado.
- Sin worktrees: se trabaja en `C:\proyectos\organizy`, rama `main`. Si una sesión se abre en un
  worktree: enlaza su `node_modules` al de la carpeta principal (junction), commit, llévalo a `main`, y
  al terminar quita el enlace y borra el worktree y su rama. Instala librerías siempre también en
  `C:\proyectos\organizy` (`npx expo install <paquete>`).
- Windows + PowerShell 5.1: encadena con `;`, no con `&&`. Mensajes de commit con comillas: en un
  archivo y `git commit -F`.
- Lo que no sea código y sea para el usuario va a `C:\Users\usuario\OneDrive\PERSONAL\RUSKO`, en su
  subcarpeta (índice en su `LEEME.md`): `Prompts`, `Guías de prueba` (`Fase NN - Nombre.md`),
  `Diseño`, `Capturas` (`Fase NN`), `QR y enlaces`, `Notas y decisiones` (`Fase NN - Resumen.md`).

### Indicaciones del usuario entre sesiones (lo más importante)

El usuario trabaja con varias sesiones a la vez. Sus indicaciones mandan sobre el prompt de la fase,
dijera lo que dijera en la sesión que fuera:

- Si da una indicación que afecta al proyecto en general (qué es la app, diseño, forma de trabajar,
  decisiones técnicas), apúntala aquí (en "Decisiones vigentes" o su sección; el detalle largo, en
  `docs/historia.md`), haz commit en `main` y avisa a las otras sesiones de Organizy/Rusko abiertas
  (ListAgents + SendMessage) con un resumen corto.
- Si solo afecta a esa sesión, no hace falta compartirla; si afecta a otra concreta, díselo solo a esa.
- Al empezar o retomar trabajo, relee este archivo en `main`: puede haber cambiado.
- Si una indicación nueva choca con otra anterior, manda la más reciente; si hay duda, pregunta.

## Decisiones vigentes

Lo anulado y el detalle → historia: "Decisiones del usuario".

- **Hoy** (27/10): saludo pequeño con el Perfil; cuadro naranja `TarjetaDia` con el día en grande y lo
  siguiente (aunque sea mañana) con "Cómo llegar"; `AccionesRapidas` (Apuntar enfoca la captura, Dictar,
  Planes, Alarmas); captura rápida **siempre abierta** sin `autoFocus`; lista del día por hora, tareas y
  "Estudio de hoy". Sin casillas, matriz ni selector de energía.
- **Barra inferior**: Hoy · Semana · Correo (`/resumenes`) · Mapa · Época (`/epoca`). Planes y Alarmas
  son pantallas con "‹ Hoy" (`/planes`, `/alarmas`).
- **Captura rápida** (02/11): primero la lee la app sola; si está clara (`bastaSinIA`: día, hora o franja
  dichos, título de 5 palabras o menos, sin preguntas, repeticiones ni "antes") no se llama a Haiku. Lo
  demás va a Haiku, que distingue cita, tarea, recordatorio (tarea con `avisarA`), alarma (despertador
  de una vez) y pregunta. Títulos limpios ("Cita DNI", "Llamar a mamá"). "A las 6" de una cita o
  recordatorio es de tarde si toca; solo las alarmas son de mañana. Si la IA falla, `entenderLocal`.
  Aprende el tipo que corriges, por título (`tiposAprendidos`, viaja en la copia). **Varias cosas en una
  frase** (la IA devuelve `elementos`; tarjetas "1 de N" y "Guardar las N"). **Repeticiones con días y
  fin** (`Evento.dias`, lunes = 0, y `hasta`: "todo este mes, lunes y jueves de 6 a 8"). A la IA le
  llegan sus **costumbres** (`costumbresDe`: hasta 30 títulos con tipo, horas y sitio) para que repita
  cómo lo apunta él. → "Fase 5".
- **IA**: Claude **Haiku 5.5** (`claude-haiku-5-5`, `effort: 'low'`) en captura, correo y Época, siempre
  a través de Supabase; la clave nunca en la app. Clave puesta el 28/10 como secreto **`CLAVE_ANTRHOPIC`**
  (con esa errata; también vale `ANTHROPIC_API_KEY`, `_shared/claveAnthropic.ts`). Límites por persona
  de 5 h y semana (el correo va aparte: 100 correos al día); el dueño sin límites y ve el saldo de la
  clave (`IA_SALDO_CLAVE`, `IA_SALDO_DESDE`). Comprar más IA: preparado y apagado. → "Límites de IA".
  **Plan de estudio, gastando lo mínimo (03/11, anula la excepción de Sonnet)**: el plan lo hace la app
  sola (`services/epoca/planLocal.ts`: temas, repasos, simulacros y consejos con las reglas del COIE),
  a medida con sus respuestas, su perfil de estudio y sus apuntes. **Haiku lo supervisa siempre**
  (03/11, acción `supervisar`: `supervisarPlan` manda un resumen corto con el plan y la IA devuelve solo
  los cambios, que valida `aplicarSupervision`; unos 0,001 $ por plan); si la IA falla, sale el plan
  local. La ficha del examen, con Haiku y 2 búsquedas web.
  Nada de Sonnet en Época. Las horas las calcula la app (`estimarHoras`) y la IA solo las mueve ±15 %.
  Lo que se sabe de cómo estudia cada uno se guarda en `organizy:perfilEstudio` (viaja en la copia) y
  no se vuelve a preguntar. **Apuntes en PDF** (03/11): se leen en el navegador con pdf.js de cdnjs
  (versión fija y huella comprobada, `leerPdf.ts`); si traen índice, los temas salen sin IA; si no, a
  Haiku solo le llega el "mapa" (cómo empieza cada página); solo un escaneado de hasta 20 páginas va
  entero. Nada se guarda. El coste apuntado incluye las búsquedas web y la tarifa de Haiku por encima de
  100.000 tokens.
- **Tareas hechas se borran solas a las 24 h** (`hechaEn`, `borrarTareasHechasAntiguas`), salvo las del
  plan de estudio (`epoca-`).
- **Correo**: solo su Gmail vinculado (proyecto de Google Cloud `rusko-512918`, modo prueba: volver a
  entrar cada 7 días); Outlook sin registrar (no se lo pidas). Recuadros por importancia 0-3, resumen
  corto, acciones deslizando, vetados, filtro con IA y "Tus filtros". Avisos de los niveles 2 y 3
  también por Web Push. → "Fase 11".
- **Mapa**: no guía; abre Waze (por defecto), Google Maps o Mapas. Tráfico con TomTom; parkings
  cercanos que aprende de ti. Sin radares ni guía por voz. → "Fase 6".
- **Avisos en la web** con Web Push (web instalada, iOS 16.4+, Perfil > Avisos) y **alarmas al Reloj
  del iPhone** con un Atajo cada noche a las 22:00. → "Fase 4" > "Avisos en la web", "Fase 7".
- **Siri** con dos Atajos ("Apunta en Rusko", "Alarma en Rusko") y un buzón en Supabase. → "Fase 9".
- **Cuenta con correo y contraseña** y copia en la nube. Pendiente del usuario: Site URL y Redirect URLs
  en Supabase. → "Tu cuenta y copia en la nube".
- **Plan de estudio con o sin Época dorada**, inicio recomendado, replanificar sin perder nada y "lo no
  hecho" con motivo. → "Fase 4b".
- **Festivos** del BOE por comunidad (tabla 2026 y 2027: **cada otoño añade la del año siguiente** en
  `services/festivos/boe.ts`); las 2 locales las pone la persona. → "Festivos".
- **Tipos de evento**: Cliente, Amigos, Yo, Entreno, Estudios y Proyectos.
- **Semana como Google Calendar**: Día · 3 días · Semana · Mes; tocar una cita abre `MenuEvento`.
- **Marcas**: botones oficiales de Google y Microsoft (`BotonEntrarCon`, `LogoMarca`); nunca el logo de
  Apple. Código con todos los derechos reservados (`LICENSE`, `"license": "UNLICENSED"`): no pongas una
  licencia libre.
- **No proponer**: la cuenta de desarrollador de Apple, "Reservar servicios" (Booksy), ni programar los
  precios del Word del usuario.
- **graphify** obligatorio (02/11): ver la sección del final.

## Diseño (26/10/2026: "fintech" oscuro con paleta naranja)

Todo sale de `src/theme/index.ts`; nada de colores sueltos en pantallas. **Solo modo oscuro**, cero
sombras, sin bordes gruesos: se separa por fondo (`fondo` → `tarjeta` → `elevado`). **Cada color
significa una sola cosa.**

| Uso | Token | Color |
|---|---|---|
| Fondo / tarjetas / elevado | `fondo` / `tarjeta` / `elevado` | `#0F0D0C` / `#1A1714` / `#24201C` |
| Texto / secundario | `texto` / `textoSecundario` | `#F5F1EC` / `#A39A90` |
| Bordes sutiles / borde de campos | `borde` / `bordeCampo` | `#2E2924` / `#7A6F64` |
| Texto sobre naranja, dorado, WhatsApp y degradados | `textoOscuro` | `#0F0D0C` |
| Cajas destacadas oscuras | `tinta` / `tintaSuave` | `#24201C` / `#2E2924` |
| Pulsar y cifras destacadas | `principal` (hover/pulsado `principalHover`/`principalPulsado`) | `#FF6B1A` |
| Lo elegido (chips, casillas) | `acentoSuave` con borde y texto `principal` | `#2C180E` |
| Errores, avisos, días >80 % | `aviso` | `#FF4D4F` |
| Clientes / Amigos / Yo | `clientes` / `amigos` / `yo` | `#9C8BFF` / `#2BC48A` / `#D9D1C7` |
| Entreno / Estudios / Proyectos | `entreno` / `estudios` / `proyectos` | `#FF6FB5` / `#3FD0E0` / `#B5E655` |
| Carga normal y huecos | `cargaNormal` | `#7A6F64` |
| Solo la Época dorada | `dorado` | `#FFB020` |
| Solo la papelera de Correo | `eliminar` (`textoSobreEliminar`) | `#D90000` |
| Solo botones de WhatsApp | `whatsapp` | `#25D366` |
| Solo botones y logos de Google/Microsoft | `coloresMarca` | sus normas |
| Tarjeta destacada (una por pantalla) | `degradados.naranja` / `.teja` | `#FF6B1A→#FFB020` / `#FF6B1A→#C2361B` |
| Solo "Tus filtros" de Correo | `degradados.azul` | `#8FBEFF→#4D8BF5` |

Otras excepciones: colores de importancia de Correo (`coloresNivel`), `acentos` (naranja, rojo, azul,
blanco con su tinte) en acciones rápidas, barra inferior y apartados de Perfil, festivos en azul, y el
mapa en **modo claro** (`coloresMapa`). Tipo de evento: `colorTipo[tipo]` y `colorBaldosa[tipo]`.

- **Letra Inter** (`fuentes`): títulos 700 (nivel 1, 800) apretados; texto 400 16/24. Horas y cifras con
  `...cifras` (tabulares); cifras grandes `tamanos.cifra` (44).
- **Botones en píldora** (`radio.chip`); de solo icono, redondos. Tarjetas `radio.grande` (24) sin borde.
- Listas tipo "movimientos" (`FilaEvento`): icono redondo, título y lugar, hora grande a la derecha.
- **Para volver, siempre `BotonAtras`.** Perfil es un menú de `Plegable` con icono.
- Formularios cortos: lo esencial con `SelectorVisual`, lo opcional en `Plegable` ("Más ajustes").
- Todo lo pulsable ≥ 44 px (`alturaTactil`). Nada de `opacity` para apagar texto.
- **Tono cercano**: tuteo, frases cortas, sin emojis ni exclamaciones; nunca el nombre del usuario en el
  correo. Ejemplos en `BRIEF.md` > "Tono".
- Movimiento: Reanimated, 150-250 ms (`duracion`), sin rebotes ni animaciones infinitas;
  `<LayoutAnimationConfig skipEntering>`; con el React Compiler, `valor.get()`/`valor.set()`.
- Densidad (`data/densidad.ts`, `useDensidad()`): Con aire, Equilibrado, Compacto.
- Componentes en `src/components` (se importan desde `@/components`): `Boton`, `Tarjeta`, `Titulo`,
  `Texto`, `CampoTexto`, `Selector`, `SelectorDias`, `SelectorHora`, `SelectorFecha`, `SelectorCantidad`,
  `SelectorVisual`, `Plegable`, `Casilla`, `Interruptor`, `BarraProgreso`, `Pantalla`, `BotonAtras`,
  `AccionesRapidas`, `BotonInicial`, `BotonFlotante`, `BotonEntrarCon`, `LogoMarca`,
  `AvisoPantallaInicio`. Detalle → historia: "Diseño".

## Tecnología

- Expo SDK 58 (React Native 0.88), TypeScript, Expo Router (rutas en `src/app/`, solo reexportan
  pantallas de `src/screens/`). Alias `@/` = `src/`.
- Guardado: AsyncStorage (`data/ajustes.ts`: `leerAjuste`, `guardarAjuste`, `borrarAjuste`, prefijo
  `organizy:`; `suscribirseAjustes`). SQLite solo en el móvil (`data/db.ts`, migraciones 1-10); **en la
  web, AsyncStorage** (`repositorio.web.ts`). Nada de la web importa `db.ts`.
- Pruebas: Jest (`jest-expo`), `npm test`, en carpetas `__tests__`; importa `describe`, `it`, `expect` de
  `@jest/globals`.
- Fechas y horas: siempre con `src/services/fechas.ts` (español, semana en lunes, 24 h, zona del
  dispositivo).
- Instala librerías con `npx expo install <paquete>`.

## Mapa del código

- `src/app/` rutas; `src/screens/` pantallas y sus piezas por carpeta (`calendario/`, `captura/`,
  `correo/`, `epoca/`, `mapa/`, `alarmas/`, `planes/`, `perfil/`, `siri/`, `formulario-perfil/`...).
- `src/data/` guardado: `perfil.ts` (`usePerfil`, `leerPerfil`), `eventos/` (`useEventos`,
  `guardarEvento`, `borrarEvento`, `marcarHecha`, `leerEventos`, `suscribirseEventos`), `epocas/`,
  `avisos.ts`, `alarmas.ts`, `planes.ts`, `correos.ts`, `calendarios.ts`, `supabase.ts`...
- `src/services/` lógica pura con pruebas: `agenda/`, `avisos/` (`GENERADORES` en `planificar.ts`),
  `epoca/`, `captura/`, `consulta/`, `rutas/`, `alarmas/`, `planes/`, `correo/`, `ia/`, `siri/`,
  `copia/`, `nube/`, `cuenta/`, `calendarios/`, `festivos/`, `dictado/`.
- `supabase/` funciones (Deno) y migraciones; `gmail/` ayudante de Apps Script.
- Para encontrar algo, primero `graphify query` (ver el final).

## Copia de seguridad y claves que no viajan

`services/copia/formato.ts`: la copia lleva eventos, épocas y todas las claves `organizy:` **salvo las de
`NO_VIAJAN`**. Si añades una clave del dispositivo o calculada sola (enlaces, sesiones, cachés), **añádela
a `NO_VIAJAN`**. → historia: "Copia de seguridad", "Tu cuenta y copia en la nube".

## Servidor propio: Supabase

- Proyecto `hwemrpexabisyueyizjz`. Funciones en `supabase/functions/<nombre>/index.ts`; comunes en
  `_shared/` (`cors.ts`, `usuario.ts`, `limite.ts`, `limiteIA.ts`). Cada función con `verify_jwt = false`
  en `supabase/config.toml` (comprueba el usuario por dentro). **Toda llamada nueva a Claude pasa por
  `permitirIA` y `apuntarIA`.**
- En la app: `obtenerSupabase()` (null sin `.env`) y `asegurarSesion` (usuario anónimo). Claves públicas
  en `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`) y en las variables del repositorio
  `SUPABASE_URL`/`SUPABASE_KEY` que usa `pages.yml`. Las secretas, solo en los secretos de Supabase.
- Desplegar: `npx supabase functions deploy <nombre> --project-ref hwemrpexabisyueyizjz --use-api`.
  SQL: `npx supabase db query --linked --project-ref hwemrpexabisyueyizjz --file <archivo.sql>`.
- `tsc` y `eslint` no miran `supabase/`. Pruebas SQL en `supabase/tests/` (acaban en "todo bien").
- **Ayudante de Gmail**: `gmail/organizy-correo.js` se genera con `npm run ayudante-gmail`; nunca a mano.
  Si cambia, el usuario lo pega otra vez y hace "Nueva versión".
→ historia: "Servidor propio: Supabase".

## Dónde está el detalle (docs/historia.md)

| Tema | Sección |
|---|---|
| Bienvenida, perfil, coordenadas (Nominatim, 1 búsqueda/s) | Fase 2 |
| Calendario, Hoy, Semana, lugares por referencia, repeticiones | Fase 3 |
| Avisos locales y Web Push (VAPID, `avisos-web`) | Fase 4 |
| Época dorada y plan de estudio | Fase 4b |
| Captura rápida, preguntas por la agenda, voz | Fase 5 |
| Mapa, TomTom, salidas, parkings, horas punta | Fase 6 |
| Alarmas y Reloj del iPhone | Fase 7 |
| Planes con WhatsApp y votación | Fase 8 |
| Micro, Siri con Atajos | Fase 9 |
| Correo (Gmail, filtros, importancia, vetados) | Fase 11 |
| Otros calendarios (iCal) | Otros calendarios |
| Festivos | Festivos |
| Matriz de Eisenhower | Matriz de Eisenhower en las tareas |
| Límites y saldo de IA | Límites de IA |
| Cuenta y nube | Tu cuenta y copia en la nube |
| Fases 10 y 15 (quitadas) | Fase 10, Fase 15 |

## Pendientes del usuario (no se los vuelvas a pedir; si pregunta, están en su guía)

- Bajar el tope de gasto mensual a 5 $ en la consola de Anthropic.
- Site URL y Redirect URLs en Supabase (para "He olvidado la contraseña").
- Registrar Outlook en Microsoft Entra (guía "Fase 11 - Correo.md", parte A2).
- Variable del repositorio `TOMTOM_MAPA_KEY` (sin ella, fondo de OpenStreetMap).
- Pegar otra vez el ayudante de Gmail y probar Siri, el Atajo del Reloj y los avisos en su iPhone.
- Antes de cualquier tienda (si algún día): nombre libre e icono propio, permiso de IA de Apple.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
