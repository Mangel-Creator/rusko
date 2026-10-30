import { StyleSheet, View } from 'react-native';

import { Interruptor, SelectorHora } from '@/components';
import { espacio } from '@/theme';

// Recordatorio de una tarea (30/10/2026): "Avisarme ese día" y a qué hora. Lo usan la
// ficha de evento y la tarjeta "¿Te lo recuerdo así?" de la captura rápida.

type Props = {
  valor: string | null; // "HH:MM" o null (sin aviso)
  alCambiar: (valor: string | null) => void;
};

export function AvisarA({ valor, alCambiar }: Props) {
  return (
    <View style={estilos.grupo}>
      <Interruptor
        etiqueta="Avisarme ese día"
        ayuda="Te mando un aviso a esa hora, si aún no la has hecho."
        valor={valor !== null}
        alCambiar={(si) => alCambiar(si ? '09:00' : null)}
      />
      {valor !== null ? <SelectorHora etiqueta="A las" valor={valor} alCambiar={alCambiar} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacio.s },
});
