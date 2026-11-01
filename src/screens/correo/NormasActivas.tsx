import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Tarjeta, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import { cambiarReglaFiltro, quitarVeto } from '@/services/correo';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// "Tus normas" (30/10/2026, lo pidió el usuario): las reglas del filtro con IA y los
// remitentes vetados que estén activos, juntos en un recuadro con degradado azul. Sin
// ninguna, no sale. Para añadir, los apartados "Filtro con IA" y "Remitentes vetados".

export function NormasActivas() {
  const { filtro, vetados } = useCorreos();
  if (filtro.length === 0 && vetados.length === 0) return null;

  return (
    <Tarjeta destacada="azul" accessibilityLabel="Tus normas de correo activas">
      <View style={estilos.cabecera}>
        <Ionicons name="shield-checkmark" size={20} color={colores.textoOscuro} />
        <Texto fuerte style={estilos.oscuro}>
          Tus normas
        </Texto>
      </View>
      {filtro.map((regla) => (
        <Fila
          key={`r:${regla}`}
          icono="sparkles"
          texto={regla}
          etiqueta={`Quitar la regla: ${regla}`}
          alQuitar={() => cambiarReglaFiltro(regla, false).catch(() => {})}
        />
      ))}
      {vetados.map((direccion) => (
        <Fila
          key={`v:${direccion}`}
          icono="ban"
          texto={`Vetado: ${direccion}`}
          etiqueta={`Quitar el veto a ${direccion}`}
          alQuitar={() => quitarVeto(direccion).catch(() => {})}
        />
      ))}
    </Tarjeta>
  );
}

function Fila({
  icono,
  texto,
  etiqueta,
  alQuitar,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  etiqueta: string;
  alQuitar: () => void;
}) {
  return (
    <View style={estilos.fila}>
      <Ionicons name={icono} size={16} color={colores.textoOscuro} />
      <Texto pequeno style={[estilos.oscuro, estilos.texto]}>
        {texto}
      </Texto>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        onPress={alQuitar}
        style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
        <Ionicons name="close" size={20} color={colores.textoOscuro} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  oscuro: { color: colores.textoOscuro },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: alturaTactil },
  texto: { flex: 1 },
  quitar: {
    width: alturaTactil,
    height: alturaTactil,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.chip,
  },
  pulsado: { opacity: 0.7 },
});
