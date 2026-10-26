import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = {
  etiqueta: string;
  valor: number;
  alCambiar: (valor: number) => void;
  minimo: number;
  maximo: number;
  paso: number;
  formato: (valor: number) => string; // por ejemplo 4 -> "4 h"
};

// Elige un número con los botones − y +, como SelectorHora. Sirve para horas
// al día, horas de preparación...
export function SelectorCantidad({ etiqueta, valor, alCambiar, minimo, maximo, paso, formato }: Props) {
  const mover = (signo: 1 | -1) =>
    alCambiar(Math.min(maximo, Math.max(minimo, Math.round((valor + signo * paso) * 100) / 100)));

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={estilos.fila}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: menos`}
          disabled={valor <= minimo}
          onPress={() => mover(-1)}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado, valor <= minimo && estilos.apagado]}>
          <Ionicons name="remove" size={22} color={colores.texto} />
        </Pressable>
        <Text style={estilos.valor} accessibilityLiveRegion="polite">
          {formato(valor)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: más`}
          disabled={valor >= maximo}
          onPress={() => mover(1)}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado, valor >= maximo && estilos.apagado]}>
          <Ionicons name="add" size={22} color={colores.texto} />
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, gap: espacio.xs },
  etiqueta: {
    fontFamily: fuentes.textoMedio,
    fontSize: tamanos.pequeno,
    color: colores.textoSecundario,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.tarjeta,
    borderRadius: radio.chip,
    padding: espacio.xs,
  },
  boton: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.elevado,
  },
  pulsado: { transform: [{ scale: 0.94 }] },
  // Sin opacidad: el botón se ve igual de nítido, solo sin fondo.
  apagado: { backgroundColor: 'transparent' },
  valor: {
    fontFamily: fuentes.textoFuerte,
    fontSize: tamanos.grande,
    color: colores.texto,
    fontVariant: ['tabular-nums'],
  },
});
