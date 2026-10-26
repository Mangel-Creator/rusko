import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, espacio, fuentes, radio } from '@/theme';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export type DatosAccion = {
  clave: string;
  icono: NombreIcono;
  texto: string; // corto, una palabra: "Apuntar", "Dictar"
  etiqueta?: string; // para el lector de pantalla, si hace falta explicar más
  activa?: boolean; // lo que abre ya está abierto: el círculo se pone en naranja
  alPulsar: () => void;
};

// Fila de acciones rápidas: botones redondos con un icono de línea y una palabra debajo,
// como los de una app de banco. La primera es la principal (naranja).
export function AccionesRapidas({ acciones }: { acciones: DatosAccion[] }) {
  return (
    <View style={estilos.fila}>
      {acciones.map((a, i) => (
        <AccionRapida key={a.clave} datos={a} principal={i === 0} />
      ))}
    </View>
  );
}

function AccionRapida({ datos, principal }: { datos: DatosAccion; principal: boolean }) {
  const naranja = principal || datos.activa;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={datos.etiqueta ?? datos.texto}
      accessibilityState={{ expanded: datos.activa }}
      onPress={datos.alPulsar}
      style={estilos.accion}>
      {({ pressed }) => (
        <>
          <View
            style={[
              estilos.circulo,
              naranja && estilos.circuloPrincipal,
              pressed && (naranja ? estilos.circuloPrincipalPulsado : estilos.circuloPulsado),
            ]}>
            <Ionicons name={datos.icono} size={24} color={naranja ? colores.textoSobrePrincipal : colores.texto} />
          </View>
          <Text style={estilos.texto} numberOfLines={1}>
            {datos.texto}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const TAMANO = 56;

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  accion: { flex: 1, alignItems: 'center', gap: espacio.xs + 2 },
  circulo: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloPrincipal: { backgroundColor: colores.principal },
  circuloPulsado: { backgroundColor: colores.borde, transform: [{ scale: 0.94 }] },
  circuloPrincipalPulsado: { backgroundColor: colores.principalPulsado, transform: [{ scale: 0.94 }] },
  texto: { fontFamily: fuentes.textoMedio, fontSize: 13, color: colores.texto },
});
