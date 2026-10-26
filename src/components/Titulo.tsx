import { StyleSheet, Text, type TextProps } from 'react-native';

import { colores, fuentes, tamanos } from '@/theme';

type Props = TextProps & {
  nivel?: 1 | 2 | 3;
};

// Título en Inter, muy grueso y apretado. Nivel 1 es el más grande.
export function Titulo({ nivel = 1, style, ...resto }: Props) {
  return (
    <Text
      accessibilityRole="header"
      style={[estilos.base, nivel === 1 ? estilos.n1 : nivel === 2 ? estilos.n2 : estilos.n3, style]}
      {...resto}
    />
  );
}

const estilos = StyleSheet.create({
  base: {
    color: colores.texto,
    fontFamily: fuentes.titulo,
  },
  n1: { fontFamily: fuentes.tituloFuerte, fontSize: tamanos.tituloGrande, lineHeight: 38, letterSpacing: -1.2 },
  n2: { fontSize: tamanos.titulo, lineHeight: 29, letterSpacing: -0.6 },
  n3: { fontSize: tamanos.grande, lineHeight: 23, letterSpacing: -0.3 },
});
