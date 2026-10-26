import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { useEventos, type Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { MAX_FRASE, interpretarFrase, type Propuesta } from '@/services/captura';
import { dejarBorrador, type BorradorFicha } from '@/services/captura/borrador';
import { entenderPregunta, respuestaDelDia } from '@/services/consulta';
import { fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';
import { callar, hablar } from '@/services/voz';
import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { AvisoMicrofono, BotonMicrofono } from './BotonMicrofono';
import { TarjetaConfirmacion } from './TarjetaConfirmacion';
import { useDictado } from './useDictado';

// Captura rápida (fase 5): escribes (o dictas con el micrófono del teclado)
// «pádel con Javi el jueves a las 8» y la IA rellena el evento. Sale una tarjeta
// para confirmarlo: nada se guarda sin pulsar "Guardar". Si no hay conexión,
// algo falla o la IA no lo tiene claro, se abre la ficha normal con la frase
// como título.
//
// "accesorio" deja poner otro botón junto al de enviar (el micrófono de la fase 9).
// "plegada": en Hoy va escondida hasta que se toca el "+" (lo pidió el usuario para
// que Hoy respire). Sigue montada aunque no se vea, así que enviarFraseACaptura
// funciona igual: si llega una frase de fuera, se despliega sola mientras piensa.
// "alRellenarAMano" pone el enlace para abrir la ficha vacía.
//
// Micro (fase 9): si el móvil o el navegador sabe pasar voz a texto, sale un botón de
// micro. Lo que dices va apareciendo en el campo y al terminar se envía igual que lo
// escrito (misma IA, misma tarjeta de confirmación). En Expo Go no sale (no trae el
// módulo): queda el micro del teclado. "escucharAlAbrir" (un número que cambia cada
// vez) empieza a escuchar sin tocar nada: lo usan /?voz=1, los accesos directos y el
// widget. En la web no, porque el navegador solo deja usar el micro tras un toque.
// "enfocar" (otro número que cambia) pone el cursor en el campo.
//
// Preguntas por la agenda, sin IA (26/10/2026): «¿qué tengo el miércoles?», «¿tengo algo
// mañana?», «¿qué hay el 5 de noviembre?»... no van a la IA: se contestan aquí con
// reglas (services/consulta) y la respuesta se lee en voz alta (services/voz).

type Props = {
  hoy: ClaveDia;
  accesorio?: ReactNode;
  plegada?: boolean;
  alRellenarAMano?: () => void;
  escucharAlAbrir?: number;
  enfocar?: number;
};

// Para mandar una frase desde fuera (por ejemplo, la voz de la fase 9): la pone
// en el campo y la envía como si se hubiera escrito. Devuelve false si Hoy no
// está abierta.
let enviarDesdeFuera: ((frase: string) => void) | null = null;
export function enviarFraseACaptura(frase: string): boolean {
  if (!enviarDesdeFuera) return false;
  enviarDesdeFuera(frase);
  return true;
}

function abrirFicha(borrador: BorradorFicha, hoy: ClaveDia) {
  const propuesta = dejarBorrador(borrador);
  router.push({ pathname: '/evento', params: { fecha: borrador.fecha ?? hoy, propuesta } });
}

function textoGuardado(evento: Evento): string {
  const dia = formatearDiaCorto(fechaDesdeClave(evento.fecha)).toLocaleLowerCase('es-ES');
  const cuando = evento.horaInicio ? `${dia} a las ${evento.horaInicio}` : `${dia}, sin hora fija`;
  return `Apuntado: «${evento.titulo}», ${cuando}.`;
}

export function CapturaRapida({ hoy, accesorio, plegada = false, alRellenarAMano, escucharAlAbrir, enfocar }: Props) {
  const { perfil } = usePerfil();
  const { eventos } = useEventos();
  const [frase, setFrase] = useState('');
  const [pensando, setPensando] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [hablando, setHablando] = useState(false);
  const campo = useRef<TextInputInstance>(null);

  const enviar = async (texto: string) => {
    const limpia = texto.trim();
    if (!limpia || pensando) return;
    setFrase(limpia);
    setHecho(null);
    setPropuesta(null);
    // «¿Qué tengo el miércoles?»: se contesta aquí, sin IA, y se lee en voz alta.
    const dia = entenderPregunta(limpia, hoy);
    if (dia) {
      campo.current?.blur();
      setFrase('');
      decir(respuestaDelDia({ eventos, dia, ahora: new Date(), perfil }));
      return;
    }
    setRespuesta(null);
    setPensando(true);
    campo.current?.blur();
    const resultado = await interpretarFrase(limpia, perfil, eventos);
    setPensando(false);
    if (resultado.estado === 'ok') {
      setPropuesta(resultado.propuesta);
      return;
    }
    // Sin conexión, error o poca confianza: la ficha normal con la frase como título.
    abrirFicha({ titulo: limpia.charAt(0).toLocaleUpperCase('es-ES') + limpia.slice(1), mensaje: resultado.mensaje }, hoy);
    setFrase('');
  };

  // Al salir de Hoy se calla.
  useEffect(() => () => callar(), []);

  const decir = (texto: string) => {
    setRespuesta(texto);
    setHablando(true);
    hablar(texto, () => setHablando(false));
  };

  const cerrarRespuesta = () => {
    callar();
    setHablando(false);
    setRespuesta(null);
  };

  useEffect(() => {
    enviarDesdeFuera = (texto) => {
      setFrase(texto);
      enviar(texto);
    };
    return () => {
      enviarDesdeFuera = null;
    };
  });

  const dictado = useDictado({
    alOir: (texto) => {
      setFrase(texto);
      setHecho(null);
    },
    alTerminar: (texto) => enviar(texto),
  });
  const escuchando = dictado.fase === 'escuchando';

  // Cada vez que llega un número nuevo en escucharAlAbrir, empieza a escuchar solo.
  const ultimaEscucha = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!escucharAlAbrir || escucharAlAbrir === ultimaEscucha.current) return;
    ultimaEscucha.current = escucharAlAbrir;
    if (dictado.disponible && Platform.OS !== 'web' && !escuchando) dictado.pulsar();
  });

  // Cada número nuevo en "enfocar" pone el cursor en el campo (el "Apuntar" de Hoy).
  const ultimoEnfoque = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!enfocar || enfocar === ultimoEnfoque.current) return;
    ultimoEnfoque.current = enfocar;
    campo.current?.focus();
  });

  const terminar = (mensaje: string | null) => {
    setPropuesta(null);
    setFrase('');
    setHecho(mensaje);
  };

  const puedeEnviar = frase.trim().length > 0 && !pensando && !escuchando;

  // Plegada y sin nada en marcha: no enseña nada (pero sigue escuchando frases de fuera).
  if (plegada && !pensando && !propuesta && !hecho && !respuesta && dictado.fase === 'quieto') return null;

  const ayuda = dictado.disponible
    ? 'Escríbelo como te salga, o toca el micro y dímelo. También puedes preguntarme «¿qué tengo el miércoles?».'
    : 'Escríbelo como te salga, o díctalo con el micrófono del teclado. También puedes preguntarme «¿qué tengo el miércoles?».';

  return (
    <View style={estilos.contenedor}>
      <Titulo nivel={3}>¿Qué apunto?</Titulo>
      <View style={estilos.fila}>
        <TextInput
          ref={campo}
          value={frase}
          onChangeText={(t) => {
            setFrase(t);
            setHecho(null);
          }}
          onSubmitEditing={() => enviar(frase)}
          placeholder={escuchando ? 'Te escucho…' : 'mañana pádel por la tarde'}
          placeholderTextColor={colores.textoSecundario}
          accessibilityLabel="Captura rápida"
          accessibilityHint="Escribe o dicta lo que tienes que hacer y te preparo el evento."
          maxLength={MAX_FRASE}
          editable={!pensando && !escuchando}
          returnKeyType="send"
          submitBehavior="blurAndSubmit"
          autoCapitalize="none"
          style={estilos.campo}
        />
        {accesorio}
        {dictado.disponible ? (
          <BotonMicrofono escuchando={escuchando} desactivado={pensando} alPulsar={dictado.pulsar} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !puedeEnviar, busy: pensando }}
          disabled={!puedeEnviar}
          onPress={() => enviar(frase)}
          style={({ pressed }) => [
            estilos.enviar,
            !puedeEnviar && !pensando && estilos.enviarApagado,
            pressed && estilos.pulsado,
          ]}>
          {pensando ? (
            <ActivityIndicator color={colores.textoSobrePrincipal} />
          ) : (
            <Ionicons name="arrow-up" size={24} color={colores.textoSobrePrincipal} />
          )}
        </Pressable>
      </View>

      <AvisoMicrofono
        fase={dictado.fase}
        alAceptar={dictado.aceptar}
        alCerrar={dictado.cerrar}
        alAbrirAjustes={dictado.abrirAjustes}
      />

      {pensando ? (
        <Texto pequeno secundario accessibilityLiveRegion="polite">
          Un segundo, lo estoy apuntando…
        </Texto>
      ) : escuchando ? (
        <Texto pequeno secundario accessibilityLiveRegion="polite">
          Te escucho. Para terminar, calla un momento o toca el cuadrado.
        </Texto>
      ) : dictado.mensaje ? (
        <Texto pequeno style={estilos.fallo} accessibilityLiveRegion="polite">
          {dictado.mensaje}
        </Texto>
      ) : hecho ? (
        <Texto pequeno accessibilityLiveRegion="polite">
          {hecho}
        </Texto>
      ) : !propuesta && !respuesta && dictado.fase === 'quieto' ? (
        <Texto pequeno secundario>{ayuda}</Texto>
      ) : null}

      {respuesta ? (
        <Tarjeta style={estilos.respuesta}>
          <View style={estilos.filaRespuesta}>
            <Ionicons name={hablando ? 'volume-high' : 'chatbubble-ellipses-outline'} size={22} color={colores.principal} />
            <Texto style={estilos.textoRespuesta} accessibilityLiveRegion="polite">
              {respuesta}
            </Texto>
          </View>
          <View style={estilos.botonesRespuesta}>
            <Boton
              titulo={hablando ? 'Callar' : 'Escuchar'}
              variante="secundario"
              accessibilityLabel={hablando ? 'Dejar de leer la respuesta' : 'Leer la respuesta en voz alta'}
              onPress={() => {
                if (hablando) {
                  callar();
                  setHablando(false);
                } else {
                  decir(respuesta);
                }
              }}
            />
            <Boton titulo="Cerrar" variante="secundario" onPress={cerrarRespuesta} />
          </View>
        </Tarjeta>
      ) : null}

      {alRellenarAMano && !propuesta && !respuesta && !pensando && !escuchando ? (
        <Pressable
          accessibilityRole="button"
          onPress={alRellenarAMano}
          style={({ pressed }) => [estilos.enlace, pressed && estilos.pulsado]}>
          <Ionicons name="create-outline" size={18} color={colores.principal} />
          <Texto fuerte style={estilos.textoEnlace}>
            Mejor lo relleno a mano
          </Texto>
        </Pressable>
      ) : null}

      {propuesta ? (
        <TarjetaConfirmacion
          key={`${propuesta.titulo}-${propuesta.fecha}-${propuesta.horaInicio}`}
          propuesta={propuesta}
          perfil={perfil}
          alGuardar={(evento) => terminar(textoGuardado(evento))}
          alCancelar={() => terminar(null)}
          alMasOpciones={(borrador) => {
            terminar(null);
            abrirFicha(borrador, hoy);
          }}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  campo: {
    flex: 1,
    minWidth: 0, // en la web el campo no encoge solo y empujaba fuera el botón de enviar
    minHeight: alturaTactil + 8,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    borderRadius: radio.chip,
    paddingHorizontal: espacio.m + 4,
    fontFamily: fuentes.texto,
    fontSize: tamanos.normal,
    color: colores.texto,
  },
  enviar: {
    width: alturaTactil + 8,
    height: alturaTactil + 8,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Apagado sin opacidad: el naranja pasa a gris, y el icono sigue viéndose.
  enviarApagado: { backgroundColor: colores.cargaNormal },
  pulsado: { transform: [{ scale: 0.94 }] },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    alignSelf: 'flex-start',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  textoEnlace: { color: colores.principal },
  fallo: { color: colores.aviso },
  respuesta: { gap: espacio.m },
  filaRespuesta: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  textoRespuesta: { flex: 1 },
  botonesRespuesta: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
});
