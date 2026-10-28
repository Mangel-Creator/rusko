import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Plegable, SelectorVisual, Tarjeta, Texto, type OpcionVisual } from '@/components';
import { useCalendarios, type Calendario } from '@/data/calendarios';
import { useEventos } from '@/data/eventos';
import type { TipoEvento } from '@/data/eventos/tipos';
import {
  actualizarCalendario,
  anadirCalendario,
  dejarDeTraer,
  desfasado,
  eventosDeCalendario,
} from '@/services/calendarios';
import { cuandoFue } from '@/services/fechas';
import { colorTipo, colores, espacio } from '@/theme';

import { MensajeError } from '../formulario-perfil/MensajeError';

const TIPOS: OpcionVisual<TipoEvento>[] = [
  { valor: 'yo', etiqueta: 'Míos', icono: 'person' },
  { valor: 'amigos', etiqueta: 'Amigos', icono: 'people' },
  { valor: 'cliente', etiqueta: 'Clientes', icono: 'briefcase' },
  { valor: 'entreno', etiqueta: 'Entrenos', icono: 'barbell' },
  { valor: 'estudios', etiqueta: 'Estudios', icono: 'school' },
];

const PASOS_GOOGLE = [
  'En el ordenador, entra en calendar.google.com.',
  'A la izquierda, en «Mis calendarios», pon el ratón sobre el tuyo, toca los tres puntos y «Configuración y uso compartido».',
  'Baja hasta «Dirección secreta en formato iCal» y cópiala (acaba en .ics).',
  'No se la pases a nadie: con ella se ve tu calendario.',
];

const PASOS_ICLOUD = [
  'En el iPhone, abre Calendario y toca «Calendarios» abajo.',
  'Toca la «i» junto al calendario que quieras traer.',
  'Activa «Calendario público» y toca «Compartir enlace…» > «Copiar».',
  'Ojo: quien tenga ese enlace puede ver ese calendario. El enlace es largo y no se puede adivinar.',
];

