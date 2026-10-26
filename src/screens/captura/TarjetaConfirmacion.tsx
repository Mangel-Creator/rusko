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
import { NOMBRE_CASA, bloqueDeFocoQuePisa } from '@/services/agenda';
import type { BorradorFicha } from '@/services/captura/borrador';
import type { Propuesta } from '@/services/captura';
import { horaDesdeMinutos, minutosDesdeHora } from '@/services/fechas';
import { colores, espacio, radio } from '@/theme';

import { OPCIONES_DURACION, OPCIONES_TIPO, rangoHoras } from '../calendario/textos';

// Tarjeta "¿Lo guardo así?" con lo que ha entendido la app (o la IA). Si solo se dijo
// la franja ("por la tarde"), ofrece sus horas a un toque. Todo se puede cambiar
// antes de guardar; con "Cancelar" no se guarda nada. Lo menos habitual
// (repetición, notas, aviso, otra dirección) está en "Más opciones", que abre
// la ficha normal ya rellena.

type Duracion = (typeof OPCIONES_DURACION)[number]['valor'];

type Props = {
  propuesta: Propuesta;
  perfil: Perfil | null;
  alGuardar: (evento: Evento) => void;
  alCancelar: () => void;
  alMasOpciones: (borrador: BorradorFicha) => void;
};

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
  const [error, setError] = useState<string | null>(null);
  const [focoPisado, setFocoPisado] = useState<{ bloque: Evento; nuevo: Evento } | null>(null);
  const [guardando, setGuardando] = useState(false);

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
    const nuevo: Evento = {
      id: nuevoId(),
      titulo: titulo.trim(),
      fecha,
      horaInicio: flexible ? null : horaInicio,
      horaFin: flexible ? null : horaFin,
      tipo,
      lugar: lugarDesdeClave(lugar),
      notas: '',
      repeticion: 'nunca',
      flexible,
      duracionMin: flexible ? Number(duracion) : null,
      hecha: false,
      foco: false,
      avisoMin: null, // la antelación del perfil
      ejemplo: false,
    };
    const bloque = bloqueDeFocoQuePisa(nuevo, eventos);
    if (bloque) {
      setFocoPisado({ bloque, nuevo });
      return;
    }
    await guardarDeVerdad(nuevo);
  };

  const guardarDeVerdad = async (nuevo: Evento) => {
    setGuardando(true);
    await guardarEvento(nuevo);
    alGuardar(nuevo);
  };

  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Titulo nivel={3}>¿Lo guardo así?</Titulo>
      {propuesta.confianza === 'media' ? (
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
        <Selector etiqueta="Duración estimada" opciones={OPCIONES_DURACION} valor={duracion} alCambiar={setDuracion} />
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
        </>
      )}
      <Selector etiqueta="Lugar" opciones={opcionesLugar} valor={lugar} alCambiar={setLugar} />

      {error ? (
        <Texto pequeno style={estilos.error} accessibilityLiveRegion="assertive">
          {error}
        </Texto>
      ) : null}

      {focoPisado ? (
        <View style={estilos.aviso} accessibilityLiveRegion="assertive">
          <Titulo nivel={3}>Esto pisa tu bloque de foco. ¿Seguro?</Titulo>
          <Texto secundario>
            «{focoPisado.bloque.titulo}», {rangoHoras(focoPisado.bloque)}.
          </Texto>
          <Boton titulo="Sí, guardar igualmente" disabled={guardando} onPress={() => guardarDeVerdad(focoPisado.nuevo)} />
          <Boton variante="secundario" titulo="Cambiar la hora" onPress={() => setFocoPisado(null)} />
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
