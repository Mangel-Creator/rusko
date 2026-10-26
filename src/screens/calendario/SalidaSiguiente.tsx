import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { useSalida } from '@/data/salidas';
import { formatearHora, type ClaveDia } from '@/services/fechas';
import { textoSalida } from '@/services/rutas';
import { citaDe } from '@/services/rutas/citas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

// Dentro de la tarjeta "Lo siguiente" de Hoy (fase 6): "Sal a las 10:05 · 18 min en
// coche" y el botón "Cómo llegar", que abre el Mapa con la ruta hasta el evento.
// La hora de salida la calcula services/rutas/actualizar.ts con el tráfico previsto.

type Props = { evento: Evento; dia: ClaveDia; enCurso: boolean; ahora: Date };

export function SalidaSiguiente({ evento, dia, enCurso, ahora }: Props) {
  const { perfil } = usePerfil();
  const salida = useSalida(evento.id, dia);
  if (enCurso || !evento.lugar || !citaDe(evento, dia, perfil)) return null;

  const hora = salida ? new Date(salida.salida) : null;
  const tarde = hora ? hora.getTime() < ahora.getTime() : false;

  return (
    <View style={estilos.fila}>
      {hora && salida ? (
        <Texto style={[estilos.texto, tarde && estilos.tarde]}>
          {tarde
            ? `Vas justo: tenías que salir a las ${formatearHora(hora)}`
            : textoSalida(hora, salida.duracionSeg, salida.modo)}
        </Texto>
      ) : (
        <View style={estilos.hueco} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cómo llegar a ${evento.titulo}`}
        onPress={() => router.navigate({ pathname: '/mapa', params: { evento: evento.id, dia } })}
        style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
        <Texto style={estilos.textoBoton}>Cómo llegar</Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.xs },
  texto: {
    flex: 1,
    color: colores.textoOscuro,
    ...cifras, fontFamily: fuentes.hora,
    fontSize: tamanos.pequeno,
    lineHeight: 18,
  },
  // El rojo no se lee sobre el degradado naranja: se usa el texto oscuro en negrita.
  tarde: { ...cifras, fontFamily: fuentes.horaFuerte },
  hueco: { flex: 1 },
  boton: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.textoOscuro,
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  textoBoton: { color: colores.texto, fontFamily: fuentes.textoFuerte, fontSize: tamanos.pequeno },
});
