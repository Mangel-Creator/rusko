import { StyleSheet, View } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { marcarResumenVisto, type Epoca, type RegistroBloque } from '@/data/epocas';
import { guardarPerfilEstudio, leerPerfilEstudio } from '@/data/perfilEstudio';
import { esDorada, estadoEpoca, resumenEpoca, textoHoras } from '@/services/epoca';
import { conRecuentos, conValoracion, type Valoracion } from '@/services/epoca/perfilEstudio';
import type { ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

const VALORACIONES: { valor: Valoracion; titulo: string }[] = [
  { valor: 'sobro', titulo: 'Me sobró' },
  { valor: 'justo', titulo: 'Justo' },
  { valor: 'falto', titulo: 'Me faltó' },
];

// Al terminar una época, Hoy vuelve solo al ritmo normal y enseña este resumen
// una vez: horas hechas, bloques completados e hitos superados. Pregunta si le
// sobró o le faltó tiempo: con eso los próximos planes calculan mejor su ritmo.
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

  const valorar = async (valoracion: Valoracion) => {
    const perfil = conRecuentos(await leerPerfilEstudio(), epocas, registro);
    await guardarPerfilEstudio(conValoracion(perfil, terminada.id, terminada.fin, valoracion));
    await marcarResumenVisto(terminada.id);
  };

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
      <Texto fuerte>¿Cómo te fue el tiempo?</Texto>
      <Texto secundario>Con esto calculo mejor tu próximo plan.</Texto>
      <View style={estilos.fila}>
        {VALORACIONES.map((v) => (
          <View key={v.valor} style={estilos.opcion}>
            <Boton variante="secundario" titulo={v.titulo} onPress={() => valorar(v.valor)} />
          </View>
        ))}
      </View>
      <Boton variante="secundario" titulo="Cerrar sin contestar" onPress={() => marcarResumenVisto(terminada.id)} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderColor: colores.dorado, borderWidth: 2, gap: espacio.s },
  fila: { flexDirection: 'row', gap: espacio.s },
  opcion: { flex: 1 },
});
