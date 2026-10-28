import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePerfil } from '@/data/perfil';
import type { ClaveDia } from '@/services/fechas';
import { festivoDelDia, type Festivo } from '@/services/festivos';
import { acentos, espacio, fuentes, radio, tamanos } from '@/theme';

// Festivo de ese día según el perfil (Perfil > "Tus festivos"), o null.
export function useFestivo(dia: ClaveDia): Festivo | null {
  const { perfil } = usePerfil();
  return festivoDelDia(dia, perfil?.festivos);
}

// Píldora azul "Festivo · Día de la Comunitat Valenciana" en Hoy y en Semana. Los
// festivos no son eventos: no ocupan horas, solo avisan de que ese día es fiesta.
export function MarcaFestivo({ dia, style }: { dia: ClaveDia; style?: StyleProp<ViewStyle> }) {
  const festivo = useFestivo(dia);
  if (!festivo) return null;
  return (
    <View style={[estilos.marca, style]} accessibilityLabel={`Festivo: ${festivo.nombre}`}>
      <Ionicons name="flag" size={14} color={acentos.azul.color} />
      <Text style={estilos.texto} numberOfLines={2}>
        Festivo · {festivo.nombre}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacio.xs,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderRadius: radio.chip,
    backgroundColor: acentos.azul.suave,
  },
  texto: { flexShrink: 1, fontFamily: fuentes.textoMedio, fontSize: tamanos.pequeno, color: acentos.azul.color },
});
