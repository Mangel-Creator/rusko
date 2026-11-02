import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Tarjeta, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import { cambiarReglaFiltro, quitarVeto } from '@/services/correo';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// "Tus filtros" (02/11/2026, lo pidió el usuario; antes "Tus normas", 30/10): las reglas del
// filtro con IA y los remitentes vetados que estén activos, en un recuadro con degradado
// azul. Cerrado enseña cuántos hay; al tocarlo salen todos. La X pregunta antes de quitar,
// para no borrar uno sin querer. Sin ninguno, no sale. Para añadir, los apartados "Filtro
// con IA" y "Remitentes vetados".

type Filtro = { clave: string; icono: keyof typeof Ionicons.glyphMap; texto: string; quitar: () => Promise<unknown> };

export function TusFiltros() {
  const { filtro, vetados } = useCorreos();
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const filtros: Filtro[] = [
    ...filtro.map((regla) => ({
      clave: `r:${regla}`,
      icono: 'sparkles' as const,
      texto: regla,
      quitar: () => cambiarReglaFiltro(regla, false),
    })),
    ...vetados.map((direccion) => ({
      clave: `v:${direccion}`,
      icono: 'ban' as const,
      texto: `Vetado: ${direccion}`,
      quitar: () => quitarVeto(direccion),
    })),
  ];
  if (filtros.length === 0) return null;

  return (
    <Tarjeta destacada="azul">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`Tus filtros, ${filtros.length === 1 ? '1 activo' : `${filtros.length} activos`}`}
        onPress={() => {
          setAbierto(!abierto);
          setConfirmando(null);
        }}
        style={({ pressed }) => [estilos.cabecera, pressed && estilos.pulsado]}>
        <Ionicons name="funnel" size={20} color={colores.textoOscuro} />
        <View style={estilos.texto}>
          <Texto fuerte style={estilos.oscuro}>
            Tus filtros
          </Texto>
          <Texto pequeno style={estilos.oscuro}>
            {filtros.length === 1 ? '1 activo' : `${filtros.length} activos`}
          </Texto>
        </View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={colores.textoOscuro} />
      </Pressable>
      {abierto
        ? filtros.map((f) =>
            confirmando === f.clave ? (
              <View key={f.clave} style={estilos.confirmar}>
                <Texto pequeno fuerte style={estilos.oscuro}>
                  ¿Quieres borrar este filtro?
                </Texto>
                <Texto pequeno style={estilos.oscuro} numberOfLines={2}>
                  {f.texto}
                </Texto>
                <View style={estilos.botones}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setConfirmando(null);
                      f.quitar().catch(() => {});
                    }}
                    style={({ pressed }) => [estilos.boton, estilos.botonBorrar, pressed && estilos.pulsado]}>
                    <Texto pequeno fuerte style={estilos.textoBorrar}>
                      Sí, borrar
                    </Texto>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmando(null)}
                    style={({ pressed }) => [estilos.boton, estilos.botonNo, pressed && estilos.pulsado]}>
                    <Texto pequeno fuerte style={estilos.oscuro}>
                      No
                    </Texto>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View key={f.clave} style={estilos.fila}>
                <Ionicons name={f.icono} size={16} color={colores.textoOscuro} />
                <Texto pequeno style={[estilos.oscuro, estilos.texto]}>
                  {f.texto}
                </Texto>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Borrar el filtro: ${f.texto}`}
                  onPress={() => setConfirmando(f.clave)}
                  style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
                  <Ionicons name="close" size={20} color={colores.textoOscuro} />
                </Pressable>
              </View>
            ),
          )
        : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: alturaTactil },
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
  confirmar: { gap: espacio.xs, paddingVertical: espacio.s },
  botones: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.xs },
  boton: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.chip,
  },
  // Píldora oscura sobre el azul, como "Cómo llegar" en el cuadro naranja de Hoy.
  botonBorrar: { backgroundColor: colores.textoOscuro },
  textoBorrar: { color: colores.texto },
  botonNo: { borderWidth: 1, borderColor: colores.textoOscuro },
  pulsado: { opacity: 0.7 },
});
