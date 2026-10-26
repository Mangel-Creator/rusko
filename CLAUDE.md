@AGENTS.md

# Organizy

App para organizar el día a día de una persona que mezcla vida personal,
amigos y clientes: calendario, avisos, planes con amigos y clientes, tráfico y
alarmas. En español de España.

## Para quién y dónde funciona (decidido el 23/09/2026)

- **Para todo el mundo**, y **cada usuario solo ve sus datos**: todo se guarda en su
  dispositivo (AsyncStorage/SQLite). No hay servidor con datos de usuarios. **Única
  excepción** (fase 8): para que los amigos voten un plan, el plan (qué es, las horas y
  el número de invitados) y los nombres que escriben al votar están en Supabase y se
  borran solos 7 días después (ver "Fase 8").
- **Un solo código, dos versiones:**
  - **Web** para el resto de la gente: https://mangel-creator.github.io/organizy/
    Se publica sola con GitHub Actions (`.github/workflows/pages.yml`) al subir a
    `main`. Se añade a la pantalla de inicio como app web (`src/app/+html.tsx`).
    `baseUrl` es `/organizy` (en `app.json`); en desarrollo la web está en
    `http://localhost:8081/`.
    La web **se actualiza sola** (`src/services/actualizacionWeb.ts`): al abrirla, o al
    volver tras 30 s fuera, compara el archivo principal publicado con el que usa y,
    si ha cambiado, recarga (una vez por versión, sin bucles).
  - **App** para el dueño, en su iPhone con Expo Go (cuenta de Expo `mangel_creator`,
    proyecto vinculado con `eas init`). En el futuro, app en las tiendas.
- **Lo que no puede hacer la web** (quedará solo para la app): alarma que suena como
  despertador con el móvil bloqueado, widget y voz sin abrir la app (en web, como
  mucho, un Atajo del iPhone). En web lo que no funcione se oculta o se avisa.
- Avisos en web: solo con la web añadida a la pantalla de inicio y con un servidor
  pequeño de notificaciones push. La fase 4 se hizo sin servidor, así que en la web
  no hay avisos (Perfil lo explica); los push web quedan pendientes para más adelante.
- Funciones que necesiten claves secretas (IA, WhatsApp Business) irán detrás de un
  servidor pequeño propio, nunca dentro de la app.
- Instalar en el iPhone una versión propia (alarmas, widget, voz) exige la cuenta
  de desarrollador de Apple (99 €/año). Avisar al usuario al llegar a esas fases.

## Normas de trabajo

- El usuario es principiante: explica las cosas en español sencillo y paso a paso.
- Si algo no se puede hacer como se pide, dilo antes de empezar y propón la
  alternativa más sencilla.
- Si el usuario tiene que hacer algo fuera del código (crear una cuenta, conseguir
  una clave, instalar algo), para y explícaselo paso a paso.
- Nunca escribas claves secretas en el código de la app ni las subas a git.
- No rehagas lo que ya funciona. Cambios pequeños y probados.
- Antes de dar algo por terminado: `npx tsc --noEmit` sin errores.
- Windows + PowerShell 5.1: encadena comandos con `;`, no con `&&`.

### Indicaciones del usuario entre sesiones (lo más importante)

El usuario trabaja con varias sesiones abiertas a la vez (una por fase o tema).
Sus indicaciones mandan sobre el prompt de la fase, **dijera lo que dijera en la
sesión que fuera**:

- Si en una sesión da una indicación que afecta al proyecto en general (qué es la
  app, para quién, diseño, forma de trabajar, decisiones técnicas), apúntala en
  este archivo (en su sección o en "Decisiones del usuario"), haz commit en `main`
  y avisa a las otras sesiones de Organizy que estén abiertas (ListAgents +
  SendMessage) con un resumen corto.
- Si solo afecta a lo que se hace en esa sesión, no hace falta compartirla.
- Si afecta solo a otra sesión concreta, díselo solo a esa sesión.
- Al empezar o retomar trabajo, relee este archivo en `main`: puede haber cambiado
  desde otra sesión.
- Si una indicación nueva choca con otra anterior, manda la más reciente; si hay
  duda, pregunta al usuario.

### Decisiones del usuario

- 23/09/2026 — App para todo el mundo con los datos de cada usuario privados; web
  para los demás y app para el dueño (ver "Para quién y dónde funciona").
- 24/09/2026 — Direcciones en la web con OpenStreetMap.
- 24/09/2026 — Sus indicaciones valen para todas las sesiones (ver arriba).
- 24/09/2026 — Sin worktrees: se trabaja directamente en `C:\proyectos\organizy`,
  rama `main` (los worktrees obligan a reinstalar `node_modules` y a fusionar). Si
  una sesión se abre igualmente en un worktree y no deja escribir fuera de él, no
  reinstales: enlaza su `node_modules` al de la carpeta principal (junction), haz el
  commit ahí, llévalo a `main`, y al terminar quita el enlace y borra el worktree y
  su rama. **Ojo** (visto el 26/09): `npx expo install` dentro del worktree cambia el
  enlace por una carpeta `node_modules` nueva y la librería no llega a la carpeta
  principal; después de subir a `main`, haz `git pull` y `npm install` en
  `C:\proyectos\organizy` (lo comprueba `scripts\comprobar-expo-go.ps1`).
- 24/09/2026 — Carpeta del usuario ordenada en subcarpetas:
  `C:\Users\usuario\OneDrive\PERSONAL\Organizy` (índice en su `LEEME.md`). Todo lo
  que no sea código y sea para el usuario va a su subcarpeta, nunca suelto en la raíz:
  `Prompts` (PDF originales y prompts añadidos), `Guías de prueba`
  (`Fase NN - Nombre.md`, una por fase), `Diseño`, `Capturas` (subcarpeta `Fase NN`),
  `QR y enlaces` (QR y `Enlaces.md`) y `Notas y decisiones` (`Fase NN - Resumen.md`).
  Si algo no encaja, crea una subcarpeta con nombre claro y añádela al `LEEME.md`.
  Al terminar cada fase, guarda ahí su guía de prueba y su resumen. El código sigue
  solo en `C:\proyectos\organizy`.
