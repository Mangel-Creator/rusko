import { StyleSheet, View } from 'react-native';

import { colores, espacio, radio } from '@/theme';

import { Texto } from './Texto';

type Props = {
  paso: number;
  total: number;
};

// Barra de progreso con el texto "Paso 1 de 2".
export function BarraProgreso({ paso, total }: Props) {
  const progreso = Math.min(Math.max(paso / total, 0), 1);
  return (
    <View
      style={estilos.contenedor}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: paso }}>
      <Texto pequeno secundario>
        Paso {paso} de {total}
      </Texto>
      <View style={estilos.fondo}>
        <View style={[estilos.relleno, { width: `${progreso * 100}%` }]} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs },
  fondo: {
    height: 8,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    overflow: 'hidden',
  },
  relleno: {
    height: '100%',
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
  },
});
