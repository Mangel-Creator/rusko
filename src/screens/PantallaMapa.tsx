import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Pantalla, Selector, Tarjeta, Texto, Titulo, type Opcion } from '@/components';
import { useAgenda } from '@/data/agenda';
import { useHorasPunta } from '@/data/horasPunta';
import { guardarNavegador, useNavegador } from '@/data/navegador';
import { empezarAparcar, parkingLleno, terminarAparcar, useAparcando, useParkingsLlenos } from '@/data/parkings';
import { usePerfil } from '@/data/perfil';
import { useSalidas } from '@/data/salidas';
import { formatearHora } from '@/services/fechas';
import { ATRIBUCION_OPENSTREETMAP, buscarCoordenadas, usaOpenStreetMap } from '@/services/lugares';
import { consultarPermiso, pedirPermiso } from '@/services/permisos';
import {
  buscarParkings,
  calcularRutas,
  fraseHorasPunta,
  horaDeSalida,
  modoDeViaje,
  navegadorPara,
  NOMBRE_NAVEGADOR,
  ordenarParkings,
  textoAndando,
  type Navegador,
  type Parking,
  type Punto,
  type ResultadoParkings,
  type ResultadoRutas,
} from '@/services/rutas';
import { abrirEnNavegador } from '@/services/rutas/abrir';
import { claveCita } from '@/services/rutas/citas';
import { ubicacionActual } from '@/services/ubicacion';
import { colores, espacio, fuentes, radio } from '@/theme';

import { useAhora } from './calendario/useAhora';
import { destinoDeEvento, sugerencias, type Destino } from './mapa/destinos';
import { MapaRuta } from './mapa/MapaRuta';
import { FilaDestino, FilaParking, Leyenda, TarjetaRuta } from './mapa/PiezasMapa';

// Pestaña Mapa (fase 6; cambiada el 26/10/2026): "¿A dónde vas?", el mapa con el
// tráfico, 2 o 3 rutas con su duración y retraso, la hora de salir si el destino es
// un evento y el botón "Ir con Waze" (o la app de "Abrir siempre con"): Organizy no
// guía, te manda a tu app de siempre. "Parkings cercanos" busca dónde dejar el coche
// cerca del destino y, si al llegar está lleno, "Está lleno, llévame a otro" te lleva
// al siguiente. Se abre también con /mapa?evento=<id>&dia=<AAAA-MM-DD>.

type EstadoRutas = { estado: 'cargando' } | ResultadoRutas | null;
type EstadoParkings = { estado: 'cargando' } | ResultadoParkings | null;

// Cuántos parkings se proponen (los demás quedan de reserva para "llévame a otro").
const PARKINGS_A_LA_VISTA = 5;

const OPCIONES_NAVEGADOR: Opcion<Navegador>[] = [
  { valor: 'waze', etiqueta: NOMBRE_NAVEGADOR.waze },
  { valor: 'google', etiqueta: NOMBRE_NAVEGADOR.google },
  // Mapas de Apple solo está en el iPhone (en la web del iPhone también se abre).
  ...(Platform.OS === 'android' ? [] : [{ valor: 'apple' as const, etiqueta: NOMBRE_NAVEGADOR.apple }]),
];

function claveDe(punto: Punto): string {
  return punto.join();
}

