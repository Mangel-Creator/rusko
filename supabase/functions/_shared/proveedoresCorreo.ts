// Organizy · Gmail y Outlook para "Vincular con…" (fase 11). Funciones puras: sin Deno
// ni red, así las prueba Jest (supabase/functions/_shared/__tests__).

export type Proveedor = 'gmail' | 'outlook';

export const PROVEEDORES: readonly Proveedor[] = ['gmail', 'outlook'];

// Lo que la función saca de cada mensaje para pasárselo a las reglas o a la IA.
export type MensajeLeido = {
  id: string;
  recibido: Date;
  de: string; // "Gestoría López <info@gl.es>"
  asunto: string;
  cuerpo: string; // texto plano
  enlace: string; // abre el correo en Gmail u Outlook
  principal: boolean; // en "Principal" (Gmail) o "Prioritarios" (Outlook)
};

type DatosOAuth = {
  autorizar: string;
  token: string;
  alcance: string;
  extra: Record<string, string>;
};

// Solo leer el correo. "offline" / offline_access: para que den la llave que dura.
export const OAUTH: Record<Proveedor, DatosOAuth> = {
  gmail: {
    autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    alcance: 'https://www.googleapis.com/auth/gmail.readonly',
    // prompt=consent: Google solo da la llave (refresh token) la primera vez si no.
    extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  outlook: {
    autorizar: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    alcance: 'offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read',
    extra: { response_mode: 'query', prompt: 'select_account' },
  },
};

export function urlAutorizacion(proveedor: Proveedor, clienteId: string, redireccion: string, estado: string): string {
  const datos = OAUTH[proveedor];
  const parametros = new URLSearchParams({
    client_id: clienteId,
    redirect_uri: redireccion,
    response_type: 'code',
    scope: datos.alcance,
    state: estado,
    ...datos.extra,
  });
  return `${datos.autorizar}?${parametros.toString()}`;
}

// Adónde puede volver el navegador después de iniciar sesión: la web publicada, el
// servidor de desarrollo o la app ("organizy://", también en Expo Go, porque la
// ventana de inicio de sesión del iPhone se cierra sola al ver esa dirección).
export function vueltaValida(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 300) return false;
  if (/^organizy:\/\/[\w\-/]*$/.test(url)) return true;
  // "/organizy/" era la dirección antigua de la web (ahora redirige a "/rusko/").
  if (/^https:\/\/mangel-creator\.github\.io\/(rusko|organizy)\/[\w\-/]*$/.test(url)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?\/[\w\-/]*$/.test(url);
}

// La vuelta con el resultado: "…/resumenes?correo=ok&cuenta=ana%40gmail.com".
export function conResultado(vuelta: string, datos: Record<string, string>): string {
  return `${vuelta}${vuelta.includes('?') ? '&' : '?'}${new URLSearchParams(datos).toString()}`;
}

// --- Gmail ---

function base64url(texto: string): string {
  const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Texto aproximado de un correo que solo viene en HTML.
export function textoDeHtml(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

type ParteGmail = {
  mimeType?: string;
  body?: { data?: string };
  parts?: ParteGmail[];
  headers?: { name: string; value: string }[];
};

function buscarParte(parte: ParteGmail, tipo: string): string | null {
  if (parte.mimeType === tipo && parte.body?.data) return base64url(parte.body.data);
  for (const hija of parte.parts ?? []) {
    const encontrada = buscarParte(hija, tipo);
    if (encontrada !== null) return encontrada;
  }
  return null;
}

// Un mensaje de la API de Gmail (format=full).
export function mensajeDeGmail(
  msg: { id: string; threadId: string; internalDate: string; labelIds?: string[]; payload: ParteGmail },
  email: string,
): MensajeLeido {
  const cabecera = (nombre: string) =>
    msg.payload.headers?.find((h) => h.name.toLowerCase() === nombre)?.value ?? '';
  const plano = buscarParte(msg.payload, 'text/plain');
  const html = plano === null ? buscarParte(msg.payload, 'text/html') : null;
  const etiquetas = msg.labelIds ?? [];
  return {
    id: msg.id,
    recibido: new Date(Number(msg.internalDate)),
    de: cabecera('from'),
    asunto: cabecera('subject'),
    cuerpo: (plano ?? (html ? textoDeHtml(html) : '')).slice(0, 20000),
    enlace: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${msg.threadId}`,
    principal: !etiquetas.some((e) => /^CATEGORY_(PROMOTIONS|SOCIAL|UPDATES|FORUMS)$/.test(e)),
  };
}

// --- Outlook (Microsoft Graph) ---

// Un mensaje de Graph pedido con Prefer: outlook.body-content-type="text".
// El id de Outlook es muy largo: se acorta con el resumen que da quien llama.
export function mensajeDeOutlook(
  msg: {
    receivedDateTime: string;
    subject?: string | null;
    from?: { emailAddress?: { name?: string; address?: string } } | null;
    body?: { contentType?: string; content?: string } | null;
    webLink?: string;
    inferenceClassification?: string;
  },
  idCorto: string,
): MensajeLeido {
  const remitente = msg.from?.emailAddress;
  const nombre = remitente?.name && remitente.address ? `${remitente.name} <${remitente.address}>` : remitente?.address ?? remitente?.name ?? '';
  const contenido = msg.body?.content ?? '';
  return {
    id: idCorto,
    recibido: new Date(msg.receivedDateTime),
    de: nombre,
    asunto: msg.subject ?? '',
    cuerpo: (msg.body?.contentType === 'html' ? textoDeHtml(contenido) : contenido).slice(0, 20000),
    enlace: msg.webLink?.startsWith('https://') ? msg.webLink : '',
    principal: msg.inferenceClassification !== 'other',
  };
}

// El correo de la cuenta, de la respuesta de Gmail (/profile) o de Graph (/me).
export function emailDeCuenta(proveedor: Proveedor, perfil: Record<string, unknown>): string | null {
  const valor = proveedor === 'gmail' ? perfil.emailAddress : perfil.mail ?? perfil.userPrincipalName;
  return typeof valor === 'string' && valor.includes('@') ? valor.toLowerCase().slice(0, 320) : null;
}