// Perfil > "Tus otros calendarios": traer Google Calendar, iCloud u Outlook a Organizy
// con su enlace iCal (services/calendarios). Lo traído son eventos normales de Organizy.
export function SeccionCalendarios() {
  const { cargado, calendarios } = useCalendarios();
  const { eventos } = useEventos();
  const [enlace, setEnlace] = useState('');
  const [tipo, setTipo] = useState<TipoEvento>('yo');
  const [ocupado, setOcupado] = useState<string | null>(null); // id del calendario, o "nuevo"
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<Calendario | null>(null);

  const traer = async () => {
    setMensaje(null);
    setError(null);
    setOcupado('nuevo');
    const resultado = await anadirCalendario(enlace, tipo);
    setOcupado(null);
    if (resultado.ok) {
      setMensaje(resultado.mensaje);
      setEnlace('');
    } else {
      setError(resultado.error);
    }
  };

  const actualizar = async (calendario: Calendario) => {
    setMensaje(null);
    setError(null);
    setOcupado(calendario.id);
    const resultado = await actualizarCalendario(calendario);
    setOcupado(null);
    if (resultado.ok) setMensaje(`${calendario.nombre}: ${resultado.mensaje}`);
    else setError(resultado.error);
  };

  const quitar = async (borrarEventos: boolean) => {
    if (!quitando) return;
    await dejarDeTraer(quitando, borrarEventos);
    setMensaje(
      borrarEventos
        ? `He quitado ${quitando.nombre} y sus eventos.`
        : `He quitado ${quitando.nombre}. Sus eventos se quedan en Rusko.`,
    );
    setQuitando(null);
  };

  return (
    <>
      <Texto secundario>
        Trae a Rusko lo que tienes en Google Calendar, iCloud u Outlook. Pegas su enlace una vez
        y lo nuevo llega solo cada vez que abres la app. Si cambias aquí un evento traído, manda lo
        tuyo.
      </Texto>

      {cargado
        ? calendarios.map((calendario) => {
            const cuantos = eventosDeCalendario(eventos, calendario.id);
            return (
              <View key={calendario.id} style={[estilos.fila, { borderLeftColor: colorTipo[calendario.tipo] }]}>
                <Texto fuerte>{calendario.nombre}</Texto>
                <Texto pequeno secundario>
                  {cuantos === 1 ? '1 evento' : `${cuantos} eventos`}
                  {calendario.ultimaVez
                    ? ` · traído ${cuandoFue(new Date(calendario.ultimaVez), new Date())}`
                    : ''}
                  {calendario.todoElDia > 0 ? ` · ${calendario.todoElDia} de todo el día sin traer` : ''}
                </Texto>
                {calendario.error || desfasado(calendario, new Date()) ? (
                  <Texto pequeno fuerte style={estilos.aviso}>
                    {calendario.error ?? 'Hace mucho que no se trae: toca «Traer ahora».'}
                  </Texto>
                ) : null}
                <View style={estilos.botones}>
                  <Boton
                    variante="secundario"
                    titulo={ocupado === calendario.id ? 'Trayendo…' : 'Traer ahora'}
                    disabled={ocupado !== null}
                    onPress={() => actualizar(calendario)}
                    style={estilos.boton}
                  />
                  <Boton
                    variante="secundario"
                    titulo="Quitar"
                    disabled={ocupado !== null}
                    onPress={() => setQuitando(calendario)}
                    style={estilos.boton}
                  />
                </View>
              </View>
            );
          })
        : null}

      {quitando ? (
        <Tarjeta accessibilityLiveRegion="polite">
          <Texto fuerte>¿Qué hago con los eventos que trajo {quitando.nombre}?</Texto>
          <Texto pequeno secundario>
            Los que hayas cambiado en Rusko se quedan siempre.
          </Texto>
          <Boton titulo="Quedármelos en Rusko" onPress={() => quitar(false)} />
          <Boton variante="secundario" titulo="Borrarlos" onPress={() => quitar(true)} />
          <Boton variante="secundario" titulo="Cancelar" onPress={() => setQuitando(null)} />
        </Tarjeta>
      ) : null}

      <CampoTexto
        etiqueta={calendarios.length > 0 ? 'Traer otro calendario' : 'Enlace del calendario'}
        placeholder="https://… o webcal://…"
        value={enlace}
        onChangeText={setEnlace}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        ayuda="El enlace iCal de tu calendario. Abajo te explico dónde está."
      />
      <SelectorVisual etiqueta="¿Qué son sus eventos?" opciones={TIPOS} valor={tipo} alCambiar={setTipo} />
      <Boton
        titulo={ocupado === 'nuevo' ? 'Trayendo…' : 'Traer eventos'}
        disabled={ocupado !== null || !enlace.trim()}
        onPress={traer}
      />
      {mensaje ? (
        <Texto fuerte accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}
      <MensajeError texto={error} />

      <Plegable titulo="Dónde está el enlace" resumen="Google Calendar e iCloud, paso a paso">
        <View style={estilos.lista}>
          <Texto fuerte>Google Calendar</Texto>
          {PASOS_GOOGLE.map((paso, i) => (
            <Texto key={paso} pequeno>
              {i + 1}. {paso}
            </Texto>
          ))}
          <Texto fuerte style={estilos.separado}>
            iCloud (Calendario del iPhone)
          </Texto>
          {PASOS_ICLOUD.map((paso, i) => (
            <Texto key={paso} pequeno>
              {i + 1}. {paso}
            </Texto>
          ))}
          <Texto pequeno secundario style={estilos.separado}>
            Se traen los eventos con hora desde hace 3 meses hasta dentro de 2 años. Los de todo el día
            todavía no. En la web, el calendario pasa por el servidor de Rusko solo para leerlo: no se
            guarda.
          </Texto>
        </View>
      </Plegable>
    </>
  );
}

const estilos = StyleSheet.create({
  fila: {
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
    padding: espacio.m,
    gap: espacio.xs,
  },
  botones: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.xs },
  boton: { flex: 1 },
  aviso: { color: colores.aviso },
  lista: { gap: espacio.s },
  separado: { marginTop: espacio.s },
});
