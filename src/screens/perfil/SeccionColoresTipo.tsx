import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { guardarColorTipo, PALETA_TIPOS, useColoresTipo } from '@/data/coloresTipo';
import { alturaTactil, colores, espacio } from '@/theme';

import { OPCIONES_TIPO } from '../calendario/textos';

// Perfil > "Cómo se ve": el color de cada tipo de evento, entre los de PALETA_TIPOS.
export function SeccionColoresTipo() {
  const { colorTipo } = useColoresTipo();
  return (
    <View style={estilos.seccion}>
      <Texto fuerte>Color de cada tipo</Texto>
      {OPCIONES_TIPO.map(({ valor: tipo, etiqueta }) => (
        <View key={tipo} style={estilos.tipo}>
          <Texto pequeno secundario>
            {etiqueta}
          </Texto>
          <View accessibilityRole="radiogroup" accessibilityLabel={`Color de ${etiqueta}`} style={estilos.paleta}>
            {PALETA_TIPOS.map(({ color, nombre }) => {
              const elegido = colorTipo[tipo] === color;
              return (
                <Pressable
                  key={color}
                  accessibilityRole="radio"
                  accessibilityLabel={nombre}
                  accessibilityState={{ selected: elegido }}
                  onPress={() => guardarColorTipo(tipo, color)}
                  style={[estilos.hueco, elegido && estilos.huecoElegido]}>
                  <View style={[estilos.circulo, { backgroundColor: color }]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: espacio.m },
  tipo: { gap: espacio.xs },
  paleta: { flexDirection: 'row', flexWrap: 'wrap' },
  hueco: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: alturaTactil / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  huecoElegido: { borderColor: colores.texto },
  circulo: { width: 28, height: 28, borderRadius: 14 },
});
