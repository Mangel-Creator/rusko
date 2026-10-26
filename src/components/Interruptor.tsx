import { Pressable, StyleSheet, View } from 'react-native';

import { alturaTactil, colores, espacio, radio } from '@/theme';

import { Texto } from './Texto';

type Props = {
  etiqueta: string;
  ayuda?: string;
  valor: boolean;
  alCambiar: (valor: boolean) => void;
};

// Fila con texto y un interruptor sí/no. Se pulsa en toda la fila.
export function Interruptor({ etiqueta, ayuda, valor, alCambiar }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={etiqueta}
      accessibilityHint={ayuda}
      accessibilityState={{ checked: valor }}
      onPress={() => alCambiar(!valor)}
      style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
      <View style={estilos.textos}>
        <Texto fuerte>{etiqueta}</Texto>
        {ayuda ? (
          <Texto pequeno secundario>
            {ayuda}
          </Texto>
        ) : null}
      </View>
      <View style={[estilos.carril, valor && estilos.carrilActivo]}>
        <View style={[estilos.bola, valor && estilos.bolaActiva]} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 12,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande - 4,
  },
  pulsado: { opacity: 0.8 },
  textos: { flex: 1 },
  carril: {
    width: 52,
    height: 32,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    padding: 3,
    justifyContent: 'center',
  },
  carrilActivo: { backgroundColor: colores.principal },
  bola: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colores.textoSecundario,
  },
  bolaActiva: { alignSelf: 'flex-end', backgroundColor: colores.textoOscuro },
});
