import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

export type Opcion<T extends string> = {
  valor: T;
  etiqueta: string;
};

type Props<T extends string> = {
  opciones: readonly Opcion<T>[];
  valor: T | null;
  alCambiar: (valor: T) => void;
  etiqueta?: string;
};

// Fila de "chips" en píldora para elegir una opción. La elegida, en naranja suave.
export function Selector<T extends string>({ opciones, valor, alCambiar, etiqueta }: Props<T>) {
  return (
    <View style={estilos.contenedor}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      <View style={estilos.fila} accessibilityRole="radiogroup">
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor;
          return (
            <Pressable
              key={opcion.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: elegida, checked: elegida }}
              onPress={() => alCambiar(opcion.valor)}
              style={({ pressed }) => [
                estilos.chip,
                elegida && estilos.chipElegido,
                pressed && estilos.pulsado,
              ]}>
              <Text style={[estilos.texto, elegida && estilos.textoElegido]}>{opcion.etiqueta}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs },
  etiqueta: {
    fontFamily: fuentes.textoMedio,
    fontSize: tamanos.pequeno,
    color: colores.textoSecundario,
  },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: colores.elevado,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipElegido: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  pulsado: { opacity: 0.8 },
  texto: { fontFamily: fuentes.textoMedio, fontSize: tamanos.normal, color: colores.texto },
  textoElegido: { color: colores.principal, fontFamily: fuentes.textoFuerte },
});
