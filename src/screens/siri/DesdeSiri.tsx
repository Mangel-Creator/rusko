import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Boton, Tarjeta, Texto } from '@/components';
import { olvidarRecogidoSiri, useRecogidoSiri } from '@/data/siri';
import { colores, espacio } from '@/theme';

// En Hoy, lo que se acaba de recoger de Siri (27/10/2026): así se ve qué ha entendido.
export function DesdeSiri() {
  const hechos = useRecogidoSiri();
  if (hechos.length === 0) return null;
  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <View style={estilos.cabecera}>
        <Ionicons name="mic-outline" size={22} color={colores.principal} />
        <Texto fuerte style={estilos.flex}>
          {hechos.length === 1 ? 'He apuntado lo que le dijiste a Siri' : `He apuntado ${hechos.length} cosas de Siri`}
        </Texto>
      </View>
      {hechos.map((hecho, i) => (
        <Texto key={i}>{hecho}</Texto>
      ))}
      <Boton variante="secundario" titulo="Vale" onPress={olvidarRecogidoSiri} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.s },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
});
