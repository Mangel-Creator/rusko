import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  titulo: string;
  variante?: 'principal' | 'secundario';
};

// Botón de la app, en forma de píldora. "principal" es naranja con texto oscuro;
// "secundario" es gris cálido con texto claro. Sin bordes ni sombras.
export function Boton({ titulo, variante = 'principal', disabled, style, ...resto }: Props) {
  const esPrincipal = variante === 'principal';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(estado) => [
        estilos.base,
        esPrincipal ? estilos.principal : estilos.secundario,
        estado.pressed && (esPrincipal ? estilos.pulsadoPrincipal : estilos.pulsado),
        disabled && estilos.desactivado,
        typeof style === 'function' ? style(estado) : style,
      ]}
      {...resto}>
      <Text style={[estilos.texto, esPrincipal ? estilos.textoPrincipal : estilos.textoSecundario]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: alturaTactil + 6,
    paddingHorizontal: espacio.l,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principal: { backgroundColor: colores.principal },
  secundario: { backgroundColor: colores.elevado },
  pulsadoPrincipal: { backgroundColor: colores.principalPulsado, transform: [{ scale: 0.98 }] },
  pulsado: { backgroundColor: colores.borde, transform: [{ scale: 0.98 }] },
  desactivado: { opacity: 0.45 },
  texto: { fontFamily: fuentes.textoFuerte, fontSize: tamanos.normal },
  textoPrincipal: { color: colores.textoSobrePrincipal },
  textoSecundario: { color: colores.texto },
});
