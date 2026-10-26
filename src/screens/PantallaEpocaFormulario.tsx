import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, View } from 'react-native';

import {
  BarraProgreso,
  Boton,
  BotonAtras,
  CampoTexto,
  Interruptor,
  Pantalla,
  Plegable,
  Selector,
  SelectorCantidad,
  SelectorDias,
  SelectorFecha,
  SelectorHora,
  SelectorVisual,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
} from '@/components';
import { guardarEpoca, useEpocas, type Epoca, type RegistroBloque } from '@/data/epocas';
import { useEventos } from '@/data/eventos';
import type { DiaSemana, Perfil } from '@/data/perfil';
import { usePerfil } from '@/data/perfil';
import { NOMBRE_CASA } from '@/services/agenda';
import { epocasSolapadas, inicioRecomendado } from '@/services/epoca';
import { claveDia, fechaDesdeClave, formatearDiaCorto } from '@/services/fechas';
import { colores, espacio } from '@/theme';

import {
  borradorConPropuesta,
  borradorDesdeEpoca,
  comprobarPaso1,
  comprobarPaso2,
  comprobarPaso3,
  epocaDesdeBorrador,
  epocaProvisional,
  hayErrores,
  inicioElegido,
  nombrePorDefecto,
  type BorradorEpoca,
  type EleccionLugar,
  type Errores,
  type Trayecto,
} from './epoca/borrador';
import { CuandoEmpezar } from './epoca/CuandoEmpezar';
import { CuentameloIA } from './epoca/CuentameloIA';
import { EditorHitos } from './epoca/EditorHitos';
import { EditorImprescindibles } from './epoca/EditorImprescindibles';
import { SelectorLugarEpoca } from './epoca/SelectorLugarEpoca';
import {
  DESCANSO_TEXTO,
  formatoHoras,
  NOMBRES_DIAS,
  OPCIONES_DESCANSO,
  OPCIONES_MOMENTO_VISUAL,
  OPCIONES_TIPO_VISUAL,
  OPCIONES_TRAYECTO,
} from './epoca/textos';
import { MensajeError } from './formulario-perfil/MensajeError';

// Formulario de la Época dorada en 3 pasos cortos (26/09/2026: el usuario lo veía
// largo y pesado). Cada paso enseña solo lo esencial con casillas de icono; lo
// opcional va plegado en "Más ajustes" con un resumen de lo que ya está puesto.
// Sirve para crear una época (/epoca-editar) y para editarla (/epoca-editar?id=...,
// y ?paso=3 para ir directo a los hitos). Al guardar, el plan se recalcula solo.

type Paso = 1 | 2 | 3;

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/epoca');
}

export function PantallaEpocaFormulario() {
  const { id, paso } = useLocalSearchParams<{ id?: string; paso?: string }>();
  const { cargado, epocas, registro } = useEpocas();
  const { perfil } = usePerfil();

  if (id && !cargado) {
    return (
      <Pantalla>
        <Texto secundario>Cargando…</Texto>
      </Pantalla>
    );
  }
  const epoca = id ? (epocas.find((e) => e.id === id) ?? null) : null;
  if (id && !epoca) {
    return (
      <Pantalla>
        <BotonVolver />
        <Texto>Esta época ya no existe.</Texto>
      </Pantalla>
    );
  }
  return (
    <Formulario
      key={id ?? 'nueva'}
      epoca={epoca}
      epocas={epocas}
      registro={registro}
      perfil={perfil}
      pasoInicial={paso === '3' ? 3 : paso === '2' ? 2 : 1}
    />
  );
}

type Props = {
  epoca: Epoca | null;
  epocas: Epoca[];
  registro: RegistroBloque[];
  perfil: Perfil | null;
  pasoInicial: Paso;
};

