import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { textoDiaCorto } from '@/services/correo';
import { sumarDias, type ClaveDia } from '@/services/fechas';
import { alturaTactil, cifras, coloresNivel, espacio, fuentes, radio, tamanos, type NivelCorreo } from '@/theme';

// Un correo en la bandeja de Correo como recuadro de color (27/10/2026): rojo muy
// importante, naranja importante, azul medio y blanco poco (coloresNivel en el tema).
// Enseña el remitente, la hora, el asunto acortado y, si trae fecha, «Tienes X el día Y».
// Al tocarlo se abre y dice de qué trata en una o dos frases; debajo van las acciones
// que le pase la pantalla (abrir en Gmail, vetar…).
// Siempre a la vista, tres botones: eliminar (de Rusko, con confirmación), fijar arriba
// y poner un recordatorio.

type Props = {
  nivel: NivelCorreo;
  fijado: boolean;
  asunto: string;
  de: string;
  hora: string;
  resumen: string | null;
  cuando?: string | null; // «Tienes la entrega el jue 29 oct»
  nuevo?: boolean;
  conRecordatorio?: boolean;
  alEliminar: () => void;
  alFijar: () => void;
  alRecordar: () => void;
  children?: ReactNode;
};

const NOMBRE_NIVEL: Record<NivelCorreo, string> = {
  3: 'Muy importante',
  2: 'Importante',
  1: 'Medio',
  0: 'Poco importante',
};

// «Tienes X el día Y», sin llamar al usuario por su nombre.
export function textoTienes(que: string, dia: ClaveDia, hoy: ClaveDia, hora?: string | null): string {
  const a = hora ? ` a las ${hora}` : '';
  if (dia === hoy) return `Tienes ${que} hoy${a}`;
  if (dia === sumarDias(hoy, 1)) return `Tienes ${que} mañana${a}`;
  return `${dia < hoy ? 'Tenías' : 'Tienes'} ${que} el ${textoDiaCorto(dia)}${a}`;
}

// Fijados arriba; luego de más a menos importante y, dentro de cada nivel, lo más nuevo.
export function porImportancia<T extends { nivel: NivelCorreo; fijado: boolean; recibido: string }>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => Number(b.fijado) - Number(a.fijado) || b.nivel - a.nivel || b.recibido.localeCompare(a.recibido),
  );
}

export function RecuadroCorreo({
  nivel,
  fijado,
  asunto,
  de,
  hora,
  resumen,
  cuando,
  nuevo,
  conRecordatorio,
  alEliminar,
  alFijar,
  alRecordar,
  children,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const c = coloresNivel[nivel];
  const texto = { color: c.texto };
  const secundario = { color: c.secundario };

  return (
    <View style={[estilos.recuadro, { backgroundColor: c.fondo, borderColor: c.borde }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={[
          nuevo ? 'Nuevo.' : '',
          fijado ? 'Fijado.' : '',
          `${NOMBRE_NIVEL[nivel]}.`,
          `${asunto}.`,
          `De ${de}, a las ${hora}.`,
          cuando ? `${cuando}.` : '',
        ].join(' ')}
        accessibilityHint={abierto ? 'Cierra el resumen' : 'Dice de qué trata'}
        onPress={() => setAbierto((a) => !a)}
        style={({ pressed }) => [estilos.cuerpo, pressed && estilos.pulsado]}>
        <View style={estilos.lineaDe}>
          {fijado ? <Ionicons name="pin" size={14} color={c.texto} /> : null}
          {nuevo ? <View style={[estilos.punto, { backgroundColor: c.texto }]} /> : null}
          <Texto pequeno numberOfLines={1} style={[estilos.de, secundario]}>
            {de}
          </Texto>
          <Texto pequeno style={[estilos.hora, secundario]}>
            {hora}
          </Texto>
        </View>
        <Texto fuerte numberOfLines={abierto ? undefined : 2} style={[estilos.asunto, texto]}>
          {asunto}
        </Texto>
        {cuando ? (
          <Texto pequeno fuerte style={texto}>
            {cuando}
          </Texto>
        ) : null}
        {abierto ? (
          <Texto style={[estilos.resumen, texto]}>{resumen ?? 'Aún no tengo un resumen de este correo.'}</Texto>
        ) : null}
      </Pressable>

      {eliminando ? (
        <View style={[estilos.confirmar, { backgroundColor: c.boton }]}>
          <Texto pequeno style={texto}>
            ¿Lo quito de Rusko? En tu correo sigue igual.
          </Texto>
          <View style={estilos.botones}>
            <Pildora etiqueta="Quitar" color={c.texto} fondo={c.boton} onPress={alEliminar} />
            <Pildora etiqueta="Mejor no" color={c.texto} fondo="transparent" onPress={() => setEliminando(false)} />
          </View>
        </View>
      ) : (
        <View style={estilos.botones}>
          <BotonIcono icono="trash-outline" etiqueta={`Quitar «${asunto}» de Rusko`} color={c.texto} fondo={c.boton} onPress={() => setEliminando(true)} />
          <BotonIcono
            icono={fijado ? 'pin' : 'pin-outline'}
            etiqueta={fijado ? 'Dejar de fijar' : 'Fijar arriba'}
            color={c.texto}
            fondo={c.boton}
            onPress={alFijar}
          />
          <BotonIcono
            icono={conRecordatorio ? 'alarm' : 'alarm-outline'}
            etiqueta={conRecordatorio ? 'Cambiar el recordatorio' : 'Ponerme un recordatorio'}
            color={c.texto}
            fondo={c.boton}
            onPress={alRecordar}
          />
        </View>
      )}

      {abierto && children ? <View style={estilos.mas}>{children}</View> : null}
    </View>
  );
}

type PropsBoton = {
  icono: ComponentProps<typeof Ionicons>['name'];
  etiqueta: string;
  color: string;
  fondo: string;
  onPress: () => void;
};

function BotonIcono({ icono, etiqueta, color, fondo, onPress }: PropsBoton) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [estilos.icono, { backgroundColor: fondo }, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={20} color={color} />
    </Pressable>
  );
}

function Pildora({ etiqueta, color, fondo, onPress }: Omit<PropsBoton, 'icono'>) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [estilos.pildora, { backgroundColor: fondo, borderColor: color }, pressed && estilos.pulsado]}>
      <Texto pequeno fuerte style={{ color }}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  recuadro: {
    borderRadius: radio.grande,
    borderWidth: 1,
    padding: espacio.m,
    gap: espacio.s,
    overflow: 'hidden',
  },
  cuerpo: { gap: espacio.xs },
  pulsado: { opacity: 0.8 },
  lineaDe: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 8, height: 8, borderRadius: radio.chip },
  de: { flexShrink: 1, fontFamily: fuentes.textoMedio },
  hora: { marginLeft: 'auto', ...cifras, fontFamily: fuentes.hora },
  asunto: { fontSize: tamanos.grande, lineHeight: 24, fontFamily: fuentes.titulo, letterSpacing: -0.3 },
  resumen: { marginTop: espacio.xs },
  botones: { flexDirection: 'row', gap: espacio.s },
  icono: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmar: { gap: espacio.s, padding: espacio.s, borderRadius: radio.normal },
  pildora: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    borderWidth: 1,
  },
  mas: { gap: espacio.s },
});
