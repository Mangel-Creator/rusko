import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { alturaTactil, colores, fuentes, tamanos } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  nombre: string;
  sobreTinta?: boolean; // en la cabecera oscura de Hoy
};

// Botón redondo con la inicial del nombre (lleva a Perfil).
export function BotonInicial({ nombre, sobreTinta, style, ...resto }: Props) {
  const inicial = nombre.trim().charAt(0).toLocaleUpperCase('es-ES') || '?';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir perfil"
      hitSlop={4}
      style={(estado) => [
        estilos.boton,
        sobreTinta && estilos.botonSobreTinta,
        estado.pressed && estilos.pulsado,
        typeof style === 'function' ? style(estado) : style,
      ]}
      {...resto}>
      <Text style={estilos.letra}>{inicial}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    width: alturaTactil + 4,
    height: alturaTactil + 4,
    borderRadius: (alturaTactil + 4) / 2,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSobreTinta: { backgroundColor: colores.elevado },
  pulsado: { opacity: 0.8 },
  letra: { fontFamily: fuentes.tituloFuerte, fontSize: tamanos.grande, color: colores.texto },
});
