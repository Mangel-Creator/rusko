import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { Evento } from '@/data/eventos';
import { useNavegador } from '@/data/navegador';
import { usePerfil } from '@/data/perfil';
import { useSalida } from '@/data/salidas';
import { formatearHora, type ClaveDia } from '@/services/fechas';
import { navegadorPara, NOMBRE_NAVEGADOR, textoSalida } from '@/services/rutas';
import { irACita } from '@/services/rutas/abrir';
import { citaDe } from '@/services/rutas/citas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

// Dentro de la tarjeta "Lo siguiente" de Hoy (fase 6): "Sal a las 10:05 · 18 min en
// coche" y el botón "Ir con Waze" (o la app elegida en el Mapa), que la abre con el sitio
// del evento puesto. Si el evento ya no tiene lugar, enseña el Mapa.
// La hora de salida la calcula services/rutas/actualizar.ts con el tráfico previsto.

type Props = { evento: Evento; dia: ClaveDia; enCurso: boolean; ahora: Date };

export function SalidaSiguiente({ evento, dia, enCurso, ahora }: Props) {
  const { perfil } = usePerfil();
  const salida = useSalida(evento.id, dia);
  const navegador = useNavegador();
  if (enCurso || !evento.lugar || !citaDe(evento, dia, perfil)) return null;

  const hora = salida ? new Date(salida.salida) : null;
  const tarde = hora ? hora.getTime() < ahora.getTime() : false;
  const ir = `Ir con ${NOMBRE_NAVEGADOR[navegadorPara(navegador, perfil?.transporte)]}`;

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
        accessibilityLabel={`${ir} hasta ${evento.titulo}`}
        onPress={async () => {
          if (!(await irACita(evento.id, dia))) router.navigate({ pathname: '/mapa', params: { evento: evento.id, dia } });
        }}
        style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}>
        <Texto style={estilos.textoBoton}>{ir}</Texto>
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
