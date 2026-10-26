import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Boton,
  BotonAtras,
  CampoTexto,
  Interruptor,
  Pantalla,
  Selector,
  SelectorFecha,
  SelectorHora,
  SelectorVisual,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
} from '@/components';
import {
  borrarEvento,
  guardarEvento,
  type Cuadrante,
  type DatosCliente,
  nuevoId,
  useEventos,
  type Evento,
  type LugarEvento,
  type Repeticion,
  type TipoEvento,
} from '@/data/eventos';
import { useEmpresa } from '@/data/empresa';
import { guardarPerfil, usePerfil, type Perfil, type SitioHabitual } from '@/data/perfil';
import {
  NOMBRE_CASA,
  NOMBRE_TRABAJO,
  bloqueDeFocoQuePisa,
  resolverLugar,
  sitioTrabajo,
} from '@/services/agenda';
import { avisosDisponibles } from '@/services/avisos';
import { leerBorrador, type BorradorFicha } from '@/services/captura/borrador';
import {
  claveDia,
  horaDesdeMinutos,
  minutosDelDia,
  minutosDesdeHora,
  type ClaveDia,
} from '@/services/fechas';
import { ATRIBUCION_OPENSTREETMAP, buscarCoordenadas, usaOpenStreetMap } from '@/services/lugares';
import { colores, espacio } from '@/theme';

import {
  ICONO_TIPO,
  OPCIONES_AVISO,
  OPCIONES_DURACION,
  OPCIONES_REPETICION,
  opcionesTipo,
  rangoHoras,
} from './calendario/textos';
import { OrigenEvento } from './calendario/OrigenEvento';
import { CamposCliente, errorTelefono, type BorradorCliente } from './clientes/CamposCliente';
import { RecordatorioCliente } from './clientes/RecordatorioCliente';
import { SelectorCuadrante } from './tareas/SelectorCuadrante';
import { MENSAJE_NO_ENCONTRADO } from './formulario-perfil/borrador';
import { MensajeError } from './formulario-perfil/MensajeError';

// Ficha de un evento: sirve para crear uno nuevo y para editar o borrar uno que ya existe.
// Se abre en /evento?fecha=AAAA-MM-DD (nuevo) o /evento?id=... (editar).

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function PantallaEvento() {
  const { id, fecha, propuesta } = useLocalSearchParams<{ id?: string; fecha?: string; propuesta?: string }>();
  const { cargado, eventos } = useEventos();
  const { perfil } = usePerfil();

  if (id && !cargado) {
    return (
      <Pantalla>
        <Texto secundario>Cargando…</Texto>
      </Pantalla>
    );
  }
  const evento = id ? (eventos.find((e) => e.id === id) ?? null) : null;
  if (id && !evento) {
    return (
      <Pantalla>
        <BotonVolver />
        <Texto>Este evento ya no está: se habrá borrado.</Texto>
      </Pantalla>
    );
  }
  return (
    <Formulario
      key={id ?? propuesta ?? 'nuevo'}
      evento={evento}
      rellenar={evento ? null : leerBorrador(propuesta)}
      fechaInicial={fecha ?? claveDia(new Date())}
      perfil={perfil}
      eventos={eventos}
    />
  );
}

type Duracion = (typeof OPCIONES_DURACION)[number]['valor'];
type Aviso = (typeof OPCIONES_AVISO)[number]['valor'];

// Antelación de los avisos elegida en el perfil (30 min si no hay perfil).
function antelacionDelPerfil(perfil: Perfil | null): number {
  return perfil?.antelacionAvisoMin ?? 30;
}

// Aviso elegido: el del evento o, si no tiene, el del perfil.
function avisoInicial(avisoMin: number | null, perfil: Perfil | null): Aviso {
  const valor = String(avisoMin ?? antelacionDelPerfil(perfil));
  return (OPCIONES_AVISO.find((o) => o.valor === valor)?.valor ?? '30') as Aviso;
}

