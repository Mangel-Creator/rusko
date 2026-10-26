import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import { abrirAjustesAlarmas, permisoAlarmas, useNivelAlarmas, usePermisoAlarmas } from '@/services/alarmas';
import { moduloAlarmas, nivelPosible } from '@/services/alarmas/nivel';
import { colores, espacio } from '@/theme';

import { SeccionReloj } from './SeccionReloj';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

// Una línea arriba de la pestaña que dice cómo van a sonar las alarmas aquí (fase 7):
// de verdad (app propia), como avisos (Expo Go o sin permiso) o, en la web, en el Reloj
// del iPhone con un Atajo (SeccionReloj).
export function AvisoNivel() {
  const nivel = useNivelAlarmas();
  const permiso = usePermisoAlarmas();

  if (nivel === 'nativo') {
    if (permiso.pantallaCompleta) return null;
    return (
      <Linea icono="phone-portrait-outline" texto="Suenan, pero con el móvil bloqueado no salen en grande.">
        <Boton variante="secundario" titulo="Activar pantalla completa" onPress={abrirAjustesAlarmas} />
      </Linea>
    );
  }

  // Web (26/10/2026): un Atajo las pasa cada noche al Reloj del iPhone.
  if (nivel === 'web') return <SeccionReloj />;

  // Avisos: el módulo existe (app propia) pero falta el permiso o el iPhone es antiguo.
  if (moduloAlarmas()) {
    if (nivelPosible() === 'nativo') {
      return (
        <Linea icono="alert-circle-outline" texto="Sin permiso de alarmas, por ahora son avisos.">
          <Boton
            variante="secundario"
            titulo="Dar permiso"
            onPress={() =>
              permiso.estado === 'denegado' ? abrirAjustesAlarmas() : permisoAlarmas(true).catch(() => null)
            }
          />
        </Linea>
      );
    }
    return (
      <Linea icono="volume-mute-outline" texto="Con iOS anterior al 26 son avisos: en silencio no suenan." />
    );
  }

  return <Linea icono="volume-mute-outline" texto="En Expo Go son avisos: con el móvil en silencio no suenan." />;
}

function Linea({ icono, texto, children }: { icono: NombreIcono; texto: string; children?: ReactNode }) {
  return (
    <View style={estilos.bloque}>
      <View style={estilos.linea}>
        <Ionicons name={icono} size={20} color={colores.textoSecundario} />
        <Texto pequeno secundario style={estilos.texto}>
          {texto}
        </Texto>
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.s },
  linea: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  texto: { flex: 1 },
});
