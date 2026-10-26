import { StyleSheet } from 'react-native';

import { Interruptor, Selector, SelectorFecha, Tarjeta, Texto, Titulo, type Opcion } from '@/components';
import type { InicioRecomendado } from '@/services/epoca';
import { fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

import type { BorradorEpoca, CuandoEmpezar as Cuando } from './borrador';
import { formatoHoras } from './textos';

type Props = {
  borrador: BorradorEpoca;
  cambiar: (cambios: Partial<BorradorEpoca>) => void;
  recomendado: InicioRecomendado | null;
  inicio: ClaveDia; // el que sale de lo elegido
  hoy: ClaveDia;
};

const corto = (dia: ClaveDia) => formatearDiaCorto(fechaDesdeClave(dia)).toLocaleLowerCase('es-ES');

// "¿Cuándo empiezas?" (paso 3): la app dice el último día que deja tiempo para
// todo con margen, y si ese día pasas a Época dorada o solo sigues un plan de
// estudio dentro de tu día normal (lo pidió el usuario el 26/10/2026).
export function CuandoEmpezar({ borrador: b, cambiar, recomendado, inicio, hoy }: Props) {
  const horas = b.hitos.filter((h) => h.fecha > hoy).reduce((t, h) => t + h.horasPreparacion, 0);
  const opciones: Opcion<Cuando>[] = [
    ...(recomendado ? [{ valor: 'recomendado' as const, etiqueta: recomendado.dia === hoy ? 'Hoy' : 'Ese día' }] : []),
    ...(recomendado?.dia === hoy ? [] : [{ valor: 'hoy' as const, etiqueta: 'Hoy' }]),
    { valor: 'otro', etiqueta: 'Otro día' },
  ];
  const elegido = b.cuandoEmpezar === 'recomendado' && !recomendado ? 'hoy' : b.cuandoEmpezar;
  const empezado = inicio <= hoy;

  return (
    <Tarjeta style={estilos.caja}>
      <Titulo nivel={3}>¿Cuándo empiezas?</Titulo>
      {recomendado ? (
        recomendado.llega ? (
          <Texto>
            {recomendado.dia === hoy ? 'Mejor empieza hoy' : `Te recomiendo empezar el ${corto(recomendado.dia)}`}: así
            te caben las {formatoHoras(horas)} con margen por si surge algo.
          </Texto>
        ) : (
          <Texto fuerte style={estilos.aviso}>
            Vas justo: aunque empieces hoy, no te cabe todo con margen. Empieza ya y, si puedes, sube las horas al día.
          </Texto>
        )
      ) : (
        <Texto secundario>Cuando añadas lo que tienes por delante, te digo qué día conviene empezar.</Texto>
      )}
      <Selector
        opciones={opciones}
        valor={elegido}
        alCambiar={(cuandoEmpezar) => cambiar({ cuandoEmpezar, ...(cuandoEmpezar === 'otro' ? { inicio } : {}) })}
      />
      {elegido === 'otro' ? (
        <SelectorFecha etiqueta="Empieza" valor={b.inicio} alCambiar={(dia) => cambiar({ inicio: dia })} />
      ) : null}
      <Interruptor
        etiqueta={empezado ? 'En Época dorada' : `El ${corto(inicio)}, ponerme en Época dorada`}
        ayuda={
          b.dorada
            ? 'Tu horario, tu sitio y la hora de dormir pasan a ser los de la época mientras dure.'
            : 'Solo plan de estudio: los bloques van en tu día normal, sin cambiar tu horario.'
        }
        valor={b.dorada}
        alCambiar={(dorada) => cambiar({ dorada })}
      />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: espacio.m },
  aviso: { color: colores.aviso },
});
