import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Boton,
  CampoTexto,
  Interruptor,
  Selector,
  SelectorFecha,
  SelectorHora,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
} from '@/components';
import { guardarEvento, nuevoId, useEventos, type Evento, type LugarEvento } from '@/data/eventos';
import type { Perfil } from '@/data/perfil';
import { apuntarTipoAprendido } from '@/data/tiposAprendidos';
import { NOMBRE_CASA, bloqueDeFocoQuePisa, unirConY } from '@/services/agenda';
import type { BorradorFicha } from '@/services/captura/borrador';
import type { Propuesta } from '@/services/captura';
import { fechaDesdeClave, formatearDiaCorto, horaDesdeMinutos, minutosDesdeHora } from '@/services/fechas';
import { colores, espacio, radio } from '@/theme';

import { AvisarA } from '../calendario/AvisarA';
import { useEstudioQuePisa } from '../epoca/useEpoca';
import { OPCIONES_AVISO, OPCIONES_DURACION, OPCIONES_TIPO, rangoHoras } from '../calendario/textos';

// Tarjeta "¿Lo guardo así?" con lo que ha entendido la app (o la IA). Si solo se dijo
// la franja ("por la tarde"), ofrece sus horas a un toque. Todo se puede cambiar
// antes de guardar; con "Cancelar" no se guarda nada. Lo menos habitual
// (repetición, notas, aviso, otra dirección) está en "Más opciones", que abre
// la ficha normal ya rellena. Un recordatorio («recuérdame mañana a las 6 llamar a
// mamá») es una tarea con "Avisarme ese día": la tarjeta pregunta "¿Te lo recuerdo así?".
// Si en una cita se pidió el aviso ("avísame el día antes"), sale con cuánto antes.

type Duracion = (typeof OPCIONES_DURACION)[number]['valor'];
type Aviso = (typeof OPCIONES_AVISO)[number]['valor'];

type Props = {
  propuesta: Propuesta;
  perfil: Perfil | null;
  alGuardar: (evento: Evento) => void;
  alCancelar: () => void;
  alMasOpciones: (borrador: BorradorFicha) => void;
};

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// El evento tal cual lo propone la captura (también lo usa "Guardar todo").
export function eventoDePropuesta(p: Propuesta): Evento {
  const repite = !p.flexible && p.repeticion && p.repeticion !== 'nunca';
  return {
    id: nuevoId(),
    titulo: p.titulo.trim(),
    fecha: p.fecha,
    horaInicio: p.flexible ? null : (p.horaInicio ?? '10:00'),
    horaFin: p.flexible ? null : (p.horaFin ?? '11:00'),
    tipo: p.tipo,
    lugar: p.lugar,
    notas: '',
    repeticion: repite ? p.repeticion! : 'nunca',
    dias: repite && p.dias?.length ? p.dias : null,
    hasta: repite ? (p.hasta ?? null) : null,
    flexible: p.flexible,
    duracionMin: p.flexible ? (p.duracionMin ?? 30) : null,
    hecha: false,
    foco: false,
    // La antelación pedida en la frase o, si no se dijo nada, la del perfil (null).
    avisoMin: p.flexible ? null : p.avisoMin,
    ejemplo: false,
    avisarA: p.flexible ? p.avisarA : null,
  };
}

// «Cada semana: lunes y jueves, hasta el Lunes 30 nov».
function textoRepeticion(p: Propuesta): string | null {
  if (p.flexible || !p.repeticion || p.repeticion === 'nunca') return null;
  const cada =
    p.repeticion === 'diaria'
      ? 'Todos los días'
      : p.repeticion === 'mensual'
        ? 'Cada mes'
        : `Cada semana${p.dias?.length ? `: ${unirConY(p.dias.map((d) => DIAS[d]))}` : ''}`;
  const hasta = p.hasta ? `, hasta el ${formatearDiaCorto(fechaDesdeClave(p.hasta)).toLocaleLowerCase('es-ES')}` : '';
  return `${cada}${hasta}.`;
}

function claveLugar(lugar: LugarEvento | null): string {
  if (!lugar) return 'ninguno';
  if (lugar.tipo === 'casa') return 'casa';
  if (lugar.tipo === 'sitio') return `sitio:${lugar.sitioId}`;
  return 'ninguno';
}

function lugarDesdeClave(clave: string): LugarEvento | null {
  if (clave === 'casa') return { tipo: 'casa' };
  if (clave.startsWith('sitio:')) return { tipo: 'sitio', sitioId: clave.slice('sitio:'.length) };
  return null;
}

