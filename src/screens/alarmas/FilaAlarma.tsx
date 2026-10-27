import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Texto } from '@/components';
import { activarAlarma, type Alarma } from '@/data/alarmas';
import { diaDeUnaVez, textoCuando, tituloAlarma, unaVezPendiente } from '@/services/alarmas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio } from '@/theme';

// Interruptor sí/no pequeño, para poner al lado de otra cosa (el de components va en
// una fila entera con su texto).
export function InterruptorPequeno({
  valor,
  alCambiar,
  etiqueta,
}: {
  valor: boolean;
  alCambiar: (valor: boolean) => void;
  etiqueta: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: valor }}
      hitSlop={8}
      onPress={() => alCambiar(!valor)}
      style={estilos.zonaInterruptor}>
      <View style={[estilos.carril, valor && estilos.carrilActivo]}>
        <View style={[estilos.bola, valor && estilos.bolaActiva]} />
      </View>
    </Pressable>
  );
}

// Una alarma en la lista: la hora en grande, los días y el nombre, y su interruptor.
// Apagada, pierde el fondo blanco y el texto pasa a gris (sin opacidad).
export function FilaAlarma({ alarma }: { alarma: Alarma }) {
  const encendida = alarma.activada;
  const cambiar = (activada: boolean) => {
    // Una de "una vez" que se vuelve a encender: su día si aún no ha llegado; si ya
    // pasó, la próxima vez que llegue su hora.
    const ahora = new Date();
    const unaVezEl =
      activada && alarma.dias.length === 0
        ? unaVezPendiente(alarma, ahora)
          ? alarma.unaVezEl
          : diaDeUnaVez(alarma.hora, ahora)
        : undefined;
    activarAlarma(alarma.id, activada, unaVezEl);
  };
  const cuando = textoCuando(alarma, new Date());
  return (
    <View style={[estilos.fila, !encendida && estilos.filaApagada]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tituloAlarma(alarma)}, ${alarma.hora}, ${cuando}. Editar`}
        onPress={() => router.push({ pathname: '/alarma', params: { id: alarma.id } })}
        style={({ pressed }) => [estilos.textos, pressed && estilos.pulsado]}>
        <Text style={[estilos.hora, !encendida && estilos.apagado]}>{alarma.hora}</Text>
        <View style={estilos.detalle}>
          {alarma.tipo === 'inteligente' ? (
            <Ionicons name="car-outline" size={16} color={colores.textoSecundario} />
          ) : null}
          <Texto pequeno secundario numberOfLines={1} style={estilos.flexible}>
            {cuando} · {tituloAlarma(alarma)}
          </Texto>
        </View>
      </Pressable>
      <InterruptorPequeno valor={encendida} alCambiar={cambiar} etiqueta={`Alarma de las ${alarma.hora}`} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    minHeight: alturaTactil + 24,
  },
  filaApagada: { backgroundColor: 'transparent' },
  textos: { flex: 1, gap: 2, minHeight: alturaTactil, justifyContent: 'center' },
  pulsado: { transform: [{ scale: 0.99 }] },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 34, lineHeight: 40, color: colores.texto },
  apagado: { color: colores.textoSecundario },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  flexible: { flexShrink: 1 },
  zonaInterruptor: { minHeight: alturaTactil, justifyContent: 'center' },
  carril: {
    width: 52,
    height: 32,
    borderRadius: radio.chip,
    backgroundColor: colores.borde,
    padding: 3,
    justifyContent: 'center',
  },
  carrilActivo: { backgroundColor: colores.principal },
  bola: { width: 26, height: 26, borderRadius: 13, backgroundColor: colores.tarjeta },
  bolaActiva: { alignSelf: 'flex-end' },
});
