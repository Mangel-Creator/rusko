import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Plegable, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import { cambiarReglaFiltro, MAX_FILTRO, MAX_LARGO_FILTRO } from '@/services/correo';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// "Filtro con IA" (28/10/2026, lo pidió el usuario): reglas en palabras que la IA aplica
// al revisar las cuentas vinculadas, para dejar pasar lo que hoy se queda fuera
// (notificaciones de la carrera) o quitar lo que entra. Los vetados mandan siempre.
// Diseño provisional: lo repasa la sesión "08 Diseño".

export function FiltroIA() {
  const { filtro } = useCorreos();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function anadir() {
    const regla = texto.trim();
    if (!regla) return;
    if (regla.length > MAX_LARGO_FILTRO) {
      setError(`Mejor en menos de ${MAX_LARGO_FILTRO} letras.`);
      return;
    }
    if (filtro.length >= MAX_FILTRO) {
      setError(`Caben ${MAX_FILTRO} reglas. Quita alguna antes.`);
      return;
    }
    setError(null);
    setGuardando(true);
    const ok = await cambiarReglaFiltro(regla, true).catch(() => false);
    setGuardando(false);
    if (ok) setTexto('');
    else setError('Esa regla ya está.');
  }

  return (
    <Plegable
      titulo="Filtro con IA"
      icono="sparkles-outline"
      resumen={filtro.length === 0 ? 'Sin reglas' : filtro.length === 1 ? '1 regla' : `${filtro.length} reglas`}>
      <Texto pequeno secundario>
        Dile con tus palabras qué correos quieres ver y cuáles no. La IA lo mira con el remitente, el asunto y el
        principio de cada correo nuevo de tus cuentas vinculadas. Los vetados no salen nunca.
      </Texto>
      <CampoTexto
        etiqueta="Nueva regla"
        placeholder="Los de la academia de inglés, que no salgan"
        value={texto}
        onChangeText={(t) => {
          setTexto(t);
          setError(null);
        }}
        onSubmitEditing={anadir}
        returnKeyType="done"
        error={error}
      />
      <Boton titulo={guardando ? 'Guardando…' : 'Añadir regla'} disabled={guardando || !texto.trim()} onPress={anadir} />
      {filtro.length > 0 ? (
        <View style={estilos.lista}>
          {filtro.map((regla) => (
            <View key={regla} style={estilos.fila}>
              <Ionicons name="sparkles-outline" size={18} color={colores.textoSecundario} />
              <Texto pequeno style={estilos.regla}>
                {regla}
              </Texto>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar la regla: ${regla}`}
                onPress={() => cambiarReglaFiltro(regla, false).catch(() => {})}
                style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
                <Texto pequeno fuerte>
                  Quitar
                </Texto>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Plegable>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: alturaTactil },
  regla: { flex: 1 },
  quitar: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  pulsado: { opacity: 0.8 },
});
