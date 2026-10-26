import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, Casilla, Tarjeta, Texto, Titulo } from '@/components';
import { marcarBloques, type Epoca, type PlanesDelDia, type RegistroBloque } from '@/data/epocas';
import { sinMarcar, textoHoras, type DiaSinMarcar } from '@/services/epoca';
import { fechaDesdeClave, formatearDiaCorto, horaDesdeMinutos, sumarDias, type ClaveDia } from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes } from '@/theme';

import { ElegirMotivo } from './Motivo';

type Props = {
  epoca: Epoca;
  planesDelDia: PlanesDelDia;
  registro: RegistroBloque[];
  hoy: ClaveDia;
};

// "Se te quedó sin marcar" (26/10/2026, lo pidió el usuario): lo que el plan tenía
// para los últimos días y no se marcó. Mientras no se marque cuenta como no hecho y
// ya se ha vuelto a repartir solo; aquí se dice qué se hizo de verdad y, de lo que
// no, por qué ("me fui a…").
export function SinMarcar({ epoca, planesDelDia, registro, hoy }: Props) {
  const dias = sinMarcar(epoca, planesDelDia, registro, hoy);
  if (dias.length === 0) return null;
  return (
    <View style={estilos.contenedor}>
      {dias.map((d) => (
        <DiaPendiente key={d.dia} epoca={epoca} dia={d} hoy={hoy} />
      ))}
    </View>
  );
}

function DiaPendiente({ epoca, dia, hoy }: { epoca: Epoca; dia: DiaSinMarcar; hoy: ClaveDia }) {
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const nombreHito = (id: string) => epoca.hitos.find((h) => h.id === id)?.nombre ?? 'Estudio';
  const cuando =
    dia.dia === sumarDias(hoy, -1)
      ? 'Ayer'
      : `El ${formatearDiaCorto(fechaDesdeClave(dia.dia)).toLocaleLowerCase('es-ES')}`;
  const faltan = dia.bloques.filter((b) => !hechos.has(b.id));
  const minutosFaltan = faltan.reduce((t, b) => t + (b.fin - b.inicio), 0);

  const alternar = (id: string, hecho: boolean) =>
    setHechos((actual) => {
      const nuevo = new Set(actual);
      if (hecho) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });

  const guardar = async () => {
    setGuardando(true);
    await marcarBloques(
      dia.bloques.map((b) => ({
        bloque: { ...b, epocaId: epoca.id, dia: dia.dia },
        estado: hechos.has(b.id) ? 'hecho' : 'saltado',
        motivo,
      })),
    );
    // La tarjeta desaparece sola al quedar todo marcado.
  };

  return (
    <Tarjeta style={estilos.caja}>
      <Titulo nivel={3}>{cuando} no marcaste esto</Titulo>
      <Texto pequeno secundario>
        Marca lo que sí hiciste. Lo demás ya lo he vuelto a repartir en los días que quedan.
      </Texto>
      <View>
        {dia.bloques.map((b, i) => (
          <View key={b.id} style={[estilos.bloque, i > 0 && estilos.separador]}>
            <Casilla
              marcada={hechos.has(b.id)}
              alCambiar={(hecho) => alternar(b.id, hecho)}
              etiqueta={`Lo hice: ${nombreHito(b.hitoId)}, ${horaDesdeMinutos(b.inicio)}`}
            />
            <View style={estilos.flex}>
              <Texto pequeno secundario style={estilos.hora}>
                {horaDesdeMinutos(b.inicio)} – {horaDesdeMinutos(b.fin)}
              </Texto>
              <Texto fuerte numberOfLines={1}>
                {nombreHito(b.hitoId)}
              </Texto>
            </View>
          </View>
        ))}
      </View>
      {faltan.length > 0 ? (
        <ElegirMotivo
          etiqueta={`¿Por qué no hiciste ${faltan.length === dia.bloques.length ? 'nada' : textoHoras(minutosFaltan)}? (si quieres)`}
          valor={motivo}
          alCambiar={setMotivo}
        />
      ) : null}
      <Boton
        titulo={
          guardando
            ? 'Guardando…'
            : faltan.length === 0
              ? 'Lo hice todo'
              : faltan.length === dia.bloques.length
                ? 'No lo hice'
                : 'Guardar'
        }
        disabled={guardando}
        onPress={guardar}
      />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  caja: { gap: espacio.s },
  flex: { flex: 1 },
  bloque: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, minHeight: alturaTactil + 8 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde },
  hora: { ...cifras, fontFamily: fuentes.hora },
});
