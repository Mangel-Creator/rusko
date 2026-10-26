import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export type OpcionVisual<T extends string> = {
  valor: T;
  etiqueta: string;
  icono: NombreIcono;
  veces?: number; // repite el icono: 1, 2 o 3 llamas para la dificultad
};

type Props<T extends string> = {
  opciones: readonly OpcionVisual<T>[];
  valor: T | null;
  alCambiar: (valor: T) => void;
  etiqueta?: string;
  columnas?: number; // por defecto, todas en una fila si son 3 o menos; si no, de 2 en 2
};

// Como Selector, pero con casillas grandes de icono y texto: se elige de un vistazo,
// sin leer. La elegida, en naranja suave, como los chips.
export function SelectorVisual<T extends string>({ opciones, valor, alCambiar, etiqueta, columnas }: Props<T>) {
  const porFila = columnas ?? (opciones.length <= 3 ? opciones.length : 2);
  return (
    <View style={estilos.contenedor}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      <View style={estilos.rejilla} accessibilityRole="radiogroup">
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor;
          const color = elegida ? colores.principal : colores.texto;
          return (
            <Pressable
              key={opcion.valor}
              accessibilityRole="radio"
              accessibilityLabel={opcion.etiqueta}
              accessibilityState={{ selected: elegida, checked: elegida }}
              onPress={() => alCambiar(opcion.valor)}
              style={({ pressed }) => [
                estilos.casilla,
                { flexBasis: `${Math.floor(100 / porFila) - 3}%` },
                elegida && estilos.elegida,
                pressed && estilos.pulsado,
              ]}>
              <View style={estilos.iconos}>
                {Array.from({ length: opcion.veces ?? 1 }, (_, i) => (
                  <Ionicons key={i} name={opcion.icono} size={24} color={color} />
                ))}
              </View>
              <Text style={[estilos.texto, elegida && estilos.textoElegido]} numberOfLines={2}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs },
  etiqueta: { fontFamily: fuentes.textoMedio, fontSize: tamanos.pequeno, color: colores.textoSecundario },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  casilla: {
    flexGrow: 1,
    minHeight: alturaTactil * 2,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.s,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
    borderRadius: radio.grande - 4,
    borderWidth: 1,
    borderColor: colores.elevado,
    backgroundColor: colores.elevado,
  },
  elegida: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  pulsado: { transform: [{ scale: 0.97 }] },
  iconos: { flexDirection: 'row' },
  texto: { fontFamily: fuentes.textoMedio, fontSize: tamanos.normal, color: colores.texto, textAlign: 'center' },
  textoElegido: { color: colores.principal, fontFamily: fuentes.textoFuerte },
});
