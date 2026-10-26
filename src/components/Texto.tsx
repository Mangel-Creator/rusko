import { StyleSheet, Text, type TextProps } from 'react-native';

import { colores, fuentes, tamanos } from '@/theme';

type Props = TextProps & {
  secundario?: boolean;
  fuerte?: boolean;
  pequeno?: boolean;
};

// Texto normal de la app con la letra Inter.
export function Texto({ secundario, fuerte, pequeno, style, ...resto }: Props) {
  return (
    <Text
      style={[
        estilos.base,
        secundario && estilos.secundario,
        fuerte && estilos.fuerte,
        pequeno && estilos.pequeno,
        style,
      ]}
      {...resto}
    />
  );
}

const estilos = StyleSheet.create({
  base: {
    color: colores.texto,
    fontFamily: fuentes.texto,
    fontSize: tamanos.normal,
    lineHeight: 24,
  },
  secundario: { color: colores.textoSecundario },
  fuerte: { fontFamily: fuentes.textoFuerte },
  pequeno: { fontSize: tamanos.pequeno, lineHeight: 20 },
});
