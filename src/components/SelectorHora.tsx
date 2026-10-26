import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { horaDesdeMinutos, minutosDesdeHora } from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = {
  etiqueta: string;
  valor: string; // "HH:MM"
  alCambiar: (valor: string) => void;
  pasoMinutos?: number;
};

// Elige una hora con los botones − y +, de 15 en 15 minutos. Formato 24 h.
export function SelectorHora({ etiqueta, valor, alCambiar, pasoMinutos = 15 }: Props) {
  const mover = (signo: 1 | -1) =>
    alCambiar(horaDesdeMinutos(minutosDesdeHora(valor) + signo * pasoMinutos));

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={estilos.fila}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: ${pasoMinutos} minutos antes`}
          onPress={() => mover(-1)}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
          <Ionicons name="remove" size={22} color={colores.texto} />
        </Pressable>
        <Text style={estilos.hora} accessibilityLiveRegion="polite">
          {valor}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: ${pasoMinutos} minutos después`}
          onPress={() => mover(1)}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
          <Ionicons name="add" size={22} color={colores.texto} />
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, gap: espacio.xs },
  etiqueta: {
    fontFamily: fuentes.textoMedio,
    fontSize: tamanos.pequeno,
    color: colores.textoSecundario,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.pequeno,
    padding: espacio.xs,
  },
  boton: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.pequeno - 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondo,
  },
  pulsado: { opacity: 0.7 },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: tamanos.grande, color: colores.texto },
});
