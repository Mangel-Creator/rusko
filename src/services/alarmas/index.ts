import { AppState, Platform } from 'react-native';

import {
  activarAlarma,
  cambiarAjustesAlarmas,
  leerAdelantos,
  leerAlarmas,
  suscribirseAdelantos,
  suscribirseAlarmas,
} from '@/data/alarmas';
import { leerAlarmasReloj, suscribirseAlarmasReloj } from '@/data/alarmasReloj';
import { leerEventos, suscribirseEventos } from '@/data/eventos';
import { cargarPerfil, suscribirsePerfil } from '@/data/perfil';
import { leerSalidas, suscribirseSalidas } from '@/data/salidas';

import { eventosConAlarmaVigentes, unaVezPasadas } from './calculo';
import { definicionesNativas } from './definiciones';
import { actualizarAdelantos } from './inteligente';
import { nivelEfectivo, quitarTodasLasNativas, sincronizarNativas } from './nativo';
import { alarmasParaReloj } from './reloj';
import { subirAlarmasReloj } from './relojServidor';

// Servicio de alarmas (fase 7). Una misma interfaz para los tres niveles (nivel.ts):
//   - La pestaña guarda las alarmas (data/alarmas.ts) sin saber cómo van a sonar.
//   - "nativo": aquí se programan las alarmas de verdad (nativo.ts).
//   - "avisos": las programa services/avisos como avisos con sonido (lee el nivel
//     con nivelEfectivo()).
//   - "web": no suena nada, pero si se ha creado el enlace del Atajo (26/10/2026), las
//     alarmas se suben al servidor y el Atajo las pasa cada noche al Reloj del iPhone.
//
// iniciarAlarmas() va en _layout: al arrancar, al volver a la app, al cambiar alarmas,
// eventos, perfil o salidas, y cada 10 min con la app abierta, recalcula el adelanto
// de la inteligente, apaga las de "una vez" que ya sonaron y deja las nativas al día.

export * from './calculo';
export { tituloAlarma } from './definiciones';
export {
  abrirAjustesAlarmas,
  atenderAlarmasNativas,
  nivelEfectivo,
  permisoAlarmas,
  useNivelAlarmas,
  usePermisoAlarmas,
  type ResultadoAlarma,
} from './nativo';
export type { NivelAlarmas } from './nivel';

let cola: Promise<unknown> = Promise.resolve();

// Pone las alarmas nativas al día (sin tráfico: eso lo hace actualizarAlarmas).
export function sincronizarAlarmas(): Promise<void> {
  const tarea = cola.then(async () => {
    const { perfil, bienvenidaCompletada } = await cargarPerfil();
    if (!perfil || !bienvenidaCompletada) return;
    const ahora = new Date();
    const [{ alarmas, ajustes }, eventos, adelantos, salidas] = await Promise.all([
      leerAlarmas(),
      leerEventos(),
      leerAdelantos(),
      leerSalidas(),
    ]);

    // Limpieza: las de una vez que ya sonaron se apagan, como en el Reloj; y las
    // alarmas de salida de eventos borrados (o sin lugar) se olvidan.
    for (const id of unaVezPasadas(alarmas, ahora)) await activarAlarma(id, false);
    const vigentes = eventosConAlarmaVigentes(ajustes.salidas, eventos);
    if (vigentes.length !== ajustes.salidas.length) await cambiarAjustesAlarmas({ salidas: vigentes });

    const nivel = await nivelEfectivo();
    if (nivel === 'nativo') {
      const estado = await leerAlarmas();
      await sincronizarNativas(
        definicionesNativas({
          ahora,
          alarmas: estado.alarmas,
          adelantos,
          salidas: Object.values(salidas),
          eventosConAlarma: estado.ajustes.salidas,
        }),
      );
    } else if (nivel === 'avisos') {
      // Sin permiso: las que hubiera de antes se quitan y pasan a ser avisos.
      await quitarTodasLasNativas();
    } else if ((await leerAlarmasReloj()).enlace) {
      // Web con el Atajo del Reloj (26/10/2026): las de los próximos 14 días al servidor.
      const estado = await leerAlarmas();
      await subirAlarmasReloj(
        alarmasParaReloj({
          ahora,
          alarmas: estado.alarmas,
          adelantos,
          salidas: Object.values(salidas),
          eventosConAlarma: estado.ajustes.salidas,
        }),
      ).catch(() => {});
    }
  });
  cola = tarea.catch(() => {});
  return tarea;
}

// Tráfico de la inteligente y después las nativas.
export async function actualizarAlarmas(): Promise<void> {
  const { perfil, bienvenidaCompletada } = await cargarPerfil();
  if (!perfil || !bienvenidaCompletada) return;
  await actualizarAdelantos().catch(() => {});
  await sincronizarAlarmas();
}

async function actualizarWeb(): Promise<void> {
  await ((await leerAlarmasReloj()).enlace ? actualizarAlarmas() : sincronizarAlarmas());
}

const esperas = new Map<() => Promise<void>, ReturnType<typeof setTimeout>>();

// Espera un segundo por si llegan varios cambios seguidos y lo hace una sola vez.
function enUnMomento(que: () => Promise<void>) {
  const anterior = esperas.get(que);
  if (anterior) clearTimeout(anterior);
  esperas.set(
    que,
    setTimeout(() => {
      esperas.delete(que);
      que().catch(() => {});
    }, 1000),
  );
}

const CADA_MS = 10 * 60 * 1000;

// Se llama una vez al arrancar la app. Devuelve la función para pararlo.
export function iniciarAlarmas(): () => void {
  // En la web solo suenan si pasan al Reloj con el Atajo: sin él, no se gasta tráfico
  // en calcular adelantos (solo se apagan las de una vez que ya pasaron).
  const todo = () => enUnMomento(Platform.OS === 'web' ? actualizarWeb : actualizarAlarmas);
  const solo = () => enUnMomento(sincronizarAlarmas);
  todo();
  const quitar = [
    suscribirseAlarmas(todo),
    suscribirseEventos(todo),
    suscribirsePerfil(todo),
    suscribirseSalidas(solo), // la hora de salida cambió con el tráfico (fase 6)
    suscribirseAdelantos(solo),
    suscribirseAlarmasReloj(solo), // se acaba de crear el enlace del Atajo
  ];
  const app = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') todo();
  });
  const reloj = setInterval(() => {
    if (AppState.currentState === 'active') todo();
  }, CADA_MS);
  return () => {
    quitar.forEach((q) => q());
    app.remove();
    clearInterval(reloj);
  };
}
