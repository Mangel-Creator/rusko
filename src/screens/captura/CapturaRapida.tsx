import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { guardarEvento, useEventos, type Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { guardarAlarma, type Alarma } from '@/data/alarmas';
import { bloqueDeFocoQuePisa } from '@/services/agenda';
import { MAX_FRASE, interpretarFrase, type Interpretacion } from '@/services/captura';
import { dejarBorrador, type BorradorFicha } from '@/services/captura/borrador';
import { entenderPregunta, respuestaDelDia } from '@/services/consulta';
import { claveDia, fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';
import { callar, hablar } from '@/services/voz';
import { alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { useEstudioQuePisa } from '../epoca/useEpoca';
import { AvisoMicrofono, BotonMicrofono } from './BotonMicrofono';
import { TarjetaAlarma, alarmaDePropuesta, yaHaPasado } from './TarjetaAlarma';
import { TarjetaConfirmacion, eventoDePropuesta } from './TarjetaConfirmacion';
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
//
// Todo lo demás va a la IA (30/10/2026), que dice qué se pide: una cita o tarea (tarjeta
// "¿Lo guardo así?"), un recordatorio (la misma tarjeta, "¿Te lo recuerdo así?", con la
// hora del aviso), una alarma ("¿Pongo la alarma así?") o una pregunta que las reglas no
// pillaron (se contesta igual que arriba).
//
// Varias cosas en una frase (02/11/2026): «comida hoy por la tarde y pádel mañana por la
// mañana» trae una tarjeta por cosa, una detrás de otra («1 de 2»), y "Guardar las 2"
// guarda de golpe las que quedan tal cual.

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

function textoDia(fecha: ClaveDia): string {
  return formatearDiaCorto(fechaDesdeClave(fecha)).toLocaleLowerCase('es-ES');
}

function textoGuardado(evento: Evento): string {
  const dia = textoDia(evento.fecha);
  if (evento.flexible && evento.avisarA) return `Hecho: te recuerdo «${evento.titulo}» el ${dia} a las ${evento.avisarA}.`;
  const cuando = evento.horaInicio ? `${dia} a las ${evento.horaInicio}` : `${dia}, sin hora fija`;
  return `Apuntado: «${evento.titulo}», ${cuando}.`;
}

function textoAlarma(alarma: Alarma): string {
  return `Alarma puesta: ${textoDia(alarma.unaVezEl ?? claveDia(new Date()))} a las ${alarma.hora}.`;
}

export function CapturaRapida({ hoy, accesorio, plegada = false, alRellenarAMano, escucharAlAbrir, enfocar }: Props) {
  const { perfil } = usePerfil();
  const { eventos } = useEventos();
  const estudioQuePisa = useEstudioQuePisa();
  const [frase, setFrase] = useState('');
  const [pensando, setPensando] = useState(false);
  // Lo que queda por confirmar (citas, tareas y alarmas), la primera en pantalla.
  const [cola, setCola] = useState<Interpretacion[]>([]);
  const [total, setTotal] = useState(0);
  const [hechos, setHechos] = useState<string[]>([]);
  const [guardandoTodo, setGuardandoTodo] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [hablando, setHablando] = useState(false);
  const campo = useRef<TextInputInstance>(null);

  const enviar = async (texto: string) => {
    const limpia = texto.trim();
    if (!limpia || pensando) return;
    setFrase(limpia);
    setHecho(null);
    setCola([]);
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
      // La IA ha visto una pregunta que las reglas no pillaron («¿tengo algo el finde?»).
      const pregunta = resultado.interpretaciones.find((i) => i.accion === 'pregunta');
      if (pregunta?.accion === 'pregunta') decir(respuestaDelDia({ eventos, dia: pregunta.dia, ahora: new Date(), perfil }));
      const cosas = resultado.interpretaciones.filter((i) => i.accion !== 'pregunta');
      if (!cosas.length) setFrase('');
      setCola(cosas);
      setTotal(cosas.length);
      setHechos([]);
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

  // Pasa a la siguiente cosa; al acabar, dice todo lo que se ha guardado.
  const terminar = (mensaje: string | null) => {
    const resto = cola.slice(1);
    const mensajes = mensaje ? [...hechos, mensaje] : hechos;
    setCola(resto);
    setHechos(mensajes);
    if (resto.length) return;
    setFrase('');
    setHecho(mensajes.join(' ') || null);
  };

  // Lo que pisa un bloque de foco o de estudio no se guarda a ciegas: se queda en la
  // cola y su tarjeta pregunta, una a una.
  const guardarTodo = async () => {
    setGuardandoTodo(true);
    const mensajes = [...hechos];
    const pendientes: typeof cola = [];
    const todos = [...eventos];
    for (const i of cola) {
      if (i.accion === 'apuntar') {
        const evento = eventoDePropuesta(i.propuesta);
        if (bloqueDeFocoQuePisa(evento, todos) || estudioQuePisa(evento, todos)) {
          pendientes.push(i);
          continue;
        }
        await guardarEvento(evento);
        todos.push(evento);
        mensajes.push(textoGuardado(evento));
      } else if (i.accion === 'alarma' && !yaHaPasado(i.alarma.fecha, i.alarma.hora)) {
        const nueva = alarmaDePropuesta(i.alarma);
        await guardarAlarma(nueva);
        mensajes.push(textoAlarma(nueva));
      }
    }
    setGuardandoTodo(false);
    setCola(pendientes);
    setHechos(mensajes);
    if (pendientes.length) return;
    setFrase('');
    setHecho(mensajes.join(' ') || null);
  };

  const actual = cola[0];
  const propuesta = actual?.accion === 'apuntar' ? actual.propuesta : null;
  const alarma = actual?.accion === 'alarma' ? actual.alarma : null;

  const puedeEnviar = frase.trim().length > 0 && !pensando && !escuchando;

  // Plegada y sin nada en marcha: no enseña nada (pero sigue escuchando frases de fuera).
  if (plegada && !pensando && !propuesta && !alarma && !hecho && !respuesta && dictado.fase === 'quieto') return null;

  const ejemplos =
    'Una cita («cita del DNI el sábado a las 12»), algo que se repite («lunes y jueves de 6 a 8 clase de inglés, todo este mes»), un recordatorio («recuérdame mañana a las 6 llamar a mamá»), una alarma («pon una alarma a las 7»), varias cosas a la vez o «¿qué tengo el miércoles?».';
  const ayuda = dictado.disponible
    ? `Escríbelo como te salga o toca el micro y dímelo. ${ejemplos}`
    : `Escríbelo como te salga o díctalo con el micrófono del teclado. ${ejemplos}`;

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
          accessibilityHint="Escribe o dicta una cita, un recordatorio, una alarma o una pregunta por tu agenda."
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
      ) : !propuesta && !alarma && !respuesta && dictado.fase === 'quieto' ? (
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

      {alRellenarAMano && !propuesta && !alarma && !respuesta && !pensando && !escuchando ? (
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

      {cola.length && total > 1 ? (
        <View style={estilos.filaCola}>
          <Texto pequeno secundario accessibilityLiveRegion="polite" style={estilos.textoCola}>
            {total - cola.length + 1} de {total}
          </Texto>
          {cola.length > 1 ? (
            <Boton
              titulo={guardandoTodo ? 'Guardando…' : `Guardar las ${cola.length}`}
              variante="secundario"
              disabled={guardandoTodo}
              accessibilityLabel={`Guardar las ${cola.length} que quedan tal cual`}
              onPress={guardarTodo}
            />
          ) : null}
        </View>
      ) : null}

      {propuesta ? (
        <TarjetaConfirmacion
          key={`${cola.length}-${propuesta.titulo}-${propuesta.fecha}-${propuesta.horaInicio}`}
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

      {alarma ? (
        <TarjetaAlarma
          key={`alarma-${cola.length}-${alarma.fecha}-${alarma.hora}`}
          alarma={alarma}
          alGuardar={(nueva) => terminar(textoAlarma(nueva))}
          alCancelar={() => terminar(null)}
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
  filaCola: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  textoCola: { flex: 1 },
  filaRespuesta: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  textoRespuesta: { flex: 1 },
  botonesRespuesta: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
});