type Borrador = BorradorCliente & {
  titulo: string;
  tipo: TipoEvento;
  fecha: ClaveDia;
  horaInicio: string;
  horaFin: string;
  flexible: boolean;
  duracion: Duracion;
  cuadrante: Cuadrante | null; // matriz de Eisenhower, solo en tareas
  hecha: boolean;
  foco: boolean;
  repeticion: Repeticion;
  aviso: Aviso;
  // "ninguno", "casa", "sitio:<id>", "nuevo-trabajo" (si el perfil aún no tiene
  // Trabajo) u "otro" (dirección exacta).
  lugar: string;
  direccion: string; // solo si lugar = "otro"
  direccionTrabajo: string; // solo si lugar = "nuevo-trabajo"
  notas: string;
};

type Errores = Partial<Record<'titulo' | 'horaFin' | 'direccion' | 'clienteTelefono', string>>;

// Hora por defecto: la siguiente hora en punto (hoy) o las 10:00 (otro día).
function horaPorDefecto(fecha: ClaveDia): string {
  if (fecha !== claveDia(new Date())) return '10:00';
  return horaDesdeMinutos(Math.min(Math.ceil(minutosDelDia(new Date()) / 60) * 60, 22 * 60));
}

function lugarInicial(lugar: LugarEvento | null, perfil: Perfil | null): string {
  if (!lugar) return 'ninguno';
  if (lugar.tipo === 'casa') return 'casa';
  if (lugar.tipo === 'otro') return 'otro';
  // Si el sitio se borró del perfil, el evento se queda sin lugar.
  return perfil?.sitios.some((s) => s.id === lugar.sitioId) ? `sitio:${lugar.sitioId}` : 'ninguno';
}

function borradorInicial(
  evento: Evento | null,
  fecha: ClaveDia,
  perfil: Perfil | null,
  rellenar: BorradorFicha | null,
): Borrador {
  if (!evento) {
    // "rellenar" trae lo que ha entendido la captura rápida (o solo la frase).
    const dia = rellenar?.fecha ?? fecha;
    const inicio = rellenar?.horaInicio ?? horaPorDefecto(dia);
    return {
      titulo: rellenar?.titulo ?? '',
      tipo: rellenar?.tipo ?? 'yo',
      fecha: dia,
      horaInicio: inicio,
      horaFin: rellenar?.horaFin ?? horaDesdeMinutos(minutosDesdeHora(inicio) + 60),
      flexible: rellenar?.flexible ?? false,
      duracion: (OPCIONES_DURACION.find((o) => o.valor === String(rellenar?.duracionMin))?.valor ?? '30') as Duracion,
      cuadrante: null,
      hecha: false,
      foco: false,
      repeticion: 'nunca',
      aviso: avisoInicial(null, perfil),
      lugar: lugarInicial(rellenar?.lugar ?? null, perfil),
      direccion: '',
      direccionTrabajo: '',
      notas: '',
      clienteNombre: '',
      clienteTelefono: '',
      clienteAcepta: false,
    };
  }
  const inicio = evento.horaInicio ?? horaPorDefecto(evento.fecha);
  return {
    titulo: evento.titulo,
    tipo: evento.tipo,
    fecha: evento.fecha,
    horaInicio: inicio,
    horaFin: evento.horaFin ?? horaDesdeMinutos(minutosDesdeHora(inicio) + 60),
    flexible: evento.flexible,
    duracion: (OPCIONES_DURACION.find((o) => o.valor === String(evento.duracionMin))?.valor ?? '30') as Duracion,
    cuadrante: evento.cuadrante ?? null,
    hecha: evento.hecha,
    foco: evento.foco,
    repeticion: evento.repeticion,
    aviso: avisoInicial(evento.avisoMin, perfil),
    lugar: lugarInicial(evento.lugar, perfil),
    direccion: evento.lugar?.tipo === 'otro' ? evento.lugar.direccion : '',
    direccionTrabajo: '',
    notas: evento.notas,
    clienteNombre: evento.cliente?.nombre ?? '',
    clienteTelefono: evento.cliente?.telefono ?? '',
    clienteAcepta: evento.cliente?.acepta ?? false,
  };
}

type Props = {
  evento: Evento | null;
  rellenar: BorradorFicha | null;
  fechaInicial: ClaveDia;
  perfil: Perfil | null;
  eventos: Evento[];
};

