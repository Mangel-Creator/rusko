import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import {
  alturaTactil,
  cifras,
  colores,
  coloresNivel,
  duracion,
  espacio,
  fuentes,
  radio,
  tamanos,
  type NivelCorreo,
} from '@/theme';

// Un correo en la bandeja de Correo como recuadro de color (27/10/2026): rojo muy
// importante, naranja importante, azul medio y blanco poco (coloresNivel en el tema).
// Enseña el remitente, la hora, el asunto acortado y, si trae fecha, «Tienes X el día Y».
// Al tocarlo se abre y dice de qué trata en una o dos frases; debajo van las acciones
// que le pase la pantalla (abrir en Gmail, vetar…).
// Las acciones van deslizando (28/10/2026, lo pidió el usuario para no darles sin querer):
// - a la izquierda aparecen fijar (ámbar) y recordatorio (blanco; abre las opciones
//   dentro del recuadro);
// - a la derecha, la papelera (rojo), que lo quita de Rusko al tocarla; deslizando mucho
//   (más de la mitad del ancho) se quita directamente.
// Con el lector de pantalla, las tres van como acciones del recuadro. Debajo de la fecha,
// a la vista, lo que pase la pantalla en `aviso` (el «¿Eliminar cita?»).

type Props = {
  nivel: NivelCorreo;
  fijado: boolean;
  asunto: string;
  de: string;
  hora: string;
  resumen: string | null;
  cuando?: string | null; // «Tienes dentista el jueves 12 de noviembre»
  nuevo?: boolean;
  recordatorio?: string | null; // «Te lo recuerdo mañana a las 09:00»
  opcionesRecordar: { clave: string; texto: string; alElegir: () => void }[];
  alQuitarRecordatorio: () => void;
  alEliminar: () => void;
  alFijar: () => void;
  aviso?: ReactNode; // siempre a la vista
  children?: ReactNode; // al abrirlo
};

const NOMBRE_NIVEL: Record<NivelCorreo, string> = {
  3: 'Muy importante',
  2: 'Importante',
  1: 'Medio',
  0: 'Poco importante',
};

// Colores de lo que sale al deslizar (solo aquí, como los de los recuadros): ámbar para
// fijar, blanco para el recordatorio y rojo para quitar; los iconos, en oscuro encima.
const COLOR_FIJAR = colores.dorado;
const COLOR_RECORDAR = colores.texto;
const COLOR_QUITAR = colores.aviso;
const ANCHO_BOTON = 76;
const ABIERTO_IZQ = -2 * ANCHO_BOTON; // se ven fijar y recordatorio
const ABIERTO_DER = ANCHO_BOTON; // se ve la papelera
const EMPEZAR = 12; // px en horizontal antes de considerar que se desliza

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
  recordatorio,
  opcionesRecordar,
  alQuitarRecordatorio,
  alEliminar,
  alFijar,
  aviso,
  children,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [recordando, setRecordando] = useState(false);
  const desliza = useDeslizar(alEliminar);
  const c = coloresNivel[nivel];
  const texto = { color: c.texto };
  const secundario = { color: c.secundario };

  const fijar = () => {
    desliza.cerrar();
    alFijar();
  };
  const recordar = () => {
    desliza.cerrar();
    setRecordando((r) => !r);
  };

  return (
    <View style={estilos.envoltura} onLayout={(e) => desliza.medir(e.nativeEvent.layout.width)}>
      {/* Lo que queda debajo: la papelera a la izquierda (se ve al deslizar a la derecha)
          y fijar y recordatorio a la derecha (se ven al deslizar a la izquierda). */}
      <View style={estilos.fondoAcciones} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[estilos.lado, { opacity: desliza.verQuitar }]}>
          <BotonDeslizar icono="trash" etiqueta="Quitar" fondo={COLOR_QUITAR} onPress={desliza.quitar} />
        </Animated.View>
        <Animated.View style={[estilos.lado, estilos.ladoDerecho, { opacity: desliza.verFijar }]}>
          <BotonDeslizar
            icono={fijado ? 'pin' : 'pin-outline'}
            etiqueta={fijado ? 'Soltar' : 'Fijar'}
            fondo={COLOR_FIJAR}
            onPress={fijar}
          />
          <BotonDeslizar
            icono={recordatorio ? 'alarm' : 'alarm-outline'}
            etiqueta="Recordar"
            fondo={COLOR_RECORDAR}
            onPress={recordar}
          />
        </Animated.View>
      </View>

      <Animated.View
        {...desliza.manejadores}
        style={[
          estilos.recuadro,
          { backgroundColor: c.fondo, borderColor: c.borde, transform: [{ translateX: desliza.x }] },
          Platform.OS === 'web' ? ({ touchAction: 'pan-y', userSelect: 'none' } as object) : null,
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: abierto }}
          accessibilityLabel={[
            nuevo ? 'Nuevo.' : '',
            fijado ? 'Fijado.' : '',
            `${NOMBRE_NIVEL[nivel]}.`,
            `${asunto}.`,
            `De ${de}, ${hora}.`,
            cuando ? `${cuando}.` : '',
            recordatorio ? `${recordatorio}.` : '',
          ].join(' ')}
          accessibilityHint={abierto ? 'Cierra el resumen' : 'Dice de qué trata'}
          accessibilityActions={[
            { name: 'fijar', label: fijado ? 'Dejar de fijar' : 'Fijar arriba' },
            { name: 'recordar', label: recordatorio ? 'Cambiar el recordatorio' : 'Ponerme un recordatorio' },
            { name: 'quitar', label: 'Quitar de Rusko' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'fijar') alFijar();
            else if (e.nativeEvent.actionName === 'recordar') setRecordando((r) => !r);
            else if (e.nativeEvent.actionName === 'quitar') alEliminar();
          }}
          onPress={() => {
            // Un toque con el recuadro deslizado lo devuelve a su sitio.
            if (desliza.abierto()) desliza.cerrar();
            else setAbierto((a) => !a);
          }}
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
          {recordatorio ? (
            <View style={estilos.lineaDe}>
              <Ionicons name="alarm" size={14} color={c.texto} />
              <Texto pequeno style={secundario}>
                {recordatorio}
              </Texto>
            </View>
          ) : null}
          {abierto ? (
            <Texto style={[estilos.resumen, texto]}>{resumen || 'Aún no tengo un resumen de este correo.'}</Texto>
          ) : null}
        </Pressable>

        {aviso}

        {recordando ? (
          <View style={[estilos.panel, { backgroundColor: c.boton }]}>
            <Texto pequeno style={texto}>
              ¿Cuándo te lo recuerdo?
            </Texto>
            <View style={estilos.pildoras}>
              {opcionesRecordar.map((o) => (
                <Pildora
                  key={o.clave}
                  etiqueta={o.texto}
                  color={c.texto}
                  fondo="transparent"
                  onPress={() => {
                    o.alElegir();
                    setRecordando(false);
                  }}
                />
              ))}
              {recordatorio ? (
                <Pildora
                  etiqueta="Quitar el recordatorio"
                  color={c.texto}
                  fondo={c.boton}
                  onPress={() => {
                    alQuitarRecordatorio();
                    setRecordando(false);
                  }}
                />
              ) : null}
              <Pildora etiqueta="Mejor no" color={c.texto} fondo="transparent" onPress={() => setRecordando(false)} />
            </View>
          </View>
        ) : null}

        {abierto && children ? <View style={estilos.mas}>{children}</View> : null}
      </Animated.View>
    </View>
  );
}

