import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import { alturaTactil, colores, espacio, radio } from '@/theme';

import type { FaseDictado } from './useDictado';

// Botón del micro junto al de enviar (fase 9). Quieto: blanco con borde y el micro en
// azul. Escuchando: azul lleno con un cuadrado de "parar"; al tocarlo, termina y envía.
export function BotonMicrofono({
  escuchando,
  desactivado,
  alPulsar,
}: {
  escuchando: boolean;
  desactivado?: boolean;
  alPulsar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={escuchando ? 'Terminar de dictar' : 'Dictar'}
      accessibilityHint={escuchando ? undefined : 'Dímelo en voz alta y te lo apunto.'}
      accessibilityState={{ disabled: !!desactivado, busy: escuchando }}
      disabled={desactivado}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.boton,
        escuchando ? estilos.escuchando : estilos.quieto,
        pressed && estilos.pulsado,
      ]}>
      <Ionicons
        name={escuchando ? 'stop' : 'mic'}
        size={escuchando ? 20 : 26}
        color={escuchando ? colores.textoSobrePrincipal : colores.principal}
      />
    </Pressable>
  );
}

// Lo que sale debajo del campo antes de pedir el permiso, o si se ha denegado.
export function AvisoMicrofono({
  fase,
  alAceptar,
  alCerrar,
  alAbrirAjustes,
}: {
  fase: FaseDictado;
  alAceptar: () => void;
  alCerrar: () => void;
  alAbrirAjustes: (() => void) | null;
}) {
  if (fase !== 'explicar' && fase !== 'sin-permiso') return null;
  const explicar = fase === 'explicar';
  return (
    <View style={estilos.aviso} accessibilityLiveRegion="polite">
      <View style={estilos.avisoFila}>
        <Ionicons name={explicar ? 'mic-outline' : 'mic-off-outline'} size={28} color={explicar ? colores.principal : colores.aviso} />
        <Texto style={estilos.avisoTexto}>
          {explicar
            ? 'Para apuntar lo que me dices necesito el micro. Solo escucho mientras el botón está azul.'
            : alAbrirAjustes
              ? 'No tengo permiso para usar el micro. Dámelo en Ajustes y vuelve.'
              : 'El navegador no me deja usar el micro. En el iPhone: Ajustes > Apps > Safari > Micrófono.'}
        </Texto>
      </View>
      <View style={estilos.botones}>
        {explicar ? (
          <Boton titulo="Vale" onPress={alAceptar} style={estilos.boton1} />
        ) : alAbrirAjustes ? (
          <Boton titulo="Abrir Ajustes" onPress={alAbrirAjustes} style={estilos.boton1} />
        ) : null}
        <Boton titulo={explicar ? 'Ahora no' : 'Cerrar'} variante="secundario" onPress={alCerrar} style={estilos.boton1} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    width: alturaTactil + 8,
    height: alturaTactil + 8,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quieto: { backgroundColor: colores.tarjeta, borderWidth: 1, borderColor: colores.bordeCampo },
  escuchando: { backgroundColor: colores.principal },
  pulsado: { transform: [{ scale: 0.94 }] },
  aviso: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
    padding: espacio.m,
    gap: espacio.m,
  },
  avisoFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  avisoTexto: { flex: 1 },
  botones: { flexDirection: 'row', gap: espacio.s },
  boton1: { flex: 1 },
});
