import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { BotonAtras, BotonFlotante, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { useAlarmas } from '@/data/alarmas';
import { permisoAlarmas } from '@/services/alarmas';
import { colores, espacio } from '@/theme';

import { AvisoNivel } from './alarmas/AvisoNivel';
import { FilaAlarma } from './alarmas/FilaAlarma';
import { FilaDormir } from './alarmas/FilaDormir';
import { SeccionSalidas } from './alarmas/SeccionSalidas';
import { TarjetaInteligente } from './alarmas/TarjetaInteligente';
import { useAhora } from './calendario/useAhora';

// Alarmas (fase 7, se abre desde Hoy): la inteligente arriba en oscuro, la lista de alarmas,
// las de salida (ajustadas al tráfico) y la hora de dormir. El "+" crea una.
// Cómo suenan depende de dónde corre la app: lo dice AvisoNivel en una línea.
export function PantallaAlarmas() {
  const { pospuesta } = useLocalSearchParams<{ pospuesta?: string }>();
  const { cargado, alarmas } = useAlarmas();
  const ahora = useAhora();
  const ordenadas = [...alarmas].sort((a, b) => a.hora.localeCompare(b.hora));

  // Mira el permiso de alarmas al entrar (en la app propia; en el resto no hace nada).
  useEffect(() => {
    permisoAlarmas().catch(() => null);
  }, []);

  return (
    <View style={estilos.contenedor}>
      <Pantalla>
        <BotonAtras texto="Hoy" etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Titulo>Alarmas</Titulo>
        <AvisoNivel />

        {pospuesta ? (
          <Tarjeta style={estilos.pospuesta}>
            <Ionicons name="time-outline" size={20} color={colores.texto} />
            <Texto>Pospuesta: vuelve a sonar a las {pospuesta}.</Texto>
          </Tarjeta>
        ) : null}

        <TarjetaInteligente alarmas={alarmas} ahora={ahora} />

        {!cargado ? null : ordenadas.length === 0 ? (
          <View style={estilos.vacio}>
            <Ionicons name="alarm-outline" size={40} color={colores.textoSecundario} />
            <Texto secundario>Aún no tienes alarmas. Toca el + para poner una.</Texto>
          </View>
        ) : (
          <View style={estilos.lista}>
            {ordenadas.map((alarma) => (
              <FilaAlarma key={alarma.id} alarma={alarma} />
            ))}
          </View>
        )}

        <SeccionSalidas />
        <FilaDormir />
        <View style={estilos.hueco} />
      </Pantalla>
      <BotonFlotante etiqueta="Nueva alarma" onPress={() => router.push('/alarma')} />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  lista: { gap: 2 },
  vacio: { alignItems: 'center', gap: espacio.s, paddingVertical: espacio.l },
  pospuesta: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  hueco: { height: espacio.xxl }, // que el "+" no tape lo último
});
