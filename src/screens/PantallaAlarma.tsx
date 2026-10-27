import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Boton,
  BotonAtras,
  CampoTexto,
  Pantalla,
  Plegable,
  Selector,
  SelectorDias,
  SelectorFecha,
  SelectorHora,
  SelectorVisual,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
  type OpcionVisual,
} from '@/components';
import {
  ADELANTOS_MAXIMOS,
  borrarAlarma,
  guardarAlarma,
  nuevoIdAlarma,
  useAlarmas,
  type Alarma,
  type SonidoAlarma,
  type TipoAlarma,
} from '@/data/alarmas';
import type { DiaSemana } from '@/data/perfil';
import { diaDeUnaVez, permisoAlarmas, textoDias, unaVezPendiente } from '@/services/alarmas';
import type { ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

// Nueva alarma (/alarma) o editar una (/alarma?id=...). Corta: tipo, hora y días a la
// vista; el nombre, el sonido y el adelanto máximo, plegados en "Más ajustes".

const TIPOS: OpcionVisual<TipoAlarma>[] = [
  { valor: 'despertador', etiqueta: 'Despertador', icono: 'alarm-outline' },
  { valor: 'inteligente', etiqueta: 'Inteligente', icono: 'car-outline' },
];

const SONIDOS: OpcionVisual<SonidoAlarma>[] = [
  { valor: 'alarma', etiqueta: 'Sonido', icono: 'musical-notes-outline' },
  { valor: 'vibrar', etiqueta: 'Solo vibrar', icono: 'phone-portrait-outline' },
];

const ADELANTOS: Opcion<string>[] = ADELANTOS_MAXIMOS.map((m) => ({ valor: String(m), etiqueta: `${m} min` }));

type Cuando = 'repite' | 'dia';

// Se repite por días de la semana, o suena una sola vez el día que elijas, aunque sea
// dentro de semanas (27/10/2026).
const CUANDO: Opcion<Cuando>[] = [
  { valor: 'repite', etiqueta: 'Se repite' },
  { valor: 'dia', etiqueta: 'Un día concreto' },
];

const DIAS_LABORABLES: DiaSemana[] = [0, 1, 2, 3, 4];

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/alarmas');
}

export function PantallaAlarma() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cargado, alarmas } = useAlarmas();
  if (!cargado) {
    return (
      <Pantalla>
        <Texto secundario>Cargando…</Texto>
      </Pantalla>
    );
  }
  const alarma = id ? (alarmas.find((a) => a.id === id) ?? null) : null;
  return <Formulario key={alarma?.id ?? 'nueva'} inicial={alarma} />;
}

