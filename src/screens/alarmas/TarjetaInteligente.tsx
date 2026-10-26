import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig } from 'react-native-reanimated';

import { useAdelantos, type Alarma } from '@/data/alarmas';
import { caminoDe, claveAdelanto, motivoAdelanto, proximaVez, tituloAlarma } from '@/services/alarmas';
import { claveDia, formatearDiaCorto, formatearHora } from '@/services/fechas';
import { cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

// Tarjeta oscura de la alarma inteligente (BRIEF.md > "Alarmas"): la hora a la que
// sonará, la de siempre tachada al lado si se adelanta, y el motivo debajo. Lo
// importante en oscuro, como la cabecera de Hoy.
export function TarjetaInteligente({ alarmas, ahora }: { alarmas: Alarma[]; ahora: Date }) {
  const adelantos = useAdelantos();
  // La inteligente encendida que suena antes.
  const veces = alarmas
    .filter((a) => a.tipo === 'inteligente' && a.activada)
    .map((a) => proximaVez(a, ahora, adelantos))
    .filter((v) => v !== null)
    .sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  const vez = veces[0];
  if (!vez) return null;

  const { alarma, adelantoMin } = vez;
  const cuandoDia = vez.dia === claveDia(ahora) ? 'hoy' : proximaEsManana(vez.dia, ahora) ? 'mañana' : null;
  const calculo = adelantos[claveAdelanto(alarma.id, vez.dia)];
  const hora = formatearHora(vez.cuando);
  const motivo =
    adelantoMin > 0 && calculo
      ? motivoAdelanto(adelantoMin, calculo.destino, cuandoDia)
      : calculo
        ? `Tráfico normal ${caminoDe(calculo.destino)}: suena a su hora`
        : `Suena a su hora. Si hay atasco, se adelanta hasta ${alarma.adelantoMaxMin} min`;
  const dia = cuandoDia === 'hoy' ? 'Hoy' : cuandoDia === 'mañana' ? 'Mañana' : formatearDiaCorto(vez.cuando);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tituloAlarma(alarma)}. ${dia} a las ${hora}. ${motivo}. Editar`}
      onPress={() => router.push({ pathname: '/alarma', params: { id: alarma.id } })}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.pulsado]}>
      <Text style={estilos.etiqueta}>
        {tituloAlarma(alarma)} · {dia}
      </Text>
      <LayoutAnimationConfig skipEntering>
        <View style={estilos.horas}>
          <Animated.Text key={hora} entering={FadeIn.duration(220)} style={estilos.hora}>
            {hora}
          </Animated.Text>
          {adelantoMin > 0 ? <Text style={estilos.original}>{alarma.hora}</Text> : null}
        </View>
      </LayoutAnimationConfig>
      <Text style={estilos.motivo}>{motivo}</Text>
    </Pressable>
  );
}

function proximaEsManana(dia: string, ahora: Date): boolean {
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  return dia === claveDia(manana);
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.tinta,
    borderRadius: radio.grande,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.l,
    gap: espacio.xs,
  },
  pulsado: { transform: [{ scale: 0.99 }] },
  etiqueta: { fontFamily: fuentes.textoMedio, fontSize: tamanos.pequeno, color: colores.textoSecundarioSobreTinta },
  horas: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 56, lineHeight: 64, color: colores.textoSobreTinta },
  original: {
    ...cifras, fontFamily: fuentes.hora,
    fontSize: 20,
    color: colores.textoSecundarioSobreTinta,
    textDecorationLine: 'line-through',
  },
  motivo: { fontFamily: fuentes.texto, fontSize: tamanos.normal, lineHeight: 22, color: colores.textoSobreTinta },
});
