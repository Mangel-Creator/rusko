import { guardarAdelantos, leerAdelantos, leerAlarmas, type Adelanto, type Adelantos } from '@/data/alarmas';
import { leerEventos } from '@/data/eventos';
import { leerPerfil } from '@/data/perfil';
import { minutosDesdeHora } from '@/services/fechas';
import { calcularRutas } from '@/services/rutas';
import { modoDeViaje } from '@/services/rutas/tipos';

import { adelantoMinutos, claveAdelanto, destinoInteligente, proximaVez } from './calculo';

// Alarma inteligente (fase 7): cuánto se adelanta su próxima vez.
//
// Cómo es fiable: la alarma está SIEMPRE programada a su hora normal. Esto solo
// guarda un adelanto (como mucho el máximo elegido) cuando hay datos de tráfico; sin
// datos, sin conexión o sin servidor, no se guarda nada y suena a su hora.
//
// El tráfico es el PREVISTO por TomTom para llegar a su hora (arriveAt), así que vale
// calcularlo la noche antes: se recalcula cada vez que se abre la app (y cada 10 min
// con ella abierta). En segundo plano no: ni Expo Go ni iOS lo garantizan (ver
// CLAUDE.md > Fase 7).

// Solo la próxima vez, si es en las próximas 30 horas (la noche antes ya vale).
const HORAS_POR_DELANTE = 30;
// Cada cuánto se vuelve a preguntar al servidor: más a menudo cerca de la hora.
function caducado(anterior: Adelanto, ahora: Date, suenaEn: number): boolean {
  const edadMin = (ahora.getTime() - new Date(anterior.calculadoEl).getTime()) / 60000;
  return suenaEn < 3 * 3600 * 1000 ? edadMin > 15 : edadMin > 120;
}

export async function actualizarAdelantos(): Promise<void> {
  const [{ alarmas }, perfil, eventos, anteriores] = await Promise.all([
    leerAlarmas(),
    leerPerfil(),
    leerEventos(),
    leerAdelantos(),
  ]);
  const ahora = new Date();
  const modo = modoDeViaje(perfil?.transporte);
  const casa = perfil?.vivienda.coordenadas;
  const nuevos: Adelantos = {};

  for (const alarma of alarmas) {
    if (alarma.tipo !== 'inteligente' || !alarma.activada) continue;
    const vez = proximaVez(alarma, ahora); // a su hora normal
    if (!vez) continue;
    const suenaEn = vez.normal.getTime() - ahora.getTime();
    if (suenaEn > HORAS_POR_DELANTE * 3600 * 1000) continue;
    const destino = destinoInteligente(eventos, perfil, vez.dia, minutosDesdeHora(alarma.hora));
    if (!destino || !modo || modo === 'a-pie' || !casa) continue;

    const clave = claveAdelanto(alarma.id, vez.dia);
    const anterior = anteriores[clave];
    if (anterior && anterior.destino === destino.nombre && !caducado(anterior, ahora, suenaEn)) {
      nuevos[clave] = { ...anterior, minutos: adelantoMinutos(anterior.retrasoMin * 60, alarma.adelantoMaxMin) };
      continue;
    }
    const resultado = await calcularRutas({
      origen: [casa.latitud, casa.longitud], // cuando suena, estás en casa
      destino: destino.punto,
      modo,
      alternativas: 0,
      llegada: destino.llegada.toISOString(),
    });
    const ruta = resultado.estado === 'ok' ? resultado.rutas[0] : undefined;
    if (!ruta) {
      // Sin datos nuevos: se conserva el cálculo anterior (si no, suena a su hora).
      if (anterior) nuevos[clave] = anterior;
      if (resultado.estado === 'sin-servidor') break;
      continue;
    }
    nuevos[clave] = {
      clave,
      alarmaId: alarma.id,
      dia: vez.dia,
      minutos: adelantoMinutos(ruta.retrasoSeg, alarma.adelantoMaxMin),
      retrasoMin: Math.ceil(ruta.retrasoSeg / 60),
      destino: destino.nombre,
      calculadoEl: ahora.toISOString(),
    };
  }
  if (JSON.stringify(nuevos) !== JSON.stringify(anteriores)) await guardarAdelantos(nuevos);
}
