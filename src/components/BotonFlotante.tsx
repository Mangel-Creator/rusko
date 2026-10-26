import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colores, espacio, radio } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  etiqueta: string; // lo que lee el lector de pantalla, por ejemplo "Añadir evento"
  icono?: 'add' | 'close'; // "close" cuando lo que abrió está abierto
};

const TAMANO = 60;

// Botón redondo naranja con un "+", fijo abajo a la derecha de la pantalla.
// Va dentro de un contenedor con flex: 1, al lado (no dentro) de <Pantalla>.
export function BotonFlotante({ etiqueta, icono = 'add', style, ...resto }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={(estado) => [
        estilos.boton,
        estado.pressed && estilos.pulsado,
        typeof style === 'function' ? style(estado) : style,
      ]}
      {...resto}>
      <Ionicons name={icono} size={32} color={colores.textoSobrePrincipal} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    position: 'absolute',
    right: espacio.l,
    bottom: espacio.l,
    width: TAMANO,
    height: TAMANO,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { backgroundColor: colores.principalPulsado, transform: [{ scale: 0.94 }] },
});
