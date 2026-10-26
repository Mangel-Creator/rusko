import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colores, degradados, espacio, radio } from '@/theme';

type Props = ViewProps & {
  // Tarjeta destacada: fondo de degradado vivo y texto oscuro encima. Como mucho una por
  // pantalla: es lo único llamativo.
  destacada?: keyof typeof degradados;
};

// Caja plana de esquinas muy redondeadas, sin borde ni sombra: se separa del fondo
// por su color.
export function Tarjeta({ destacada, style, ...resto }: Props) {
  if (destacada) {
    return (
      <LinearGradient
        colors={degradados[destacada]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[estilos.tarjeta, style]}
        {...resto}
      />
    );
  }
  return <View style={[estilos.tarjeta, estilos.plana, style]} {...resto} />;
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderRadius: radio.grande,
    padding: espacio.l - 4,
    gap: espacio.s,
    overflow: 'hidden',
  },
  plana: { backgroundColor: colores.tarjeta },
});