function Formulario({ epoca, epocas, registro, perfil, pasoInicial }: Props) {
  const hoy = claveDia(new Date());
  const { eventos } = useEventos();
  const [borrador, setBorrador] = useState<BorradorEpoca>(() => borradorDesdeEpoca(epoca, perfil, hoy));
  const [errores, setErrores] = useState<Errores>({});
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [solapes, setSolapes] = useState<Epoca[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  const b = borrador;
  // El día recomendado para empezar solo hace falta en el paso 3 (donde se elige).
  const recomendado =
    paso === 3 ? inicioRecomendado({ epoca: epocaProvisional(b), eventos, registro, hoy }) : null;
  const inicio = inicioElegido(b, recomendado?.dia ?? null, hoy);

  const cambiar = (cambios: Partial<BorradorEpoca>) => {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setSolapes([]);
    setErrores((actuales) => {
      const quedan = { ...actuales };
      for (const clave of Object.keys(cambios)) delete quedan[clave as keyof Errores];
      if ('inicio' in cambios) delete quedan.fin;
      if ('lugar' in cambios) delete quedan.direccion;
      if ('levantarse' in cambios) delete quedan.acostarse;
      return quedan;
    });
  };

  const irA = (nuevo: Paso) => {
    setPaso(nuevo);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const siguiente = (comprobar: () => Errores, destino: Paso) => {
    const nuevos = comprobar();
    setErrores(nuevos);
    if (hayErrores(nuevos)) {
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    irA(destino);
  };

  const guardar = async (aunqueSeSolape: boolean) => {
    const b = { ...borrador, inicio };
    const todos = { ...comprobarPaso1(b, hoy), ...comprobarPaso2(b), ...comprobarPaso3(b) };
    setErrores(todos);
    if (hayErrores(todos)) {
      if (todos.nombre || todos.tipo || todos.fin) irA(1);
      else if (!todos.hitos) irA(2);
      return;
    }
    const otras = epocasSolapadas({ id: b.id ?? '', inicio: b.inicio, fin: b.fin }, epocas);
    if (otras.length > 0 && !aunqueSeSolape) {
      setSolapes(otras);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    setOcupado(true);
    const resultado = await epocaDesdeBorrador(b);
    if ('error' in resultado) {
      setOcupado(false);
      setErrores({ direccion: resultado.error });
      irA(2);
      return;
    }
    await guardarEpoca(resultado);
    router.replace({ pathname: '/epoca', params: { id: resultado.id } });
  };

  // Chips del sitio de cada día: el de la época, Casa o un sitio habitual.
  const opcionesDia: Opcion<EleccionLugar>[] = [
    { valor: 'epoca', etiqueta: 'El de la época' },
    { valor: 'casa', etiqueta: NOMBRE_CASA },
    ...(perfil?.sitios ?? []).map((s) => ({ valor: `sitio:${s.id}`, etiqueta: s.nombre })),
  ];
  const opcionesLibre: Opcion<string>[] = [
    { valor: 'ninguno', etiqueta: 'Ninguno' },
    ...NOMBRES_DIAS.map((nombre, i) => ({ valor: String(i), etiqueta: nombre })),
  ];
  const vaFuera = b.lugar !== 'casa' || (b.distintoPorDia && Object.values(b.lugarPorDia).some((l) => l !== 'casa'));

  return (
    <Pantalla ref={scroll}>
      <BotonVolver />
      <BarraProgreso paso={paso} total={3} />

      {paso === 1 ? (
        <>
          <Titulo>¿Qué se viene?</Titulo>
          {!epoca ? (
            <CuentameloIA
              perfil={perfil}
              alPreparar={(propuesta) => {
                setBorrador((actual) => borradorConPropuesta(actual, propuesta));
                setErrores({});
                setSolapes([]);
              }}
            />
          ) : null}
          <View>
            <SelectorVisual opciones={OPCIONES_TIPO_VISUAL} valor={b.tipo} alCambiar={(tipo) => cambiar({ tipo })} />
            <MensajeError texto={errores.tipo} />
          </View>
          <View>
            <SelectorFecha etiqueta="¿Hasta cuándo?" valor={b.fin} alCambiar={(fin) => cambiar({ fin })} />
            <MensajeError texto={errores.fin} />
          </View>
          <Plegable
            titulo="Más ajustes"
            resumen={`«${b.nombre.trim() || nombrePorDefecto(b)}»`}
            abierto={!!errores.nombre}>
            <CampoTexto
              etiqueta="Nombre (si no, le pongo uno)"
              placeholder={nombrePorDefecto(b)}
              value={b.nombre}
              onChangeText={(nombre) => cambiar({ nombre })}
              autoCapitalize="sentences"
              error={errores.nombre}
            />
          </Plegable>
          <Boton titulo="Siguiente" onPress={() => siguiente(() => comprobarPaso1(b, hoy), 2)} />
        </>
      ) : null}

      {paso === 2 ? (
        <>
          <Titulo>Tu ritmo</Titulo>
          <SelectorLugarEpoca
            etiqueta="¿Dónde vas a estar?"
            valor={b.lugar}
            alCambiar={(lugar) => cambiar({ lugar })}
            perfil={perfil}
            direccion={b.direccion}
            alCambiarDireccion={(direccion) => cambiar({ direccion })}
            error={errores.direccion}
          />
          <SelectorCantidad
            etiqueta="Horas al día"
            valor={b.horasDia}
            alCambiar={(horasDia) => cambiar({ horasDia })}
            minimo={0.5}
            maximo={14}
            paso={0.5}
            formato={formatoHoras}
          />
          <View>
            <SelectorVisual
              etiqueta="¿Cuándo rindes más?"
              opciones={OPCIONES_MOMENTO_VISUAL}
              valor={b.rindeMas}
              alCambiar={(rindeMas) => cambiar({ rindeMas })}
            />
            <MensajeError texto={errores.rindeMas} />
          </View>

          <Plegable
            titulo="Más ajustes"
            resumen={[
              `De ${b.levantarse} a ${b.acostarse}`,
              b.descanso ? DESCANSO_TEXTO[b.descanso] : null,
              b.diaLibre === null ? 'sin día libre' : `libre el ${NOMBRES_DIAS[b.diaLibre].toLocaleLowerCase('es-ES')}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            abierto={!!(errores.acostarse || errores.descanso)}>
            <View>
              <View style={estilos.fila}>
                <SelectorHora etiqueta="Me levanto" valor={b.levantarse} alCambiar={(levantarse) => cambiar({ levantarse })} />
                <SelectorHora etiqueta="Me acuesto" valor={b.acostarse} alCambiar={(acostarse) => cambiar({ acostarse })} />
              </View>
              <MensajeError texto={errores.acostarse} />
            </View>
            <View>
              <Selector
                etiqueta="Bloques de estudio"
                opciones={OPCIONES_DESCANSO}
                valor={b.descanso}
                alCambiar={(descanso) => cambiar({ descanso })}
              />
              <MensajeError texto={errores.descanso} />
            </View>
            <Selector
              etiqueta="Día libre a la semana"
              opciones={opcionesLibre}
              valor={b.diaLibre === null ? 'ninguno' : String(b.diaLibre)}
              alCambiar={(valor) => cambiar({ diaLibre: valor === 'ninguno' ? null : (Number(valor) as DiaSemana) })}
            />
            <SelectorDias
              etiqueta="Qué días vas (los demás, en casa)"
              valor={b.diasVas}
              alCambiar={(diasVas) => cambiar({ diasVas })}
            />
            <Interruptor
              etiqueta="Un sitio distinto según el día"
              valor={b.distintoPorDia}
              alCambiar={(distintoPorDia) => cambiar({ distintoPorDia })}
            />
            {b.distintoPorDia
              ? b.diasVas.map((dia) => (
                  <Selector
                    key={dia}
                    etiqueta={NOMBRES_DIAS[dia]}
                    opciones={opcionesDia}
                    valor={b.lugarPorDia[dia] ?? 'epoca'}
                    alCambiar={(eleccion) => cambiar({ lugarPorDia: { ...b.lugarPorDia, [dia]: eleccion } })}
                  />
                ))
              : null}
            {vaFuera ? (
              <Selector
                etiqueta="¿Cuánto tardas en llegar?"
                opciones={OPCIONES_TRAYECTO}
                valor={b.trayecto}
                alCambiar={(trayecto: Trayecto) => cambiar({ trayecto })}
              />
            ) : null}
            <EditorImprescindibles
              lista={b.imprescindibles}
              alCambiar={(imprescindibles) => cambiar({ imprescindibles })}
            />
          </Plegable>

          <View style={estilos.botones}>
            <Boton titulo="Siguiente" onPress={() => siguiente(() => comprobarPaso2(b), 3)} />
            <Boton variante="secundario" titulo="Atrás" onPress={() => irA(1)} />
          </View>
        </>
      ) : null}

      {paso === 3 ? (
        <>
          <Titulo>¿Qué tienes por delante?</Titulo>
          <Texto secundario>Añade cada examen o entrega y te preparo el plan día a día.</Texto>
          <EditorHitos
            hitos={b.hitos}
            alCambiar={(hitos) => cambiar({ hitos })}
            perfil={perfil}
            inicio={b.inicio}
            fin={b.fin}
          />
          <MensajeError texto={errores.hitos} />
          <CuandoEmpezar borrador={b} cambiar={cambiar} recomendado={recomendado} inicio={inicio} hoy={hoy} />

          {solapes.length > 0 ? (
            <Tarjeta style={estilos.aviso} accessibilityLiveRegion="assertive">
              <Titulo nivel={3}>Se solapa con otra época</Titulo>
              {solapes.map((o) => (
                <Texto key={o.id} secundario>
                  «{o.nombre}», del {formatearDiaCorto(fechaDesdeClave(o.inicio))} al{' '}
                  {formatearDiaCorto(fechaDesdeClave(o.fin))}.
                </Texto>
              ))}
              <Texto secundario>
                Solo puede haber una activa a la vez: en los días que coincidan manda la que empieza antes.
              </Texto>
              <Boton titulo="Guardar igualmente" disabled={ocupado} onPress={() => guardar(true)} />
              <Boton variante="secundario" titulo="Cambiar las fechas" onPress={() => irA(1)} />
            </Tarjeta>
          ) : null}

          <View style={estilos.botones}>
            <Boton
              titulo={
                ocupado
                  ? 'Guardando…'
                  : epoca
                    ? 'Guardar cambios'
                    : inicio > hoy
                      ? 'Guardar el plan'
                      : b.dorada
                        ? 'Empezar época dorada'
                        : 'Empezar el plan'
              }
              disabled={ocupado}
              onPress={() => guardar(false)}
            />
            <Boton variante="secundario" titulo="Atrás" onPress={() => irA(2)} />
          </View>
        </>
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
  pulsado: { transform: [{ scale: 0.97 }] },
  fila: { flexDirection: 'row', gap: espacio.m },
  botones: { gap: espacio.s, marginTop: espacio.s },
  aviso: { borderColor: colores.aviso, borderWidth: 2, gap: espacio.m },
});