export function PantallaMapa() {
  const { perfil } = usePerfil();
  const { eventos } = useAgenda();
  const salidas = useSalidas();
  const horasPunta = useHorasPunta();
  const navegador = useNavegador();
  const llenos = useParkingsLlenos();
  const aparcando = useAparcando();
  const ahora = useAhora();
  const parametros = useLocalSearchParams<{ evento?: string; dia?: string }>();

  const [texto, setTexto] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [ubicacion, setUbicacion] = useState<Punto | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [elegida, setElegida] = useState(0);
  // Destino (su clave) del que se han pedido los parkings, y lo que ha contestado.
  const [verParkings, setVerParkings] = useState<string | null>(null);
  const [parkingsDe, setParkingsDe] = useState<{ clave: string; resultado: ResultadoParkings } | null>(null);
  const [avisoParking, setAvisoParking] = useState<string | null>(null);

  const modo = modoDeViaje(perfil?.transporte);
  const app = navegadorPara(navegador, perfil?.transporte);
  const casa: Punto | null = perfil?.vivienda.coordenadas
    ? [perfil.vivienda.coordenadas.latitud, perfil.vivienda.coordenadas.longitud]
    : null;
  const origen = ubicacion ?? casa;

  // Dónde estás, cada vez que se abre la pestaña (sin volver a pedir permiso).
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      (async () => {
        const permiso = await consultarPermiso('ubicacion');
        if (!activo) return;
        setSinPermiso(permiso !== 'concedido');
        if (permiso === 'concedido') {
          const aqui = await ubicacionActual();
          if (activo && aqui) setUbicacion(aqui);
        }
      })();
      return () => {
        activo = false;
      };
    }, []),
  );

  async function usarMiUbicacion() {
    if ((await pedirPermiso('ubicacion')) !== 'concedido') return;
    setSinPermiso(false);
    const aqui = await ubicacionActual();
    if (aqui) setUbicacion(aqui);
  }

  // Elegir un destino. Si aún no tiene coordenadas, el efecto de abajo las busca.
  function elegirDestino(nuevo: Destino) {
    setErrorBusqueda(null);
    setElegida(0);
    setTexto('');
    setAvisoParking(null);
    setDestino(nuevo);
  }

  function buscarTexto() {
    const escrito = texto.trim();
    if (!escrito) return;
    elegirDestino({ id: 'busqueda', nombre: escrito, detalle: '', direccion: escrito, punto: null, cita: null });
  }

  // Desde un aviso o desde Hoy llega un evento (si no se pudo abrir Waze directamente):
  // se elige como destino una sola vez (se ajusta al pintar, como recomienda React).
  const { evento: eventoId, dia } = parametros;
  const claveParametros = eventoId && dia ? `${eventoId}:${dia}` : null;
  const [parametrosVistos, setParametrosVistos] = useState<string | null>(null);
  if (claveParametros && claveParametros !== parametrosVistos && eventoId && dia) {
    const evento = eventos.find((e) => e.id === eventoId);
    const nuevo = evento ? destinoDeEvento(evento, dia, perfil) : null;
    if (nuevo) {
      setParametrosVistos(claveParametros);
      elegirDestino(nuevo);
    }
  }

  // Coordenadas del destino elegido si todavía no las tiene (dirección escrita).
  const buscando = !!destino && !destino.punto && !errorBusqueda;
  useEffect(() => {
    if (!destino || destino.punto) return;
    let activo = true;
    buscarCoordenadas(destino.direccion).then((resultado) => {
      if (!activo) return;
      if (resultado.estado === 'encontrado') {
        const { latitud, longitud } = resultado.coordenadas;
        setDestino({ ...destino, punto: [latitud, longitud] });
      } else {
        setErrorBusqueda(
          resultado.estado === 'no-encontrado'
            ? `No encuentro "${destino.direccion}". Prueba a escribirla de otra forma.`
            : 'Sin conexión: no puedo buscar la dirección ahora.',
        );
      }
    });
    return () => {
      activo = false;
    };
  }, [destino]);

  // Rutas con tráfico cada vez que cambian el destino, el origen o el transporte.
  // Se guardan 5 minutos (services/rutas): volver a la pestaña no gasta otra llamada.
  const punto = destino?.punto ?? null;
  const huella = punto && origen && modo ? `${origen.join()}|${punto.join()}|${modo}` : null;
  const [calculadas, setCalculadas] = useState<{ huella: string; resultado: ResultadoRutas } | null>(null);
  useEffect(() => {
    if (!huella || !punto || !origen || !modo) return;
    let activo = true;
    calcularRutas({ origen, destino: punto, modo, alternativas: 2 }).then((resultado) => {
      if (activo) setCalculadas({ huella, resultado });
    });
    return () => {
      activo = false;
    };
    // La huella resume origen, destino y modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella]);
  const rutas: EstadoRutas = !huella
    ? null
    : calculadas?.huella === huella
      ? calculadas.resultado
      : { estado: 'cargando' };

  const lista = rutas?.estado === 'ok' ? rutas.rutas : [];
  const rutaElegida = lista[elegida] ?? lista[0];

  // Hora de salida si el destino es un evento: la calculada con el tráfico previsto
  // (services/rutas/actualizar.ts) o, si aún no está, con la ruta elegida.
  let salida: Date | null = null;
  if (destino?.cita) {
    const guardada = salidas[claveCita(destino.cita.eventoId, destino.cita.dia)];
    if (guardada) salida = new Date(guardada.salida);
    else if (rutaElegida) salida = horaDeSalida(new Date(destino.cita.llegada), rutaElegida.duracionSeg);
  }
  const vaTarde = salida ? salida.getTime() < ahora.getTime() : false;

  // --- Parkings cerca del destino ---
  // Solo en coche o en moto. Se piden al tocar "Parkings cercanos" (cada búsqueda
  // gasta una petición de TomTom; después se guardan un día).
  const conCoche = modo === 'coche' || modo === 'moto';
  const clavePunto = punto ? claveDe(punto) : null;
  const pedidos = !!clavePunto && verParkings === clavePunto;
  useEffect(() => {
    if (!pedidos || !punto || !clavePunto) return;
    let activo = true;
    buscarParkings(punto).then((resultado) => {
      if (activo) setParkingsDe({ clave: clavePunto, resultado });
    });
    return () => {
      activo = false;
    };
    // clavePunto resume el destino.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, clavePunto]);
  const parkings: EstadoParkings = !pedidos
    ? null
    : parkingsDe?.clave === clavePunto
      ? parkingsDe.resultado
      : { estado: 'cargando' };
  // Cuándo llegarás: a la hora del evento o ahora más lo que se tarda.
  const llegada = destino?.cita
    ? new Date(destino.cita.llegada)
    : new Date(ahora.getTime() + (rutaElegida?.duracionSeg ?? 0) * 1000);
  const ordenados = parkings?.estado === 'ok' ? ordenarParkings(parkings.parkings, llenos, llegada) : [];

  async function irAlParking(parking: Parking) {
    if (!punto || !destino) return;
    setAvisoParking(null);
    await empezarAparcar({ destinoNombre: destino.nombre, destino: punto, parkings: ordenados, actual: parking.id });
    await abrirEnNavegador(parking.punto);
  }

  // "Está lleno, llévame a otro": lo apunta (así aprende) y abre el siguiente.
  async function estaLleno() {
    const siguiente = await parkingLleno();
    if (siguiente) {
      setAvisoParking(null);
      await abrirEnNavegador(siguiente.punto);
    } else {
      setAvisoParking('No quedan más parkings cerca de ahí. Prueba a buscar otro sitio.');
    }
  }

  // Mientras vas a un parking, el mapa lo enseña aunque no hayas elegido destino aquí
  // (por ejemplo, al volver a la app desde Waze).
  const actual = aparcando?.parkings.find((p) => p.id === aparcando.actual) ?? null;
  const enMapa = {
    destino: punto ?? aparcando?.destino ?? null,
    parkings: ordenados.length > 0 ? ordenados.slice(0, PARKINGS_A_LA_VISTA) : !punto ? (aparcando?.parkings ?? []) : [],
  };

  const propuestas = destino ? [] : sugerencias(perfil, eventos, ahora, texto);

  return (
    <Pantalla>
      {aparcando && actual ? (
        <Tarjeta>
          <Texto fuerte>Vas al parking {actual.nombre}</Texto>
          <Texto pequeno secundario>
            {textoAndando(actual.distanciaM)} ({aparcando.destinoNombre}).
          </Texto>
          <View style={estilos.botones}>
            <Boton titulo="Está lleno, llévame a otro" onPress={estaLleno} />
            <Boton
              variante="secundario"
              titulo={`Volver a abrir ${NOMBRE_NAVEGADOR[app]}`}
              onPress={() => abrirEnNavegador(actual.punto)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={terminarAparcar}
            style={({ pressed }) => [estilos.enlaceFila, pressed && estilos.pulsado]}>
            <Texto style={estilos.enlace}>Ya he aparcado</Texto>
          </Pressable>
        </Tarjeta>
      ) : null}
      {avisoParking ? <Texto style={estilos.tarde}>{avisoParking}</Texto> : null}

      <Titulo>¿A dónde vas?</Titulo>
      <View style={estilos.buscador}>
        <View style={estilos.campo}>
          <CampoTexto
            value={texto}
            onChangeText={setTexto}
            placeholder="Un sitio o una dirección"
            accessibilityLabel="¿A dónde vas?"
            returnKeyType="search"
            onSubmitEditing={buscarTexto}
            error={errorBusqueda}
          />
        </View>
        <Boton titulo="Buscar" onPress={buscarTexto} disabled={buscando || !texto.trim()} />
      </View>
      {usaOpenStreetMap && texto.trim() ? (
        <Texto pequeno secundario>
          {ATRIBUCION_OPENSTREETMAP}
        </Texto>
      ) : null}
      {buscando ? <Texto secundario>Buscando…</Texto> : null}

      {propuestas.length > 0 ? (
        <View style={estilos.lista}>
          {propuestas.map((d) => (
            <FilaDestino key={d.id} destino={d} alPulsar={() => elegirDestino(d)} />
          ))}
        </View>
      ) : null}

      {destino ? (
        <View style={estilos.destino}>
          <View style={estilos.destinoTextos}>
            <Texto fuerte>{destino.nombre}</Texto>
            {destino.detalle ? (
              <Texto pequeno secundario>
                {destino.detalle}
              </Texto>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDestino(null)}
            style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
            <Texto style={estilos.enlace}>Cambiar</Texto>
          </Pressable>
        </View>
      ) : null}

      <MapaRuta
        style={estilos.mapa}
        ubicacion={ubicacion}
        destino={enMapa.destino}
        rutas={lista}
        elegida={rutaElegida ? lista.indexOf(rutaElegida) : 0}
        alElegir={setElegida}
        parkings={enMapa.parkings}
        parkingElegido={aparcando?.actual ?? null}
        centroInicial={casa}
      />
      <Leyenda conParkings={enMapa.parkings.length > 0} />

      {sinPermiso ? (
        <Boton variante="secundario" titulo="Usar mi ubicación" onPress={usarMiUbicacion} />
      ) : null}

      {destino && punto ? (
        <>
          {salida ? (
            <Tarjeta>
              <Texto fuerte style={vaTarde ? estilos.tarde : null}>
                {vaTarde ? `Vas justo: tenías que salir a las ${formatearHora(salida)}` : `Sal a las ${formatearHora(salida)}`}
              </Texto>
              {destino.cita ? (
                <Texto pequeno secundario>
                  Para llegar a las {formatearHora(new Date(destino.cita.llegada))}, con el tráfico previsto y 5 min de
                  margen. A esa hora te aviso y, al tocar el aviso, se abre {NOMBRE_NAVEGADOR[app]}.
                </Texto>
              ) : null}
            </Tarjeta>
          ) : null}

          <EstadoDeRutas rutas={rutas} modo={modo} origen={origen} />

          {lista.length > 0 ? (
            <View style={estilos.lista}>
              {lista.map((r, i) => (
                <TarjetaRuta
                  key={i}
                  numero={i + 1}
                  ruta={r}
                  elegida={r === rutaElegida}
                  alPulsar={() => setElegida(i)}
                />
              ))}
            </View>
          ) : null}

          <View style={estilos.botones}>
            <Boton titulo={`Ir con ${NOMBRE_NAVEGADOR[app]}`} onPress={() => abrirEnNavegador(punto)} />
            {conCoche && !pedidos ? (
              <Boton variante="secundario" titulo="Parkings cercanos" onPress={() => setVerParkings(clavePunto)} />
            ) : null}
          </View>

          {pedidos ? <SeccionParkings estado={parkings} ordenados={ordenados} alElegir={irAlParking} /> : null}
        </>
      ) : null}

      <Tarjeta>
        <Selector
          etiqueta="Abrir siempre con"
          opciones={OPCIONES_NAVEGADOR}
          valor={navegador}
          alCambiar={(nuevo) => guardarNavegador(nuevo)}
        />
        {navegador !== app ? (
          <Texto pequeno secundario>
            Waze solo sirve en coche o en moto: como vas {perfil?.transporte === 'a-pie' ? 'a pie' : 'en transporte público'},
            se abre Google Maps.
          </Texto>
        ) : null}
      </Tarjeta>

      {horasPunta ? (
        <Tarjeta>
          <Texto fuerte>{fraseHorasPunta(horasPunta.horas)}</Texto>
          <Texto pequeno secundario>
            De casa al trabajo y vuelta, un día laborable. Se calcula una vez por semana.
          </Texto>
        </Tarjeta>
      ) : null}

      <Texto pequeno secundario>
        Tráfico, rutas y parkings: TomTom.
      </Texto>
    </Pantalla>
  );
}

function SeccionParkings({
  estado,
  ordenados,
  alElegir,
}: {
  estado: EstadoParkings;
  ordenados: ReturnType<typeof ordenarParkings>;
  alElegir: (parking: Parking) => void;
}) {
  if (!estado) return null;
  if (estado.estado === 'cargando') return <Texto secundario>Buscando parkings cerca…</Texto>;
  if (estado.estado === 'sin-servidor') {
    return <Texto secundario>Los parkings todavía no están activados en esta versión.</Texto>;
  }
  if (estado.estado === 'error') return <Texto style={estilos.tarde}>{estado.mensaje}</Texto>;
  if (ordenados.length === 0) return <Texto secundario>No encuentro parkings a menos de 1 km de ahí.</Texto>;
  return (
    <View style={estilos.lista}>
      <Titulo nivel={3}>Parkings cercanos</Titulo>
      {ordenados.slice(0, PARKINGS_A_LA_VISTA).map((p) => (
        <FilaParking key={p.id} parking={p} alPulsar={() => alElegir(p)} />
      ))}
      <Texto pequeno secundario>
        Toca uno y te llevo. Si al llegar está lleno, abre Organizy y pulsa «Está lleno, llévame a otro»: te mando al
        siguiente y me apunto la hora, para proponerte otro la próxima vez.
      </Texto>
    </View>
  );
}

function EstadoDeRutas({ rutas, modo, origen }: { rutas: EstadoRutas; modo: string | null; origen: Punto | null }) {
  if (!modo) {
    return (
      <Texto secundario>
        En transporte público no hay tráfico que calcular: ábrelo en Google Maps y te da los horarios.
      </Texto>
    );
  }
  if (!origen) {
    return <Texto secundario>Para calcular la ruta necesito saber dónde estás o tener tu casa en Perfil.</Texto>;
  }
  if (!rutas) return null;
  if (rutas.estado === 'cargando') return <Texto secundario>Calculando rutas con el tráfico de ahora…</Texto>;
  if (rutas.estado === 'sin-servidor') {
    return (
      <Texto secundario>
        Las rutas con tráfico todavía no están activadas en esta versión. Mientras, puedes abrir el destino en tu app de
        mapas.
      </Texto>
    );
  }
  if (rutas.estado === 'error') return <Texto style={estilos.tarde}>{rutas.mensaje}</Texto>;
  if (rutas.rutas.length === 0) return <Texto secundario>No encuentro una ruta por carretera hasta ahí.</Texto>;
  return null;
}

const estilos = StyleSheet.create({
  buscador: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start' },
  campo: { flex: 1 },
  lista: { gap: espacio.s },
  botones: { gap: espacio.s },
  destino: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  destinoTextos: { flex: 1 },
  quitar: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  enlaceFila: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  enlace: { color: colores.principal, fontFamily: fuentes.textoFuerte },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  mapa: { height: 340, borderRadius: radio.grande },
  tarde: { color: colores.aviso },
});