function Formulario({ evento, rellenar, fechaInicial, perfil, eventos }: Props) {
  const [b, setBorrador] = useState<Borrador>(() => borradorInicial(evento, fechaInicial, perfil, rellenar));
  const { modo: modoEmpresa } = useEmpresa();
  const antelacionPerfil = antelacionDelPerfil(perfil);
  const [errores, setErrores] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  const [focoPisado, setFocoPisado] = useState<{ bloque: Evento; nuevo: Evento } | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const cambiar = (cambios: Partial<Borrador>) => {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setFocoPisado(null);
    setErrores((actuales) => {
      const quedan = { ...actuales };
      for (const clave of Object.keys(cambios)) delete quedan[clave as keyof Errores];
      if ('horaInicio' in cambios) delete quedan.horaFin;
      if ('lugar' in cambios) delete quedan.direccion;
      return quedan;
    });
  };

  // Al mover la hora de inicio, la de fin se mueve igual (se mantiene la duración).
  const cambiarInicio = (horaInicio: string) => {
    const diferencia = minutosDesdeHora(horaInicio) - minutosDesdeHora(b.horaInicio);
    cambiar({ horaInicio, horaFin: horaDesdeMinutos(minutosDesdeHora(b.horaFin) + diferencia) });
  };

  // Casa, Trabajo, los demás sitios del perfil y "Otro sitio". Si el perfil no tiene
  // Trabajo, el chip "Trabajo" deja escribir su dirección y lo crea en el perfil.
  const trabajo = sitioTrabajo(perfil);
  const opcionesLugar: Opcion<string>[] = [
    { valor: 'ninguno', etiqueta: 'Sin lugar' },
    { valor: 'casa', etiqueta: NOMBRE_CASA },
    { valor: trabajo ? `sitio:${trabajo.id}` : 'nuevo-trabajo', etiqueta: NOMBRE_TRABAJO },
    ...(perfil?.sitios ?? [])
      .filter((s) => s.id !== trabajo?.id)
      .map((s) => ({ valor: `sitio:${s.id}`, etiqueta: s.nombre })),
    { valor: 'otro', etiqueta: 'Otro sitio' },
  ];

  // Casa y los sitios del perfil se guardan como referencia (no como copia).
  const referencia = (): LugarEvento | null => {
    if (b.lugar === 'casa') return { tipo: 'casa' };
    if (b.lugar.startsWith('sitio:')) return { tipo: 'sitio', sitioId: b.lugar.slice('sitio:'.length) };
    return null;
  };
  const lugarElegido = resolverLugar(referencia(), perfil);

  // Calcula el lugar del evento. Devuelve un texto de error si no encuentra la dirección.
  const calcularLugar = async (): Promise<LugarEvento | null | string> => {
    if (b.lugar === 'ninguno') return null;
    if (b.lugar === 'nuevo-trabajo') return crearTrabajo();
    if (b.lugar !== 'otro') return referencia();
    const direccion = b.direccion.trim();
    // Si la dirección no ha cambiado, se conservan sus coordenadas.
    if (evento?.lugar?.tipo === 'otro' && evento.lugar.direccion === direccion && evento.lugar.coordenadas) {
      return evento.lugar;
    }
    const resultado = await buscarCoordenadas(direccion);
    if (resultado.estado === 'no-encontrado') return MENSAJE_NO_ENCONTRADO;
    return {
      tipo: 'otro',
      direccion,
      coordenadas: resultado.estado === 'encontrado' ? resultado.coordenadas : null,
    };
  };

  // Guarda "Trabajo" en los sitios habituales del perfil y devuelve la referencia.
  const crearTrabajo = async (): Promise<LugarEvento | string> => {
    if (!perfil) return 'Primero rellena tu perfil.';
    const direccion = b.direccionTrabajo.trim();
    const resultado = await buscarCoordenadas(direccion);
    if (resultado.estado === 'no-encontrado') return MENSAJE_NO_ENCONTRADO;
    const sitio: SitioHabitual = {
      id: nuevoId(),
      nombre: NOMBRE_TRABAJO,
      direccion,
      coordenadas: resultado.estado === 'encontrado' ? resultado.coordenadas : null,
    };
    await guardarPerfil({ ...perfil, sitios: [...perfil.sitios, sitio] });
    // Si luego sale el aviso del bloque de foco, que no lo cree otra vez.
    setBorrador((actual) => ({ ...actual, lugar: `sitio:${sitio.id}`, direccionTrabajo: '' }));
    return { tipo: 'sitio', sitioId: sitio.id };
  };

  // Datos del cliente (fase 10): solo en citas de Clientes con hora.
  const conCliente = b.tipo === 'cliente' && !b.flexible;
  const clienteDelBorrador = (): DatosCliente | null => {
    const datos = { nombre: b.clienteNombre.trim(), telefono: b.clienteTelefono.trim(), acepta: b.clienteAcepta };
    return datos.nombre || datos.telefono || datos.acepta ? datos : null;
  };

  const guardar = async () => {
    const nuevosErrores: Errores = {};
    if (!b.titulo.trim()) nuevosErrores.titulo = 'Ponle un título.';
    if (!b.flexible && minutosDesdeHora(b.horaFin) <= minutosDesdeHora(b.horaInicio)) {
      nuevosErrores.horaFin = 'Tiene que terminar después de empezar.';
    }
    if (b.lugar === 'otro' && !b.direccion.trim()) {
      nuevosErrores.direccion = 'Pon la dirección o elige «Sin lugar».';
    }
    if (b.lugar === 'nuevo-trabajo' && !b.direccionTrabajo.trim()) {
      nuevosErrores.direccion = 'Pon la dirección de tu trabajo o elige otro lugar.';
    }
    if (conCliente) {
      const error = errorTelefono(b);
      if (error) nuevosErrores.clienteTelefono = error;
    }
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    setOcupado(true);
    const lugar = await calcularLugar();
    setOcupado(false);
    if (typeof lugar === 'string') {
      setErrores({ direccion: lugar });
      return;
    }

    const nuevo: Evento = {
      id: evento?.id ?? nuevoId(),
      titulo: b.titulo.trim(),
      fecha: b.fecha,
      horaInicio: b.flexible ? null : b.horaInicio,
      horaFin: b.flexible ? null : b.horaFin,
      tipo: b.tipo,
      lugar,
      notas: b.notas.trim(),
      repeticion: b.flexible ? 'nunca' : b.repeticion,
      flexible: b.flexible,
      duracionMin: b.flexible ? Number(b.duracion) : null,
      hecha: b.flexible && b.hecha,
      foco: !b.flexible && b.foco,
      // Si coincide con el del perfil se guarda null: así sigue al perfil si lo cambias.
      avisoMin: b.flexible || Number(b.aviso) === antelacionPerfil ? null : Number(b.aviso),
      ejemplo: evento?.ejemplo ?? false,
      // Solo en citas con clientes; si deja de serlo, sus datos se borran.
      cliente: conCliente ? clienteDelBorrador() : null,
      // Si vino de otro calendario se conserva: así, al traerlo otra vez, se sabe que
      // lo has cambiado aquí y no se duplica ni se pisa.
      origen: evento?.origen ?? null,
      cuadrante: b.flexible ? b.cuadrante : null,
    };

    const bloque = bloqueDeFocoQuePisa(nuevo, eventos);
    if (bloque) {
      setFocoPisado({ bloque, nuevo });
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    await guardarDeVerdad(nuevo);
  };

  const guardarDeVerdad = async (nuevo: Evento) => {
    setOcupado(true);
    await guardarEvento(nuevo);
    volver();
  };

  const borrar = async () => {
    if (!evento) return;
    volver();
    await borrarEvento(evento.id);
  };

  const nombre = b.flexible ? 'tarea' : 'evento';

  return (
    <Pantalla ref={scroll}>
      <BotonVolver />
      <Titulo>{evento ? `Editar ${nombre}` : b.flexible ? 'Nueva tarea' : 'Nuevo evento'}</Titulo>
      {evento ? <OrigenEvento evento={evento} /> : null}
      {rellenar?.mensaje ? (
        <Texto secundario accessibilityLiveRegion="polite">
          {rellenar.mensaje}
        </Texto>
      ) : null}

      <CampoTexto
        etiqueta="Título"
        placeholder={b.flexible ? 'Llamar al taller' : 'Reunión con Laura'}
        value={b.titulo}
        onChangeText={(titulo) => cambiar({ titulo })}
        autoCapitalize="sentences"
        autoFocus={!evento}
        returnKeyType="done"
        error={errores.titulo}
      />

      <SelectorVisual
        etiqueta="Tipo"
        opciones={opcionesTipo(modoEmpresa, evento?.tipo ?? null).map((o) => ({ ...o, icono: ICONO_TIPO[o.valor] }))}
        valor={b.tipo}
        alCambiar={(tipo) => cambiar({ tipo })}
      />

      {conCliente ? (
        <CamposCliente
          clienteNombre={b.clienteNombre}
          clienteTelefono={b.clienteTelefono}
          clienteAcepta={b.clienteAcepta}
          cambiar={cambiar}
          error={errores.clienteTelefono}
        />
      ) : null}

      <Interruptor
        etiqueta="Tarea flexible"
        ayuda="Sin hora fija, como «llamar al taller». La coloco en tus huecos libres."
        valor={b.flexible}
        alCambiar={(flexible) => cambiar({ flexible })}
      />

      <SelectorFecha
        etiqueta={b.flexible ? 'Para el día' : 'Fecha'}
        valor={b.fecha}
        alCambiar={(fecha) => cambiar({ fecha })}
      />

      {b.flexible ? (
        <>
          <Selector
            etiqueta="Duración estimada"
            opciones={OPCIONES_DURACION}
            valor={b.duracion}
            alCambiar={(duracion) => cambiar({ duracion })}
          />
          <SelectorCuadrante
            etiqueta="¿Qué prioridad tiene?"
            valor={b.cuadrante}
            alCambiar={(cuadrante) => cambiar({ cuadrante })}
          />
          {evento ? (
            <Interruptor etiqueta="Ya está hecha" valor={b.hecha} alCambiar={(hecha) => cambiar({ hecha })} />
          ) : null}
        </>
      ) : (
        <>
          <View>
            <View style={estilos.fila}>
              <SelectorHora etiqueta="Empieza" valor={b.horaInicio} alCambiar={cambiarInicio} />
              <SelectorHora etiqueta="Termina" valor={b.horaFin} alCambiar={(horaFin) => cambiar({ horaFin })} />
            </View>
            <MensajeError texto={errores.horaFin} />
          </View>

          <Interruptor
            etiqueta="Bloque de foco"
            ayuda="Tiempo protegido para concentrarte. Te aviso si algo lo pisa."
            valor={b.foco}
            alCambiar={(foco) => cambiar({ foco })}
          />

          <Selector
            etiqueta="Repetición"
            opciones={OPCIONES_REPETICION}
            valor={b.repeticion}
            alCambiar={(repeticion) => cambiar({ repeticion })}
          />

          {/* En la web no hay avisos: solo en la app del móvil. */}
          {avisosDisponibles ? (
            <View style={estilos.grupo}>
              <Selector
                etiqueta="Aviso antes"
                opciones={OPCIONES_AVISO}
                valor={b.aviso}
                alCambiar={(aviso) => cambiar({ aviso })}
              />
              <Texto pequeno secundario>
                Por defecto, {OPCIONES_AVISO.find((o) => o.valor === String(antelacionPerfil))?.etiqueta ?? '30 min'}{' '}
                como en tu perfil. Los tipos de aviso se activan o se quitan en Perfil.
              </Texto>
            </View>
          ) : null}
        </>
      )}

      <View style={estilos.grupo}>
        <Selector
          etiqueta="Lugar (opcional)"
          opciones={opcionesLugar}
          valor={b.lugar}
          alCambiar={(lugar) => cambiar({ lugar })}
        />
        {lugarElegido ? (
          <Tarjeta style={estilos.lugar}>
            <Texto fuerte>{lugarElegido.nombre}</Texto>
            <Texto pequeno secundario>
              {lugarElegido.direccion}
            </Texto>
          </Tarjeta>
        ) : null}
        {b.lugar === 'otro' ? (
          <CampoTexto
            placeholder="Calle, número y municipio"
            value={b.direccion}
            onChangeText={(direccion) => cambiar({ direccion })}
            autoCapitalize="words"
            accessibilityLabel="Dirección exacta"
            error={errores.direccion}
          />
        ) : null}
        {b.lugar === 'nuevo-trabajo' ? (
          <CampoTexto
            etiqueta="Dirección de tu trabajo"
            placeholder="Calle, número y municipio"
            value={b.direccionTrabajo}
            onChangeText={(direccionTrabajo) => cambiar({ direccionTrabajo })}
            autoCapitalize="words"
            ayuda="Aún no está en tu perfil. Al guardar lo añado a tus sitios habituales."
            error={errores.direccion}
          />
        ) : null}
        {usaOpenStreetMap && (b.lugar === 'otro' || b.lugar === 'nuevo-trabajo') ? (
          <Texto pequeno secundario>
            {ATRIBUCION_OPENSTREETMAP}
          </Texto>
        ) : null}
      </View>

      <CampoTexto
        etiqueta="Notas (opcional)"
        placeholder="Lo que quieras recordar"
        value={b.notas}
        onChangeText={(notas) => cambiar({ notas })}
        multiline
        style={estilos.notas}
      />

      {/* Recordatorio por WhatsApp de una cita con cliente ya guardada (fase 10). */}
      {conCliente && evento && !evento.flexible ? (
        <RecordatorioCliente
          evento={evento}
          cliente={{ nombre: b.clienteNombre.trim(), telefono: b.clienteTelefono.trim(), acepta: b.clienteAcepta }}
          perfil={perfil}
        />
      ) : null}

      {focoPisado ? (
        <Tarjeta style={estilos.aviso} accessibilityLiveRegion="assertive">
          <Titulo nivel={3}>Ojo, esto pisa tu bloque de foco. ¿Lo guardo igual?</Titulo>
          <Texto secundario>
            «{focoPisado.bloque.titulo}», {rangoHoras(focoPisado.bloque)}.
          </Texto>
          <Boton titulo="Sí, guárdalo" disabled={ocupado} onPress={() => guardarDeVerdad(focoPisado.nuevo)} />
          <Boton variante="secundario" titulo="Cambiar la hora" onPress={() => setFocoPisado(null)} />
        </Tarjeta>
      ) : (
        <Boton
          titulo={ocupado ? 'Guardando…' : evento ? 'Guardar cambios' : `Guardar ${nombre}`}
          disabled={ocupado}
          onPress={guardar}
        />
      )}

      {evento ? (
        confirmarBorrado ? (
          <Tarjeta style={estilos.aviso}>
            <Titulo nivel={3}>¿Borrar «{evento.titulo}»?</Titulo>
            <Texto secundario>
              {evento.repeticion !== 'nunca'
                ? 'Se borran todas las repeticiones y no hay vuelta atrás.'
                : 'Luego no hay vuelta atrás.'}
            </Texto>
            <Boton titulo="Sí, borrar" onPress={borrar} />
            <Boton variante="secundario" titulo="No, déjalo" onPress={() => setConfirmarBorrado(false)} />
          </Tarjeta>
        ) : (
          <Boton
            variante="secundario"
            titulo={`Borrar ${nombre}`}
            onPress={() => {
              setConfirmarBorrado(true);
              setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
            }}
          />
        )
      ) : null}
    </Pantalla>
  );
}

function BotonVolver() {
  return (
    <BotonAtras texto="Volver" etiqueta="Volver sin guardar" onPress={volver} />
  );
}

const estilos = StyleSheet.create({
  pulsado: { opacity: 0.6 },
  fila: { flexDirection: 'row', gap: espacio.m },
  grupo: { gap: espacio.s },
  lugar: { gap: 2, paddingVertical: espacio.s },
  notas: { minHeight: 96, paddingTop: espacio.s, textAlignVertical: 'top' },
  aviso: { borderColor: colores.aviso, borderWidth: 2, gap: espacio.m },
});
