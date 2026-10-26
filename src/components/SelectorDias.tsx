import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DIAS_SEMANA_LETRA } from '@/services/fechas';
import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

type Props<T extends number> = {
  etiqueta?: string;
  valor: readonly T[]; // lunes = 0 ... domingo = 6
  alCambiar: (dias: T[]) => void;
};

// Fila L M X J V S D para elegir varios días. Los elegidos, en naranja suave.
export function SelectorDias<T extends number>({ etiqueta, valor, alCambiar }: Props<T>) {
  const alternar = (dia: T) => {
    const nuevos = valor.includes(dia) ? valor.filter((d) => d !== dia) : [...valor, dia];
    alCambiar(nuevos.sort((a, b) => a - b));
  };

  return (
    <View style={estilos.contenedor}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      <View style={estilos.fila}>
        {DIAS_SEMANA_LETRA.map((letra, indice) => {
          const dia = indice as T;
          const elegido = valor.includes(dia);
          return (
            <Pressable
              key={letra}
              accessibilityRole="checkbox"
              accessibilityLabel={NOMBRES_DIAS[indice]}
              accessibilityState={{ checked: elegido }}
              onPress={() => alternar(dia)}
              style={({ pressed }) => [
                estilos.dia,
                elegido && estilos.diaElegido,
                pressed && estilos.pulsado,
              ]}>
              <Text style={[estilos.texto, elegido && estilos.textoElegido]}>{letra}</Text>
            </Pressable>
          );
        })}
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
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.xs },
  dia: {
    flex: 1,
    maxWidth: 48,
    aspectRatio: 1,
    minHeight: alturaTactil,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: colores.elevado,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaElegido: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  pulsado: { opacity: 0.8 },
  texto: { fontFamily: fuentes.textoFuerte, fontSize: tamanos.normal, color: colores.texto },
  textoElegido: { color: colores.principal },
});
