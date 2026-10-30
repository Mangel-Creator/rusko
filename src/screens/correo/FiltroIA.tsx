import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Plegable, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import { cambiarReglaFiltro, MAX_FILTRO, MAX_LARGO_FILTRO } from '@/services/correo';
import { acentos, alturaTactil, colores, espacio, radio } from '@/theme';

// "Filtro con IA" (28/10/2026, lo pidió el usuario): reglas en palabras que la IA aplica
// al revisar las cuentas vinculadas, para dejar pasar lo que hoy se queda fuera
// (notificaciones de la carrera) o quitar lo que entra. Los vetados mandan siempre.
// Diseño (30/10/2026): icono naranja como "Tu IA" en Perfil; ejemplos en chips que
// rellenan el campo; cada regla en su fila con un botón redondo para quitarla.

// Ejemplos para empezar: al tocarlos se copian en el campo, no se guardan solos.
const EJEMPLOS = [
  'Las notificaciones de la universidad, que salgan',
  'La publicidad de tiendas, que no salga',
  'Los del banco, solo si hay que pagar algo',
];

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
      color="naranja"
      resumen={filtro.length === 0 ? 'Sin reglas' : filtro.length === 1 ? '1 regla' : `${filtro.length} reglas`}>
      <Texto pequeno secundario>
        Dile con tus palabras qué correos quieres ver y cuáles no. La IA lo mira con el remitente, el asunto y el
        principio de cada correo nuevo de tus cuentas vinculadas. Los vetados no salen nunca.
      </Texto>
      {filtro.length > 0 ? (
        <View style={estilos.lista}>
          {filtro.map((regla) => (
            <View key={regla} style={estilos.fila}>
              <View style={estilos.iconoRegla}>
                <Ionicons name="sparkles" size={16} color={acentos.naranja.color} />
              </View>
              <Texto style={estilos.regla}>
                {regla}
              </Texto>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar la regla: ${regla}`}
                onPress={() => cambiarReglaFiltro(regla, false).catch(() => {})}
                style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
                <Ionicons name="close" size={20} color={colores.texto} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
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
      {texto.trim() ? null : (
        <View style={estilos.ejemplos}>
          {EJEMPLOS.filter((e) => !filtro.includes(e)).map((ejemplo) => (
            <Pressable
              key={ejemplo}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Usar el ejemplo: ${ejemplo}`}
              onPress={() => {
                setTexto(ejemplo);
                setError(null);
              }}
              style={({ pressed }) => [estilos.ejemplo, pressed && estilos.pulsado]}>
              <Texto pequeno style={estilos.textoEjemplo}>
                {ejemplo}
              </Texto>
            </Pressable>
          ))}
        </View>
      )}
      <Boton titulo={guardando ? 'Guardando…' : 'Añadir regla'} disabled={guardando || !texto.trim()} onPress={anadir} />
    </Plegable>
  );
}

const estilos = StyleSheet.create({
  ejemplos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  ejemplo: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: espacio.m - 4,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
  },
  textoEjemplo: { color: colores.textoSecundario },
  lista: { gap: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m - 4,
    paddingVertical: espacio.s,
    paddingLeft: espacio.m - 4,
    paddingRight: espacio.s,
    borderRadius: radio.normal,
    backgroundColor: colores.elevado,
  },
  iconoRegla: {
    width: 32,
    height: 32,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: acentos.naranja.suave,
  },
  regla: { flex: 1 },
  quitar: {
    width: alturaTactil,
    height: alturaTactil,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.chip,
  },
  pulsado: { opacity: 0.8 },
});
