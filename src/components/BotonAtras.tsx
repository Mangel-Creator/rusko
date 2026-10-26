import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = {
  texto: string; // adónde vuelve: "Hoy", "Alarmas", "Volver"
  etiqueta?: string; // lo que lee el lector de pantalla, si no es el texto ("Volver sin guardar")
  onPress: () => void;
};

// Botón para volver, arriba a la izquierda de cada ficha: píldora gris con flecha.
// Siempre igual en toda la app, para encontrarlo sin buscar.
export function BotonAtras({ texto, etiqueta, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
      <Ionicons name="chevron-back" size={20} color={colores.texto} />
      <Text style={estilos.texto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: alturaTactil,
    paddingLeft: espacio.s + 2,
    paddingRight: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  pulsado: { backgroundColor: colores.borde, transform: [{ scale: 0.97 }] },
  texto: { fontFamily: fuentes.textoFuerte, fontSize: tamanos.normal, color: colores.texto },
});
