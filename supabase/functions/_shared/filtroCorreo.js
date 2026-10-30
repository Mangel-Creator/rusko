// Filtro con IA del correo (28/10/2026, lo pidió el usuario): reglas en palabras de la
// persona ("aunque sean notificaciones, si son de mi carrera, que lleguen") que la IA
// aplica a cada tanda de correos nuevos de las cuentas vinculadas. Funciona en los dos
// sentidos: deja pasar lo que hoy se queda fuera (Notificaciones y Foros de Gmail, "Otros"
// de Outlook) o quita lo que entra. Lo vetado se quita antes y no llega a la IA.
// Sin nada de Deno, para probarlo con Jest.

export const MAX_FILTRO = 10;
export const MAX_LARGO_FILTRO = 200;

// La lista que manda la app, limpia. null si no es una lista.
export function leerFiltro(valor) {
  if (!Array.isArray(valor)) return null;
  var lista = [];
  valor.forEach(function (v) {
    if (typeof v !== 'string') return;
    var r = v.replace(/\s+/g, ' ').trim();
    if (r && r.length <= MAX_LARGO_FILTRO && lista.indexOf(r) === -1) lista.push(r);
  });
  return lista.slice(0, MAX_FILTRO);
}

// Lo que contesta la IA ({ decisiones: [{ n, decision }] }) a un mapa n -> decisión.
// Lo que no se entiende es "igual" (se queda como estaba).
export function leerDecisiones(datos, cuantos) {
  var mapa = {};
  var lista = datos && Array.isArray(datos.decisiones) ? datos.decisiones : [];
  lista.forEach(function (d) {
    if (!d || typeof d.n !== 'number' || d.n < 0 || d.n >= cuantos) return;
    if (d.decision === 'pasa' || d.decision === 'fuera') mapa[d.n] = d.decision;
  });
  return mapa;
}

// ¿Entra el correo n? "entra" = lo que entraría sin filtro (Principal, Prioritarios).
export function entraConFiltro(entra, decision) {
  if (decision === 'pasa') return true;
  if (decision === 'fuera') return false;
  return entra;
}
