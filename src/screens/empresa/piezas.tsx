import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Tarjeta, Texto } from '@/components';
import { useEmpresa, type DatosEmpresa } from '@/data/empresa';
import { alturaTactil, cifras, colorBaldosa, colores, espacio, fuentes, radio } from '@/theme';

// Piezas comunes de las pantallas del plan empresa (Organizy grupal, fase 15).

// Lo de la empresa si se está dentro (y el plan está puesto).
export function useDatosEmpresa(): DatosEmpresa | null {
  const { modo, situacion } = useEmpresa();
  return modo && situacion.fase === 'dentro' ? situacion.datos : null;
}

// Vuelve a la pantalla de antes (o, si se abrió directamente, a la que toque).
export function volver(destino: Href = '/trabajo') {
  if (router.canGoBack()) router.back();
  else router.replace(destino);
}

export function BotonVolver({ texto = 'Empresa', destino = '/trabajo' }: { texto?: string; destino?: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Volver a ${texto}`}
      onPress={() => volver(destino)}
      style={({ pressed }) => [estilos.volver, pressed && estilos.pulsado]}>
      <Ionicons name="chevron-back" size={24} color={colores.texto} />
      <Texto fuerte>{texto}</Texto>
    </Pressable>
  );
}

// Un mensaje corto: en granate si es un error; si no, en negro (el verde es de Amigos).
export function Mensaje({ texto, bien }: { texto: string | null; bien?: boolean }) {
  if (!texto) return null;
  return (
    <Texto fuerte={bien} style={bien ? estilos.bien : estilos.error} accessibilityLiveRegion="polite">
      {texto}
    </Texto>
  );
}

type PropsFila = {
  titulo: string;
  detalle?: string | null;
  hora?: string | null; // "09:00"
  horaFin?: string | null;
  apagada?: boolean;
  onPress?: () => void;
  derecha?: ReactNode;
  lectura?: string;
};

// Fila plana con la barra de empresa (azul pizarra), como las filas de eventos.
export function FilaEmpresa({ titulo, detalle, hora, horaFin, apagada, onPress, derecha, lectura }: PropsFila) {
  const contenido = (
    <>
      {hora !== undefined ? (
        <View style={estilos.horas}>
          <Texto style={[estilos.hora, apagada && estilos.textoApagado]}>{hora ?? 'Día'}</Texto>
          {horaFin ? (
            <Texto pequeno secundario style={estilos.horaFin}>
              {horaFin}
            </Texto>
          ) : null}
        </View>
      ) : null}
      <View style={estilos.textos}>
        <Texto fuerte numberOfLines={2} style={apagada && estilos.textoApagado}>
          {titulo}
        </Texto>
        {detalle ? (
          <Texto pequeno secundario numberOfLines={2}>
            {detalle}
          </Texto>
        ) : null}
      </View>
      {derecha}
      {onPress && !derecha ? <Ionicons name="chevron-forward" size={18} color={colores.textoSecundario} /> : null}
    </>
  );
  const estilo = [estilos.fila, { borderLeftColor: apagada ? colores.cargaNormal : colores.empresa }, apagada && estilos.apagada];
  if (!onPress) return <View style={estilo}>{contenido}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lectura ?? [hora, titulo, detalle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [...estilo, pressed && estilos.pulsado]}>
      {contenido}
    </Pressable>
  );
}

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export type Baldosa<T extends string> = { clave: T; icono: NombreIcono; numero?: string; etiqueta: string; lectura: string };

// Casillas grandes de dos en dos, como el panel de Hoy.
export function Baldosas<T extends string>({
  baldosas,
  elegida,
  alPulsar,
}: {
  baldosas: Baldosa<T>[];
  elegida?: T | null;
  alPulsar: (clave: T) => void;
}) {
  return (
    <View style={estilos.rejilla}>
      {baldosas.map((b) => {
        const activa = b.clave === elegida;
        return (
          <Pressable
            key={b.clave}
            accessibilityRole="button"
            accessibilityLabel={b.lectura}
            accessibilityState={{ selected: activa }}
            onPress={() => alPulsar(b.clave)}
            style={({ pressed }) => [estilos.baldosa, activa && estilos.baldosaElegida, pressed && estilos.hundida]}>
            <View style={[estilos.icono, { backgroundColor: colorBaldosa.empresa.fondo }]}>
              <Ionicons name={b.icono} size={20} color={colorBaldosa.empresa.icono} />
            </View>
            {b.numero !== undefined ? (
              <Texto style={[estilos.numero, activa && estilos.textoElegido]}>{b.numero}</Texto>
            ) : null}
            <Texto
              pequeno={b.numero !== undefined}
              fuerte={b.numero === undefined}
              numberOfLines={2}
              style={[b.numero !== undefined ? estilos.etiqueta : estilos.etiquetaSola, activa && estilos.textoElegido]}>
              {b.etiqueta}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

// Tarjeta de "¿Seguro?" dentro de la pantalla (Alert no hace nada en la web).
export function Confirmar({
  texto,
  si,
  no = 'Cancelar',
  alSi,
  alNo,
}: {
  texto: string;
  si: string;
  no?: string;
  alSi: () => void;
  alNo: () => void;
}) {
  return (
    <Tarjeta style={estilos.confirmar}>
      <Texto>{texto}</Texto>
      <Boton titulo={si} onPress={alSi} />
      <Boton variante="secundario" titulo={no} onPress={alNo} />
    </Tarjeta>
  );
}

// Chip pequeño para elegir entre pocas cosas (personas, equipos) cuando no caben en casillas.
export function Chip({ texto, elegido, onPress }: { texto: string; elegido: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: elegido }}
      onPress={onPress}
      style={({ pressed }) => [estilos.chip, elegido && estilos.chipElegido, pressed && estilos.pulsado]}>
      <Texto style={elegido ? estilos.chipTextoElegido : undefined}>{texto}</Texto>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={estilos.chips}>{children}</View>;
}

const estilos = StyleSheet.create({
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: alturaTactil,
    paddingRight: espacio.s,
    marginLeft: -espacio.xs,
  },
  pulsado: { opacity: 0.75 },
  hundida: { transform: [{ scale: 0.97 }] },
  bien: { color: colores.texto },
  error: { color: colores.aviso },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 12,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
  },
  apagada: { backgroundColor: 'transparent' },
  textoApagado: { color: colores.textoSecundario },
  horas: { width: 48 },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte },
  horaFin: { ...cifras, fontFamily: fuentes.hora },
  textos: { flex: 1, gap: 2 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  baldosa: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    padding: espacio.m,
    gap: espacio.xs,
    borderRadius: radio.grande + 4,
    backgroundColor: colores.tarjeta,
  },
  baldosaElegida: { backgroundColor: colores.tinta },
  icono: { width: 36, height: 36, borderRadius: radio.normal, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fuentes.titulo, fontSize: 26, lineHeight: 32, marginTop: espacio.xs },
  etiqueta: { color: colores.textoSecundario },
  etiquetaSola: { marginTop: espacio.s },
  textoElegido: { color: colores.textoSobreTinta },
  confirmar: { gap: espacio.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    justifyContent: 'center',
    borderRadius: radio.pequeno,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
  },
  chipElegido: { backgroundColor: colores.texto, borderColor: colores.texto },
  chipTextoElegido: { color: colores.fondo, fontFamily: fuentes.textoMedio },
});
