import { StyleSheet, View } from 'react-native';

import { Interruptor, Selector, Texto, type Opcion } from '@/components';
import { ANTES_DE_DORMIR, cambiarAjustesAlarmas, useAlarmas } from '@/data/alarmas';
import { usePerfil } from '@/data/perfil';
import { minutoDormir, useNivelAlarmas } from '@/services/alarmas';
import { horaDesdeMinutos } from '@/services/fechas';
import { espacio } from '@/theme';

const ANTES: Opcion<string>[] = ANTES_DE_DORMIR.map((m) => ({ valor: String(m), etiqueta: `${m} min` }));

// Hora de dormir: un aviso suave (no una alarma) antes de acostarte, con la hora del
// perfil. En la web llega como aviso push si están activados en Perfil (26/10/2026).
export function FilaDormir() {
  const { ajustes } = useAlarmas();
  const { perfil } = usePerfil();
  const nivel = useNivelAlarmas();
  if (!perfil) return null;
  const hora = horaDesdeMinutos(minutoDormir(perfil, ajustes.dormirAntesMin));

  return (
    <View style={estilos.contenedor}>
      <Interruptor
        etiqueta="Hora de dormir"
        ayuda={
          nivel === 'web'
            ? `Un aviso a las ${hora}, si tienes los avisos activados en Perfil.`
            : `Un aviso suave a las ${hora}, ${ajustes.dormirAntesMin} min antes de acostarte.`
        }
        valor={ajustes.dormir}
        alCambiar={(dormir) => cambiarAjustesAlarmas({ dormir })}
      />
      {ajustes.dormir ? (
        <Selector
          etiqueta="Cuánto antes"
          opciones={ANTES}
          valor={String(ajustes.dormirAntesMin)}
          alCambiar={(v) => cambiarAjustesAlarmas({ dormirAntesMin: Number(v) })}
        />
      ) : null}
      {ajustes.dormir ? (
        <Texto pequeno secundario>
          Te acuestas a las {perfil.horario.acostarse} (lo cambias en Perfil).
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s, marginTop: espacio.m },
});
