import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { Epoca } from '@/data/epocas';
import { textoQuedan } from '@/services/epoca';
import type { ClaveDia } from '@/services/fechas';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// Franja dorada arriba del todo en Hoy mientras hay una época activa:
// "Época dorada · Exámenes de enero · quedan 12 días". Al tocarla, abre la sección.
export function FranjaEpoca({ epoca, hoy }: { epoca: Epoca; hoy: ClaveDia }) {
  const texto = `Época dorada · ${epoca.nombre} · ${textoQuedan(epoca, hoy)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${texto}. Abrir la época`}
      onPress={() => router.push('/epoca')}
      style={({ pressed }) => [estilos.franja, pressed && estilos.pulsado]}>
      <Ionicons name="star" size={18} color={colores.textoOscuro} />
      <Texto fuerte pequeno style={estilos.texto} numberOfLines={2}>
        {texto}
      </Texto>
      <Ionicons name="chevron-forward" size={18} color={colores.texto} />
    </Pressable>
  );
}

// Botón "Época dorada" en Hoy cuando no hay ninguna activa: abre la sección
// (desde ahí se crea una o se ven las programadas).
export function BotonEpoca() {
  return (
    <View style={estilos.fila}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/epoca')}
        style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
        <Ionicons name="star-outline" size={16} color={colores.dorado} />
        <Texto fuerte pequeno>
          Época dorada
        </Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.chip,
    backgroundColor: colores.dorado,
  },
  texto: { flex: 1, color: colores.textoOscuro },
  pulsado: { transform: [{ scale: 0.99 }] },
  fila: { flexDirection: 'row' },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    borderWidth: 1.5,
    borderColor: colores.dorado,
    backgroundColor: colores.tarjeta,
  },
});
