import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { acentos, alturaTactil, colores, espacio, radio, type Acento } from '@/theme';

import { Texto } from './Texto';

type Props = {
  titulo: string; // "Más ajustes"
  resumen?: string; // lo que ya está puesto, para no tener que abrirlo: "Te levantas a las 7:30 · de lunes a viernes"
  abierto?: boolean; // ábrelo desde fuera, por ejemplo si hay un error dentro
  icono?: ComponentProps<typeof Ionicons>['name']; // icono en un círculo a la izquierda (menús como Perfil)
  color?: Acento; // el icono en ese color sobre su tinte (28/10/2026); sin él, blanco sobre gris
  children: ReactNode;
};

// Esconde lo opcional detrás de una fila que se toca para abrir. Así un formulario
// enseña solo lo importante (lo pidió el usuario: "mucho más cortos y visuales").
export function Plegable({ titulo, resumen, abierto, icono, color, children }: Props) {
  const acento = acentos[color ?? 'blanco'];
  const [abiertoAMano, setAbiertoAMano] = useState(false);
  const visible = abiertoAMano || !!abierto;

  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: visible }}
        onPress={() => setAbiertoAMano((actual) => !actual)}
        style={({ pressed }) => [estilos.cabecera, pressed && estilos.pulsado]}>
        {icono ? (
          <View style={[estilos.icono, { backgroundColor: acento.suave }]}>
            <Ionicons name={icono} size={20} color={acento.color} />
          </View>
        ) : null}
        <View style={estilos.textos}>
          <Texto fuerte>{titulo}</Texto>
          {resumen && !visible ? (
            <Texto pequeno secundario numberOfLines={2}>
              {resumen}
            </Texto>
          ) : null}
        </View>
        <Ionicons name={visible ? 'chevron-up' : 'chevron-down'} size={20} color={colores.texto} />
      </Pressable>
      {visible ? (
        <Animated.View entering={FadeIn.duration(160)} style={estilos.contenido}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.m },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m - 4,
    minHeight: alturaTactil + 12,
    paddingVertical: espacio.s,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande - 4,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  pulsado: { backgroundColor: colores.elevado },
  contenido: { gap: espacio.m },
});
