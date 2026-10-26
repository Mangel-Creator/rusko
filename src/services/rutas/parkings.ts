import { distanciaM } from './distancia';
import type { Punto } from './tipos';

// Parkings cerca de donde vas (26/10/2026). Los busca TomTom a través del servidor
// (acción "parkings"); lo lleno que suele estar cada uno lo aprende la app de ti:
// cada "Está lleno, llévame a otro" se apunta con el día y la hora, y a esa hora
// ese parking baja en la lista. No hay datos de ocupación gratis para toda España.
// Funciones puras, con pruebas.

export type Parking = {
  id: string; // el de TomTom
  nombre: string;
  direccion: string;
  punto: Punto;
  tipo: 'garaje' | 'aire-libre'; // parking cubierto o explanada
  distanciaM: number; // en línea recta hasta el destino
};

// Una vez que lo encontraste lleno.
export type MarcaLleno = { id: string; cuando: string }; // ISO

// Cuenta como "a esa hora" si fue una hora antes o después, el mismo tipo de día.
export const MARGEN_HORA_MIN = 60;
// Cada vez que lo encontraste lleno a esa hora pesa como si estuviera 400 m más lejos.
export const PENALIZACION_LLENO_M = 400;
// Se recuerdan 4 meses y como mucho 300 marcas.
export const DIAS_RECUERDO = 120;
export const MAXIMO_MARCAS = 300;
// Andando, unos 80 metros por minuto.
const METROS_POR_MINUTO = 80;

type TipoDia = 'laborable' | 'sabado' | 'domingo';

function tipoDia(fecha: Date): TipoDia {
  const d = fecha.getDay();
  if (d === 6) return 'sabado';
  if (d === 0) return 'domingo';
  return 'laborable';
}

function minutoDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

// Cuántas veces encontraste lleno este parking un día como ese y a esa hora.
export function vecesLleno(id: string, llenos: MarcaLleno[], cuando: Date): number {
  const tipo = tipoDia(cuando);
  const minuto = minutoDelDia(cuando);
  return llenos.filter((m) => {
    if (m.id !== id) return false;
    const fecha = new Date(m.cuando);
    return tipoDia(fecha) === tipo && Math.abs(minutoDelDia(fecha) - minuto) <= MARGEN_HORA_MIN;
  }).length;
}

export type ParkingOrdenado = Parking & { vecesLleno: number };

// Del que más te conviene al que menos: cerca del destino y que no suela estar lleno.
export function ordenarParkings(parkings: Parking[], llenos: MarcaLleno[], cuando: Date): ParkingOrdenado[] {
  return parkings
    .map((p) => ({ ...p, vecesLleno: vecesLleno(p.id, llenos, cuando) }))
    .sort(
      (a, b) =>
        a.distanciaM + a.vecesLleno * PENALIZACION_LLENO_M - (b.distanciaM + b.vecesLleno * PENALIZACION_LLENO_M),
    );
}

// "Suele estar lleno a esta hora" (2 o más veces) o "A veces se llena a esta hora".
export function textoOcupacion(veces: number): string | null {
  if (veces >= 2) return 'Suele estar lleno a esta hora';
  if (veces === 1) return 'A veces se llena a esta hora';
  return null;
}

// "4 min andando hasta el sitio"
export function textoAndando(metros: number): string {
  const minutos = Math.max(1, Math.round(metros / METROS_POR_MINUTO));
  return `${minutos} min andando hasta el sitio`;
}

// Apunta que estaba lleno. Quita las marcas viejas y se queda con las últimas.
export function anadirLleno(llenos: MarcaLleno[], id: string, cuando: Date): MarcaLleno[] {
  const limite = cuando.getTime() - DIAS_RECUERDO * 24 * 3600 * 1000;
  return [...llenos.filter((m) => new Date(m.cuando).getTime() >= limite), { id, cuando: cuando.toISOString() }].slice(
    -MAXIMO_MARCAS,
  );
}

// El siguiente de la lista que todavía no has probado.
export function siguienteParking<T extends Parking>(lista: T[], probados: string[]): T | null {
  return lista.find((p) => !probados.includes(p.id)) ?? null;
}

// Pone la distancia hasta el destino y quita los repetidos (mismo sitio o mismo id).
export function prepararParkings(lista: Omit<Parking, 'distanciaM'>[], destino: Punto): Parking[] {
  const vistos: Parking[] = [];
  for (const p of lista) {
    if (vistos.some((v) => v.id === p.id || distanciaM(v.punto, p.punto) < 25)) continue;
    vistos.push({ ...p, distanciaM: distanciaM(p.punto, destino) });
  }
  return vistos;
}