export function TarjetaConfirmacion({ propuesta, perfil, alGuardar, alCancelar, alMasOpciones }: Props) {
  const { eventos } = useEventos();
  const estudioQuePisa = useEstudioQuePisa();
  const [titulo, setTitulo] = useState(propuesta.titulo);
  const [tipo, setTipo] = useState(propuesta.tipo);
  const [fecha, setFecha] = useState(propuesta.fecha);
  const [flexible, setFlexible] = useState(propuesta.flexible);
  const [horaInicio, setHoraInicio] = useState(propuesta.horaInicio ?? '10:00');
  const [horaFin, setHoraFin] = useState(propuesta.horaFin ?? '11:00');
  const [duracion, setDuracion] = useState<Duracion>(
    (OPCIONES_DURACION.find((o) => o.valor === String(propuesta.duracionMin))?.valor ?? '30') as Duracion,
  );
  const [lugar, setLugar] = useState(claveLugar(propuesta.lugar));
  const [avisarA, setAvisarA] = useState(propuesta.avisarA);
  const [aviso, setAviso] = useState<Aviso | null>(
    propuesta.avisoMin === null
      ? null
      : (OPCIONES_AVISO.find((o) => o.valor === String(propuesta.avisoMin))?.valor ?? null),
  );
  const [error, setError] = useState<string | null>(null);
  const [focoPisado, setFocoPisado] = useState<{ bloque: Evento; nuevo: Evento; estudio: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const repeticion = textoRepeticion({ ...propuesta, flexible });
  const opcionesLugar: Opcion<string>[] = [
    { valor: 'ninguno', etiqueta: 'Sin lugar' },
    { valor: 'casa', etiqueta: NOMBRE_CASA },
    ...(perfil?.sitios ?? []).map((s) => ({ valor: `sitio:${s.id}`, etiqueta: s.nombre })),
  ];

  // Al mover el inicio, el fin se mueve igual (se mantiene la duración).
  const cambiarInicio = (nueva: string) => {
    const diferencia = minutosDesdeHora(nueva) - minutosDesdeHora(horaInicio);
    setHoraInicio(nueva);
    setHoraFin(horaDesdeMinutos(minutosDesdeHora(horaFin) + diferencia));
    setError(null);
    setFocoPisado(null);
  };

  const borrador = (): BorradorFicha => ({
    titulo: titulo.trim(),
    fecha,
    tipo,
    flexible,
    horaInicio: flexible ? null : horaInicio,
    horaFin: flexible ? null : horaFin,
    duracionMin: flexible ? Number(duracion) : null,
    lugar: lugarDesdeClave(lugar),
    avisarA: flexible ? avisarA : null,
    avisoMin: !flexible && aviso !== null ? Number(aviso) : null,
    repeticion: propuesta.repeticion,
    dias: propuesta.dias,
    hasta: propuesta.hasta,
  });

  const guardar = async () => {
    if (!titulo.trim()) {
      setError('Escribe un título.');
      return;
    }
    if (!flexible && minutosDesdeHora(horaFin) <= minutosDesdeHora(horaInicio)) {
      setError('La hora de fin tiene que ser después de la de inicio.');
      return;
    }
    const b = borrador();
    const nuevo = eventoDePropuesta({
      ...propuesta,
      ...b,
      horaInicio: b.horaInicio ?? null,
      horaFin: b.horaFin ?? null,
      lugar: b.lugar ?? null,
      avisoMin: b.avisoMin ?? null,
      avisarA: b.avisarA ?? null,
      dias: propuesta.dias,
      hasta: propuesta.hasta,
    });
    const foco = bloqueDeFocoQuePisa(nuevo, eventos);
    const estudio = foco ? null : estudioQuePisa(nuevo, eventos);
    const bloque = foco ?? estudio;
    if (bloque) {
      setFocoPisado({ bloque, nuevo, estudio: !foco });
      return;
    }
    await guardarDeVerdad(nuevo);
  };

  const guardarDeVerdad = async (nuevo: Evento) => {
    setGuardando(true);
    // Has cambiado el tipo: la próxima vez con este título sale ya así.
    if (tipo !== propuesta.tipo) await apuntarTipoAprendido(nuevo.titulo, tipo).catch(() => {});
    await guardarEvento(nuevo);
    alGuardar(nuevo);
  };

  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Titulo nivel={3}>{flexible && avisarA ? '¿Te lo recuerdo así?' : '¿Lo guardo así?'}</Titulo>
      {propuesta.confianza !== 'alta' ? (
        <Texto pequeno secundario>
          No lo tengo del todo claro: échale un ojo antes de guardar.
        </Texto>
      ) : null}

      <CampoTexto
        etiqueta="Título"
        value={titulo}
        onChangeText={(t) => {
          setTitulo(t);
          setError(null);
        }}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      <Selector etiqueta="Tipo" opciones={OPCIONES_TIPO} valor={tipo} alCambiar={setTipo} />
      <SelectorFecha etiqueta={flexible ? 'Para el día' : 'Día'} valor={fecha} alCambiar={setFecha} />
      <Interruptor
        etiqueta="Tarea flexible"
        ayuda="Sin hora fija: la coloco en tus huecos libres."
        valor={flexible}
        alCambiar={(valor) => {
          setFlexible(valor);
          setError(null);
          setFocoPisado(null);
        }}
      />
      {flexible ? (
        <>
          <AvisarA valor={avisarA} alCambiar={setAvisarA} />
          <Selector etiqueta="Duración estimada" opciones={OPCIONES_DURACION} valor={duracion} alCambiar={setDuracion} />
        </>
      ) : (
        <>
          {propuesta.opcionesHora ? (
            <Selector
              etiqueta="¿A qué hora?"
              opciones={propuesta.opcionesHora.map((h) => ({ valor: h, etiqueta: h }))}
              valor={horaInicio}
              alCambiar={cambiarInicio}
            />
          ) : null}
          <View style={estilos.fila}>
            <SelectorHora etiqueta="Empieza" valor={horaInicio} alCambiar={cambiarInicio} />
            <SelectorHora
              etiqueta="Termina"
              valor={horaFin}
              alCambiar={(h) => {
                setHoraFin(h);
                setError(null);
                setFocoPisado(null);
              }}
            />
          </View>
          {aviso !== null ? (
            <Selector etiqueta="Aviso antes" opciones={OPCIONES_AVISO} valor={aviso} alCambiar={setAviso} />
          ) : null}
        </>
      )}
      <Selector etiqueta="Lugar" opciones={opcionesLugar} valor={lugar} alCambiar={setLugar} />
      {repeticion ? (
        <Texto pequeno secundario>
          {repeticion} Para cambiarlo, «Más opciones».
        </Texto>
      ) : null}

      {error ? (
        <Texto pequeno style={estilos.error} accessibilityLiveRegion="assertive">
          {error}
        </Texto>
      ) : null}

      {focoPisado ? (
        <View style={estilos.aviso} accessibilityLiveRegion="assertive">
          <Titulo nivel={3}>
            {focoPisado.estudio ? 'A esa hora tienes estudio. ¿Lo muevo?' : 'Esto pisa tu bloque de foco. ¿Seguro?'}
          </Titulo>
          <Texto secundario>
            «{focoPisado.bloque.titulo}», {rangoHoras(focoPisado.bloque)}.
            {focoPisado.estudio ? ' Si lo muevo, va a otro hueco libre y no pierdes horas.' : ''}
          </Texto>
          <Boton
            titulo={focoPisado.estudio ? 'Sí, muévelo' : 'Sí, guardar igualmente'}
            disabled={guardando}
            onPress={() => guardarDeVerdad(focoPisado.nuevo)}
          />
          <Boton
            variante="secundario"
            titulo={focoPisado.estudio ? 'No, cambio la hora' : 'Cambiar la hora'}
            onPress={() => setFocoPisado(null)}
          />
        </View>
      ) : (
        <View style={estilos.botones}>
          <Boton titulo={guardando ? 'Guardando…' : 'Guardar'} disabled={guardando} onPress={guardar} />
          <Boton variante="secundario" titulo="Cancelar" disabled={guardando} onPress={alCancelar} />
        </View>
      )}
      <Boton variante="secundario" titulo="Más opciones" disabled={guardando} onPress={() => alMasOpciones(borrador())} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  fila: { flexDirection: 'row', gap: espacio.m },
  botones: { gap: espacio.s },
  error: { color: colores.aviso },
  aviso: {
    gap: espacio.s,
    borderColor: colores.aviso,
    borderWidth: 2,
    borderRadius: radio.grande - 4,
    padding: espacio.m,
  },
});
