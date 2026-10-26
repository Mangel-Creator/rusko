import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto, Titulo } from '@/components';
import { useEmpresa } from '@/data/empresa';
import { NOMBRE_PLAN, planEmpresaVisible } from '@/services/empresa/plan';
import { alturaTactil, colorBaldosa, colores, espacio, radio } from '@/theme';

// Perfil > "Tu plan": el plan que tienes y "Cambiar de plan". Solo sale donde el plan
// empresa se puede ver (Expo Go, desarrollo o si ya lo tienes): en la web pública, nada.
export function SeccionPlan() {
  const { cargado, modo, situacion } = useEmpresa();
  if (!cargado || !planEmpresaVisible(modo)) return null;

  const detalle = !modo
    ? 'Organizy de siempre: todo en tu móvil.'
    : situacion.fase === 'dentro'
      ? situacion.datos.empresa.nombre
      : situacion.fase === 'pendiente'
        ? `Esperando que te acepten en ${situacion.empresa || 'tu empresa'}`
        : 'Aún no estás en ninguna empresa';

  return (
    <>
      <Titulo nivel={2} style={estilos.seccion}>
        Tu plan
      </Titulo>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${modo ? NOMBRE_PLAN.empresa : NOMBRE_PLAN.personal}. ${detalle}`}
        disabled={!modo}
        onPress={() => router.navigate('/trabajo')}
        style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
        <View style={[estilos.icono, { backgroundColor: modo ? colorBaldosa.empresa.fondo : colorBaldosa.yo.fondo }]}>
          <Ionicons
            name={modo ? 'business-outline' : 'person-outline'}
            size={20}
            color={modo ? colorBaldosa.empresa.icono : colorBaldosa.yo.icono}
          />
        </View>
        <View style={estilos.textos}>
          <Texto fuerte>{modo ? NOMBRE_PLAN.empresa : NOMBRE_PLAN.personal}</Texto>
          <Texto pequeno secundario>
            {detalle}
          </Texto>
        </View>
        {modo ? <Ionicons name="chevron-forward" size={18} color={colores.textoSecundario} /> : null}
      </Pressable>
      <Boton variante="secundario" titulo="Cambiar de plan" onPress={() => router.push('/cambiar-plan')} />
    </>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: espacio.m },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 16,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
  },
  pulsado: { opacity: 0.8 },
  icono: { width: 40, height: 40, borderRadius: radio.chip, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
});
