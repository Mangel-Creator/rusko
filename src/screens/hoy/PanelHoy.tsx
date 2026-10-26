import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { cifras, colores, espacio, fuentes, radio } from '@/theme';

// Panel de Hoy (lo pidió el usuario: "mucho más visual"): casillas grandes con
// icono y número. Al tocar una, Hoy enseña su lista debajo; al tocarla otra vez, se
// cierra. "Época dorada" y "Resúmenes" (de correo, fase 11) no abren lista: llevan a
// su sección.

export type Vista = 'cliente' | 'amigos' | 'yo' | 'tareas' | 'estudio' | 'dia' | 'empresa';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export type DatosBaldosa = {
  clave: Vista | 'epoca' | 'resumenes';
  icono: NombreIcono;
  colores: { fondo: string; icono: string };
  numero?: string; // "2", "0/5"; sin número, la etiqueta va más grande
  etiqueta: string; // "clientes", "Todo el día"
  lectura: string; // lo que lee el lector de pantalla: "2 clientes hoy"
};

type Props = {
  baldosas: DatosBaldosa[];
  elegida: Vista | null;
  alPulsar: (clave: DatosBaldosa['clave']) => void;
};

export function PanelHoy({ baldosas, elegida, alPulsar }: Props) {
  return (
    <View style={estilos.rejilla}>
      {baldosas.map((b) => (
        <Baldosa key={b.clave} datos={b} elegida={b.clave === elegida} alPulsar={() => alPulsar(b.clave)} />
      ))}
    </View>
  );
}

function Baldosa({ datos, elegida, alPulsar }: { datos: DatosBaldosa; elegida: boolean; alPulsar: () => void }) {
  const conNumero = datos.numero !== undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={datos.lectura}
      accessibilityState={{ selected: elegida }}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.baldosa, elegida && estilos.elegida, pressed && estilos.pulsado]}>
      <View style={[estilos.icono, { backgroundColor: datos.colores.fondo }]}>
        <Ionicons name={datos.icono} size={20} color={datos.colores.icono} />
      </View>
      {conNumero ? (
        <Texto style={[estilos.numero, elegida && estilos.textoElegido]} numberOfLines={1}>
          {datos.numero}
        </Texto>
      ) : null}
      <Texto
        pequeno={conNumero}
        fuerte={!conNumero}
        numberOfLines={2}
        style={[conNumero ? estilos.etiqueta : estilos.etiquetaSola, elegida && estilos.textoElegido]}>
        {datos.etiqueta}
      </Texto>
    </Pressable>
  );
}

// Casillas de dos en dos. Las que no llevan número (Todo el día, Época dorada) son
// igual de anchas, así que la rejilla queda siempre pareja.
const estilos = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  baldosa: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 112,
    padding: espacio.m,
    gap: espacio.xs,
    borderRadius: radio.grande,
    borderWidth: 1,
    borderColor: colores.tarjeta,
    backgroundColor: colores.tarjeta,
  },
  // La elegida, en naranja suave: se ve de un vistazo qué lista está abierta.
  elegida: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  pulsado: { transform: [{ scale: 0.97 }] },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { ...cifras, fontFamily: fuentes.tituloFuerte, fontSize: 32, lineHeight: 38, letterSpacing: -1, marginTop: espacio.xs },
  etiqueta: { color: colores.textoSecundario },
  etiquetaSola: { marginTop: espacio.s },
  textoElegido: { color: colores.principal },
});
