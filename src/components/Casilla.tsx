import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { alturaTactil, colores } from '@/theme';

type Props = {
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  etiqueta: string; // para el lector de pantalla
};

// Casilla para marcar algo como hecho. Mide 44 px para pulsarla bien.
// Al marcarla da un pequeño salto (no lo hace si el móvil tiene "reducir movimiento").
export function Casilla({ marcada, alCambiar, etiqueta }: Props) {
  const escala = useSharedValue(1);
  const estiloSalto = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));

  function pulsar() {
    if (!marcada) {
      escala.set(withSequence(withTiming(1.2, { duration: 110 }), withTiming(1, { duration: 160 })));
    }
    alCambiar(!marcada);
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: marcada }}
      onPress={pulsar}
      style={({ pressed }) => [estilos.zona, pressed && estilos.pulsado]}>
      <Animated.View style={[estilos.caja, marcada && estilos.cajaMarcada, estiloSalto]}>
        {marcada ? <Ionicons name="checkmark" size={18} color={colores.textoSobrePrincipal} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  zona: {
    width: alturaTactil,
    height: alturaTactil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caja: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colores.textoSecundario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaMarcada: { backgroundColor: colores.principal, borderColor: colores.principal },
  pulsado: { opacity: 0.6 },
});
