import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { claveDia, fechaDesdeClave, formatearDiaCorto, sumarDias, type ClaveDia } from '@/services/fechas';
import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = {
  etiqueta: string;
  valor: ClaveDia; // "AAAA-MM-DD"
  alCambiar: (valor: ClaveDia) => void;
};

// Elige un día con los botones − y + (de uno en uno) o los atajos Hoy y Mañana.
// Como SelectorHora: funciona igual en Expo Go y en el navegador.
export function SelectorFecha({ etiqueta, valor, alCambiar }: Props) {
  const hoy = claveDia(new Date());
  const atajos = [
    { texto: 'Hoy', dia: hoy },
    { texto: 'Mañana', dia: sumarDias(hoy, 1) },
    { texto: 'En una semana', dia: sumarDias(valor, 7) },
  ];

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={estilos.fila}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: un día antes`}
          onPress={() => alCambiar(sumarDias(valor, -1))}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
          <Ionicons name="chevron-back" size={22} color={colores.texto} />
        </Pressable>
        <Text style={estilos.fecha} accessibilityLiveRegion="polite">
          {formatearDiaCorto(fechaDesdeClave(valor))}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: un día después`}
          onPress={() => alCambiar(sumarDias(valor, 1))}
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
          <Ionicons name="chevron-forward" size={22} color={colores.texto} />
        </Pressable>
      </View>
      <View style={estilos.atajos}>
        {atajos.map((atajo) => (
          <Pressable
            key={atajo.texto}
            accessibilityRole="button"
            onPress={() => alCambiar(atajo.dia)}
            style={({ pressed }) => [estilos.atajo, pressed && estilos.pulsado]}>
            <Text style={estilos.textoAtajo}>{atajo.texto}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs },
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
    borderRadius: radio.chip,
    padding: espacio.xs,
  },
  boton: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.elevado,
  },
  pulsado: { opacity: 0.7 },
  fecha: { fontFamily: fuentes.textoFuerte, fontSize: tamanos.grande, color: colores.texto },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  atajo: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    justifyContent: 'center',
  },
  textoAtajo: { fontFamily: fuentes.textoMedio, fontSize: tamanos.pequeno, color: colores.texto },
});
