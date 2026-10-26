import { StyleSheet, View } from 'react-native';

import { CampoTexto, Selector, Texto, type Opcion } from '@/components';
import { espacio } from '@/theme';

// "¿Por qué no lo hiciste?" al saltar un bloque o al marcar lo que se quedó sin
// hacer (lo pidió el usuario el 26/10/2026). Es opcional: los atajos más
// comunes y, si no encaja ninguno, se escribe.

export const MOTIVOS = ['Me surgió un plan', 'Me fui fuera', 'Estaba malo', 'No me dio tiempo'] as const;
const OTRO = 'otro';

type Props = {
  valor: string;
  alCambiar: (motivo: string) => void;
  etiqueta?: string;
};

export function ElegirMotivo({ valor, alCambiar, etiqueta = '¿Por qué? (si quieres)' }: Props) {
  const atajo = (MOTIVOS as readonly string[]).includes(valor);
  const opciones: Opcion<string>[] = [
    ...MOTIVOS.map((m) => ({ valor: m, etiqueta: m })),
    { valor: OTRO, etiqueta: 'Otro' },
  ];
  const elegido = atajo ? valor : valor ? OTRO : null;
  return (
    <View style={estilos.caja}>
      <Texto pequeno secundario>
        {etiqueta}
      </Texto>
      <Selector
        opciones={opciones}
        valor={elegido}
        // Tocar otra vez el elegido lo quita. "Otro" abre el campo (un espacio lo
        // mantiene abierto mientras está vacío; al guardar se recorta).
        alCambiar={(nuevo) => alCambiar(nuevo === elegido ? '' : nuevo === OTRO ? ' ' : nuevo)}
      />
      {elegido === OTRO ? (
        <CampoTexto
          placeholder="Me fui a…"
          value={valor.trim() ? valor : ''}
          onChangeText={(texto) => alCambiar(texto || ' ')}
          autoCapitalize="sentences"
          autoFocus
          accessibilityLabel="Por qué no lo hiciste"
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: espacio.xs },
});
