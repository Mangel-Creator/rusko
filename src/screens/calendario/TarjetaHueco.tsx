import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { useDensidad } from '@/data/densidad';
import type { Intervalo } from '@/services/agenda';
import { formatearDuracion, horaDesdeMinutos } from '@/services/fechas';
import { cifras, colores, espacio, fuentes, radio } from '@/theme';

// Hueco libre de 1 hora o más: tarjeta con borde discontinuo.
export function TarjetaHueco({ hueco }: { hueco: Intervalo }) {
  const { medidas } = useDensidad();
  return (
    <View style={[estilos.tarjeta, { minHeight: medidas.altoFila - 4, paddingVertical: medidas.rellenoFila }]}>
      <View style={estilos.horas}>
        <Texto pequeno secundario style={estilos.hora}>
          {horaDesdeMinutos(hueco.inicio)}
        </Texto>
        <Texto pequeno secundario style={estilos.hora}>
          {horaDesdeMinutos(hueco.fin)}
        </Texto>
      </View>
      <Texto fuerte style={[estilos.texto, { fontSize: medidas.texto, lineHeight: medidas.interlineado }]}>
        Hueco libre · {formatearDuracion(hueco.fin - hueco.inicio)}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colores.cargaNormal,
    borderRadius: radio.grande - 4,
  },
  horas: { width: 48 },
  hora: { ...cifras, fontFamily: fuentes.hora },
  texto: { flex: 1, color: colores.textoSecundario },
});