function Formulario({ inicial }: { inicial: Alarma | null }) {
  const [tipo, setTipo] = useState<TipoAlarma>(inicial?.tipo ?? 'despertador');
  const [hora, setHora] = useState(inicial?.hora ?? '07:30');
  const [dias, setDias] = useState<DiaSemana[]>(inicial?.dias ?? DIAS_LABORABLES);
  // Los últimos días marcados, para volver a ellos al pasar de "Un día concreto" a "Se repite".
  const [diasRepite, setDiasRepite] = useState<DiaSemana[]>(
    inicial?.dias.length ? inicial.dias : DIAS_LABORABLES,
  );
  const [dia, setDia] = useState<ClaveDia>(() =>
    inicial && unaVezPendiente(inicial, new Date()) ? inicial.unaVezEl! : diaDeUnaVez(hora, new Date()),
  );
  const [etiqueta, setEtiqueta] = useState(inicial?.etiqueta ?? '');
  const [sonido, setSonido] = useState<SonidoAlarma>(inicial?.sonido ?? 'alarma');
  const [adelantoMax, setAdelantoMax] = useState(inicial?.adelantoMaxMin ?? 20);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuando: Cuando = dias.length === 0 ? 'dia' : 'repite';
  const cambiarCuando = (nuevo: Cuando) => {
    setError(null);
    setDias(nuevo === 'dia' ? [] : diasRepite);
  };
  const cambiarDias = (nuevos: DiaSemana[]) => {
    setDias(nuevos);
    if (nuevos.length > 0) setDiasRepite(nuevos);
  };

  const alarma = (): Alarma => ({
    id: inicial?.id ?? nuevoIdAlarma(),
    tipo,
    hora,
    dias,
    unaVezEl: dias.length === 0 ? dia : null,
    etiqueta: etiqueta.trim(),
    sonido,
    activada: true,
    adelantoMaxMin: adelantoMax,
  });

  const guardar = async () => {
    if (dias.length === 0 && !unaVezPendiente({ hora, unaVezEl: dia }, new Date())) {
      setError('Esa hora ya ha pasado. Elige otro día u otra hora.');
      return;
    }
    setOcupado(true);
    await guardarAlarma(alarma());
    // En la app propia, la primera vez pide el permiso de alarmas (AlarmKit / exactas).
    // Si no hay módulo (Expo Go, web), no hace nada.
    await permisoAlarmas(true).catch(() => null);
    volver();
  };

  const borrar = async () => {
    if (!inicial) return;
    setOcupado(true);
    await borrarAlarma(inicial.id);
    volver();
  };

  const resumen = [
    etiqueta.trim() || 'Sin nombre',
    sonido === 'vibrar' ? 'solo vibrar' : 'con sonido',
    tipo === 'inteligente' ? `se adelanta hasta ${adelantoMax} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pantalla>
      <BotonAtras texto="Alarmas" etiqueta="Volver sin guardar" onPress={volver} />
      <Titulo>{inicial ? 'Editar alarma' : 'Nueva alarma'}</Titulo>

      <SelectorVisual opciones={TIPOS} valor={tipo} alCambiar={setTipo} />
      {tipo === 'inteligente' ? (
        <Texto pequeno secundario>
          Suena a su hora, pero si hay atasco camino del trabajo o de tu primera cita, se adelanta.
        </Texto>
      ) : null}

      <SelectorHora
        etiqueta="Hora"
        valor={hora}
        alCambiar={(h) => {
          setHora(h);
          setError(null);
        }}
        pasoMinutos={5}
      />
      <Selector etiqueta="Cuándo" opciones={CUANDO} valor={cuando} alCambiar={cambiarCuando} />
      {cuando === 'repite' ? (
        <SelectorDias etiqueta={`Días · ${textoDias(dias)}`} valor={dias} alCambiar={cambiarDias} />
      ) : (
        <SelectorFecha
          etiqueta="Qué día (suena solo ese día)"
          valor={dia}
          alCambiar={(d) => {
            setDia(d);
            setError(null);
          }}
        />
      )}
      {error ? (
        <Texto pequeno style={estilos.error} accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}

      <Plegable titulo="Más ajustes" resumen={resumen}>
        <CampoTexto
          etiqueta="Nombre"
          placeholder={tipo === 'inteligente' ? 'Alarma inteligente' : 'Despertador'}
          value={etiqueta}
          onChangeText={setEtiqueta}
          maxLength={40}
        />
        <SelectorVisual opciones={SONIDOS} valor={sonido} alCambiar={setSonido} etiqueta="Cómo suena" />
        {tipo === 'inteligente' ? (
          <Selector
            etiqueta="Como mucho, se adelanta"
            opciones={ADELANTOS}
            valor={String(adelantoMax)}
            alCambiar={(v) => setAdelantoMax(Number(v))}
          />
        ) : null}
      </Plegable>

      {confirmarBorrar ? (
        <Tarjeta style={estilos.confirmar}>
          <Texto fuerte>¿Borro esta alarma? Luego no hay vuelta atrás.</Texto>
          <Boton titulo="Sí, borrar" onPress={borrar} disabled={ocupado} />
          <Boton variante="secundario" titulo="Mejor no" onPress={() => setConfirmarBorrar(false)} />
        </Tarjeta>
      ) : (
        <View style={estilos.botones}>
          <Boton titulo={ocupado ? 'Guardando…' : 'Guardar'} disabled={ocupado} onPress={guardar} />
          {inicial ? (
            <Boton variante="secundario" titulo="Borrar alarma" onPress={() => setConfirmarBorrar(true)} />
          ) : null}
        </View>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  pulsado: { transform: [{ scale: 0.97 }] },
  botones: { gap: espacio.s, marginTop: espacio.s },
  confirmar: { gap: espacio.m, borderColor: colores.aviso, borderWidth: 2 },
  error: { color: colores.aviso },
});
