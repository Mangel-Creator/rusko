import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { Intervalo } from '@/services/agenda';
import { formatearDuracion, horaDesdeMinutos } from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio } from '@/theme';

// Hueco libre de 2 h o más en Semana, con el botón "Proponer plan" (fase 8).
// Mismo borde discontinuo que los huecos de Hoy.
export function HuecoPlan({ hueco, alProponer }: { hueco: Intervalo; alProponer: () => void }) {
  return (
    <View style={estilos.hueco}>
      <View style={estilos.textos}>
        <Texto pequeno secundario style={estilos.hora}>
          {horaDesdeMinutos(hueco.inicio)} – {horaDesdeMinutos(hueco.fin)}
        </Texto>
        <Texto fuerte style={estilos.libre}>
          Libre · {formatearDuracion(hueco.fin - hueco.inicio)}
        </Texto>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Proponer plan de ${horaDesdeMinutos(hueco.inicio)} a ${horaDesdeMinutos(hueco.fin)}`}
        onPress={alProponer}
        style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
        <Ionicons name="people" size={18} color={colores.textoSobrePrincipal} />
        <Texto pequeno fuerte style={estilos.textoBoton}>
          Proponer plan
        </Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  hueco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 16,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colores.cargaNormal,
    borderRadius: radio.grande - 4,
  },
  textos: { flex: 1 },
  hora: { ...cifras, fontFamily: fuentes.hora },
  libre: { color: colores.textoSecundario },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
  },
  pulsado: { transform: [{ scale: 0.97 }] },
  textoBoton: { color: colores.textoSobrePrincipal },
});
