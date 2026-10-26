import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { TipoPlan } from '@/data/planes';
import { capitalizar, fechaDesdeClave, formatearDiaCorto } from '@/services/fechas';
import { alturaTactil, cifras, colorBaldosa, colores, espacio, fuentes, radio, tamanos } from '@/theme';

// Piezas compartidas por Planes, el formulario de nuevo plan, la ficha del plan y la
// página de votación.

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export const ICONO_TIPO: Record<TipoPlan, NombreIcono> = { amigos: 'people', cliente: 'briefcase' };

// "Viernes 3 oct"
export function textoDia(dia: string): string {
  return capitalizar(formatearDiaCorto(fechaDesdeClave(dia)));
}

// "Vie 3 oct": para las filas de votos, donde hay poco sitio.
export function textoDiaCorto(dia: string): string {
  return textoDia(dia).replace(/^(\S{3})\S*/, '$1');
}

// Cuadrado con el icono del tipo de plan, en el color suave de su tipo (como en Hoy).
export function BaldosaTipo({ tipo, grande }: { tipo: TipoPlan; grande?: boolean }) {
  const tono = colorBaldosa[tipo];
  const lado = grande ? 52 : 40;
  return (
    <View style={[estilos.baldosa, { width: lado, height: lado, backgroundColor: tono.fondo }]}>
      <Ionicons name={ICONO_TIPO[tipo]} size={grande ? 28 : 22} color={tono.icono} />
    </View>
  );
}

// Botón de WhatsApp: el verde de la marca (excepción elegida por el usuario) con su
// logo. Solo abre WhatsApp con el mensaje escrito; lo envía la persona.
export function BotonWhatsapp({
  titulo,
  onPress,
  disabled,
}: {
  titulo: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [estilos.whatsapp, pressed && estilos.pulsado, disabled && estilos.desactivado]}>
      <Ionicons name="logo-whatsapp" size={24} color={colores.textoOscuro} />
      <Texto fuerte style={estilos.textoWhatsapp}>
        {titulo}
      </Texto>
    </Pressable>
  );
}

// Abre WhatsApp con el enlace wa.me. En la web, el navegador solo deja abrir otra
// pestaña justo al tocar: si antes hay que esperar al servidor (crear el plan), se
// abre la pestaña al tocar y se le pone la dirección cuando llega.
export function prepararWhatsapp(): (url: string | null) => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return (url) => {
      if (url) Linking.openURL(url).catch(() => {});
    };
  }
  const pestana = window.open('', '_blank');
  return (url) => {
    if (!url) {
      pestana?.close();
      return;
    }
    if (pestana) pestana.location.href = url;
    else window.location.href = url;
  };
}

export function abrirWhatsapp(url: string) {
  prepararWhatsapp()(url);
}

export function BotonVolver({ destino = '/planes', texto = 'Volver' }: { destino?: '/planes'; texto?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(destino))}
      style={({ pressed }) => [estilos.volver, pressed && estilos.pulsado]}>
      <Ionicons name="chevron-back" size={24} color={colores.texto} />
      <Texto fuerte>{texto}</Texto>
    </Pressable>
  );
}

type PropsFila = {
  dia: string;
  hora: string;
  votos: number;
  total: number; // para la barra: votos / total
  nombres: string[];
  gana?: boolean;
  modo?: 'marcar' | 'elegir'; // casilla (votar) o botón redondo (elegir la hora al cerrar)
  marcada?: boolean;
  onPress?: () => void;
};

// Una hora propuesta con sus votos: día, hora, barra y quién la ha votado.
export function FilaVotos({ dia, hora, votos, total, nombres, gana, modo, marcada, onPress }: PropsFila) {
  const icono: NombreIcono | null =
    modo === 'marcar'
      ? marcada
        ? 'checkbox'
        : 'square-outline'
      : modo === 'elegir'
        ? marcada
          ? 'radio-button-on'
          : 'radio-button-off'
        : null;
  const contenido = (
    <>
      {icono ? <Ionicons name={icono} size={26} color={marcada ? colores.principal : colores.texto} /> : null}
      <View style={estilos.cuando}>
        <Texto pequeno secundario numberOfLines={1}>
          {textoDiaCorto(dia)}
        </Texto>
        <Texto style={estilos.hora}>{hora}</Texto>
      </View>
      <View style={estilos.votos}>
        <View style={estilos.barraFondo}>
          <View
            style={[
              estilos.barra,
              { width: `${total > 0 ? Math.round((votos / total) * 100) : 0}%` },
              gana && estilos.barraGana,
            ]}
          />
        </View>
        {nombres.length > 0 ? (
          <Texto pequeno secundario numberOfLines={2}>
            {nombres.join(', ')}
          </Texto>
        ) : null}
      </View>
      <Texto fuerte style={estilos.cuenta}>
        {votos}
      </Texto>
    </>
  );
  const lectura = `${textoDia(dia)} a las ${hora}, ${votos === 1 ? '1 voto' : `${votos} votos`}${gana ? ', gana' : ''}`;
  if (!onPress) {
    return (
      <View style={[estilos.fila, gana && estilos.filaGana]} accessibilityLabel={lectura}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={modo === 'marcar' ? 'checkbox' : 'radio'}
      accessibilityLabel={lectura}
      accessibilityState={{ checked: !!marcada }}
      onPress={onPress}
      style={({ pressed }) => [estilos.fila, gana && estilos.filaGana, pressed && estilos.pulsado]}>
      {contenido}
    </Pressable>
  );
}

// Nombre en un chip con su botón de quitar.
export function ChipNombre({ nombre, alQuitar }: { nombre: string; alQuitar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quitar a ${nombre}`}
      onPress={alQuitar}
      style={({ pressed }) => [estilos.chip, pressed && estilos.pulsado]}>
      <Texto>{nombre}</Texto>
      <Ionicons name="close" size={18} color={colores.textoSecundario} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  baldosa: { borderRadius: radio.normal, alignItems: 'center', justifyContent: 'center' },
  whatsapp: {
    minHeight: alturaTactil + 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    borderRadius: radio.normal,
    backgroundColor: colores.whatsapp,
  },
  textoWhatsapp: { color: colores.textoOscuro },
  pulsado: { transform: [{ scale: 0.98 }] },
  desactivado: { opacity: 0.5 },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: alturaTactil,
    paddingRight: espacio.s,
    marginLeft: -espacio.xs,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 16,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.normal,
  },
  filaGana: { borderLeftWidth: 4, borderLeftColor: colores.principal },
  cuando: { width: 84 },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: tamanos.grande, lineHeight: 24 },
  votos: { flex: 1, gap: espacio.xs },
  barraFondo: { height: 8, borderRadius: radio.chip, backgroundColor: colores.fondo, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: radio.chip, backgroundColor: colores.cargaNormal },
  barraGana: { backgroundColor: colores.principal },
  cuenta: { minWidth: 20, textAlign: 'right', fontSize: tamanos.grande },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.pequeno,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
  },
});