// El deslizamiento del recuadro, con PanResponder (va en la web sin montar nada más).
// Solo coge el gesto si es claramente horizontal, así la lista sigue bajando con el dedo.
function useDeslizar(alQuitar: () => void) {
  const [control] = useState(crearDeslizar);
  useEffect(() => control.alQuitar(alQuitar), [control, alQuitar]);
  return control;
}

// Se crea una vez por recuadro; guarda dentro dónde se quedó y el ancho.
function crearDeslizar() {
  const x = new Animated.Value(0);
  let base = 0;
  let ancho = 360;
  let alQuitar = () => {};

  const mover = (a: number, luego?: () => void) => {
    base = a;
    Animated.timing(x, { toValue: a, duration: duracion.normal, useNativeDriver: Platform.OS !== 'web' }).start(() =>
      luego?.(),
    );
  };
  const quitar = () => mover(ancho + 40, () => alQuitar());
  const horizontal = (g: { dx: number; dy: number }) => Math.abs(g.dx) > EMPEZAR && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => horizontal(g),
    onMoveShouldSetPanResponderCapture: (_, g) => horizontal(g),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const a = base + g.dx;
      // A la izquierda, con resistencia pasados los dos botones.
      x.setValue(a < ABIERTO_IZQ ? ABIERTO_IZQ + (a - ABIERTO_IZQ) / 3 : a);
    },
    onPanResponderRelease: (_, g) => {
      const a = base + g.dx;
      if (a > ancho * 0.5) quitar();
      else if (a > ABIERTO_DER * 0.6) mover(ABIERTO_DER);
      else if (a < ABIERTO_IZQ * 0.4) mover(ABIERTO_IZQ);
      else mover(0);
    },
    onPanResponderTerminate: () => mover(base),
  });

  return {
    x,
    manejadores: responder.panHandlers,
    // Lo de debajo solo se ve por el lado hacia el que se desliza.
    verQuitar: x.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    verFijar: x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
    medir: (a: number) => {
      ancho = a;
    },
    alQuitar: (fn: () => void) => {
      alQuitar = fn;
    },
    abierto: () => base !== 0,
    cerrar: () => mover(0),
    quitar,
  };
}

function BotonDeslizar({
  icono,
  etiqueta,
  fondo,
  onPress,
}: {
  icono: ComponentProps<typeof Ionicons>['name'];
  etiqueta: string;
  fondo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [estilos.botonDeslizar, { backgroundColor: fondo }, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={22} color={colores.textoOscuro} />
      <Texto pequeno fuerte style={{ color: colores.textoOscuro }}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

function Pildora({
  etiqueta,
  color,
  fondo,
  onPress,
}: {
  etiqueta: string;
  color: string;
  fondo: string;
  onPress: () => void;
}) {
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
  envoltura: { borderRadius: radio.grande, overflow: 'hidden' },
  fondoAcciones: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'space-between' },
  lado: { flexDirection: 'row' },
  ladoDerecho: { marginLeft: 'auto' },
  botonDeslizar: {
    width: ANCHO_BOTON,
    minHeight: alturaTactil,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
  },
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
  pildoras: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  panel: { gap: espacio.s, padding: espacio.s + 4, borderRadius: radio.normal },
  pildora: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    borderWidth: 1,
  },
  mas: { gap: espacio.s },
});
