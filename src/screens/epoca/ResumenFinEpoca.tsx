import { StyleSheet } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { marcarResumenVisto, type Epoca, type RegistroBloque } from '@/data/epocas';
import { esDorada, estadoEpoca, resumenEpoca, textoHoras } from '@/services/epoca';
import type { ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

// Al terminar una época, Hoy vuelve solo al ritmo normal y enseña este resumen
// una vez: horas hechas, bloques completados e hitos superados.
export function ResumenFinEpoca({
  epocas,
  registro,
  hoy,
}: {
  epocas: Epoca[];
  registro: RegistroBloque[];
  hoy: ClaveDia;
}) {
  const terminada = epocas
    .filter((e) => estadoEpoca(e, hoy) === 'pasada' && !e.resumenVisto)
    .sort((a, b) => b.fin.localeCompare(a.fin))[0];
  if (!terminada) return null;
  const r = resumenEpoca(terminada, registro, hoy);

  return (
    <Tarjeta style={estilos.tarjeta}>
      <Titulo nivel={3}>
        {esDorada(terminada) ? 'Época dorada terminada' : 'Plan de estudio terminado'}: {terminada.nombre}
      </Titulo>
      <Texto>
        {textoHoras(r.minutosHechos)} de trabajo, {r.bloquesHechos}{' '}
        {r.bloquesHechos === 1 ? 'bloque completado' : 'bloques completados'} y {r.hitosSuperados} de{' '}
        {r.hitosTotal} {r.hitosTotal === 1 ? 'hito superado' : 'hitos superados'}. Vuelves a tu ritmo de siempre.
      </Texto>
      <Boton variante="secundario" titulo="Cerrar" onPress={() => marcarResumenVisto(terminada.id)} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderColor: colores.dorado, borderWidth: 2, gap: espacio.s },
});