- 24/09/2026 — La web se actualiza sola al publicar una versión nueva (ver "Para
  quién y dónde funciona").
- 24/09/2026 — Diseño "cuaderno cálido" con una regla: cada color significa una sola
  cosa (azul tinta = pulsar, naranja = Clientes, verde = Amigos, negro = Yo, granate =
  aviso). Cada persona elige la densidad en Perfil > "Cómo se ve" (por defecto
  Equilibrado). Alguna animación suave, sin excesos. Ver "Diseño" y `BRIEF.md`.
- 25/09/2026 — Todavía no quiere la cuenta de desarrollador de Apple (99 €/año) ni una
  app propia en el iPhone (**corregido más abajo, el mismo día: sí quiere app propia
  además de la web, y la subirá a Apple en el futuro**). Mientras tanto: en el día a día usa la web añadida a la
  pantalla de inicio (funciona con cualquier wifi y se actualiza sola, pero sin avisos
  ni alarmas) y prueba la app en Expo Go con modo túnel (necesita el ordenador
  encendido con el servidor en marcha). Expo Go no puede cargar actualizaciones de
  EAS Update, así que sin app propia no hay forma de usar la app sin el ordenador. No
  propongas de nuevo la cuenta de Apple salvo en las fases que la necesiten de verdad
  (alarmas, widget, voz) o si el usuario lo pide.
- 25/09/2026 — Fase 7 (Alarmas): la pestaña se hace completa (despertador, hora de
  dormir, salida e inteligente) con tres niveles detrás de una misma interfaz:
  **app propia** con alarmas de verdad (AlarmKit en iOS 26+, AlarmManager en Android),
  que se programa ya aunque solo se pueda probar cuando haya build de EAS (ajustada por
  la entrada siguiente: se construye como app de verdad); **Expo Go**, avisos locales
  con sonido (no suenan con el móvil en silencio); **web**, se explica y se ofrece
  crear la alarma en el Reloj del iPhone con un Atajo.
- 25/09/2026 (corrige la entrada "Todavía no quiere… ni una app propia") — **Quiere app
  propia y web.** Organizy se construye como app de verdad (todo lo que la web no puede
  hacer se hace igualmente para la app) además de la web, y **en el futuro la subirá a
  Apple** (App Store/TestFlight con la cuenta de desarrollador). Lo que no cambia: la
  cuenta de Apple se paga más adelante, cuando él lo decida; hasta entonces la app se
  prueba en Expo Go con túnel y en el día a día usa la web. Tenerla instalada en el
  iPhone sin el ordenador exige esa cuenta (no hay vía gratis desde Windows). Prepara
  el código para ese paso (app.json, permisos, EAS) sin obligarle a pagar antes.
- 25/09/2026 — Fase 6 (Mapa): la pestaña Mapa es **como una app dentro de Organizy**,
  totalmente funcional para el tráfico, **con Waze como modelo**: radares en el mapa, la
  carretera pintada según el tráfico (libre, poco denso, muy denso, atasco) y rutas con
  el tráfico real. Lo que Waze saca de su comunidad de conductores (policía, accidentes
  avisados por otros usuarios) no se puede copiar sin usuarios que compartan datos:
  se sustituye por fuentes abiertas (radares fijos de la DGT u OpenStreetMap,
  incidencias de la DGT) y se le explica. Las claves de los proveedores de tráfico van
  detrás del servidor, nunca en la app. **Los colores del tráfico sobre la carretera son
  la única excepción** a "cada color significa una sola cosa", y solo dentro del mapa
  (son el código que todo el mundo reconoce); fuera del mapa la regla sigue igual.
- 25/09/2026 (más tarde; **anulado en la entrada siguiente**) — Había elegido pagar
  ya la cuenta de desarrollador de Apple para tener la app propia en el iPhone sin
  depender del ordenador. Plan: (1) él se da de alta en el Apple Developer Program
  (lo hace y lo paga él; Apple puede tardar hasta 48 h en activarla); (2) cuando esté
  activa, la sesión "Organizy · 02 Bienvenida" (o la que él diga) prepara app.json
  (bundleIdentifier), expo-updates y la build con EAS, y la manda a TestFlight;
  (3) después, las mejoras le llegan con EAS Update sin reinstalar. Las credenciales
  de Apple las escribe siempre él en su terminal; nunca en el código ni en el chat.
  Hasta que esté activa, sigue con la web y Expo Go con túnel.
- 25/09/2026 (última palabra, anula la anterior) — **No quiere pagar todavía la cuenta
  de Apple (99 €/año).** Quiere probar la app él mismo y, en el futuro, sacarla
  (App Store). Hasta entonces: la app se prueba en Expo Go con el túnel (solo con el
  ordenador encendido) y en el día a día usa la web. Organizy se sigue construyendo
  como app de verdad y preparada para ese paso. No le propongas pagar la cuenta salvo
  que lo pida o una fase la necesite de verdad; si pregunta cómo usar la app sin el
  ordenador, recuérdale que solo se puede con esa cuenta (o con la web).
- 25/09/2026 (sustituye al "cuaderno cálido") — El diseño anterior "se notaba mucho que
  era hecho por una IA" (sobre todo, todas las tarjetas iguales). Elegido: **"agenda
  nocturna"** con la paleta de siempre: letra IBM Plex (horas en Plex Mono), cabecera
  oscura en Hoy, filas planas con barra de color y esquinas más rectas. Y **tono cercano
  en toda la app**: nada de "Buenos días"; tuteo, frases cortas y algún giro coloquial
  suave ("¿Qué toca hoy?", "Día libre", "Ojo, esto pisa tu bloque de foco"), sin emojis
  ni exclamaciones de colega. Ver "Diseño" y `BRIEF.md`.
- 25/09/2026 — Fase 6: el tráfico sale de **TomTom** (gratis y sin tarjeta; si se pasa del
  uso gratuito deja de funcionar ese día, nunca cobra), no de Google Maps Platform (pedía
  tarjeta). El servidor es el mismo proyecto de Supabase de la fase 5. Ver "Fase 6".
- 26/09/2026 (**anulada el 26/10/2026**: sin radares ni guía, ver esa fecha) — Fase 6: el
  mapa se puede **ver en grande** y **guía por voz** giro a giro,
  con avisos de radares. Con el móvil bloqueado solo podrá la app propia (en la web y en
  Expo Go se mantiene la pantalla encendida; para ir con el móvil bloqueado ya, "Abrir en
  Waze"). Los radares se revisan al actualizarlos y **en el futuro se añadirán los del
  resto de España** (Cataluña, País Vasco, municipales) hasta completarla.
- 25/09/2026 — **Cada vez que se termine una parte del proyecto, la web y Expo Go tienen
  que quedar al día y funcionando** (subir a `main` y dejar el túnel en marcha con la
  app compilando para iPhone). Ver "Cómo prueba el usuario en el iPhone".
- 26/09/2026 — **La app tiene que ser mucho más visual y menos cargada.** Hoy pasa a un
  **panel de casillas grandes con icono y número** (clientes, planes, tareas, cosas tuyas
  o estudio, "Todo el día" y "Época dorada"); al tocar una, su lista sale debajo. La
  captura rápida va **plegada** (se abre con el "+"). Los formularios, cortos: lo esencial
  con casillas de icono (`SelectorVisual`) y lo opcional plegado (`Plegable`, "Más
  ajustes"). Primero, el formulario de la Época dorada. Ver "Diseño".

- 26/09/2026 — **La clave de Anthropic (IA de la captura rápida) la pondrá cuando la app esté
  terminada** (5 $ de saldo). Supabase ya está montado y desplegado. Hasta entonces la captura
  abre la ficha con la frase como título: es lo esperado. No se lo vuelvas a pedir; si
  pregunta, los pasos están en su guía "Fase 05 - Captura con IA.md".
- 26/09/2026 — **Expo Go SIN el ordenador: funciona y el usuario lo ha comprobado.** Expo
  Go sí carga publicaciones de EAS Update de proyectos propios si su `runtimeVersion` es
  `exposdk:58.0.0` (la de Expo Go). Dirección fija, siempre la última versión:
  `exp://u.expo.dev/bf4c1bdd-dea3-4040-b236-458205d44d0e?runtime-version=exposdk%3A58.0.0&channel-name=expo-go`
  (canal y rama `expo-go`). La publica sola `.github/workflows/expo-go.yml` en cada
  subida a `main`, poniendo esa `runtimeVersion` solo durante la publicación; necesita
  el secreto `EXPO_TOKEN` de GitHub, que crea y guarda el propio usuario. Ver "Cómo
  prueba el usuario en el iPhone".
- 26/09/2026 — Fase 8 (Planes), elegido por el usuario:
  - La **página de votación va dentro de la propia web de GitHub Pages**
    (`/organizy/votar#código`), sin Vercel ni Netlify ni cuentas nuevas. Funciona sin la
    bienvenida y sin guardar nada en el móvil del invitado.
  - **Aviso cuando alguien vota**: push en Expo Go (iPhone) y en la app propia; en la web
    no hay avisos, pero al abrir Planes (o volver a la web) los votos nuevos salen
    marcados.
  - **El botón "Enviar por WhatsApp" es verde de WhatsApp** (`colores.whatsapp`,
    `#25D366`, texto oscuro encima): **segunda excepción** a "cada color significa una
    sola cosa", como los colores del tráfico del Mapa. Solo en los botones de WhatsApp.
  - El plan y sus votos se **borran del servidor 7 días después** de la última hora
    propuesta (o de la elegida).
- 27/09/2026 — Fase 10 (recordatorios a clientes; ver "Fase 10"), elegido por el usuario: **primero la
  vía gratis y sin servidor, y más adelante el envío automático con WhatsApp Business.**
  - **Ahora (parte A)**: nombre, teléfono y "Acepta recordatorios por WhatsApp" en los
    eventos de Clientes, **solo en el dispositivo**. El día antes, a la hora elegida en
    Perfil, un aviso local; su botón abre WhatsApp en el chat de ese cliente
    (`wa.me/<teléfono>?text=`) con el recordatorio escrito, y lo envía la persona.
    Sin cuentas de Meta, sin coste y sin datos en el servidor.
  - **Más adelante (parte B)**, cuando el usuario cree las cuentas de Meta (cartera
    empresarial, app de desarrollador, número dedicado, tarjeta y plantilla de
    "Utilidad" aprobada; ~0,017 € por mensaje en España, tarifa del 1/07/2026): envío
    automático desde Supabase con la Cloud API, **solo para la cuenta del dueño** (el
    número y el token de Meta son suyos). Aceptada ya como **tercera excepción** a "los
    datos solo en el dispositivo": el servidor guardará solo los recordatorios pendientes
    de clientes que hayan aceptado (nombre, teléfono, día, hora y sitio) y los borrará al
    enviarlos o al pasar la cita. El token, solo en los secretos de Supabase.
- 27/09/2026 — Fase 11 (correo; ver "Fase 11"), elegido por el usuario: **solo su Gmail**
  (leer el Gmail de cualquiera exige la verificación de Google con auditoría de seguridad de
  pago), **varias cuentas juntas reenviándolas a ese Gmail** (la app Mail del iPhone no deja
  a otras apps leer correos), **sin IA por ahora** (reglas; la IA se enciende sola cuando
  ponga la clave de Anthropic) y **solo la pestaña Principal**. Lo hace un ayudante (Google
  Apps Script) en su propia cuenta de Google: los correos no pasan por el servidor de
  Organizy mientras no haya IA; con IA, el texto pasa por la función `correo` sin guardarse
  (como las frases de la captura).
- 27/09/2026 — **Otros calendarios** (ver "Otros calendarios"): usa Google Calendar e iCloud
  y quiere **mover todo lo que tiene allí a Organizy**. Se hace con el enlace iCal de cada
  calendario, en la web y en Expo Go: lo traído son eventos normales de Organizy y lo nuevo
  de fuera llega solo. **En la web el calendario pasa por la función `calendario` de
  Supabase sin guardarse** (el navegador no deja leerlo directamente); lo aprobó el usuario.
  En el móvil se lee directamente. La lectura directa del calendario del iPhone
  (`expo-calendar`, que no viene en Expo Go) **queda para la app propia, en el futuro**: no
  se programa todavía.

- 28/09/2026 — **La IA de Organizy es Claude (Anthropic) a través del servidor propio**
  (Supabase), también cuando la app salga en App Store, Google Play o Microsoft Store: la
  clave nunca va en la app y el modelo se cambia en el servidor sin publicar otra versión.
  Se lo explicó al usuario la sesión de la Época dorada. **Pendiente antes de subir a las
  tiendas**: Apple pide avisar y pedir permiso antes de mandar datos personales a una IA de
  otra empresa. La Época dorada ya lleva una frase corta de qué se envía donde se usa la IA
  (revisar que la captura y el correo también la lleven); hará falta una pantalla de permiso
  formal (una vez, con "Ahora no") y mencionarlo en la política de privacidad. Alternativa futura, solo para la app propia: la
  IA del propio móvil (Apple Intelligence o la de Android), gratis y sin salir del teléfono.
- 28/09/2026 — Fase 11, **vincular el correo solo iniciando sesión** (corrige en parte la
  entrada del 27/09): botones **"Vincular con Gmail"** y **"Vincular con Outlook"** (OAuth de
  Google y Microsoft; el usuario solo inicia sesión) y, además, el **ayudante de Gmail con un
  QR** que vincula sin pegar nada. Eligió **avisos al momento**, así que se acepta como
  **cuarta excepción** a "los datos solo en el dispositivo": el servidor guarda, **cifrado**,
  el permiso para leer el correo (refresh token, solo lectura; nunca la contraseña) y **7
  días de títulos y resúmenes**; se borra todo al quitar la cuenta. **iCloud y la app Mail
  del iPhone no se pueden vincular** (Apple no lo deja): se explica cómo reenviarlos a Gmail
  u Outlook. Para que los botones funcionen, **el usuario registra una vez Organizy en Google
  Cloud y en Microsoft Entra** y guarda sus claves en los secretos de Supabase (guía "Fase 11 -
  Correo.md", parte A); mientras tanto dicen "Aún no está activado". Gmail va en modo
  "prueba" de Google: solo para los usuarios de prueba que él añada (hasta 100) y hay que
  volver a entrar cada 7 días; para abrirlo a todo el mundo haría falta la verificación de
  Google con auditoría de pago.
  **Pendiente del usuario** (28/09/2026, lo dejó para más adelante): registrar Organizy en
  Google y Microsoft (parte A de la guía). Es gratis. No se lo vuelvas a pedir; si pregunta,
  los pasos están en su guía "Fase 11 - Correo.md".
- 28/09/2026 — **Dejar la app preparada para subirla a la App Store y a Google Play.**
  Identificador de la app en las dos tiendas: `com.mangelcreator.organizy` (en
  `app.json`; no se cambia después de publicar). Lo que pide cada tienda está en "Fase 7"
  > "Al subir a las tiendas". Las cuentas (Apple 99 €/año, Google Play 25 $ una vez) las
  crea él cuando decida publicar.
- 28/09/2026 — **Organizy grupal (fase 15)**: modo **activable** en Perfil (apagado por
  defecto; sin activarlo la app no cambia) para que una empresa use Organizy con todos sus
  empleados: calendario de empresa, turnos, tareas asignadas y disponibilidad del equipo.
  **La empresa no ve nada personal**: solo lo de trabajo; cada empleado puede, si quiere,
  compartir sus huecos como "Ocupado" sin título ni lugar. Se entra con la **cuenta de
  Google o Microsoft** del trabajo; el usuario pidió que **dar de alta a la gente no sea un
  lío para el jefe** (dominio propio con aprobación, o lista de correos / enlace). Lo de la
  empresa se guarda en Supabase: será una **excepción más** a "datos solo en el
  dispositivo" (la apunta la sesión 15 con el detalle). Prompt en
  `C:\Users\usuario\OneDrive\PERSONAL\Organizy\Prompts\Organizy-15-organizy-grupal.md`.
- 29/09/2026 (ajusta la anterior) — **Organizy grupal es un PLAN EXTRA, el "Plan empresa"**, no
  parte de la app de siempre: se elige en Perfil > "Tu plan" > **"Cambiar de plan"** (Plan
  personal / Plan empresa), con un momento de **"Cambiando de plan…"**. **Por ahora solo se
  ve en Expo Go** (el dueño lo prueba ahí) y en desarrollo; en la web pública no sale "Cambiar
  de plan" (solo entra quien llega con un enlace de invitación). No se cobra nada: cobrar un
  plan necesitará las compras de Apple/Google o Stripe cuando él lo decida. Es la **quinta
  excepción** a "los datos solo en el dispositivo" (lo de la empresa, en Supabase). Ver
  "Fase 15". **Pendiente del usuario** (cuando quiera; no se lo vuelvas a pedir): activar los
  proveedores Google y Azure en Supabase (guía "Fase 15 - Organizy grupal.md", parte A);
  mientras tanto los botones dicen "Aún no está activado".
- 29/09/2026 — **El plan empresa es "de empresa": sin planes con amigos** (ver "Fase 15" >
  "Pestaña Empresa"). Con el plan puesto, la pestaña **Empresa** ocupa el sitio de Planes; no
  salen la casilla "planes con amigos" de Hoy, "Amigos" en la leyenda de Semana ni "Proponer
  plan" en sus huecos, ni el tipo "Amigos" al crear un evento o traer un calendario. Con el plan
  personal todo sigue igual. Y **quiere verlo en Expo Go sin cuentas**: "Ver una empresa de
  ejemplo" en la pantalla de entrar (un bar ya montado; se ve como el jefe, una responsable o un
  empleado).
- 29/09/2026 — **Chat de empresa y avisos de los superiores, al estilo de Teams** (plan
  empresa, ver "Fase 15" > "Chat y avisos"): canales (General para toda la empresa y uno por
  equipo) y chats privados entre dos personas, y un apartado de **Avisos** que solo publican el
  administrador y los responsables, con "Importante", "Leído" y quién lo ha leído. **Los chats
  privados solo los leen esas dos personas, tampoco el jefe.** Los mensajes están en Supabase
  (no cifrados de extremo a extremo) y se borran a los 180 días. Sin fotos ni archivos por ahora.
- 29/09/2026 — **Límites de IA como los de Claude** (ver "Límites de IA"): cada persona tiene
  un límite cada 5 horas y otro por semana, que ve **en porcentaje** en Perfil > "Tu IA". Al
  llegar, la app sigue sin IA hasta que se libere; **el correo también cuenta** y al agotarse
  usa las reglas. **Comprar más IA ("Conseguir más IA") queda preparado pero apagado**: el
  saldo extra ya existe en el servidor, pero cobrar necesita la cuenta de Apple o Stripe
  (autónomo); el botón explica que aún no se puede. No lo actives sin que el usuario tenga
  esas cuentas y lo pida.
- 29/09/2026 (ajusta la anterior en el correo) — **El correo, aparte del límite general, y la
  persona elige qué correos resume la IA.** Con muchos correos, un límite común dejaría sin IA
  para lo demás. Plan: el correo **no gasta** del límite de 5 h ni del semanal; tiene su propio
  cupo de correos al día con IA (propuesta: 20 en el Completo) y en Resúmenes se elige cuáles:
  todos los de Principal, solo los de remitentes o dominios marcados, o solo los que parezcan
  tener fecha límite. Los demás se resumen con las reglas, sin límite ni coste. **Pendiente de
  programar** (servidor: `_shared/limiteIA.ts` y las funciones `correo` y `correo-cuentas`).
- 29/09/2026 — **Precios: propuesta, sin decidir.** Está en el Word del usuario
  `OneDrive\PERSONAL\Organizy yo\PLAN DE PRECIOS TEMPORAL.docx` (sesión "Monetización y
  planes"): Base gratis, Pro, Completo, De por vida Pro y Completo (con mejora pagando la
  diferencia), Familia, recargas de IA y tres planes de empresa. No lo programes ni lo des por
  bueno hasta que el usuario lo confirme.
- 28/09/2026 — **Sin "Reservar servicios"** (peluquería, barbería... con Booksy). Se hizo y el
  usuario lo quitó el mismo día al saber que Organizy no puede reservar ni cancelar por él:
  Booksy solo deja reservar desde fuera a empresas socias, y un "robot" con su contraseña va
  contra sus normas. No lo vuelvas a proponer salvo que lo pida.
- 29/09/2026 — **Revisión de plagio y propiedad intelectual** (lo pidió el usuario). Arreglado:
  - **El código es del usuario, con todos los derechos reservados** (`LICENSE`; `package.json`
    con `"license": "UNLICENSED"`). Antes llevaba por error la licencia MIT de la plantilla
    de Expo, que dejaba copiar Organizy entera. El repositorio sigue público por GitHub
    Pages. No vuelvas a poner una licencia libre sin que el usuario lo pida.
  - **Botones oficiales para entrar con Google y Microsoft** (`BotonEntrarCon`, `LogoMarca`):
    "Continuar con Google" (la "G" de colores sobre blanco y letra Google Sans) e "Iniciar
    sesión con Microsoft" (su logo de cuatro cuadrados), como exigen sus normas de marca
    para pasar su revisión. Nunca pongas sus logos en un solo color ni sobre otro fondo.
    Sus colores (`coloresMarca`) son otra excepción a "cada color significa una sola cosa",
    solo en esos botones y en el logo de cada cuenta vinculada. **No uses el logo de
    Apple** en la app (Apple no deja: la fila de iCloud lleva una nube).
  - **Pendiente del usuario, antes de subir a las tiendas**: **cambiar el nombre** (ya
    existe "Organizy: AI Planner" en la App Store, de Organizy Ltd., y Apple no admite dos
    apps con el mismo nombre; comprobar en TMview que el nuevo está libre) y **hacer un
    icono propio** (el actual es la "A" de la plantilla de Expo, en `assets/images`,
    `assets/expo.icon` y `public/icono-app.png`). El identificador
    `com.mangelcreator.organizy` puede quedarse.
- 01/10/2026 — **Proyecto nuevo: Raxu** (nombre de trabajo), en `C:\proyectos\raxu`. Tras
  una sesión de estrategia (Organizy intenta servir a demasiados públicos), el usuario eligió
  centrarse en **autónomos que van a casa de sus clientes**: agenda con tráfico, "llego tarde",
  ruta del día, cobros y, más adelante, recepcionista con IA. Todo en `C:\proyectos\raxu\IDEA.md`
  y su `CLAUDE.md`; mensajes de cada sesión en `OneDrive\PERSONAL\Raxu\Prompts`. Raxu lee
  Organizy como referencia y copia lo que sirve, **sin modificarlo**. **Organizy sigue como
  está**: no se poda, oculta ni borra nada de Organizy sin que el usuario lo diga.
- 23/10/2026 (última palabra sobre para quién es) — **Organizy sigue, pero solo para uso
  propio del usuario: olvidarse de venderla por ahora.** Nada de planes de pago, precios,
  marketing ni competencia; las sesiones de negocio se han archivado. Los **límites de IA y el
  saldo** se quedan (lo eligió él). **Se quitan de la app**: el **Plan empresa** (pestaña
  Empresa, turnos, tareas, chat, avisos de superiores y "Cambiar de plan"; vuelve la pestaña
  Planes con amigos a su hueco) y los **recordatorios a clientes por WhatsApp** (fase 10, con
  la parte B de WhatsApp Business). Lo hace la sesión "Quitar Plan empresa y WhatsApp a
  clientes"; hasta entonces, no amplíes esas dos partes.
- 26/10/2026 (sustituye a "agenda nocturna" del 25/09) — **Rediseño "fintech" oscuro con
  paleta naranja**, pedido por el usuario: minimalista y plano (cero sombras, sin bordes
  gruesos), mucho aire, letra **Inter** para todo (titulares 700-800 apretados, cifras y
  horas grandes con números tabulares), botones en **píldora**, tarjetas de esquinas muy
  redondeadas separadas por color de fondo, **una tarjeta destacada con degradado**
  naranja → ámbar como único elemento llamativo, iconos de línea en círculos y listas tipo
  "movimientos" (icono redondo, título y lugar, hora a la derecha). Transiciones de
  150-250 ms sin rebotes. **Solo modo oscuro.** Como el naranja pasa a ser el color de
  pulsar, **Clientes cambia a violeta**. Detalle en "Diseño".
- 26/10/2026 — **Organizy sube a Expo SDK 58** (React Native 0.88): el iPhone del usuario
  actualizó Expo Go a la 58 y la app salía "incompatible" (Expo Go de la App Store solo
  abre la última versión del SDK). La dirección de Expo Go sin ordenador cambia a
  `runtime-version=exposdk%3A58.0.0` (QR nuevo en su carpeta "QR y enlaces"). Cuando salga
  otro SDK y Expo Go se actualice, habrá que repetirlo: `npx expo install expo@^NN`,
  `npx expo install --fix`, `RUNTIME_EXPO_GO` en `expo-go.yml`, la dirección aquí y el QR.
- 26/10/2026 (sustituye a la del 26/09 sobre el mapa en grande y la voz) — **El Mapa ya no
  guía: te manda a tu app de navegación.** Se quitan los **radares** (datos, script y
  marcas), la **guía por voz** y el **mapa en grande**, para que la app pese y gaste menos.
  Se queda el mapa con la ruta, el tráfico y cuánto tardas. "**Abrir siempre con**" Waze
  (por defecto), Google Maps o Mapas de Apple. El aviso **"Sal ya"** (a la hora exacta de
  salir, con el tráfico previsto) y el botón de Hoy **abren directamente esa app** con el
  sitio puesto. Nuevo: **"Parkings cercanos"** al destino; lo lleno que suele estar cada
  uno **lo aprende la app de ti** (no hay datos gratis de ocupación para toda España;
  TomTom los cobra) y, si al llegar está lleno, **"Está lleno, llévame a otro"** abre el
  siguiente con un toque. Aparca sobre todo en **Alicante** (no se ha comprobado si su
  ayuntamiento publica plazas libres; mirarlo si pide datos reales). Ver "Fase 6".

## Cómo prueba el usuario en el iPhone

- **Al terminar cada parte del proyecto** (una fase, un bloque de trabajo, un arreglo),
  deja al día **las dos cosas**, sin que el usuario lo pida (decisión del 25/09/2026):
  1. **La web**: sube tu trabajo a `main` (con tsc, lint y pruebas pasando) y comprueba
     con `gh run list` que se ha publicado.
  2. **Expo Go**: ejecuta
     `powershell -ExecutionPolicy Bypass -File scripts\comprobar-expo-go.ps1`. Instala
     las librerías que falten, mira que el túnel responda desde internet y pide la app
     como la pediría el iPhone. Tiene que acabar en "OK". Si dice que el túnel no está
     en marcha, arráncalo (`preview_start` "organizy-tunel") y vuelve a ejecutarlo. Si
     has añadido librerías y el túnel ya estaba en marcha, reinícialo antes.
  **Por qué**: el 25/09 el usuario no podía abrir la app en Expo Go por dos cosas que
  nadie vio: el túnel se había apagado (la app de Claude apaga los servidores de
  `preview_start` cuando la sesión que los arrancó termina) y faltaba instalar una
  librería nueva de otra sesión (`@supabase/supabase-js`), así que la app no compilaba.
  Si añades una librería, **instálala también en `C:\proyectos\organizy`** aunque
  trabajes en un worktree.
- **A diario, la web** en la pantalla de inicio: funciona con cualquier wifi o datos,
  sin el ordenador, y se actualiza sola en cuanto una sesión sube a `main`.
- **La app en Expo Go SIN el ordenador** (desde el 26/09/2026): 
  `exp://u.expo.dev/bf4c1bdd-dea3-4040-b236-458205d44d0e?runtime-version=exposdk%3A58.0.0&channel-name=expo-go`.
  Se publica sola al subir a `main` (`.github/workflows/expo-go.yml`, trabajo "Publicar
  en Expo Go"; compruébalo con `gh run list`). Reglas: **no pongas `runtimeVersion` en
  `app.json`** (lo pone el workflow solo al publicar); **no instales `expo-updates`**
  mientras se use Expo Go; si se sube de SDK, cambia `RUNTIME_EXPO_GO` en el workflow;
  las variables `EXPO_PUBLIC_*` nuevas añádelas también en ese workflow. Lo que use
  módulos nativos que Expo Go no trae no funcionará aquí (igual que con el túnel).
- **La app, en Expo Go con túnel** (para programar y ver cambios al momento), siempre con la **misma dirección**:
  `exp://uv-pnzw-mangel_creator-8083.exp.direct`. Sale de `.expo/settings.json`
  (`urlRandomness`, no está en git: no lo borres) más el puerto 8083 y la cuenta de
  Expo `mangel_creator` con la que está iniciada la sesión de Expo CLI.
  - Arráncalo con `preview_start` y el nombre `organizy-tunel` (`.claude/launch.json`).
    Vale desde cualquier sesión, también desde un worktree: usa las rutas de
    `C:\proyectos\organizy`. Nunca con otro puerto: cambiaría la dirección.
  - Solo una sesión a la vez: si el puerto 8083 ya está en uso, el túnel ya está en
    marcha y no hay que hacer nada.
  - En el iPhone: Expo Go → "Development servers" → Organizy, o escribir la dirección
    en Safari.
  - Funciona con cualquier wifi o datos, pero **solo con el ordenador encendido** y el
    túnel en marcha. Los avisos ya programados siguen llegando aunque el ordenador
    esté apagado (hasta 7 días); lo que necesita el ordenador es abrir la app.
- **App propia sin el ordenador**: solo con la cuenta de desarrollador de Apple (ver
  la decisión del 25/09/2026). Ya está `eas.json` con los perfiles `preview`
  (instalación directa en su iPhone) y `production` (TestFlight/App Store), cada uno
  con su canal. **No instales todavía `expo-updates`** ni pongas `runtimeVersion` o
  `updates.url` en `app.json`: dejaría de funcionar el túnel (la sesión 02 concluyó el
  24/09 que Expo Go no carga EAS Update; era un error: sí la carga con `runtimeVersion`
  `exposdk:58.0.0`, ver arriba). Plan para cuando tenga la
  cuenta, en este orden:
  1. `npx expo install expo-updates` y `npx eas-cli@latest update:configure`.
  2. `npx eas-cli@latest build --profile preview --platform ios` (el usuario registra
     su iPhone con `eas device:create` y entra con su cuenta de Apple; nunca le pidas
     la contraseña).
  3. Un workflow de GitHub que, al subir a `main`, ejecute
     `npx eas-cli@latest update --channel preview --auto`. Necesita el secreto
     `EXPO_TOKEN` en GitHub, que crea y pega el propio usuario (expo.dev → Access
     tokens); nunca lo escribas tú.
  4. Desde entonces la app se actualiza sola al abrirla, sin el ordenador.

## Tecnología

- Expo SDK 58 (React Native 0.88) con TypeScript.
- Expo Router (rutas en `src/app/`), pestañas con `Tabs` de `expo-router`.
- Iconos: `@expo/vector-icons` (Ionicons).
- Letras: `@expo-google-fonts/ibm-plex-sans` e `@expo-google-fonts/ibm-plex-mono`.
- Guardado local: AsyncStorage (ajustes) y expo-sqlite (datos como eventos; en la
  web, AsyncStorage: ver "Fase 3").
- Se prueba con Expo Go mientras no haga falta código nativo propio.
- Alarmas de verdad: `react-native-alarm-scheduler` (solo en la app propia; en Expo Go no
  se carga, ver "Fase 7").
- Dictado por voz: `expo-speech-recognition` (solo en la app propia; en Expo Go no se carga,
  ver "Fase 9"). En la web, el reconocimiento del navegador.
- Instala librerías siempre con `npx expo install <paquete>`.
- Pruebas automáticas con Jest (`jest-expo`): `npm test`. Están junto al código en
  carpetas `__tests__`. Importa `describe`, `it` y `expect` de `@jest/globals`
  (TypeScript 6 no carga los tipos globales solo).

## Estructura de carpetas

```
src/
  app/                 Rutas (Expo Router). Solo reexportan pantallas.
    _layout.tsx        Raíz: carga letras y perfil, tema, Stack con rutas protegidas.
    bienvenida.tsx     Formulario de bienvenida (solo si no se ha completado).
    perfil.tsx         Perfil (se abre desde el botón con la inicial en Hoy).
    evento.tsx         Ficha de evento: /evento?fecha=AAAA-MM-DD (nuevo) o ?id= (editar).
    epoca.tsx          Sección de la Época dorada: /epoca (la activa) o /epoca?id=.
    epoca-editar.tsx   Formulario de la época en 3 pasos: nueva, o ?id= (y &paso=3).
    alarma.tsx         Nueva alarma (/alarma) o editar (/alarma?id=).
    (tabs)/_layout.tsx Barra inferior con las 5 pestañas.
    (tabs)/index.tsx   Hoy
    (tabs)/semana.tsx  Semana
    (tabs)/planes.tsx  Planes (con el plan personal)
    (tabs)/trabajo.tsx Empresa (con el plan empresa, en el sitio de Planes)
    (tabs)/mapa.tsx    Mapa
    (tabs)/alarmas.tsx Alarmas
  screens/             Una pantalla por archivo (PantallaHoy, PantallaSemana...).
    formulario-perfil/ Piezas compartidas por Bienvenida y Perfil (campos, borrador,
                       comprobaciones y tarjetas de permisos).
    calendario/        Piezas de Hoy, Semana y la ficha de evento (FilaEvento,
                       TarjetaHueco, textos y opciones, useAhora, ConfirmacionMovidas).
    perfil/            Secciones propias de Perfil (SeccionAvisos, SeccionEpocas).
    epoca/             Piezas de la Época dorada (franja, Plan de hoy, formulario,
                       editores de hitos y de imprescindibles, useEpocaActiva).
    captura/           Captura rápida con IA (campo de Hoy y tarjeta de confirmación).
    mapa/              Piezas del Mapa (MapaRuta móvil y web, destinos, tarjetas, leyenda).
    alarmas/           Piezas de Alarmas (fila, tarjeta de la inteligente, salidas,
                       hora de dormir, aviso del nivel).
    planes/            Piezas de Planes (botón de WhatsApp, fila de votos, hueco de
                       Semana con "Proponer plan").
    clientes/          Datos del cliente en la ficha y su recordatorio por WhatsApp.
    tareas/            Matriz de Eisenhower: selector de cuadrante y vista "Matriz" de Hoy.
    correo/            Piezas de Resúmenes (fila de correo, "Vincular con…", tus cuentas).
    empresa/           Piezas del plan empresa (entrar, casillas, filas, QR, avisos).
  components/          Piezas reutilizables. Se importan desde '@/components'.
  theme/               Colores, letras, tamaños, espacios y radios.
  data/                Guardado local: ajustes.ts (AsyncStorage), db.ts (SQLite),
                       perfil.ts (perfil del usuario), energia.ts (energía del día),
                       avisos.ts (qué avisos están activados), eventos/ (eventos),
                       epocas/ (épocas doradas y bloques marcados),
                       supabase.ts (conexión con el servidor propio),
                       salidas.ts y horasPunta.ts (tráfico calculado), navegador.ts
                       (app de navegación elegida), parkings.ts (parkings llenos),
                       alarmas.ts (alarmas, ajustes y adelantos de la inteligente),
                       planes.ts (planes con votación y sus votos),
                       recordatorios.ts (recordatorios a clientes: ajustes y envíos),
                       copia.ts (reunir y recuperar la copia de seguridad),
                       correos.ts (resúmenes de correo y enlace del ayudante de Gmail),
                       calendarios.ts (enlaces de otros calendarios),
                       empresa/ (plan empresa: copia y modo), supabaseEmpresa.ts (su sesión),
                       agenda.ts (tus eventos + lo de la empresa: úsalo para calcular el día).
  services/            Lógica sin pantalla: fechas.ts (formatos en español),
                       copia/ (formato de la copia de seguridad y su archivo; con pruebas),
                       calendarios/ (traer Google, iCloud u Outlook por su enlace iCal;
                       con pruebas),
                       lugares.ts (texto -> coordenadas), permisos.ts,
                       agenda/ (huecos, carga, resumen, reparto, prioridad de las
                       tareas con la matriz de Eisenhower; con pruebas),
                       avisos/ (notificaciones locales; con pruebas),
                       epoca/ (plan, progreso y cuenta atrás de la época; con pruebas),
                       captura/ (captura rápida con IA y validación; con pruebas),
                       dictado/ (voz a texto para el micro de la captura; con pruebas),
                       rutas/ (rutas con tráfico, hora de salida, horas punta,
                       abrir Waze/Google Maps/Mapas y parkings; con pruebas),
                       ubicacion.ts (dónde estás, sin preguntar),
                       alarmas/ (cuándo suena cada alarma, inteligente, alarmas de verdad
                       y Atajo de la web; con pruebas),
                       planes/ (horas sugeridas, recuento, mensajes de WhatsApp,
                       servidor y votación; con pruebas), contactos.ts (agenda),
                       clientes/ (recordatorios a clientes: teléfono, mensaje, estado;
                       con pruebas),
                       correo/ (resúmenes de correo: traerlos del servidor y del ayudante,
                       vincular y quitar cuentas, plazos como tareas; con pruebas),
                       ia/ (límites de IA de 5 horas y semana: porcentajes y mensajes;
                       con pruebas),
                       empresa/ (plan empresa: servidor, entrar, calendario, disponibilidad,
                       papeles, QR; con pruebas).
supabase/              Servidor propio: Edge Functions (Deno) y SQL. Ver "Servidor propio".
                       tests/: pruebas SQL de las reglas (se deshacen solas al acabar).
gmail/                 Ayudante de Gmail (Google Apps Script): ayudante.js (lo de Google) y
                       organizy-correo.js, que se GENERA con `npm run ayudante-gmail` juntando
                       ayudante.js y las reglas del servidor. Ver "Fase 11".
```

El alias `@/` apunta a `src/`.

## Diseño

Todo sale de `src/theme/index.ts`. No escribas colores sueltos en las pantallas.
Estilo desde el 26/10/2026: "fintech" oscuro y premium con paleta naranja (ver la decisión
de ese día). `BRIEF.md` guarda el porqué del diseño anterior; donde choque, manda esta sección.

**Cada color significa una sola cosa.** El naranja es solo para pulsar y para las cifras
destacadas; no lo uses para un tipo de evento, ni para errores ni para mensajes de "hecho".

| Uso | Token | Color |
|---|---|---|
| Fondo (negro cálido) | `fondo` | `#0F0D0C` |
| Tarjetas / superficies | `tarjeta` | `#1A1714` |
| Un nivel más elevado: botón secundario, chips, casillas, `BotonInicial` | `elevado` | `#24201C` |
| Texto principal | `texto` | `#F5F1EC` |
| Texto secundario | `textoSecundario` | `#A39A90` |
| Bordes y separadores sutiles (decorativo) | `borde` | `#2E2924` |
| Borde de los campos de texto | `bordeCampo` | `#7A6F64` |
| Texto sobre naranja, dorado, WhatsApp y degradados | `textoOscuro` | `#0F0D0C` |
| Cajas destacadas oscuras (alarma inteligente, aviso del mapa, burbujas) | `tinta` / `tintaSuave` | `#24201C` / `#2E2924` |
| Pulsar: botón principal, "+", pestaña activa, interruptores, hoy, casilla marcada; cifras destacadas | `principal` | `#FF6B1A` (naranja; texto encima `textoSobrePrincipal`, oscuro) |
| Naranja al pasar por encima / al pulsar | `principalHover` / `principalPulsado` | `#FF8A47` / `#E0560A` |
| Lo elegido: chips, casillas de `SelectorVisual`, casilla abierta de Hoy, bloque de foco | `acentoSuave` | `#2C180E` (naranja al 12 %), con borde y texto `principal` |
| Errores, avisos, días cargados (>80 %) | `aviso` | `#FF4D4F` (rojo) |
| "Clientes" | `clientes` | `#9C8BFF` (violeta) |
| "Amigos" | `amigos` | `#2BC48A` (verde) |
| "Yo" (personal) | `yo` | `#D9D1C7` (blanco cálido) |
| Barrita de carga normal y borde de huecos | `cargaNormal` | `#7A6F64` (gris) |
| Solo la Época dorada (franja, bloques de estudio, días con hito) | `dorado` | `#FFB020` (ámbar; texto oscuro encima) |
| Solo los botones de WhatsApp (excepción del 26/09) | `whatsapp` | `#25D366` (texto oscuro encima) |
| Solo lo de la empresa (plan empresa, fase 15) | `empresa` | `#7F93A8` (azul pizarra) |
| Solo los botones de entrar con Google o Microsoft y sus logos (excepción del 29/09) | `coloresMarca` | los de sus normas de marca |
| Tarjeta destacada (una por pantalla como mucho) | `degradados.naranja` / `degradados.teja` | `#FF6B1A → #FFB020` / `#FF6B1A → #C2361B` |

Para el color de un tipo de evento usa `colorTipo[evento.tipo]` (en `theme`), y para su
icono redondo, `colorBaldosa[tipo]` (fondo del color al 14 % e icono del color).
`colorTipoSobreTinta` y `colorEventoSobreTinta` siguen existiendo pero ya dan lo mismo.
Dentro del mapa, la ruta elegida sigue en azul (`coloresMapa.ruta`) para no confundirla
con el naranja y el rojo del tráfico.

- **Solo modo oscuro.** Cero sombras, sin degradados en botones y sin bordes gruesos: las
  cosas se separan por el color de fondo (`fondo` → `tarjeta` → `elevado`).
- **Letra Inter** para todo (`fuentes`): títulos 700 (el nivel 1, 800) con interletrado
  negativo, texto 400 de 16 px con interlineado 24, etiquetas 500, destacado 600. **Horas
  y cifras con números tabulares**: añade `...cifras` al estilo (lo llevan ya todos los que
  usan `fuentes.hora` y `fuentes.horaFuerte`). Las cifras importantes van enormes y en
  negrita (`tamanos.cifra`, 44).
- **Botones en píldora** (`radio.chip`): principal naranja con texto oscuro; secundario
  `elevado` con texto claro. Chips y selector de días, también en píldora.
- **Tarjetas de esquinas muy redondeadas** (`radio.grande`, 24) y sin borde. Una sola
  tarjeta destacada por pantalla, con degradado (`Tarjeta destacada="naranja"`).
- **Iconos de línea dentro de círculos**: casillas de Hoy y filas de eventos.
- **Listas tipo "movimientos"** (`FilaEvento`): icono redondo del color del tipo a la
  izquierda, título y lugar en el centro, hora de inicio grande y en negrita a la derecha
  (y la de fin debajo). Cada fila es una tarjeta redondeada (radio 20); las pasadas,
  sin fondo y en gris.
- **Hoy**: arriba la fecha y el botón de Perfil; debajo, el saludo gigante (40 px, 800) y
  la tarjeta "Lo siguiente" con degradado naranja → ámbar: "LO SIGUIENTE", la hora en
  grande ("10:00 hasta 12:00"), título y lugar, todo en `textoOscuro`; "Cómo llegar" va en
  píldora oscura. Debajo, **acciones rápidas** (`AccionesRapidas`, 26/10/2026, porque el
  usuario lo quería "mucho más cómodo"): cuatro botones redondos con una palabra debajo,
  Apuntar (naranja; abre la captura y pasa a "Cerrar"), Dictar, Semana y Mapa. Hoy ya no
  lleva `BotonFlotante`, que tapaba las casillas. El aviso de "añádela a la pantalla de
  inicio" va al final de Hoy, no arriba.
- **Todo lo que se pulsa se parece**: botones y chips en píldora; botones de solo icono,
  redondos (micrófono, enviar, "+", − y +); iconos de contenido dentro de un círculo.
  **Para volver, siempre `BotonAtras`** (píldora gris con flecha arriba a la izquierda); no
  hagas otro "Volver" a mano.
- **Perfil es un menú de ajustes** (26/10/2026): cada apartado es un `Plegable` con icono
  (Sobre ti y tu ritmo, Cómo se ve, Permisos, Tu IA, Avisos, Épocas doradas...), cerrado
  hasta que lo tocas. "Sobre ti y tu ritmo" se abre solo si al guardar hay un error. Si
  añades un apartado a Perfil, que sea otro `Plegable` con icono.
- **Tono cercano** en todos los textos: tuteo, frases cortas, algún giro coloquial
  suave, sin emojis ni exclamaciones. Ejemplos en `BRIEF.md` > "Tono".
- Todo lo pulsable mide 44 px de alto como mínimo (`alturaTactil`).
- Nada de `opacity` para "apagar" texto (baja del contraste mínimo): quita el fondo
  y usa `textoSecundario`, como las filas de eventos pasados.
- Barra de pestañas sobre `fondo` con una raya `borde` arriba; la activa, en naranja.
- **Hoy es un panel de casillas** (`screens/hoy/PanelHoy.tsx`, 26/09/2026): cabecera
  (fecha, saludo, "Lo siguiente") y seis casillas grandes de dos en dos, con icono en
  un círculo de color suave (`colorBaldosa`) y número grande:
  clientes, planes con amigos, tareas, cosas tuyas (o bloques de estudio si hay época),
  "Todo el día" y "Época dorada" (esta abre `/epoca`). Al tocar una, su lista sale
  debajo y la casilla se pone en `acentoSuave` con borde naranja; al tocarla otra vez,
  se cierra. La energía solo
  sale en Tareas y Estudio. La captura rápida está plegada: "Apuntar" la abre (y pasa a
  "Cerrar"); dentro, "Mejor lo relleno a mano" abre la ficha vacía. Si añades algo a Hoy,
  que sea una casilla o vaya dentro de la lista de una, no un bloque suelto más.
- **Formularios cortos y visuales**: a la vista solo lo esencial, con casillas de icono
  (`SelectorVisual`) mejor que chips de texto; lo opcional, en un `Plegable` ("Más
  ajustes") con un resumen de lo que ya está puesto, que se abre solo si hay un error
  dentro. Pon valores por defecto sensatos en vez de preguntar.
- **Época dorada en Hoy: cada cosa en su caja redondeada** (petición del usuario del
  25/09/2026, porque se veía todo amontonado): cuenta atrás, "Plan de hoy", aviso de "no
  caben" y "Cómo vas" van cada uno en una `Tarjeta` aparte. Dentro del plan, lo que se
  repite (sitio, largo de bloque y descanso) se dice una vez arriba y cada bloque es una
  línea (casilla, hora con cifras tabulares, examen y "Saltar"), separada por una raya fina. Sin
  líneas sueltas de descanso ni la dirección entera en cada bloque.

### Densidad (`src/data/densidad.ts`)

Cada persona elige en Perfil > "Cómo se ve": Con aire, Equilibrado (por defecto) o
Compacto. Se guarda en `organizy:densidad`. En pantallas:
`const { medidas } = useDensidad()` (alto y relleno de fila, separación, tamaño de
texto y `pxPorHora` de Semana). Solo afecta a las listas de Hoy y a la línea de horas de
Semana; los formularios no cambian. Ninguna fila baja de 44 px.

### Movimiento

Poco y con sentido, con `react-native-reanimated` (ya viene en Expo Go): la casilla da
un pequeño salto al marcarla, las filas de Hoy se recolocan deslizándose
(`LinearTransition`) y Semana hace un fundido corto al cambiar de día. Envuelve las
listas en `<LayoutAnimationConfig skipEntering>` para que no se anime nada al abrir la
pantalla. Las animaciones de Reanimated respetan solas "reducir movimiento". Con el
React Compiler, usa `valor.get()` y `valor.set()`, no `valor.value`. Al pulsar, los
botones se hunden un poco (`scale` 0.94-0.99) y el naranja pasa a `principalPulsado`. Las
transiciones duran 150-250 ms (`duracion` en theme), sin rebotes. Nada de pulsos ni
animaciones infinitas.

### Componentes (`src/components`)

- `Boton` — píldora; `variante="principal"` (naranja, texto oscuro) o `"secundario"` (`elevado`, texto claro).
- `Tarjeta` — caja plana de esquinas de 24, sin borde ni sombra. `destacada="naranja"` (o
  `"teja"`) la pinta con degradado y entonces el texto de dentro va en `textoOscuro`.
- `Titulo` — Inter 700 (el nivel 1, 800), apretado; `nivel` 1, 2 o 3.
- `Texto` — Inter, con `secundario`, `fuerte` y `pequeno`.
- `CampoTexto` — campo con `etiqueta`, `ayuda` y `error` (borde y mensaje en rojo, `aviso`).
- `Selector` — chips en píldora para elegir una opción; la elegida en `acentoSuave` con borde y texto naranja.
- `SelectorDias` — L M X J V S D, varios a la vez (lunes = 0).
- `SelectorHora` — hora "HH:MM" con botones − y + de 15 en 15 minutos.
- `BarraProgreso` — "Paso 1 de 2" con barra naranja.
- `AvisoPantallaInicio` — solo en la web del móvil: cómo añadirla a la pantalla de inicio.
- `BotonInicial` — botón redondo con la inicial del nombre (abre Perfil).
- `Pantalla` — contenedor de pantalla con fondo, márgenes y scroll. Se aparta del
  teclado (`KeyboardAvoidingView`) y admite `ref` para hacer scroll. `colorArriba` pinta
  la franja de la hora y la batería (ya casi no hace falta: todo es oscuro).
- `Proximamente` — relleno provisional para pestañas sin hacer.
- `BotonFlotante` — botón redondo naranja con "+", fijo abajo a la derecha. Va al
  lado de `Pantalla` (no dentro), en un `View` con `flex: 1`.
- `Casilla` — casilla para marcar como hecho (44 px); da un pequeño salto al marcarla.
- `Interruptor` — fila con texto, ayuda y un interruptor sí/no.
- `SelectorFecha` — día con − y + y atajos Hoy, Mañana y En una semana.
- `SelectorCantidad` — número con − y + (horas al día, horas de preparación...).
- `SelectorVisual` — como `Selector`, con casillas grandes de icono y texto (`OpcionVisual`:
  `valor`, `etiqueta`, `icono` de Ionicons y `veces` para repetirlo, como las llamas de la
  dificultad). La elegida, en naranja suave, como los chips.
- `Plegable` — tarjeta "Más ajustes" que se abre al tocarla; `resumen` enseña lo que ya
  está puesto, `abierto` la abre desde fuera (por ejemplo, si hay un error dentro) e
  `icono` le pone un icono en un círculo a la izquierda (menús como Perfil).
- `BotonAtras` — píldora gris con flecha para volver (`texto`, `etiqueta` para el lector de
  pantalla y `onPress`). Es el único "Volver" de la app.
- `AccionesRapidas` — fila de botones redondos con icono y una palabra debajo (`DatosAccion`:
  `clave`, `icono`, `texto`, `etiqueta`, `activa`, `alPulsar`); el primero, en naranja.
- `BotonFlotante` admite `icono="close"` para cuando lo que abre ya está abierto.
- `BotonEntrarCon` — botón oficial para entrar con `proveedor="google"` o `"microsoft"`, como
  piden sus normas de marca (no cambies su aspecto). `LogoMarca` enseña solo el logo.

## Idioma y formatos

- Toda la app en español de España.
- Fechas en formato español, semana empezando en lunes, horas en 24 h.
- Zona horaria del dispositivo. Usa siempre las funciones de `src/services/fechas.ts`.

## Datos

- `src/data/ajustes.ts`: `leerAjuste`, `guardarAjuste`, `borrarAjuste` (AsyncStorage,
  prefijo `organizy:`).
- `src/data/db.ts`: `obtenerBD()` abre `organizy.db` y aplica migraciones. Para crear
  tablas, añade una función al final de `MIGRACIONES` (la versión se guarda en
  `PRAGMA user_version`). Migración 1: tabla `eventos`; 2: columnas
  `lugar_tipo` y `lugar_sitio_id`; 3: `aviso_min`; 4: tablas `epocas`, `hitos` y
  `bloques_epoca` (fase 4b); 5: columna `cliente` (fase 10); 6: columna `origen` (otros
  calendarios); 7: columna `cuadrante` (matriz de Eisenhower); 8: columna `temas` de `hitos`
  (temario de la Época dorada); 9: tabla `empresa_copia` (copia del plan empresa, fase 15).
  Solo se usa en Android e iOS.
- `src/data/perfil.ts`: tipo `Perfil` (nombre, vivienda con coordenadas, sitios
  habituales, transporte, uso, horario, días de trabajo, cuándo rinde más y
  antelación de avisos). Se guarda en AsyncStorage (`organizy:perfil` y
  `organizy:bienvenidaCompletada`).
  - En pantallas: `const { perfil } = usePerfil()` (se actualiza solo al guardar).
  (Alarmas: `data/alarmas.ts`, ver "Fase 7": `useAlarmas()`, `guardarAlarma`,
  `borrarAlarma`, `activarAlarma`, `cambiarAjustesAlarmas`, `alternarAlarmaSalida`,
  `useAdelantos()`.)
  - Fuera de pantallas: `await leerPerfil()`.
  - `guardarPerfil`, `completarBienvenida`, `repetirBienvenida`.
- `src/data/eventos/`: tipo `Evento` en `tipos.ts` (título, fecha "AAAA-MM-DD",
  horas "HH:MM" o null, tipo `cliente|amigos|yo`, lugar (`LugarEvento`: casa, sitio
  por id u otro), notas, repetición, flexible + duración + hecha, foco, ejemplo).
  - En pantallas: `const { cargado, eventos } = useEventos()`.
  - Para cambiar: `guardarEvento` (crea o actualiza), `borrarEvento`, `marcarHecha`,
    `moverTareas`, `crearEventosEjemplo`, `borrarEventosEjemplo`, `nuevoId`.
  - El guardado real está en `repositorio.ts` (SQLite, móvil) y `repositorio.web.ts`
    (AsyncStorage, clave `organizy:eventos`). Metro elige el archivo según la
    plataforma; los dos cumplen el tipo `RepositorioEventos`. Nada de la web debe
    importar `db.ts`.
- `src/data/energia.ts`: `useEnergia(dia)` guarda "a-tope", "normal" o "tranqui" en
  `organizy:energia:AAAA-MM-DD`.
- `src/services/agenda/` (funciones puras, con pruebas en `__tests__`):
  `eventosDelDia`, `ocurreEnDia` (repeticiones), `tareasPendientes`,
  `calcularHuecos`, `cargaDelDia`, `fraseResumen`, `repartirTareas`,
  `siguienteEvento`, `bloqueDeFocoQuePisa`, `colocarEnCarriles`, `ventanaDelDia`,
  `resolverLugar`, `sitioTrabajo`.
  Tiempos en minutos desde medianoche (`Intervalo`).
- `src/data/avisos.ts`: `AjustesAvisos` (eventos, resumenManana, cierreDia,
  cierreSinPendientes) en `organizy:avisos`. En pantallas `useAjustesAvisos()`; para
  cambiar `cambiarAjustesAvisos({...})`.
- Evento tiene `avisoMin` (migración 3 de SQLite, columna `aviso_min`): null = la
  antelación del perfil, 0 = sin aviso. En la web, los eventos antiguos sin el campo
  se leen con null.
- Para lógica sin pantallas: `leerEventos()` / `suscribirseEventos` y
  `cargarPerfil()` / `suscribirsePerfil`.
- `src/data/epocas/`: tipos `Epoca`, `Hito`, `RitmoEpoca`, `Imprescindible`, `RegistroBloque`
  en `tipos.ts`. En pantallas `useEpocas()` → { cargado, epocas, registro }; fuera,
  `leerEpocas()` / `suscribirseEpocas`. Para cambiar: `guardarEpoca`, `borrarEpoca`,
  `terminarEpoca`, `marcarResumenVisto`, `marcarBloque(bloque, 'hecho'|'saltado'|null)`,
  `crearEpocaDeEjemplo`, `borrarEpocasDeEjemplo`. Guardado como los eventos:
  `repositorio.ts` (SQLite) y `repositorio.web.ts` (`organizy:epocas` y
  `organizy:bloquesEpoca`).
- `src/services/epoca/` (puro, con pruebas): `epocaActiva(epocas, dia)` (úsala para saber
  si hay época: Hoy, Semana y avisos), `estadoEpoca`, `epocaProxima`, `epocasSolapadas`,
  `ventanaEpoca`, `lugarDelDia`, `imprescindiblesDelDia`, `cuentaAtras`, `textoQuedan`,
  `planificarEpoca`, `eventoDeBloque`, `progresoHitos`, `progresoSemana`, `resumenEpoca`.

## Fase 2: bienvenida y perfil (decisiones)

- La bienvenida sale mientras `bienvenidaCompletada` sea false. Se controla en
  `src/app/_layout.tsx` con `Stack.Protected`: al completarla, la app salta sola a
  las pestañas; con "Repetir bienvenida" (en Perfil) vuelve a salir, ya rellena.
- Pasos: 1 "Cuéntame un poco de ti", 2 "Tu ritmo" y una pantalla final que explica
  los permisos (ubicación y notificaciones) antes de pedirlos. "Ahora no" los salta.
  Si se deniegan, se activan desde Perfil ("Activar" o "Abrir Ajustes del teléfono"
  si el sistema ya no deja volver a preguntar). Micrófono y contactos: en su fase.
- Coordenadas (`src/services/lugares.ts`, `buscarCoordenadas`):
  - En el móvil, `Location.geocodeAsync` (no necesita permiso de ubicación).
  - En la web, OpenStreetMap (Nominatim), aprobado por el usuario. Solo se envía el
    texto de la dirección. Normas: como mucho 1 búsqueda por segundo (ya
    controlado), nunca buscar mientras se escribe, y mostrar la atribución
    `ATRIBUCION_OPENSTREETMAP` donde se busque.
  - Sin conexión se guarda con `coordenadas: null` y `completarCoordenadasPendientes()`
    las calcula al abrir la app. Si no encuentra un sitio, pide escribirlo de otra forma.
- Horas con botones − y + (no hay selector de hora nativo que funcione igual en
  Expo Go y en web). Días de trabajo por defecto de lunes a viernes.
- Saludo en Hoy con `saludoSegunHora(fecha, nombre)` (`fechas.ts`): "¿Qué toca hoy,
  Miguel?" hasta las 13:59, "¿Qué queda hoy…?" de 14:00 a 20:59 y "¿Qué tal el día…?"
  de 21:00 a 23:59. También es el título del aviso del resumen de la mañana.
- Perfil no usa la cabecera del Stack: lleva su propio botón "Hoy" para volver, así
  el apartado del teclado no necesita calcular la altura de la cabecera.
- Librerías añadidas: `expo-location` y `expo-notifications` (con sus plugins en
  `app.json`). Las dos funcionan en Expo Go.
- Permisos por plataforma: `PERMISOS_DISPONIBLES` (`src/services/permisos.ts`). En web
  solo ubicación; si se deniega, se explica cómo activarla desde el navegador.
- En la web del móvil, Hoy muestra `AvisoPantallaInicio` (pasos para iPhone y
  Android). Se puede cerrar y no vuelve a salir. Añadirla a la pantalla de inicio
  evita que Safari borre los datos tras 7 días sin usarla.

## Fase 3: calendario, Hoy y Semana (decisiones)

- **SQLite no funciona en la web publicada**: expo-sqlite en navegador necesita
  `SharedArrayBuffer` y las cabeceras COOP/COEP, que GitHub Pages no permite. Por eso
  los eventos van a SQLite en el móvil y a AsyncStorage (localStorage) en la web,
  con la misma interfaz (`src/data/eventos/`).
- Eventos con hora fija: fin después del inicio y el mismo día (no cruzan la
  medianoche). Las tareas flexibles no tienen hora ni se repiten; tienen fecha
  prevista, duración (15, 30, 60 o 120 min) y casilla de hecha. Las de días
  anteriores sin hacer aparecen hoy.
- Repetición: cada día, cada semana (mismo día de la semana) o cada mes (mismo
  número; los meses sin ese día se saltan). Editar o borrar afecta a toda la serie.
- Lugar: "Sin lugar", "Casa" (vivienda del perfil), "Trabajo", los demás sitios
  habituales u "Otro sitio" (dirección exacta; coordenadas con `buscarCoordenadas`,
  sin conexión solo el texto). Casa y los sitios se guardan como **referencia**
  (`{ tipo: 'casa' }` o `{ tipo: 'sitio', sitioId }`), no como copia: se muestran con
  `resolverLugar(lugar, perfil)`, así que al cambiar la dirección en Perfil los
  eventos se actualizan solos. "Otro sitio" sí guarda la dirección tal cual.
- Si el perfil no tiene un sitio "Trabajo" (`sitioTrabajo`), el chip "Trabajo" de la
  ficha pide su dirección y lo crea en el perfil al guardar el evento.
- En Perfil los sitios habituales se pueden editar (botón del lápiz) conservando su
  id. Si se borra un sitio, sus eventos se quedan sin lugar.
- En la ficha y en la tarjeta "Siguiente" se ve el nombre del sitio y debajo la
  dirección; en las listas, solo el nombre.
- Eventos guardados con el formato antiguo de lugar (`{ nombre, direccion,
  coordenadas }`): se leen como "Otro sitio" (`normalizarLugar` en la web; migración
  2 de SQLite en el móvil).
- Aviso "Esto pisa tu bloque de foco. ¿Seguro?" al guardar un evento (nuevo o
  editado) que se solapa con un bloque de foco de ese día. Las confirmaciones (foco y
  borrar) son tarjetas dentro de la pantalla, no `Alert`, porque `Alert` no hace
  nada en la web.
- Hoy: fecha "Jueves 24 sept", saludo, tarjeta "Lo siguiente" (el que está en curso o el
  próximo, hasta 7 días) y el panel de casillas (ver "Diseño"); "Todo el día" enseña la
  lista con huecos, y "Tareas", las tareas con la energía.
  Huecos libres: de 1 h o más, desde ahora (redondeado al cuarto de hora) hasta la
  hora de acostarse, empezando como pronto al levantarse.
- Energía: A tope coloca las tareas primero en el momento en que rinde más
  (mañana 6-14, tarde 14-21, noche 21-24); Normal las reparte por turnos entre los
  huecos; Tranqui deja 2 y ofrece "Pasar el resto a mañana". Para colocar tareas
  valen huecos de 15 min o más. Las tareas solo muestran una hora sugerida: nunca
  mueven eventos.
- Semana: carga = (horas de eventos, sin contar dos veces lo solapado, + duración
  de tareas pendientes) / horas de jornada del perfil. Más del 80 % = granate (`aviso`).
  Cambiar de semana con flechas o deslizando sobre la tira de días; "Hoy" aparece
  cuando no se está en hoy. Línea de horas a 56 px por hora; los solapados van en
  columnas; los bloques de foco en negro con "Protegido".
- Eventos de ejemplo: en modo desarrollo se crean solos la primera vez
  (`organizy:ejemplosCreados`). En Perfil > Pruebas hay botones para crearlos y
  borrarlos también en la web publicada (allí no hay modo desarrollo).
- La hora actual se refresca cada minuto (`useAhora`).

## Fase 4: avisos (decisiones)

- Notificaciones locales con expo-notifications, sin servidor. Solo en el móvil: en
  la web no se programan (el navegador no puede con la web cerrada) y Perfil > Avisos
  lo explica; la ficha de evento oculta el selector de aviso.
- `src/services/avisos/`:
  - `planificar.ts` (puro, con pruebas): `planificarAvisos(ctx)` recorre los días
    (desde ayer hasta 7 días) y llama a los `GENERADORES` activos. Quita lo pasado,
    ordena por hora y se queda con 60 (`MAX_AVISOS`; iOS admite 64).
  - `programar.ts` (móvil) y `programar.web.ts` (no hace nada): hablan con
    expo-notifications. Cada vez se borran todos los programados (menos el de
    prueba) y se vuelven a programar.
  - `index.ts`: `iniciarAvisos()` (en `_layout`) reprograma al arrancar, al volver a
    abrir la app y al cambiar eventos, perfil o ajustes (espera 0,5 s para juntar
    cambios). Solo si hay permiso y la bienvenida está hecha.
  - **Para añadir un tipo de aviso** (fase 4b: inicio de bloque, fin del descanso,
    hora de dormir...): añade el tipo en `tipos.ts`, su interruptor en
    `data/avisos.ts` y un generador `(ctx, dia) => AvisoPlanificado[]` en `GENERADORES`.
    Si lleva botones, crea su categoría en `prepararAvisos()`.
- Aviso de evento: "En 30 min: Reunión con Laura en Oficina" y la hora debajo. Uno
  por cada repetición. Antelación: la del evento o la del perfil (10, 30 o 60 min).
  En la ficha, si eliges la misma que el perfil se guarda null (sigue al perfil).
- Resumen de la mañana a la hora de levantarse: `fraseDeLaManana` usa `fraseResumen`
  de Hoy (huecos de todo el día) y añade "Hoy va justo, mejor no metas nada más." si
  la carga pasa del 80 % (la misma cuenta que Semana).
- Cierre del día una hora antes de acostarse (si se acuesta después de medianoche,
  cae de madrugada). Con tareas pendientes: "Te quedaron 2 cosas: ... ¿Las paso a
  mañana?" con botones "Sí, a mañana" y "Abrir". Sin pendientes: buenas noches o
  nada (ajuste `cierreSinPendientes`).
- **"Sí, a mañana" abre la app**: iOS (y Expo Go) no deja ejecutar código de la app
  desde un botón de la notificación si está cerrada. Al abrirse pasa al momento las
  tareas que sigan pendientes ese día y enseña Hoy con "Hecho: he pasado N tareas a
  mañana" (`/?movidas=N`, `ConfirmacionMovidas`). Con una versión propia se podría
  hacer sin abrir la app (tarea en segundo plano).
- Al tocar un aviso: evento -> su ficha; resumen y cierre -> Hoy. Se escucha en
  `_layout.tsx` con `escucharRespuestas` (también el aviso que abrió la app cerrada).
- Perfil > Avisos (`screens/perfil/SeccionAvisos.tsx`): interruptores por tipo, aviso
  con botón si no hay permiso, número de avisos programados y botones de prueba que
  llegan en 5 s: "Enviar un aviso de prueba", "Probar el resumen de la mañana" y
  "Probar el cierre del día" (`probarAvisoDeHoy`: el aviso de hoy tal cual, con sus
  botones). Hacen falta porque las horas van de 15 en 15 min y no se puede poner la
  hora de levantarse "dentro de 2 minutos".
- Android: canal "avisos" de importancia alta.
- **Alarmas (fase 7), hecho así** (ver "Fase 7"). Notas originales:
  1. Cada tipo nuevo (despertador, hora de dormir, salida, inteligente) es un
     generador en `GENERADORES` (`planificar.ts`), más su tipo en `tipos.ts` y su
     interruptor en `data/avisos.ts`. Si lleva botones (posponer, apagar), crea su
     categoría en `prepararAvisos()` (`programar.ts`) y atiende la acción en
     `atenderRespuesta()` (`index.ts`).
  2. **Reserva sitio a las alarmas antes del recorte.** `planificarAvisos` se queda
     con los `MAX_AVISOS` (60) más cercanos en el tiempo: con muchos eventos, una
     alarma de dentro de unos días se quedaría fuera y no sonaría. Mete primero las
     alarmas y rellena con el resto hasta 60 (y añade una prueba de ello).
  3. `programarAvisos` borra y vuelve a programar todo, salvo los identificadores que
     empiezan por `prueba:`. Si las alarmas se programan por otra vía (AlarmKit o
     AlarmManager en la app propia), que no pasen por aquí o las borrará.
  4. Sonido: `sound: 'default'`. Un sonido propio no funciona en Expo Go y no suena
     con el móvil en silencio.

## Fase 4b: Época dorada (decisiones)

- Modo para exámenes o trabajo intenso, con fechas de inicio y fin. Mientras dura, Hoy,
  Semana y los avisos usan el ritmo de la época (levantarse, acostarse, horas al día)
  en vez del del perfil. Fuera de la época nada cambia. Solo una activa a la vez: si
  dos se solapan se avisa al guardar y, si se guarda igualmente, manda la que empieza antes.
- Dónde: en Hoy, la casilla "Época dorada" (con "quedan N días" si hay una activa) abre la
  sección, y la casilla de bloques de estudio enseña el plan de hoy; sección `/epoca`; en Perfil, el apartado "Épocas doradas" (activa, programadas y pasadas).
- Formulario de 3 pasos cortos (`/epoca-editar`), editable después. A la vista solo lo
  esencial; el resto, en "Más ajustes" (26/09/2026): 1 tipo (casillas con icono) y hasta
  cuándo; plegados, el nombre (si se deja vacío, `nombrePorDefecto`: "Exámenes de
  octubre") y el día que empieza (hoy). 2 dónde, horas al día y cuándo rinde más;
  plegados, horario, bloques y descanso (50 + 10 por defecto), día libre, días que va,
  sitio por día, trayecto y lo que no quiere dejar de hacer. 3 hitos: de qué es, cuándo,
  dificultad (1 a 3 llamas) y horas; plegados, la hora y el lugar.
- "Qué días vas" son los días que va al sitio de estudio; los demás estudia en casa. El
  día libre no tiene plan. Los sitios por día se eligen entre el de la época, Casa y los
  sitios habituales. Lugares como en los eventos: Casa y sitios por referencia.
- **Plan automático** (`planificarEpoca`): reparte las horas de cada hito en bloques del
  largo elegido (25, 50 o 90 min, con su descanso detrás) en los días anteriores al hito,
  dentro del horario de la época, primero en el momento en que rinde más, sin pisar
  eventos ni lo que no quiere dejar de hacer (que se ven como eventos "virtuales" con id
  `epoca-...`: al tocarlos se abre la sección). Cada bloque va al hito con más
  `puntuacion` = dificultad × horas que le quedan / días hasta su fecha. "Tranqui" ese
  día: la mitad de horas. Bloque mínimo 15 min.
- El plan no se guarda: se calcula al vuelo. Solo se guarda lo marcado (`RegistroBloque`,
  id "<época>:<día>:<minuto>"). El plan de hoy se calcula desde que empieza el día para
  que los bloques no cambien de hora. Un bloque saltado (botón "Saltar") o uno de un día
  pasado sin marcar se reparte solo en los días que quedan. Si ya no caben, se avisa
  (`faltanMin`) en Hoy y en la sección.
- Hoy durante la época: cuenta atrás al siguiente hito, "Plan de hoy" (bloques con
  casilla, "Saltar"/"Deshacer" y descansos) y progreso (semana y cada hito). Los huecos
  de "Tu día" usan el horario de la época y descuentan los bloques.
- Semana: en los días de la época, carga = ocupado / horas despierto de la época; los
  bloques salen en la línea de horas como bloques de foco con barra dorada y los días
  con hito llevan un punto dorado.
- Avisos (`services/avisos/epoca.ts`, en `GENERADORES`): hora de salir (primer bloque
  menos "tardo en llegar", solo si no estudia en casa), inicio de cada bloque, fin del
  descanso (si justo después empieza otro bloque) y "Hora de ir a dormir". Se apagan uno
  a uno en la sección (`Epoca.avisos`). En la web no hay avisos: la sección lo explica.
  La hora de salir usa un tiempo elegido a mano hasta que la fase 6 dé trayectos reales.
  **Pendiente**: la fase 6 ya los da (`calcularRutas` con `llegada` y `horaDeSalida`, ver
  "Fase 6"); conectarlo dejando el tiempo a mano como respaldo (sin servidor o en
  transporte público).
- Al terminar (o con "Terminar la época hoy") la app vuelve sola al ritmo normal y Hoy
  enseña una vez el resumen: horas hechas, bloques completados e hitos superados.
- Época de ejemplo (3 exámenes, algunos bloques hechos): en desarrollo se crea sola la
  primera vez (`organizy:epocaEjemploCreada`); en Perfil hay botones para crearla y borrarla.
- Rutas nuevas: si `tsc` se queja de `/epoca` en otra carpeta, es que `.expo/types` está
  anticuado; se regenera al arrancar `expo start`.
- **La IA ayuda a planificar** (28/09/2026, lo pidió el usuario; eligió las tres formas).
  Función `epoca` de Supabase (desplegada; Claude Haiku 4.5, `EPOCA_MODELO` para cambiarlo sin
  tocar la app; límites `EPOCA_LIMITE_USUARIO` 30 y `EPOCA_LIMITE_GLOBAL` 1000 al día). Sin
  `ANTHROPIC_API_KEY` contesta 503 `sin-clave` sin gastar y la app dice "aún no está
  encendida"; se enciende sola al poner la clave. No guarda nada. Cliente en
  `services/epoca/ia.ts` (no se exporta desde el `index` para que las pruebas no carguen
  Supabase); comprobaciones puras con pruebas en `services/epoca/validarIA.ts`.
  1. **"Cuéntamelo y lo preparo"** (`screens/epoca/CuentameloIA.tsx`, plegado en el paso 1
     del formulario, solo al crear): texto libre (o dictado con el micro del teclado) → la IA
     devuelve tipo, fechas, sitio (Casa, un sitio habitual por id u "otro" con su texto),
     días, horas, momento, descanso, día libre, horario, imprescindibles, hitos con dificultad
     y horas estimadas, y `notas` con lo que ha supuesto. `borradorConPropuesta` solo cambia
     lo que ha dicho y añade hitos e imprescindibles. Se envían el texto, el día, el horario
     normal y los nombres de los sitios (sin direcciones).
  2. **Temario por temas** (`screens/epoca/PanelTemario.tsx`, icono de lista en cada hito del
     paso 3): pegas el temario → temas con horas (el último, de repaso) y un consejo. Al
     usarlos, `Hito.temas` (`TemaHito[]`) y las horas de preparación pasan a ser su suma. Los
     bloques van recorriendo los temas en orden según los minutos hechos (`temasDelPlan`: cada
     bloque, el tema donde cae su mitad; pasado el final, el último): "Plan de hoy" enseña el
     tema debajo del examen y la sección, "Toca: Tema 3 (3 de 6)" (`temaActual`).
  3. **Repaso de cómo vas** (`screens/epoca/RepasoIA.tsx`, sección "¿Cómo lo llevas?" con la
     época activa): se mandan solo números y nombres de hitos (`datosRepaso`); vuelve un
     resumen y como mucho 3 propuestas (`horas-dia`, `horas-hito`, `dificultad`, `descanso`)
     con "Aplicar" o "Aplicar todo" (`aplicarPropuesta` + `guardarEpoca`; el plan se recalcula
     solo). Se descartan las que no cambian nada o de hitos pasados.
  Probado el 28/09 en la web a tamaño móvil: la función real sin clave ("aún no está
  encendida") y, con respuestas simuladas, rellenar el formulario, repartir el temario,
  guardarlo, el tema en "Plan de hoy" y aplicar propuestas. **Falta** probarlo con la clave.

## Servidor propio: Supabase (desde la fase 5)

Un solo proyecto de Supabase para todo lo que necesita claves secretas (fases 5, 6, 8...).
Los datos del usuario siguen solo en su dispositivo: el servidor no guarda frases ni
eventos, solo cuenta usos. La excepción son los planes con votación (fase 8), que se
borran solos a los 7 días.

- **Cuentas**: las crea y administra el usuario (supabase.com y console.anthropic.com).
  Nunca le pidas contraseñas ni claves secretas: las escribe él en el panel de Supabase
  o con `npx supabase secrets set` en su terminal.
- **Claves**: la dirección del proyecto y la clave **pública** (publishable,
  `sb_publishable_...`) pueden ir en la app: `EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_KEY` en `.env` (no se sube; plantilla en `.env.example`) y, para la
  web publicada, variables del repositorio `SUPABASE_URL` y `SUPABASE_KEY` (Settings >
  Secrets and variables > Actions > Variables) que `pages.yml` pasa a `expo export`. Tras
  crear o cambiar `.env`, reinicia el servidor de Expo (túnel incluido). Las secretas
  (`ANTHROPIC_API_KEY`, `TOMTOM_API_KEY`, la `sb_secret_...`) solo en los secretos de Supabase.
- **En la app**: `src/data/supabase.ts`: `obtenerSupabase()` (null si no hay `.env`: la
  app funciona igual, sin lo del servidor) y `asegurarSesion(supabase)` (usuario anónimo,
  sin registro; sesión en AsyncStorage). Después `supabase.functions.invoke('nombre',
  { body, timeout })`: el token del usuario va solo en la cabecera.
- **Funciones** en `supabase/functions/<nombre>/index.ts` (Deno; `tsc` y `eslint` no miran
  la carpeta `supabase`). Piezas comunes en `supabase/functions/_shared/`: `cors.ts`
  (solo `https://mangel-creator.github.io` y `http://localhost:*`), `usuario.ts`
  (`usuarioDeLaPeticion`: comprueba el token con `auth.getUser`) y `limite.ts` (`sumarUso`:
  límite por usuario y día y otro global). Cada función lleva `verify_jwt = false` en
  `supabase/config.toml` (comprueba el usuario por dentro; así pasa el preflight CORS).
- **Base de datos**: `supabase/migrations/` (tabla `usos_diarios` y función `sumar_uso`,
  que solo puede llamar el servidor; tablas de planes de la fase 8; cuentas de correo
  vinculadas de la fase 11). Se aplica pegando el
  SQL en el SQL Editor del panel o, con la sesión de la CLI, con
  `npx supabase db query --linked --project-ref <ref> --file <archivo.sql>` (así se aplicó
  la de la fase 8). Mirar qué hay: `npx supabase db query --linked --project-ref <ref> "select ..."`.
- **Desplegar** (desde `C:\proyectos\organizy`, con la sesión de la CLI iniciada por el
  usuario con `npx supabase login`): `npx supabase functions deploy <nombre>
  --project-ref <ref> --use-api`.
- Autenticación anónima activada en el panel (Authentication > Sign In / Providers >
  Anonymous). Supabase limita a 30 altas anónimas por hora y dirección IP.

## Fase 5: captura rápida con IA (decisiones)

- En Hoy, bajo la cabecera, campo "¿Qué apunto?" (`screens/captura/CapturaRapida.tsx`),
  **plegado** hasta tocar el "+" (`plegada`). Sigue montado aunque no se vea, así que
  `enviarFraseACaptura` funciona igual y lo despliega mientras piensa.
  Se escribe o se dicta con el micrófono del teclado. `accesorio` deja poner otro botón
  junto al de enviar (micrófono de la fase 9) y `enviarFraseACaptura(frase)` manda una
  frase desde fuera por el mismo camino.
- `services/captura/index.ts`: `interpretarFrase(frase, perfil)` envía la frase, el día y la
  hora, la zona horaria y los sitios (Casa con id `casa` y los habituales, solo id y
  nombre, sin direcciones) a la Edge Function `captura`. Nunca guarda nada.
- La función (`supabase/functions/captura`) usa **Claude Haiku 4.5** (`claude-haiku-4-5`) con
  salida estructurada (JSON con esquema). Le da un calendario de 15 días para que acierte
  "el jueves". Devuelve título, fecha, inicio, fin (1 h por defecto), tipo, `sitioId`,
  flexible, duración y confianza (alta, media, baja). Límite: 50 usos por usuario y día y
  1000 en total (secretos opcionales `CAPTURA_LIMITE_USUARIO` y `CAPTURA_LIMITE_GLOBAL`).
  En sus registros solo apunta los tokens gastados, nunca la frase.
- La app vuelve a validar el JSON (`services/captura/validar.ts`, con pruebas): fecha real
  y cercana, horas válidas, fin después del inicio y sin cruzar medianoche, tipo y sitio
  válidos (lugar por referencia, como en la fase 3). Sin hora = tarea flexible.
- Confianza alta o media: tarjeta editable "¿Lo guardo así?" (`TarjetaConfirmacion.tsx`)
  con Guardar, Cancelar y "Más opciones" (abre la ficha completa ya rellena). Avisa si
  pisa un bloque de foco.
- Sin `.env`, sin conexión, con error, al llegar al límite o con confianza baja: abre la
  ficha normal con la frase como título y un mensaje corto arriba. La ficha acepta
  `/evento?fecha=...&propuesta=<id>` con un borrador en memoria
  (`services/captura/borrador.ts`: `dejarBorrador` y `leerBorrador`), para no poner la
  frase en la dirección de la página.
- Coste aproximado: 0,2 céntimos de dólar por frase (unos 1.300 tokens de entrada y 120 de
  salida, a 1 $ y 5 $ por millón): unas 500 frases por dólar. Gasto en console.anthropic.com > Usage / Cost; conviene poner
  también un límite de gasto mensual en la consola.

## Fase 6: mapa, tráfico y rutas (decisiones)

- **Tráfico con TomTom, no con Google** (lo eligió el usuario): gratis y sin tarjeta,
  2.500 peticiones al día para todos los usuarios juntos y 50.000 trozos de mapa al día;
  si se pasa, deja de responder hasta el día siguiente, nunca cobra. No calcula
  transporte público: con `transporte-publico` no se piden rutas y se ofrece Google Maps.
  Waze no da datos a otras apps: solo se abre con un enlace.
- **Claves**: la de rutas solo en los secretos de Supabase, como `TOMTOM_API_KEY` o `TOMTOM_KEY` (el usuario la guardó así el 27/09; la función acepta los dos nombres). Es la clave "My First API key" de su cuenta de TomTom (plan Evaluation, todos los productos, rotada el 27/09). Para la web hay
  otra clave de TomTom **pública**, restringida al dominio `mangel-creator.github.io` y
  solo a mapas (Map Display y Traffic tiles), en la variable del repositorio
  `TOMTOM_MAPA_KEY` → `EXPO_PUBLIC_TOMTOM_MAPA_KEY` (pages.yml); sirve para el fondo del mapa
  y la capa de tráfico de todas las carreteras. Sin ella, fondo de OpenStreetMap y solo
  los tramos de la ruta. Sin tarjeta en TomTom, un abuso no puede generar gasto.
- **Mapa**: `screens/mapa/MapaRuta.tsx` (móvil, `react-native-maps`, incluido en Expo Go:
  mapa de Apple en iPhone, sin clave, con `showsTraffic` para pintar el tráfico como Waze)
  y `MapaRuta.web.tsx` (web, Leaflet, cargado al montar porque necesita el navegador).
  Mismas props (`screens/mapa/tipos.ts`). Para la app propia en **Android** hará falta una
  clave de Google Maps SDK en el plugin de `react-native-maps` (en iPhone no).
- **Colores del tráfico** (`coloresMapa` en theme): rojo atasco, amarillo denso, ruta en
  azul, alternativas en gris y parkings como "P" blanca en un cuadrado azul. Solo dentro
  del mapa (la excepción del 25/09); fuera, el "+6 min" va en granate (`aviso`).
- **Servidor** (`supabase/functions/rutas`): acción `rutas` (1 a 3 rutas con
  `maxAlternatives`, `arriveAt` para llegar a una hora o `departAt`; devuelve duración,
  sin tráfico, retraso, distancia, puntos aligerados y tramos `denso`/`atasco` según
  `magnitudeOfDelay` de las secciones de tráfico), acción `muestras` (horas punta: una
  sola llamada por lotes, `batch/sync`, 56 peticiones) y acción `parkings` (Search API,
  `nearbySearch` con las categorías 7313 parking cubierto y 7369 al aire libre, a menos de
  1 km del destino, hasta 15). Límites: `rutas` 150 por usuario y 2.000 en total al día;
  `rutas-horas-punta` 2 por usuario y 8 en total; `parkings` 30 por usuario y 300 en
  total (secretos opcionales `RUTAS_LIMITE_*`, `HORAS_PUNTA_LIMITE_*` y
  `PARKINGS_LIMITE_*`). Hay que desplegarla como
  `captura` (`npx supabase functions deploy rutas ...`).
- **En la app** (`src/services/rutas/`, con pruebas): `calcularRutas` (guarda 5 min en
  memoria, redondeando a ~11 m y 5 min), `buscarParkings` (guarda un día), textos y
  `enlaceWhatsapp`, enlaces de navegación en `navegador.ts` (`enlaceWaze`,
  `enlaceGoogleMaps`, `enlaceAppleMaps`, `enlaceNavegador`, `navegadorPara`), `horaDeSalida` (llegada − trayecto − 5 min), `proximasCitas` y
  `hayQueRecalcular`, `horasDeAtasco` y `fraseHorasPunta`. `ubicacionActual()`
  (`services/ubicacion.ts`) nunca pide permiso: solo lo usa si ya lo hay.
- **Sin radares** (quitados el 26/10/2026 a petición del usuario, para ganar eficiencia):
  ya no están `src/data/radares/`, `scripts/actualizar-radares.mjs` ni `npm run radares`.
  Si algún día se vuelven a pedir, están en el historial de git (commit `fefa9bf` y
  anteriores: datos de la DGT revisados con OpenStreetMap, licencia ODbL).
- **Hora de salida** (`services/rutas/actualizar.ts`, `iniciarTrafico()` en `_layout`):
  para las citas con lugar y coordenadas de las próximas 24 h (máx. 5; no bloques de foco
  ni tareas), con el tráfico previsto para llegar a su hora (`arriveAt`) desde donde
  estás (o desde casa si no hay permiso). Se guarda en `organizy:salidas`
  (`data/salidas.ts`: `useSalida(eventoId, dia)`, `leerSalidas`). Se recalcula al abrir la
  app, al volver a ella, al cambiar eventos o perfil y cada 10 min con la app abierta;
  cada cita pregunta al servidor solo si su cálculo tiene más de 15 min (a menos de 3 h
  de salir) o de 2 h (si falta más), si te has movido más de 1 km o si cambió la hora.
- **En segundo plano no se recalcula**: en iPhone las tareas en segundo plano
  (BGAppRefresh) las lanza iOS cuando quiere (pueden pasar horas) y en Expo Go no se
  pueden registrar; en Android WorkManager tampoco garantiza la hora. Lo fiable: el aviso
  se programa con el tráfico previsto para esa hora y se corrige cada vez que se abre la
  app. Con la app propia se podría añadir `expo-background-task` como extra.
- **Hoy**: en la tarjeta "Lo siguiente", `SalidaSiguiente` ("Sal a las 10:05 · 18 min en
  coche" y botón "Ir con Waze", o la app elegida, que la abre con el sitio del evento con
  `irACita`; si el evento ya no tiene lugar, `/mapa?evento=<id>&dia=<AAAA-MM-DD>`). Si ya
  pasó: "Vas justo: tenías que salir a las...".
- **Aviso "Sal ya"** (tipo `salida`, interruptor `salida` en Perfil > Avisos, botón de
  prueba): a la hora de salir, "Sal ya: Reunión" / "18 min en coche hasta Oficina para
  llegar a las 10:30. Toca para ir con Waze." (`ContextoAvisos.navegador`). Al tocarlo se
  abre la app y esta **abre directamente Waze** (o la elegida) con el sitio del evento
  (`irACita` en `services/rutas/abrir.ts`, desde `_layout`; iOS no deja saltar a otra app
  sin abrir antes la nuestra). Lo mismo con "Cómo llegar" de la alarma de salida. Botón
  "Avisar de retraso": abre la app y esta abre WhatsApp (`wa.me/?text=`) con "Voy con unos
  10 min de retraso, lo siento"; nunca se envía solo.
- **Pestaña Mapa** (`screens/PantallaMapa.tsx` y `screens/mapa/`): buscador "¿A dónde
  vas?" que propone Casa, los sitios habituales y los próximos eventos con lugar (7 días)
  y acepta cualquier dirección (`buscarCoordenadas`); mapa con tu posición, la ruta
  elegida y sus tramos, las alternativas (se pueden tocar) y los parkings ("P" azul);
  tarjetas de ruta (duración, "+6 min" y km); "Sal a las..." si el destino es un evento;
  botón "**Ir con Waze**" (la app de "Abrir siempre con") y "**Parkings cercanos**" (solo en
  coche o moto); leyenda Atasco, Denso (y Parking); "**Abrir siempre con**" (`Selector`:
  Waze, Google Maps y, salvo en Android, Mapas; se guarda en `organizy:navegador`,
  `data/navegador.ts`; Waze a pie o en transporte público pasa a Google Maps); frase de
  horas punta. Organizy **no guía**: abre la app elegida (`abrirEnNavegador`).
- **Parkings cercanos** (26/10/2026): se piden al tocar el botón (1 petición a TomTom por
  destino y día). Se ordenan (`ordenarParkings`, puro) por distancia al destino más 400 m
  por cada vez que lo encontraste lleno **el mismo tipo de día** (laborable, sábado o
  domingo) **a esa hora ±1 h** (la de llegada: la del evento o ahora más el trayecto).
  Con 1 vez: "A veces se llena a esta hora"; con 2 o más: "Suele estar lleno a esta hora".
  Se ven 5. Al tocar uno, `empezarAparcar` guarda en `organizy:aparcando` la lista entera
  y abre la app de navegación. Arriba del Mapa sale "Vas al parking X" con "**Está lleno,
  llévame a otro**" (`parkingLleno`: apunta la marca en `organizy:parkingsLlenos`, máx.
  300 y 4 meses, y abre el siguiente no probado), "Volver a abrir Waze" y "Ya he aparcado".
  "aparcando" caduca a las 3 h y no viaja en la copia; las marcas sí. Datos en
  `data/parkings.ts`. **No hay ocupación real**: TomTom la cobra (Parking Availability,
  solo por ventas) y casi ninguna ciudad la publica en abierto.
- **Horas punta**: una vez por semana (o al cambiar casa, trabajo o transporte), de casa
  al trabajo y vuelta saliendo de 7:00 a 20:30 cada media hora en el próximo laborable.
  Atasco = 25 % más que la hora más despejada y pico local; como mucho 3 horas, separadas
  2 h. Se guarda en `organizy:horasPunta` (`data/horasPunta.ts`). Hace falta un sitio
  llamado "Trabajo" con coordenadas.
- **Gasto** (un usuario, día normal): ~15-30 peticiones a TomTom (3 citas recalculadas
  varias veces, unas 5 búsquedas en el Mapa y 8 de media de horas punta); en el peor caso
  unas 60. Con 2.500 gratis al día llega para unas 80-150 personas al día, a 0 €. En la
  web, cada vista del mapa gasta unos 30-60 trozos de mapa de los 50.000 diarios.
  Supabase gratis: 500.000 llamadas a funciones al mes. "Parkings cercanos": 1 petición por
  destino y día; "Está lleno, llévame a otro" no gasta (usa la lista ya traída).
- **Sin guía por voz ni mapa en grande** (quitados el 26/10/2026): ya no están
  `navegacion.ts`, `motorNavegacion.ts`, `navegacionFondo.ts`, `services/voz.ts` ni
  `MapaGrande.tsx`, ni las librerías expo-speech, expo-keep-awake y expo-task-manager; el
  servidor ya no pide indicaciones (`instructionsType`). En `app.json` ya no se pide
  ubicación en segundo plano y expo-audio no reproduce en segundo plano. Para navegar con
  el móvil bloqueado, Waze o la app elegida.
- **Para la fase 7 (alarma de salida)**: usar las mismas salidas (`leerSalidas`,
  `suscribirseSalidas`) y no duplicar con el "Sal ya" (por ejemplo, apagar el aviso de esa
  cita si ya tiene alarma). Hecho así en la fase 7.

## Fase 7: alarmas (decisiones)

- **Tres niveles detrás de una misma pestaña** (`services/alarmas/nivel.ts`,
  `useNivelAlarmas()`); la pestaña guarda igual en todos (`data/alarmas.ts`,
  `organizy:alarmas`) y una línea arriba (`AvisoNivel`) dice cómo van a sonar:
  - **"nativo"** (app propia, build de EAS): alarmas de verdad con
    **`react-native-alarm-scheduler`** (AlarmKit en iPhone con iOS 26+; en Android,
    `AlarmManager.setAlarmClock` + servicio en primer plano + pantalla completa). Suenan
    bloqueado y en silencio. Solo si hay módulo **y** permiso; si no, pasan a "avisos".
    El permiso se pide al guardar la primera alarma (`permisoAlarmas(true)`); si se
    deniega, la pestaña ofrece "Dar permiso" (abre los ajustes).
  - **"avisos"** (Expo Go, iPhone con iOS < 26 o sin permiso): despertador, inteligente
    y salidas son avisos con sonido de la fase 4 (tipos `alarma` y `alarma-salida`, con
    botones "Posponer 5 min", "Parar" y, en las de salida, "Cómo llegar"). **Con el
    móvil en silencio no suenan** y el sonido es corto: la pestaña lo dice.
  - **"web"**: nada suena. En la web de un iPhone, cada alarma ofrece "Crear en el Reloj
    del iPhone" con el Atajo "Organizy alarma" (`services/alarmas/atajo.ts`: enlace
    oficial `shortcuts://run-shortcut?name=...&input=text&text=07:30|Nombre`; los pasos
    para crearlo están plegados en la pestaña y en la guía). Los días de repetición no se
    pueden pasar al Atajo. **El Atajo no está probado** desde aquí.
- **La librería no se importa directamente**: `requireOptionalNativeModule('AlarmScheduler')`
  (de `expo`) devuelve null en Expo Go, así el túnel sigue funcionando.
- **Plugin propio `plugins/alarmas.js`** (28/09/2026), no el de la librería: el de
  `react-native-alarm-scheduler` 1.0.1 **rompe `expo prebuild` de Android** (pasa
  `modResults.manifest` a `addPermission`: "Cannot read properties of undefined (reading
  'uses-permission')"), así que la app de Android no se podía construir. El nuestro hace
  lo mismo bien: permisos `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS` y `SET_ALARM`; en
  iPhone, `NSAlarmKitUsageDescription`, `NSSupportsLiveActivities` y el sonido silencioso
  de la librería (para "Solo vibrar"). Comprobado con `expo prebuild --platform android`
  y `expo config --type introspect` (el proyecto de iPhone no se puede generar desde
  Windows; lo hace EAS). Si sale una versión de la librería que lo arregle, se puede
  volver a su plugin.
- **Tipos** (`Alarma`): despertador e inteligente (hora, días —vacío = una vez, con
  `unaVezEl`; se apaga sola al pasar—, nombre, sonido "alarma" o "vibrar", encendida,
  y en la inteligente `adelantoMaxMin` 10/20/30/45). **Hora de dormir**: aviso suave (no
  alarma, en todos los niveles menos la web) 15/30/45/60 min antes de acostarse
  (`minutoDormir`); los días de Época dorada no sale (la época tiene el suyo).
  **Salida**: interruptor por evento en la sección "Alarmas de salida · se ajustan al
  tráfico" (`ajustes.salidas`, ids de evento; vale para toda la serie). Suena a la hora
  de salir de la fase 6 (`leerSalidas`), así que se mueve sola si cambia el evento o el
  tráfico; con alarma, el "Sal ya" de esa cita no se programa. Los ids de eventos
  borrados o sin lugar se limpian solos.
- **Alarma inteligente, fiable**: siempre programada a su hora normal; solo se adelanta
  si hay dato de tráfico, como mucho `adelantoMaxMin` (`adelantoMinutos`: retraso
  redondeado a 5 min; menos de 5 min no mueve nada). Destino: la primera cita con lugar
  después de la alarma o, en días de trabajo, el sitio "Trabajo" a la hora
  `empiezoTrabajo` (`destinoInteligente`). Tráfico **previsto** (TomTom `arriveAt`) desde
  casa, así que vale calcularlo la noche antes: `actualizarAdelantos()` (solo la próxima
  vez, si es en menos de 30 h; repregunta cada 2 h, o cada 15 min a menos de 3 h). Se
  guarda en `organizy:adelantos`. Se hace al abrir la app, al volver, al cambiar datos y
  cada 10 min con ella abierta (`iniciarAlarmas()` en `_layout`). **No se usa tarea en
  segundo plano ni push silencioso**: iOS los lanza cuando quiere (o nunca), Expo Go no
  los permite y el push obligaría a guardar horas y destinos en el servidor. Con la app
  propia se podría añadir `expo-background-task` como extra, sin quitar lo anterior.
- **Alarmas de verdad** (`definiciones.ts`, puro, con pruebas; `nativo.ts`): se calcula la
  lista que debe haber y se compara con lo programado (`organizy:alarmasNativas`): solo
  cambia lo distinto y **primero programa la nueva y después quita la vieja**. AlarmKit
  solo sabe "una vez, la próxima vez que llegue esa hora" o "cada semana": la inteligente
  va en una semanal por día y solo cambia la de su próxima vez (si no se abre la app en
  una semana, suena antes, nunca tarde); una de "una vez" a más de 24 h va como semanal
  de ese día y se quita cuando pasa. AlarmKit solo deja un botón además de "Parar":
  "Posponer 5 min" o "Cómo llegar"; los dos **abren la app** (hay que desbloquear), que
  pospone (otra alarma dentro de 5-6 min) o abre el Mapa (`atenderAlarmasNativas()` al
  abrir y al volver a la app). Posponer sin abrir la app necesitaría una extensión de
  Live Activity (pendiente). IDs en UUID (AlarmKit lo exige).
- **Pestaña** (`PantallaAlarmas`): título, `AvisoNivel`, tarjeta oscura de la
  inteligente (`TarjetaInteligente`, como en BRIEF.md: hora nueva en 56 px, la de siempre
  tachada, motivo "Hoy suena 15 min antes: hay atasco camino del trabajo"; sin barra de
  acento), lista (`FilaAlarma`: hora grande, días y nombre, interruptor; apagada sin fondo
  blanco), salidas y hora de dormir; "+" abre `/alarma`. Formulario corto: tipo con
  casillas de icono, hora de 5 en 5 min y días; en "Más ajustes", nombre, sonido y
  adelanto máximo. Tras "Posponer" se abre `/alarmas?pospuesta=HH:MM`.
- **Preparado para las tiendas** (28/09/2026, lo pidió el usuario): en `app.json`,
  `ios.bundleIdentifier` y `android.package` = **`com.mangelcreator.organizy`** (no se
  puede cambiar después de publicar la primera versión) e
  `ITSAppUsesNonExemptEncryption: false` (solo HTTPS: así App Store Connect no pregunta
  por el cifrado en cada subida). En `eas.json`, el perfil `preview` saca un APK en
  Android (se instala directamente) y `production` saca el paquete (.aab) de Google Play
  y la versión de App Store. La app **no puede crear alarmas en el Reloj del iPhone**:
  Apple no lo deja a ninguna app; solo el Atajo (web) o las alarmas de Organizy con
  AlarmKit.
- **Probar las alarmas de verdad** (lo hace el usuario; nunca le pidas contraseñas):
  - **iPhone**: solo con la cuenta de desarrollador de Apple (99 €/año). Cuando la tenga:
    `npx eas-cli@latest device:create` (registra su iPhone) y `npx eas-cli@latest build
    --profile preview --platform ios`; instala desde el enlace de EAS. Necesita iOS 26 o
    más. Prueba: alarma para dentro de 2 min, móvil bloqueado y en silencio.
  - **Android, sin cuenta de pago**: se puede ya con un APK de EAS (cuenta de Expo
    gratis): `npx eas-cli@latest build --profile preview --platform android`; se instala
    desde el enlace. Hay que dar "Alarmas y recordatorios" y "Pantalla completa" en
    Ajustes. El mapa en Android necesitará la clave de Google Maps (ver "Fase 6"). El
    usuario no tiene Android (26/09/2026).
- **Al subir a las tiendas, lo que piden las alarmas** (lo rellena el usuario en las
  consolas; explícaselo paso a paso cuando llegue):
  - **Google Play** (cuenta de desarrollador de Google, 25 $ una vez): `npx eas-cli@latest
    build --profile production --platform android` y subir el .aab. En Play Console >
    "Contenido de la aplicación": declarar **intención de pantalla completa**
    (`USE_FULL_SCREEN_INTENT`, la usa la alarma: categoría "reloj despertador"), el
    **servicio en primer plano** de uso especial (`FOREGROUND_SERVICE_SPECIAL_USE`, el
    que hace sonar la alarma con la app cerrada; hay que explicar para qué y a veces un
    vídeo corto). Las alarmas exactas usan
    `SCHEDULE_EXACT_ALARM` (el usuario da el permiso en Ajustes; la pestaña lo pide con
    "Dar permiso"), no `USE_EXACT_ALARM`, que Google solo acepta en apps de despertador o
    calendario puros y podría rechazar.
  - **App Store** (cuenta de Apple): `npx eas-cli@latest build --profile production
    --platform ios` y `npx eas-cli@latest submit --platform ios` (pide entrar con su
    cuenta de Apple en su terminal). AlarmKit no necesita permiso especial de Apple: basta
    la frase de `NSAlarmKitUsageDescription`. En la ficha de revisión, explicar que las
    alarmas se crean en la pestaña Alarmas.
  - Antes de publicar convendrá repasar permisos que Expo añade por defecto y la app no
    usa (`SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`, `WRITE_CONTACTS`) con
    `android.blockedPermissions`, comprobando que no los necesita ninguna fase.

## Fase 8: planes con WhatsApp y votación (decisiones)

- **WhatsApp solo se abre con el mensaje escrito** (`wa.me/?text=`, `enlaceWhatsapp` de
  `services/rutas/textos.ts`): la persona elige el chat o el grupo y lo envía ella. La app
  nunca lee ni escribe en sus chats. En la web, `prepararWhatsapp()`
  (`screens/planes/piezas.tsx`) abre la pestaña al tocar y le pone la dirección cuando el
  servidor responde (si no, el navegador la bloquea); si aun así se bloquea, navega en la
  misma pestaña. No hay conector (MCP) oficial de WhatsApp: se le explicó al usuario el
  26/09 y queda para la fase 10 (WhatsApp Business, vía oficial de Meta).
- **Pestaña Planes** (`PantallaPlanes`): "Nuevo plan"; "Votando" (con "N nuevos" en azul),
  "Cerrados" y, plegados, "Pasados" (`situacionPlan`). Trae los votos al entrar.
- **Nuevo plan** (`/plan-nuevo`, `PantallaPlanNuevo`), corto y visual: casillas "Con amigos"
  / "Con un cliente", "¿Qué?", horas (de 2 a 4, casillas grandes con día y hora en Plex
  Mono; vienen marcadas las 3 primeras sugerencias; "Otra hora" plegado), "¿Con quién?"
  (nombres a mano o "Elegir de la agenda"), "Más ajustes" (cuánto dura: 2 h con amigos y
  1 h con cliente; "Recordar a todos 3 h antes", solo en el móvil; tu nombre en la
  invitación, el del perfil), vista previa y "Enviar por WhatsApp". Desde Semana llega
  con `?dia=...&hora=...` y esa hora ya marcada.
- **Horas sugeridas** (`sugerirHoras`, puro, con pruebas): una por día, en días distintos,
  sin pisar eventos y dentro de la ventana del día; hoy solo con 2 h de margen. Con amigos,
  entre semana después de trabajar (21:00, 20:30, 20:00…) y el fin de semana comida o cena
  (14:00, 21:00…); con clientes, solo días de trabajo y en su horario (10:00, 11:00, 12:00…).
- **Semana**: los huecos de 2 h o más del día elegido (hoy, desde ahora; con la Época
  dorada, descontando sus bloques) salen como `HuecoPlan` con "Proponer plan"
  (`huecosParaPlan`, `horaParaHueco`: una hora habitual dentro del hueco o su principio).
- **Contactos** (`services/contactos.ts`, `expo-contacts`, incluido en Expo Go): al tocar
  "Elegir de la agenda" sale primero una tarjeta que explica para qué ("solo el nombre de
  quien elijas; no guardo ni envío tu agenda"); luego el permiso y el selector del sistema
  (`Contact.presentPicker`). Solo se guarda el nombre de pila. Si está bloqueado, "Abrir
  Ajustes". En la web no sale: nombres a mano. Frase del permiso en `app.json`.
- **Servidor** (`supabase/migrations/20260926000000_planes.sql`, ya aplicada):
  - Tablas `planes` (con `codigo` de 32 caracteres al azar, `creador` = usuario anónimo,
    título, tipo, organizador, `personas` = cuántos invitó —no sus nombres—, duración,
    estado, hora elegida, `aviso_token` y `borrar_el`), `horas`, `invitados` (nombre y
    `clave` normalizada, única por plan) y `votos`.
  - **RLS**: el creador ve, cambia y borra sus planes y horas y lee invitados y votos;
    nadie más toca las tablas. Límites con disparadores: 30 planes al día por persona, 4
    horas por plan, borrado como tarde a los 90 días.
  - **Borrado**: `pg_cron` cada noche borra los planes con `borrar_el` pasado (7 días
    después de la última hora propuesta, o de la elegida al cerrar).
  - **Función `votar`** (sin sesión, `verify_jwt = false`; la llave es el código):
    acciones `ver` y `votar`. **Votos duplicados**: el mismo nombre (sin tildes, mayúsculas
    ni espacios de más, `claveNombre`) cambia su voto en vez de sumar otro. Límite: 60
    votos al día por plan y 5000 en total (`VOTAR_LIMITE_*`), 50 invitados por plan. Al
    votar, manda el push al organizador por el servicio de Expo (sin clave).
  - El recuento (`supabase/functions/_shared/recuento.ts`) es el mismo para la función y la
    app (`services/planes/votos.ts` lo reexporta): "Ganan las 21:00 con 3 de 3." ("de N" =
    invitados o votantes, lo que sea mayor; con horas en varios días, "las 21:00 del sáb
    3"; empate: "Empatan…").
- **En la app** (`services/planes/`): `crearPlan` (crea en el servidor con la sesión
  anónima y lo guarda en el móvil), `actualizarPlanes` (trae los votos; `iniciarPlanes()`
  en `_layout`: al abrir, al volver a la app y al llegar un push de voto con la app
  abierta), `cerrarPlan`, `borrarPlan`, `cambiarRecordar`. Los planes se guardan en
  AsyncStorage también en el móvil (`data/planes.ts`, `organizy:planes`): son pocos y el
  historial sigue aunque el servidor los borre (`enServidor: false`).
- **Página de votación** (`/votar#código`, `PantallaVotar`, fuera de las rutas protegidas):
  "Miguel te invita a…", horas con casillas, votos y nombres de cada una, "Tu nombre" y
  "Votar"; después, "Hecho, Laura. Tu voto ya cuenta." y "Cambiar mi voto". Cerrado: "Ya
  está decidido" con la hora. Habla con la función con un `fetch` normal
  (`services/planes/votacion.ts`): sin sesión ni nada guardado en el navegador. El código
  va tras `#` (no llega a los registros de GitHub) y se lee con `useSyncExternalStore`.
- **Push "Laura ha votado. Ganan las 21:00 con 3 de 3. ¿La cerramos?"**: el token de Expo
  del móvil se guarda con cada plan al crearlo (`tokenDeAvisos`, solo con permiso de
  avisos). Funciona en Expo Go de iPhone (también la de EAS Update) y en la app propia (en
  iPhone, con la cuenta de Apple); **no en Expo Go de Android** (desde el SDK 53). Al
  tocarlo se abre el plan (destino `plan`). En la web, los votos nuevos al abrir Planes.
- **Ficha del plan** (`/plan?id=`, `PantallaPlan`): votos por hora (se elige la hora con
  botones redondos; por defecto la que gana), "Cerrar: lunes 28 sept a las 21:00" (crea el
  evento Amigos o Cliente con la duración del plan y "Con Laura y Javi" en las notas, y
  avisa al servidor para que la página enseñe la hora), "Enviar la confirmación"
  ("Cerrado: Cena de viernes, el viernes 2 de octubre a las 21:00. Nos vemos."),
  "Recordar a todos 3 h antes", "Recordar ahora por WhatsApp", "Ver en el calendario" y
  "Borrar plan" (el evento se queda).
- **Recordatorio 3 h antes** (`services/avisos/planes.ts`, en `GENERADORES`, tipo
  `plan-recordatorio`, categoría `plan`): aviso local "En 3 horas: Cena de viernes" con el
  botón "Recordar por WhatsApp", que abre la app y esta abre WhatsApp con "Recordatorio:
  Cena de viernes, hoy a las 21:00. Nos vemos." (`DatosAviso.mensaje`). Sale de la hora
  del evento del calendario (si lo mueves, se mueve). Solo en el móvil.
- Probado el 26/09 en la web a tamaño móvil: crear, abrir WhatsApp con el mensaje, votar
  desde un navegador sin bienvenida, ver "1 nuevo", cerrar (evento en el calendario y
  página en "Ya está decidido") y "Proponer plan" en Semana.

## Fase 9: voz sin abrir la app y widget (en curso, por partes)

- **Qué puede ir dónde** (explicado al usuario el 25-27/09): el micro dentro de la app va
  en la **web** (Web Speech API: Safari del iPhone y Chrome) y en la **app propia**
  (`expo-speech-recognition`); **en Expo Go no** (no trae el módulo): ahí se esconde y queda
  el micro del teclado. Siri, el widget y los accesos directos de Android solo en la app
  propia (se dejan hechos para cuando haya build de EAS; no se pueden probar antes). El
  Asistente de Google y sus App Actions dejaron de existir el 4/09/2026 (Gemini no ofrece
  nada parecido): en Android, accesos directos del icono y widget. Siri no deja decir la
  frase entera de una vez con texto libre: "Oye Siri, apunta en Organizy" → "¿Qué quieres
  apuntar?" → la frase.
- **Parte 1, micro en la captura rápida (hecha):**
  - `services/dictado/` (`index.ts` móvil, `index.web.ts` navegador, `textos.ts` puro con
    pruebas): `dictadoDisponible()`, `consultarPermisoDictado()`, `pedirPermisoDictado()`,
    `empezarDictado({ alOir, alTerminar, alFallar })` (devuelve la función para terminar) y
    `cancelarDictado()`. Español de España, una frase (`continuous: false`). El móvil usa
    `requireOptionalNativeModule('ExpoSpeechRecognition')` (null en Expo Go, como las
    alarmas).
  - `screens/captura/useDictado.ts` y `BotonMicrofono.tsx` (botón y `AvisoMicrofono`),
    dentro de `CapturaRapida`: lo que dices sale en el campo y al terminar se envía con el
    mismo `enviar` que lo escrito (misma IA, misma tarjeta de confirmación o la ficha si no
    se entiende). La primera vez explica para qué es el micro ("Vale" / "Ahora no",
    `organizy:dictadoExplicado`) antes del permiso del sistema; si se deniega, "Abrir
    Ajustes" (en la web, dónde se da en Safari).
  - **`/?voz=1`** abre la captura en Hoy y, en el móvil, empieza a escuchar sola
    (`escucharAlAbrir`); en la web solo la abre, porque el navegador exige un toque para el
    micro. Lo usarán los accesos directos, el widget y el Atajo.
  - `app.json`: plugin de `expo-speech-recognition` con los textos del permiso, y
    `expo-audio` pasa de `microphonePermission: false` a la misma frase (con `false` borraba
    el permiso del micro del iPhone y la app se cerraría al dictar).
  - Probado en la web a tamaño móvil con un reconocimiento simulado (el navegador de
    pruebas no tiene micro): explicación, "Te escucho…", texto en el campo y ficha con la
    frase como título (sin la clave de Anthropic, como en la fase 5).
- **Pendiente (27/09/2026)**: el usuario aún no ha probado el micro con su voz en el iPhone.
  Faltan la parte 2 (Siri y Atajos con App Intents: módulo propio en `modules/` con su
  plugin; "apunta en Organizy" pide la frase después, llama a la Edge Function `captura` con
  la sesión anónima y responde "Apuntado: …"; "¿qué tengo hoy/mañana?" y "¿cuándo tengo que
  salir?"), la parte 3 (Android: accesos directos del icono "Apuntar por voz" y "Mi día" a
  `/?voz=1` y `/`) y la parte 4 (widget: `expo-widgets` en iPhone, otra librería en
  Android; próximo evento, "Sal a las HH:MM" y micro grande a `/?voz=1`). Todo eso solo se
  prueba con la app propia; en la web, como mucho un Atajo que abra `/?voz=1`.

## Fase 10: recordatorios a clientes por WhatsApp (decisiones)

- **Parte A (hecha, 27/09/2026)**: gratis, sin cuentas de Meta y sin servidor. Nada sale
  del dispositivo: la app abre WhatsApp en el chat del cliente con el mensaje escrito
  (`enlaceWhatsapp(texto, telefono)` → `wa.me/34612345678?text=`) y lo envía la persona.
- **Datos del cliente** (`Evento.cliente?: DatosCliente | null`: nombre, teléfono tal como
  se escribe y `acepta`): solo en eventos de Clientes con hora. SQLite: **migración 5**,
  columna `cliente` (JSON); en la web, dentro del evento. Si el evento deja de ser de
  Clientes (o es tarea flexible), se borran. En la ficha van plegados
  (`screens/clientes/CamposCliente.tsx`, "Cliente y recordatorio"); el teléfono se revisa
  al guardar (`telefonoWhatsapp`: 9 cifras españolas → prefijo 34; otros, con + o 00).
- **Sin la casilla "Acepta recordatorios por WhatsApp" no se manda nada**: ni aviso ni
  botón (`puedeRecordar`). Para retirar el consentimiento se desmarca.
- **Aviso del día antes** (`services/avisos/clientes.ts`, en `GENERADORES`, tipo
  `recordatorio-cliente`, categoría `cliente`): a la hora de Perfil (10:00 por defecto),
  "Recuérdale la cita a Laura" con el botón "Enviar por WhatsApp" (reutiliza
  `ACCION_WHATSAPP`; `DatosAviso.telefono` decide que va al chat del cliente). El botón
  abre la app, que abre WhatsApp y apunta el envío; tocar el aviso abre la ficha. Uno por
  cada repetición. Si la cita se crea después de esa hora del día antes, no hay aviso:
  queda el botón de la ficha. Solo en el móvil (en la web no hay avisos).
- **Estado de cada envío** (`data/recordatorios.ts`, `organizy:recordatoriosEnviados`, por
  `"<evento>:<día>"`; se olvidan a los 60 días): `enviado` (al abrir WhatsApp; la app no
  puede saber si luego se pulsó enviar, por eso existe "No llegué a enviarlo"), `fallido`
  (no se pudo abrir WhatsApp) o `pendiente` (sin apunte). **Nunca dos veces**: enviado =
  no vuelve el aviso; reenviar solo a mano ("Volver a enviarlo").
- **Ficha** (`screens/clientes/RecordatorioCliente.tsx`, en citas de cliente ya guardadas):
  "Recordatorio enviado ayer a las 11:02" (o el fallo, o "Te aviso hoy a las 10:00 para
  mandárselo"), el mensaje y el botón verde "Enviar recordatorio por WhatsApp". Usa la
  fecha y hora guardadas; si los datos del cliente cambiaron en la ficha, los guarda al
  enviar.
- **Perfil > Recordatorios a clientes** (`SeccionRecordatorios`,
  `organizy:recordatoriosClientes`): interruptor general (apagado = sin aviso; el botón de
  la ficha sigue), hora del aviso, botón "Probar el recordatorio a un cliente" (llega en 5
  s con la próxima cita que lo acepte) y, plegado, "Lo básico de la protección de datos".
- **Mensaje** (`textoRecordatorioCliente`), el mismo que la plantilla de la parte B: "Hola
  Laura, te recuerdo nuestra cita mañana lunes 28 de septiembre a las 10:00 en <dirección>.
  Si no puedes venir, respóndeme a este mensaje." Lleva la **dirección** (el cliente no
  sabe qué es "Oficina" en tu perfil); "hoy", "mañana …" o "el …" según cuándo se mande.
- **Parte B (pendiente, cuando el usuario tenga las cuentas de Meta; solo para el dueño)**:
  plantilla de categoría "Utilidad" en español (`es_ES`) con 4 variables en el orden del
  mensaje de arriba ({{1}} nombre, {{2}} "mañana lunes 28 de septiembre", {{3}} hora, {{4}}
  sitio). Plan: tabla `recordatorios_clientes` en Supabase (solo pendientes de clientes que
  aceptan; se borran al enviar o al pasar la cita) que la app rellena al guardar citas; Edge
  Function `recordatorios` con `pg_cron` cada hora que envía con la Cloud API
  (`/<phone-number-id>/messages`, `type: template`) y guarda `enviado`/`fallido`; la app
  lo trae y lo enseña con `via: 'automatico'`. Solo para la cuenta del dueño (su usuario
  anónimo, o una clave suya en los secretos). Secretos: `WHATSAPP_TOKEN` (token permanente
  de usuario del sistema), `WHATSAPP_PHONE_ID`; nunca en la app ni en git. Precio en España
  ~0,017 € por plantilla de utilidad entregada (tarifa del 1/07/2026; gratis si el cliente
  escribió en las 24 h anteriores). El número de prueba de Meta envía gratis a 5 teléfonos.

## Copia de seguridad (27/09/2026)

- Primera mejora tras el análisis de la competencia (el usuario la eligió): sin ella, perder
  el móvil es perderlo todo, y no hay forma de pasar los datos de la web a la app ni de un
  móvil a otro. **Sin servidor**: un archivo JSON que guarda la persona.
- Perfil > "Copia de seguridad" (`screens/perfil/SeccionCopia.tsx`): "Guardar una copia",
  "Recuperar una copia" (tarjeta con el resumen y "Sí, recuperar") y, plegado, dónde
  guardarla. Dice cuándo se hizo la última en ese dispositivo (`organizy:ultimaCopia`) y,
  pasado un mes, lo pone en granate.
- **Qué lleva** (`services/copia/formato.ts`, puro, con pruebas): eventos, épocas y su
  registro (sin los de ejemplo) y **todas las claves `organizy:` salvo las de `NO_VIAJAN`**
  (lo calculado: salidas, horas punta, adelantos; y lo de ese dispositivo: alarmas nativas
  ya programadas, última copia, explicaciones vistas). Si añades una clave nueva que sea del
  dispositivo o se calcule sola, **añádela a `NO_VIAJAN`**; si no, viaja sola. La sesión
  anónima de Supabase no viaja: los votos de los planes abiertos solo se ven donde se
  crearon (se avisa al recuperar). `formato` sube si cambia la forma del archivo;
  `leerCopia` rechaza las de un formato más nuevo.
- **Recuperar cambia todo** lo del dispositivo por lo de la copia (no mezcla): eventos y
  épocas con `reemplazarTodos`/`reemplazarTodo` de los repositorios (en SQLite, en una
  transacción: si falla, no se toca nada), después AsyncStorage, y se reinicia la app
  (`reloadAppAsync` de `expo`; en la web, recargar) porque cada parte tiene sus datos en
  memoria. Los avisos y alarmas se reprograman solos al arrancar.
- **Archivo** (`services/copia/archivo.ts` y `.web.ts`): en el móvil, `expo-file-system`
  (lo escribe en la caché) + `expo-sharing` (menú de compartir: "Guardar en Archivos",
  correo...) y `expo-document-picker` para elegirlo; las tres vienen en Expo Go. En la web,
  en pantallas táctiles el menú de compartir del navegador (Web Share con archivos) y si no,
  descarga; para elegirlo, `expo-document-picker` con `base64: false`.
- Probado el 27/09 en la web a tamaño móvil: guardar, recuperar una copia modificada (se
  reinicia con el nombre y el evento de la copia) y rechazar un archivo que no es copia.
  **Falta probarla en el iPhone** (Expo Go): el menú de compartir y el selector de Archivos.

## Fase 11: correo, plazos y resúmenes (27/09/2026)

- **Ayudante de Gmail** (`gmail/organizy-correo.js`, JavaScript de Google Apps Script): lo
  pega el usuario en script.google.com (guía "Fase 11 - Correo.md"), ejecuta `instalar`
  (revisión cada 10 min con un disparador y recoge el último día sin avisar) y lo implementa
  como **Aplicación web** ("Ejecutar como: yo", acceso "Cualquier usuario"). La URL `/exec`
  se pega en Organizy (Hoy > Resúmenes) y **es la llave**: quien la tenga lee los
  resúmenes. Busca `in:inbox category:primary -from:me after:<última revisión − 20 min>`,
  como mucho 25 hilos por vuelta; guarda en las propiedades del script los ids vistos
  (150), 7 días de resúmenes (máx. 200, límite de 500 KB) y los tokens de avisos (5).
  Funciones para el usuario: `instalar`, `probarAviso`, `olvidarMoviles`, `desinstalar`.
  **Si cambias el script**, el usuario tiene que pegarlo otra vez y hacer "Gestionar
  implementaciones > editar > Nueva versión" (así la URL no cambia): díselo.
- **Reglas sin IA** (`supabase/functions/_shared/reglasCorreo.js`, módulo ES sin nada de
  Google ni de Deno, con pruebas en `_shared/__tests__`): las usan el servidor y el ayudante.
  **El ayudante que se pega en Google se genera**: `npm run ayudante-gmail`
  (`scripts/generar-ayudante-gmail.js`) junta `gmail/ayudante.js` y las reglas sin los
  "export" en `gmail/organizy-correo.js`; una prueba (`gmail/__tests__`) falla si se cambia
  algo y no se genera. Nunca edites `organizy-correo.js` a mano. Fecha límite = una
  fecha (05/10, 5 de octubre, 5 oct; "mañana", "el viernes" o "a final de mes" solo con
  palabra fuerte) a menos de 60 letras después de una palabra de plazo (fecha límite,
  plazo, vence, antes del, entregar...) o 25 antes, en la misma frase, de hoy a un año.
  "Hasta el" solo vale con fecha escrita ("hasta el lunes" es una despedida). Resumen = las
  primeras frases sin saludo, despedida, citas, firmas ni enlaces (240 letras); en un
  reenvío, lo reenviado. Título = asunto sin "RE:", "RV:", "[EXTERNO]".
- **Avisos** del ayudante por el servicio de Expo (`exp.host`, sin clave), a los tokens que
  manda la app al pedir los correos; data `{ tipo: 'correo', destino: { pantalla:
  'resumenes' } }`. Plazo: "Vence el lun 5 oct: …" / "Te lo he apuntado en las tareas.";
  normal: título y "Remitente · resumen"; más de 3 normales en una vuelta, un solo aviso
  "N correos nuevos". En la web no hay avisos.
- **IA** (`supabase/functions/correo`, desplegada; Claude Haiku 4.5, salida con esquema:
  título, resumen, `fechaLimite`, `tarea` con verbo): la app manda al ayudante la URL y la
  clave **pública** de Supabase; el ayudante se da de alta como usuario anónimo
  (`/auth/v1/signup`, sesión en sus propiedades) y llama a la función. Sin
  `ANTHROPIC_API_KEY` contesta 503 `sin-clave` sin gastar nada y el ayudante no vuelve a
  probar en 6 h (otros fallos, 30 min): se enciende sola al poner la clave. Límites
  `CORREO_LIMITE_USUARIO` (150) y `CORREO_LIMITE_GLOBAL` (3000). No guarda el correo.
- **En la app**: `data/correos.ts` (`organizy:correo` = enlace y estado;
  `organizy:correos` = resúmenes, 30 días; las dos en `NO_VIAJAN` de la copia) y
  `services/correo/` (`conectarCorreo`, `actualizarCorreos` —al abrir, al volver y al
  llegar un push "correo"; `iniciarCorreo()` en `_layout`—, `quitarPlazo`,
  `marcarCorreosVistos`). La petición es un POST `text/plain` (sin pregunta previa de
  CORS; Google redirige y `fetch` lo sigue). Cada plazo nuevo de hoy en adelante se apunta
  una vez como **tarea flexible de 30 min, tipo Yo, el día que vence** (con el correo y el
  enlace en las notas); si se borra, no se vuelve a crear. "No es un plazo" borra la tarea
  si no está hecha.
- **Pantallas**: casilla "Resúmenes" en Hoy (la séptima, a lo ancho; número = correos sin
  ver) y `/resumenes` (`PantallaResumenes`): sin conectar, cómo hacerlo y el campo del
  enlace; conectado, "Con fecha límite" (barra de "Yo") y el resto por días (Hoy, Ayer, lun
  5 oct), con "Nuevo" hasta salir de la pantalla; al tocar uno, "Abrir en Gmail", "Ver la
  tarea" y "No es un plazo"; "Más ajustes": otras cuentas y desconectar.
- **QR del ayudante** (28/09): al abrir su URL `/exec` en el navegador (`doGet`), el ayudante
  enseña un QR (qrcodejs de cdnjs) a `https://mangel-creator.github.io/organizy/resumenes#ayudante=<url>`;
  Resúmenes lo lee (también `?ayudante=`), se conecta solo y limpia la dirección. Abre la
  web: Expo Go no garantiza abrirse desde un enlace con una publicación de EAS Update
  (`Linking.createURL` no es estable ahí), así que en Expo Go se pega el enlace.
- **"Vincular con Gmail / Outlook"** (28/09, función `correo-cuentas`, desplegada; tablas en
  `supabase/migrations/20260927000000_correo_cuentas.sql`, ya aplicada):
  - **Tablas** `correo_cuentas` (usuario anónimo, proveedor, email, `llave` = refresh token
    cifrado con AES-GCM y el secreto `CORREO_CLAVE_CIFRADO`, tokens de avisos (5), estado
    `ok`/`caducada`, última revisión e ids vistos), `correo_estados` (un "state" por intento
    de vincular, 15 min) y `correo_resumenes` (7 días). RLS sin políticas: solo la función.
    Máximo 5 cuentas por persona. `pg_cron` limpia cada noche.
  - **Vincular**: la app manda `empezar` (proveedor, vuelta y token de avisos) → URL de Google
    (`gmail.readonly`, `access_type=offline`, `prompt=consent`) o Microsoft (`Mail.Read`,
    `offline_access`, `User.Read`, endpoint `common`). La vuelta (GET con `code` y `state`)
    canjea el código, cifra y guarda la llave, recoge el último día sin avisar y redirige a
    la vuelta con `?correo=ok&cuenta=…` (o `cancelado`/`error`). Vueltas permitidas
    (`vueltaValida`): `organizy://…`, `https://mangel-creator.github.io/organizy/…` y
    `http://localhost:*`. En el móvil (también Expo Go) se abre con
    `WebBrowser.openAuthSessionAsync(url, 'organizy://correo-vinculado')`: la ventana del
    sistema se cierra sola al ver ese esquema. En la web, la página se va a Google y vuelve a
    `/resumenes`.
  - **Revisión cada 5 min**: `pg_cron` → `lanzar_revision_correo()` → `pg_net` POST
    `{accion:'revisar'}` con la cabecera `x-organizy-cron` (contraseña en la bóveda,
    `vault` "correo_cron", y en el secreto `CORREO_CRON_SECRETO`; no está en git). Por cuenta:
    renueva la llave (Microsoft da otra y se guarda), lista la bandeja (Gmail
    `category:primary`; Outlook solo "Prioritarios", `inferenceClassification`), analiza con
    las reglas o Claude y avisa por Expo como el ayudante. `invalid_grant` o 401 → cuenta
    `caducada` y aviso "Vuelve a entrar en Gmail". Ids de Outlook acortados (`o:` + SHA-256).
  - **Secretos** (los pone el usuario; guía, parte A): `GOOGLE_CLIENT_ID`/`_SECRET` y
    `MICROSOFT_CLIENT_ID`/`_SECRET`. Sin ellos, `estado` devuelve `proveedores` en false y
    los botones dicen "Aún no está activado". Redirección registrada en los dos:
    `https://hwemrpexabisyueyizjz.supabase.co/functions/v1/correo-cuentas`.
  - **En la app**: `services/correo/servidor.ts` (`estadoEnServidor`, `empezarEnServidor`,
    `quitarEnServidor`), `vincularCuenta`, `quitarCuenta` y `actualizarCorreos({ servidor })`,
    que junta las dos vías (solo pregunta al servidor si hay cuentas, o al entrar en
    Resúmenes). `organizy:cuentasCorreo` (en `NO_VIAJAN`: la sesión es de cada dispositivo).
    Cada correo del servidor lleva `origen` y `cuenta`: "Abrir en Outlook" y, al quitar la
    cuenta, se van sus resúmenes (las tareas se quedan).
  - **Pantalla**: sin nada vinculado, "Vincula tu correo" con los botones oficiales
    "Continuar con Google" (Gmail) e "Iniciar sesión con Microsoft" (Outlook), las filas
    "iCloud o Mail del iPhone" y "Otro correo" (estas dos explican el reenvío), la frase de qué se
    guarda y qué se envía a la IA, y plegado "Sin guardar nada en el servidor" (ayudante:
    QR o enlace). Con algo vinculado, "Tus cuentas" (revisado hace…, "Volver a entrar" en
    granate si caducó, "Quitar" con confirmación) y "Vincular otra cuenta" plegado.
  - Probado el 28/09: las funciones contra Supabase (vuelta sin datos, revisión sin y con la
    contraseña de la bóveda, `estado` y `empezar` sin configurar) y la pantalla en la web a
    tamaño móvil con el servidor real y con respuestas simuladas (cuentas, caducada, plazo
    como tarea, "Abrir en Outlook", quitar). **Falta**: el paso A del usuario y probarlo con
    su Gmail y su Outlook de verdad.
- **Aviso de la víspera** (`services/avisos/correos.ts`, tipo `plazo-correo`, interruptor
  `plazosCorreo` en Perfil > Avisos): "Mañana vence: …" a la hora de levantarse, si la
  tarea sigue sin hacer.
- Probado el 27/09 en la web a tamaño móvil con un ayudante simulado: enlace erróneo, conectar,
  tarea creada, "Nuevo", "No es un plazo" y la casilla. La función `correo`, el alta anónima
  y su renovación, probadas contra Supabase. **Falta**: que el usuario instale el ayudante y
  lo pruebe con su Gmail y los avisos en el iPhone.

## Otros calendarios (27/09/2026)

- Segunda mejora tras el análisis de la competencia: la gente ya tiene su vida en Google
  Calendar o iCloud y no la va a copiar a mano. El usuario quiere **mover todo a
  Organizy** (ver "Decisiones del usuario", 27/09).
- **Perfil > "Tus otros calendarios"** (`screens/perfil/SeccionCalendarios.tsx`): pegar el
  enlace iCal (`https://` o `webcal://`), elegir qué son sus eventos (Míos, Amigos o
  Clientes: su tipo en Organizy) y "Traer eventos". Cada calendario sale con cuántos eventos
  trajo, cuándo y los de todo el día sin traer; "Traer ahora" y "Quitar" (quedarse los
  eventos o borrarlos; los cambiados aquí se quedan siempre). Plegado, dónde está el enlace
  en Google Calendar ("Dirección secreta en formato iCal") y en iCloud ("Calendario
  público" > "Compartir enlace"). Enlaces en `organizy:calendarios` (`data/calendarios.ts`);
  **no viajan en la copia de seguridad** (son una llave), los eventos traídos sí.
- **Lo traído son eventos normales** (cuentan para huecos, carga, planes, época y avisos)
  con `Evento.origen` = { fuente, uid, huella } (SQLite: migración 6, columna `origen`).
  Id `cal-<resumen de fuente y uid>`. La ficha lo dice (`screens/calendario/OrigenEvento.tsx`)
  y **conserva `origen` al guardar** (si no, se duplicaría).
- **Se mantiene al día solo** (`iniciarCalendarios()` en `_layout`): al abrir la app y al
  volver a ella, si hace más de 1 h. `sincronizar` (puro, con pruebas): lo nuevo se crea, lo
  cambiado fuera se cambia y lo borrado fuera se borra, **salvo lo que hayas cambiado en
  Organizy** (`cambiadoAqui`: su huella ya no coincide), que ya no se toca. Lo anterior a
  la ventana no se borra. Se guarda de golpe (`cambiarEventos`, `cambiarVarios` de los
  repositorios).
- **Lectura** (`services/calendarios/ics.ts`, librería `ical.js`, pura, con pruebas): ventana
  desde hace 3 meses hasta dentro de 2 años. Zonas horarias del propio archivo (VTIMEZONE)
  pasadas a la del dispositivo. Series sencillas (cada día, cada semana el mismo día, cada
  mes el mismo número; sin fin, sin días quitados ni cambiados) → serie de Organizy; las
  demás, una cita suelta por vez (máx. 400 por serie). Lo que cruza la medianoche se corta a
  las 23:59. **Los de todo el día no se traen** (Organizy no los tiene): se cuentan y se dice.
  Cancelados, fuera.
- **Descarga**: en el móvil, `fetch` directo (`descargar.ts`). En la web, función
  `calendario` de Supabase (`descargar.web.ts`; ya desplegada): solo Google Calendar,
  `*.icloud.com` y Outlook, redirecciones comprobadas, 5 MB, 15 s, 60 al día por persona y
  3000 en total (`CALENDARIO_LIMITE_*`), sin guardar ni apuntar el enlace ni el contenido.
- Probado el 27/09 en la web a tamaño móvil: el calendario público de festivos de Google a
  través de la función (386 de todo el día, ninguno traído, como debe), y con un calendario
  simulado: traer 3, "Está al día", "1 cambiado y 1 borrado", ficha con su origen, Semana,
  "Quitar" borrando y enlaces erróneos. **Falta** que el usuario pegue sus enlaces de verdad.
- **Pendiente**: eventos de todo el día (cumpleaños, festivos, vacaciones) cuando Organizy
  los tenga; lectura directa con `expo-calendar` en la app propia (ver la decisión del 27/09).

## Matriz de Eisenhower en las tareas (27/09/2026)

- Lo pidió el usuario: clasificar cada tarea con la matriz de Eisenhower. Solo las **tareas
  flexibles**; los eventos con hora no llevan cuadrante.
- `Evento.cuadrante?: Cuadrante | null` (`hazlo` importante y con prisa, `planifica`
  importante sin prisa, `delega` con prisa y poco importante, `elimina` ni lo uno ni lo
  otro; null = sin clasificar). SQLite: **migración 7**, columna `cuadrante`; en la web,
  dentro del evento. Lo desconocido se lee como null (`normalizarCuadrante`, también en la
  copia de seguridad). Si deja de ser tarea, se borra. Para cambiarlo fuera de la ficha,
  `clasificarTarea(id, cuadrante)`.
- `services/agenda/prioridad.ts` (puro, con pruebas): `DATOS_CUADRANTE` (nombre, descripción,
  consejo), `cuadranteDe(importante, urgente)`, `ordenarPorPrioridad` (hazlo, planifica, sin
  clasificar, delega, elimina; estable) y `agruparPorCuadrante`.
- **Hoy > Tareas**: las pendientes van ordenadas por prioridad antes de `repartirTareas`, así
  que lo importante coge antes los huecos y con energía "Tranqui" se quedan hoy las 2 más
  importantes. Selector "Ver": **Por horas** (la lista de siempre; cada fila dice su
  cuadrante, "Hazlo ya" en granate) o **Matriz** (`screens/tareas/MatrizTareas.tsx`: arriba
  las sin clasificar y debajo las cuatro cajas de dos en dos; al tocar una tarea sale el
  selector para colocarla sin abrir la ficha, y "Abrir la tarea"). Se recuerda en
  `organizy:vistaTareas`.
- **Ficha de tarea**: "¿Qué prioridad tiene?" con las cuatro casillas colocadas como la matriz
  (`SelectorCuadrante`: arriba lo importante, a la izquierda lo que corre prisa); tocar otra
  vez la elegida la quita. Debajo, qué significa y un consejo.
- Colores: "Hazlo ya" en granate (`aviso`); los demás cuadrantes en tinta y gris. Nada de
  naranja ni verde.
- **Pendiente (idea)**: que la captura con IA proponga el cuadrante al apuntar y que los plazos
  del correo entren como "Hazlo ya"; cuando el usuario ponga la clave de Anthropic.

## Límites de IA (29/09/2026)

- Lo pidió el usuario: límites como los de Claude y poder pagar más si se agotan. Dos
  límites por persona (usuario anónimo de Supabase), contados **en millonésimas de dólar**
  según el modelo y los tokens de cada llamada (`costeLlamada`): una **ventana de 5 horas**
  que empieza con el primer uso y se libera entera al acabar, y una **semana** igual (7 días
  desde el primer uso). Por defecto 0,15 $ cada 5 h y 0,50 $ a la semana (el uso "alto" de la
  hoja IA del Excel); secretos `IA_VENTANA_HORAS`, `IA_LIMITE_VENTANA` e `IA_LIMITE_SEMANA`.
  Siguen además los máximos por día de cada función (`sumarUso`), que protegen el gasto total.
- **Servidor**: `supabase/migrations/20260929000000_limites_ia.sql` (ya aplicada): tablas
  `ia_consumo` (lo gastado; `pg_cron` borra lo de más de 8 días), `ia_cuentas` (inicio de la
  ventana y de la semana y saldo `extra`) e `ia_recargas` (referencia de pago única, para no
  sumar dos veces), y funciones SQL `ia_estado`, `ia_permitir`, `ia_apuntar` (lo que pasa de un
  límite se descuenta del extra) e `ia_recargar`. En las funciones:
  `_shared/limiteIA.ts` (`permitirIA` antes de llamar a Claude, `apuntarIA(usuario, funcion,
  modelo, respuesta.usage)` justo después, también si la respuesta no vale). **Toda llamada
  nueva a Claude tiene que pasar por las dos.** Sin permiso: 429 `{ error: 'limite-ia', motivo:
  'ventana'|'semana', libre, horas }`. Función `ia` (acción `estado`, solo lee) para la app.
- **Correo**: cuenta para el límite; sin permiso, `correo-cuentas` usa las reglas y la función
  `correo` contesta 429 (el ayudante de Gmail usa sus reglas 30 min). Ojo: el ayudante de Gmail
  tiene su propio usuario anónimo, así que su gasto no se suma al de la app.
- **App**: `services/ia/` (`limites.ts` puro con pruebas: porcentajes, "Se libera a las 18:40",
  mensajes; `consultarEstadoIA`, `limiteDelError`). La captura y la Época dorada, al recibir el
  429, dicen "Has gastado la IA de estas 5 horas. Vuelve a tenerla a las 18:40." y dejan
  rellenarlo a mano. Perfil > "Tu IA" (`screens/perfil/SeccionIA.tsx`): dos barras ("Estas 5
  horas" y "Esta semana", granate desde el 80 %), cuándo se libera cada una, el saldo extra y
  "Conseguir más IA" (hoy explica que aún no se puede comprar).
- **Comprar más (pendiente, apagado)**: cuando haya cobro, el aviso del pago (RevenueCat para
  Apple/Google o Stripe en la web) llamará a `ia_recargar(usuario, cantidad, origen,
  referencia)` desde una función nueva, y el secreto `IA_COMPRA_ACTIVA=si` hará que `estado`
  devuelva `compra: true` (la tarjeta de "Conseguir más IA" tendrá entonces los paquetes).
  Propuesta de paquetes en el Word "RESUMEN IA" del usuario. Para regalar saldo a mano:
  `select public.ia_recargar('<usuario>', 500000, 'regalo', '<referencia única>')`.
- **Correo aparte** (decisión del 29/09, pendiente de programar): el correo dejará de contar
  para el límite general y tendrá su propio cupo diario, con la persona eligiendo qué correos
  resume la IA (ver "Decisiones del usuario", 29/09).
- **Planes de pago** (pendiente): cada plan tendrá sus números; hoy son los mismos para todos.
  Propuesta por plan en el Word "PLAN DE PRECIOS TEMPORAL" del usuario (sin decidir).
  Con usuarios anónimos, borrar los datos del navegador da un usuario nuevo con los límites a
  cero: para límites por persona de verdad hará falta iniciar sesión (lo mismo que para cobrar).

## Fase 15: plan empresa, Organizy grupal (29/09/2026)

- **Es un plan extra** (decisión del 29/09): Perfil > "Tu plan" (`screens/perfil/SeccionPlan.tsx`)
  > "Cambiar de plan" (`/cambiar-plan`, `PantallaCambiarPlan`: tarjetas Plan personal / Plan
  empresa y "Cambiando de plan…"). Dónde se ve: `planEmpresaVisible` (`services/empresa/plan.ts`):
  Expo Go, desarrollo o si ya tiene el plan (llegó con un enlace de invitación). **Con el plan
  personal no cambia nada**: ni pantallas, ni sesión, ni llamadas al servidor
  (`iniciarEmpresa()` solo lee `organizy:empresaModo`), y la agenda es el mismo array de eventos.
  Volver al personal estando en una empresa = salir de ella (se pregunta antes).
- **Privacidad** (no negociable): la empresa solo ve lo de trabajo. Frase en pantalla: "Tu
  empresa solo ve lo de trabajo. Lo personal no sale de tu móvil." El "Ocupado" compartido va
  apagado por defecto y lo decide el empleado (Empresa > "Tus ajustes en la empresa"): se suben
  solo día y minutos de SUS eventos con hora de los próximos 28 días (`bloquesOcupados`), sin
  título, lugar ni tipo; al apagarlo se borra del servidor.
- **Quinta excepción a "los datos solo en el dispositivo"**: en Supabase va SOLO lo de la
  empresa (tablas en `supabase/migrations/20260929010000_empresa.sql`, ya aplicada): empresas,
  empresa_miembros (nombre y correo del trabajo), equipos y equipo_miembros, invitaciones_correo
  e invitaciones_enlace, eventos_empresa y respuestas_evento, turnos y cambios_turno,
  tareas_empresa, ocupado_compartido (si lo activa) y empresa_avisos (direcciones de avisos, solo
  las ve su dueño). Salir = `empresa_salir` borra la cuenta de empresa de esa persona y todo lo
  suyo; borrar la empresa, todo. Cada noche `emp_limpiar` (pg_cron) quita lo viejo (turnos y
  eventos de hace más de 400 días, tareas hechas hace 180, pendientes de 60 días) y las cuentas de
  Google/Microsoft sin empresa y sin entrar en 30 días (las anónimas no se tocan).
- **Reglas (RLS)**: cada uno solo lee su empresa y solo cuando le han aceptado; los pendientes
  solo ven su fila y el nombre de la empresa. Escribe el administrador o el responsable del equipo
  (turnos y tareas solo a gente de su equipo). Lo delicado va por funciones `empresa_*` (security
  definer): crear, unirme, aprobar, cambiar_rol (siempre queda un admin), quitar, salir, borrar,
  ajustes (el dominio tiene que ser el del correo del admin y no gratuito), mis_datos,
  marcar_tarea y resolver_cambio. **Pruebas**: `supabase/tests/empresa_rls.sql` (jefe, responsable,
  empleado, pendiente, sin invitación, otra empresa y la sesión anónima); se ejecuta con
  `npx supabase db query --linked --project-ref hwemrpexabisyueyizjz --file supabase/tests/empresa_rls.sql`
  y acaba en "todo bien"; se deshace sola (rollback). Si cambias el SQL, vuelve a pasarla.
- **Papeles**: administrador (quien crea; puede nombrar a otros), responsable (lleva uno o varios
  equipos: `equipo_miembros.responsable`) y empleado. Una persona, una empresa.
- **Entrar**: Supabase Auth con Google y Azure (Microsoft), en **una sesión aparte**
  (`data/supabaseEmpresa.ts`, guardada en `sb-organizy-empresa`), NO con `linkIdentity`: la
  anónima (planes, correo, IA) sigue igual en todos los dispositivos (vincularla solo valdría para
  el primero). Móvil: `openAuthSessionAsync` a `organizy://empresa-entrada` y canje del código
  (PKCE); web: vuelve a `/empresa?code=`. Qué proveedores están activos lo dice
  `/auth/v1/settings` (sin sesión). **Parte del dueño** (guía, parte A): cliente de Google aparte
  solo con `openid email profile` publicado "En producción" (no necesita la verificación de pago),
  app de Microsoft Entra aparte (multiempresa y cuentas personales, solo User.Read, reclamos
  opcionales `email` y `xms_edov`), activar los dos en Supabase y añadir en URL Configuration
  `organizy://**`, `https://mangel-creator.github.io/organizy/**` y `http://localhost:8081/**`.
- **Dar de alta sin lío** (lo pidió el usuario): dominio propio ("Que entre cualquiera con un
  correo @suempresa.com": salen en "Esperan que les aceptes" y se aceptan con un toque; o
  "Aprobar solo"), lista de correos (entran directamente) o enlace de invitación con QR
  (`/empresa#invitacion=<32 letras>`, caduca en 1, 7 o 30 días, se anula; quien entra queda
  pendiente). El QR se dibuja sin librerías (`services/empresa/qr.ts`, comprobado contra "toqr").
  Empresas con Microsoft restringido: ayuda plegada con los pasos y "Mandar el texto al
  informático" (aprueba Organizy una vez en Entra). `/empresa` está fuera de las rutas protegidas:
  el enlace funciona aunque no se haya hecho la bienvenida.
- **Pantallas**: `/empresa` y la pestaña Empresa (`/trabajo`) (entrar, crear o unirse, esperando, y dentro casillas Calendario,
  Turnos, Tareas, Equipo y, si gestionas, Disponibilidad; "Tus ajustes": Ocupado, salir, borrar),
  `/empresa-equipo`, `/empresa-evento` (Voy / No voy y respuestas; quien gestiona, formulario;
  festivos y cierres de todo el día), `/empresa-turnos` (semana, repartir, "Copiar la semana
  anterior", cambios por mirar), `/empresa-turno` (varios días de una vez; el del turno "Pedir un
  cambio": otro día u horas u otra persona), `/empresa-tarea` (a una persona o a un equipo, fecha
  límite, matriz de Eisenhower) y `/empresa-disponibilidad` (rejilla T/O/libre y "Buscar hueco":
  horas en las que nadie está ocupado o "cuando están todos de turno", sin festivos ni cierres).
- **En el calendario de cada uno** (`data/agenda.ts`: `useAgenda()` / `leerAgenda()`; úsalos en
  vez de `useEventos()` para calcular el día): sus turnos (sin sitio, en su sitio "Trabajo"; los que
  cruzan la medianoche, en dos trozos), los eventos de empresa a los que no ha dicho "No voy" y sus
  tareas asignadas (salen hoy hasta hacerlas) son eventos con `Evento.empresa` e id `emp-…`
  (`services/empresa/calendario.ts`). No se guardan ni se editan desde el calendario: `abrirEvento`
  abre su ficha. Cuentan en Hoy (casilla "Empresa"), Semana (leyenda "Empresa" y festivos arriba),
  la carga, los avisos, la hora de salida y la alarma inteligente (un turno es ir al trabajo). Las
  tareas de la empresa no van al cierre del día ni a "Pasar a mañana". A `combinar` se le pasa
  todo lo que usa (no lo lee de fuera): si no, el compilador de React se queda con lo viejo.
- **Avisos push** desde el servidor (triggers + pg_net al servicio de Expo, como el correo): turno
  nuevo, cambiado o quitado (uno por persona aunque sean varios), tarea asignada, evento de
  empresa nuevo o cambiado, cambio de turno pedido/aprobado/rechazado y altas pendientes. Se
  apagan en Perfil > Avisos > "De la empresa" (se guardan en `empresa_avisos`). Al tocarlos,
  destino `{ pantalla: 'empresa', seccion }`. En la web no hay avisos.
- **Sin conexión**: copia en SQLite (migración 9, `empresa_copia`) o en la web en
  `organizy:empresaCopia`; `empresaModo`, `empresaCopia`, `empresaInvitacion` y `empresaOcupado`
  están en `NO_VIAJAN` de la copia de seguridad.
- **Probar sin cuentas**: en desarrollo y en la web, `http://localhost:8081/?prueba-empresa=1`
  enciende un servidor de prueba en el navegador (`services/empresa/prueba.ts`) con Pepe, Laura y
  Javi ("Entrar como…"); `=0` lo apaga. Probado así el 29/09 a tamaño móvil: crear, dominio,
  enlace con QR, lista, aceptar, equipos y responsable, evento con Voy, turnos de varios días,
  copiar semana, tarea marcada desde Hoy, pedir y aprobar cambio, Ocupado, disponibilidad,
  "Buscar hueco" y volver al plan personal. Ojo: en un worktree con `node_modules` enlazado, la web
  enseña las rutas de la carpeta principal hasta arrancar con `--clear`.
- **Chat y avisos** (29/09, a petición del usuario, "como Teams"; `supabase/migrations/20260929020000_empresa_chat.sql`,
  ya aplicada; pruebas en `supabase/tests/empresa_chat_rls.sql`, acaban en "todo bien"):
  - **Canales**: `chat_canales` "general" (se crea solo con la empresa), "equipo" (solo con cada
    equipo) y "privado" (`chat_privado(persona)`, uno por pareja). Ven General todos; el de un
    equipo, sus miembros, su responsable y el administrador; un privado, **solo esas dos personas**
    (`emp_ve_canal`). `chat_mensajes` (texto hasta 2000; autor y hora los pone el servidor; 30 por
    minuto como mucho; "Mensaje borrado" con `chat_borrar_mensaje`, solo lo tuyo), `chat_leidos`
    (hasta dónde has leído) y `chat_resumen()` (sin leer y último de cada canal, va en la copia).
    Al momento con **Supabase Realtime** (`chat_mensajes` en la publicación; `base().escuchar`) y
    cada 15 s por si acaso. Push a los del canal (menos a quien escribe), con el canal en el
    destino (`seccion: "chat", id`). Se borran a los 180 días (`emp_limpiar_chat`).
  - **Avisos** (`anuncios` y `anuncios_leidos`): los publica el administrador (a todos o a un
    equipo) o el responsable (a su equipo). "Importante" = barra y etiqueta granate y arriba hasta
    leerlo. Cada uno pulsa "Leído"; quien lo publica o gestiona ve "Leído por N de M" y quién falta
    (`lecturas`). Push "Aviso: …" o "Importante: …". Se borran al año.
  - **App**: casillas "Chat" y "Avisos" en `/empresa` (con los sin leer), `/empresa-chat` (canales
    y chats, "Nuevo chat"), `/empresa-canal?id=` (burbujas: lo mío a la derecha en tinta; lo de los
    demás con la barra de empresa; se juntan los seguidos de la misma persona, como en Teams) y
    `/empresa-avisos`. En Hoy, dentro de la casilla de la empresa, "N avisos sin leer" y "N mensajes
    sin leer". Interruptores "Mensajes del chat" y "Avisos de la empresa" en Perfil > Avisos
    (`empresa_avisos.chat` y `.anuncios`). Funciones puras con pruebas en `services/empresa/chat.ts`.
  - **Ojo con las reglas de "ver"**: que miren las columnas de la fila, no la busquen por su id (al
    crearla con `insert(...).select()` aún no se ve y la regla falla).
  - Sin fotos ni archivos (harían falta Supabase Storage y sus reglas).
- **Pestaña Empresa** (29/09, a petición del usuario: "que sea de empresa, quita lo de planes
  con amigos"): `(tabs)/trabajo.tsx` (`/trabajo`) es `PantallaEmpresa` con `enPestana` (sin
  "Volver"). En `(tabs)/_layout.tsx`, con el plan puesto, Planes lleva `href: null` y Empresa
  sale en su sitio con los mensajes y avisos sin leer en el globo; sin el plan, al revés. Las
  pantallas de la empresa vuelven a `/trabajo` (`volver()` y `BotonVolver`), y también "Cambiar de
  plan", Perfil > "Tu plan", la casilla de Hoy y los avisos push sin sección. `/empresa` sigue
  para el enlace de invitación (fuera de las pestañas). Lo que no sale con el plan: casilla
  "planes con amigos" en Hoy (la de la empresa va en su sitio), "Amigos" en la leyenda y
  "Proponer plan" en Semana, y el tipo "Amigos" en el formulario de evento (`opcionesTipo`,
  salvo si el evento ya era de amigos) y en Otros calendarios. Los planes que ya hubiera se quedan
  en el móvil y vuelven al volver al plan personal.
- **Empresa de ejemplo** (29/09, para que el dueño lo vea en Expo Go sin cuentas):
  `services/empresa/ejemplo.ts` (`datosDeEjemplo`, función pura con pruebas en
  `__tests__/ejemplo.test.ts`): "Bar Pepe" con Pepe (admin), Laura (responsable de Cocina), Javi
  (Sala), Marta (responsable de Sala), Luis y Ana (esperando), turnos de esta semana y la
  siguiente (dos cruzan la medianoche), un cambio pedido, tareas, eventos, "Ocupado" de Laura,
  canales con mensajes (uno privado Pepe–Laura) y tres avisos (uno importante). Se abre con "Ver
  una empresa de ejemplo" en la pantalla de entrar (solo donde `ejemploPosible()`: Expo Go y
  desarrollo) y va por el servidor de prueba (`prueba.ts`), que en el móvil guarda en memoria y en
  AsyncStorage (`organizy-prueba-empresa`, fuera de la copia de seguridad; `cargarPrueba()` antes
  de traer nada). Dentro, una tarjeta "Empresa de ejemplo" con "Verlo como" Pepe, Laura o Javi y
  "Dejar el ejemplo". `DatosEmpresa.ejemplo` = true: **no programa avisos ni cambia la hora de
  salida ni las alarmas** (`leerAgenda` lo salta; solo sale en las pantallas), ni sube "Ocupado"
  ni el token de avisos. Nada va a Supabase.
- **Falta**: que el usuario active Google y Microsoft (parte A de la guía) y lo pruebe con cuentas
  de verdad y los avisos en el iPhone.

## Hoja de ruta

- [x] 1. Base: proyecto, pestañas y diseño.
- [x] 2. Formulario de bienvenida y perfil.
- [x] 3. Calendario: pantallas Hoy y Semana.
- [x] 4. Avisos (notificaciones).
- [x] 4b. Época dorada: modo para exámenes o épocas de trabajo intenso (prompt en C:\Users\usuario\OneDrive\PERSONAL\Organizy\Prompts\Organizy-04b-epoca-dorada.md)
- [x] 5. Captura rápida con IA. Supabase montado y funciones desplegadas (proyecto `hwemrpexabisyueyizjz`). Falta solo la clave de Anthropic: el usuario la pondrá cuando la app esté terminada (ver "Decisiones del usuario", 26/09/2026).
- [x] 6. Mapa, tráfico y rutas (funcionando con TomTom desde el 27/09/2026; desde el 26/10/2026 sin radares ni guía: abre Waze, Google Maps o Mapas, con parkings cercanos. Ver "Fase 6").
- [x] 7. Alarmas (en Expo Go son avisos con sonido; las alarmas de verdad están programadas pero sin probar hasta que haya build de EAS: ver "Fase 7").
- [x] 8. Planes con WhatsApp y votación (servidor y función `votar` ya desplegados: ver "Fase 8").
- [ ] 9. Voz sin abrir la app y widget.
- [x] 10. Recordatorios a clientes por WhatsApp (parte A, gratis y sin servidor, hecha el 27/09/2026; la parte B, envío automático con WhatsApp Business, espera a que el usuario cree las cuentas de Meta: ver "Fase 10").
- [x] 11. Correo: plazos al calendario y resúmenes con aviso (27/09/2026; "Vincular con Gmail / Outlook" y QR del ayudante el 28/09; falta que el usuario registre Organizy en Google y Microsoft y lo pruebe: ver "Fase 11").
- [x] 15. Organizy grupal como plan extra ("Plan empresa", 29/09/2026; servidor aplicado y probado; por ahora solo visible en Expo Go; falta que el usuario active Google y Microsoft en Supabase y lo pruebe con cuentas de verdad: ver "Fase 15").
