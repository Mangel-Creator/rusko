import type { Ref } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewInstance, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio } from '@/theme';

// Contenedor base de cada pantalla: fondo oscuro, márgenes y scroll.
// Se aparta del teclado para que no tape los campos.
// colorArriba pinta la franja de la hora y la batería (Hoy la pone oscura, como su cabecera).
export function Pantalla({
  contentContainerStyle,
  colorArriba,
  ref,
  ...resto
}: ScrollViewProps & { ref?: Ref<ScrollViewInstance>; colorArriba?: string }) {
  return (
    <SafeAreaView
      style={[estilos.seguro, colorArriba ? { backgroundColor: colorArriba } : null]}
      edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={estilos.seguro}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        <ScrollView
          ref={ref}
          style={[estilos.scroll, colorArriba ? estilos.fondo : null]}
          contentContainerStyle={[estilos.contenido, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          {...resto}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  seguro: { flex: 1, backgroundColor: colores.fondo },
  scroll: { flex: 1 },
  fondo: { backgroundColor: colores.fondo },
  contenido: {
    paddingHorizontal: espacio.l - 4,
    paddingTop: espacio.m,
    paddingBottom: espacio.xxl,
    gap: espacio.l - 4,
  },
});
