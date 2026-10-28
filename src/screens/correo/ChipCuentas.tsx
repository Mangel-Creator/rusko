import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { LogoMarca, Texto } from '@/components';
import type { ConexionCorreo, CuentaCorreo } from '@/data/correos';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// La cuenta vinculada como un chip pequeño junto al título de Correo (27/10/2026): el
// logo, la dirección acortada y un punto rojo si hay que volver a entrar. Al tocarlo se
// abre "Tus cuentas" (CuentasCorreo) para quitarla o vincular otra. Antes era una
// tarjeta grande arriba de la bandeja que estorbaba.

type Props = {
  cuentas: CuentaCorreo[];
  conexion: ConexionCorreo | null;
  abierto: boolean;
  alPulsar: () => void;
};

// Solo lo de antes de la arroba, y acortado si es largo: "nombre.apellido@gmail.com" →
// "nombre.apellid…".
function corta(email: string): string {
  const [usuario] = email.split('@');
  return usuario.length > 14 ? `${usuario.slice(0, 13)}…` : usuario;
}

export function ChipCuentas({ cuentas, conexion, abierto, alPulsar }: Props) {
  const primera = cuentas[0];
  const caducadas = cuentas.some((c) => c.estado === 'caducada');
  const caducada = caducadas || !!conexion?.error;
  const total = cuentas.length + (conexion ? 1 : 0);
  const nombre = primera ? corta(primera.email) : 'Ayudante';
  const resto = total > 1 ? ` +${total - 1}` : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: abierto }}
      accessibilityLabel={`${total === 1 ? 'Cuenta vinculada' : `${total} cuentas vinculadas`}: ${
        primera?.email ?? 'ayudante de Gmail'
      }${caducadas ? '. Hay que volver a entrar' : caducada ? '. El ayudante no responde' : ''}`}
      onPress={alPulsar}
      hitSlop={(alturaTactil - 32) / 2}
      style={({ pressed }) => [estilos.chip, pressed && estilos.pulsado]}>
      {primera ? (
        <LogoMarca proveedor={primera.proveedor === 'gmail' ? 'google' : 'microsoft'} tamano={14} />
      ) : (
        <Ionicons name="code-slash-outline" size={14} color={colores.texto} />
      )}
      <Texto pequeno numberOfLines={1} style={estilos.texto}>
        {nombre}
        {resto}
      </Texto>
      {caducada ? <View style={estilos.punto} /> : null}
      <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={14} color={colores.textoSecundario} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    height: 32,
    maxWidth: 200,
    paddingHorizontal: espacio.s + 2,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  pulsado: { opacity: 0.8 },
  texto: { flexShrink: 1, fontSize: 13 },
  punto: { width: 8, height: 8, borderRadius: radio.chip, backgroundColor: colores.aviso },
});
