import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Props = TextInputProps & {
  etiqueta?: string;
  ayuda?: string;
  error?: string | null;
};

// Campo para escribir texto, con etiqueta encima y ayuda opcional debajo.
// Si hay "error", el borde se pone naranja y el mensaje sale debajo.
export function CampoTexto({ etiqueta, ayuda, error, style, ...resto }: Props) {
  return (
    <View style={estilos.contenedor}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      <TextInput
        accessibilityLabel={etiqueta}
        accessibilityHint={error ?? undefined}
        placeholderTextColor={colores.textoSecundario}
        style={[estilos.campo, error ? estilos.campoError : null, style]}
        {...resto}
      />
      {error ? <Text style={estilos.error}>{error}</Text> : null}
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xs },
  etiqueta: {
    fontFamily: fuentes.textoMedio,
    fontSize: tamanos.pequeno,
    color: colores.textoSecundario,
  },
  campo: {
    minHeight: alturaTactil + 6,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    borderRadius: radio.normal,
    paddingHorizontal: espacio.m,
    fontFamily: fuentes.texto,
    fontSize: tamanos.normal,
    color: colores.texto,
  },
  campoError: { borderColor: colores.aviso, borderWidth: 2 },
  error: {
    fontFamily: fuentes.textoMedio,
    fontSize: tamanos.pequeno,
    color: colores.aviso,
  },
  ayuda: {
    fontFamily: fuentes.texto,
    fontSize: tamanos.pequeno,
    color: colores.textoSecundario,
  },
});
