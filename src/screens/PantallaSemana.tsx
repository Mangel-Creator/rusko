import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig } from 'react-native-reanimated';

import { BotonFlotante, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { useDensidad } from '@/data/densidad';
import { useEventos, type Evento } from '@/data/eventos';
import { useEnergia } from '@/data/energia';
import { useEpocas, type Epoca } from '@/data/epocas';
import { usePerfil } from '@/data/perfil';
import {
  cargaDelDia,
  colocarEnCarriles,
  duracionTarea,
  eventosDelDia,
  intervaloDe,
  minutosDeJornada,
  tareasPendientes,
  ventanaDelDia,
} from '@/services/agenda';
import {
  epocaActiva,
  eventoDeBloque,
  imprescindiblesDelDia,
  planificarEpoca,
  PREFIJO_EPOCA,
  ventanaEpoca,
  type PlanEpoca,
} from '@/services/epoca';
import {
  DIAS_SEMANA_LETRA,
  claveDia,
  fechaDesdeClave,
  formatearDiaCorto,
  formatearDuracion,
  horaDesdeMinutos,
  inicioDeSemana,
  minutosDelDia,
  nombreMes,
  numeroSemana,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';
import { alturaTactil, cifras, colores, colorEvento, colorTipo, espacio, fuentes, radio, tamanos } from '@/theme';

import { DURACION_POR_DEFECTO, horaParaHueco, huecosParaPlan } from '@/services/planes/sugerencias';

import { abrirEvento, nuevoEvento, rangoHoras } from './calendario/textos';
import { useAhora } from './calendario/useAhora';
import { HuecoPlan } from './planes/HuecoPlan';

const ALTURA_BARRA = 44;
// Al cambiar de día, lo de ese día aparece con un fundido corto para que se note el
// cambio. No se anima al abrir la pantalla ni con "reducir movimiento" activado.
const CAMBIO_DE_DIA = FadeIn.duration(160);

export function PantallaSemana() {
  const ahora = useAhora();
  const hoy = claveDia(ahora);
  const [elegido, setElegido] = useState<ClaveDia>(hoy);
  const { perfil } = usePerfil();
  const { eventos } = useEventos();
  const { epocas, registro } = useEpocas();
  const [energiaHoy] = useEnergia(hoy);

  const lunes = claveDia(inicioDeSemana(fechaDesdeClave(elegido)));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const jornada = minutosDeJornada(perfil);

  // Época dorada (fase 4b): los días de una época usan su horario para la carga y
  // la línea de horas, y enseñan sus bloques de estudio (de hoy en adelante, el
  // plan; los días pasados, lo que se hizo) y lo que no quiere dejar de hacer.
  const planes = new Map<string, PlanEpoca>();
  const planDe = (epoca: Epoca) => {
    const guardado = planes.get(epoca.id);
    if (guardado) return guardado;
    const plan = planificarEpoca({ epoca, eventos, registro, hoy, energias: { [hoy]: energiaHoy } });
    planes.set(epoca.id, plan);
    return plan;
  };
  const delDiaConEpoca = (dia: ClaveDia) => {
    const epoca = epocaActiva(epocas, dia);
    const propios = eventosDelDia(eventos, dia);
    if (!epoca) return { epoca: null, eventos: propios, ventana: ventanaDelDia(perfil), jornada };
    const bloques =
      dia >= hoy
        ? planDe(epoca).bloques.filter((b) => b.dia === dia && b.estado !== 'saltado')
        : registro.filter((r) => r.epocaId === epoca.id && r.dia === dia && r.estado === 'hecho');
    const todos = [
      ...propios,
      ...imprescindiblesDelDia(epoca, dia),
      ...bloques.map((b) => eventoDeBloque(epoca, b)),
    ].sort((a, b) => intervaloDe(a).inicio - intervaloDe(b).inicio);
    const ventana = ventanaEpoca(epoca);
    return { epoca, eventos: todos, ventana, jornada: ventana.fin - ventana.inicio };
  };
  const fechaElegida = fechaDesdeClave(elegido);

  const cambiarSemana = (semanas: number) => setElegido((actual) => sumarDias(actual, 7 * semanas));
  // Deslizar a los lados sobre la tira de días cambia de semana.
  const [deslizar] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) setElegido((actual) => sumarDias(actual, 7));
        else if (g.dx > 50) setElegido((actual) => sumarDias(actual, -7));
      },
    }),
  );

  const diaElegido = delDiaConEpoca(elegido);
  const delDia = diaElegido.eventos;
  const hitosElegido = diaElegido.epoca?.hitos.filter((h) => h.fecha === elegido) ?? [];
  const tareas = eventos.filter((e) => e.flexible && e.fecha === elegido);
  const huecosPlan = huecosParaPlan(delDia.map(intervaloDe), diaElegido.ventana, elegido, ahora);

  return (
    <View style={estilos.contenedor}>
      <Pantalla contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          <View style={estilos.textos}>
            <Titulo>{nombreMes(fechaDesdeClave(sumarDias(lunes, 3)))}</Titulo>
            <Texto secundario>Semana {numeroSemana(fechaElegida)}</Texto>
          </View>
          <BotonIcono icono="chevron-back" etiqueta="Semana anterior" onPress={() => cambiarSemana(-1)} />
          <BotonIcono icono="chevron-forward" etiqueta="Semana siguiente" onPress={() => cambiarSemana(1)} />
        </View>

        <View style={estilos.leyendaFila}>
          <View style={estilos.leyenda}>
            <Leyenda color={colorTipo.cliente} texto="Clientes" />
            <Leyenda color={colorTipo.amigos} texto="Amigos" />
            <Leyenda color={colorTipo.yo} texto="Yo" />
          </View>
          {elegido !== hoy ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a hoy"
              onPress={() => setElegido(hoy)}
              style={({ pressed }) => [estilos.botonHoy, pressed && estilos.pulsado]}>
              <Texto fuerte pequeno>
                Hoy
              </Texto>
            </Pressable>
          ) : null}
        </View>

        <Tarjeta style={estilos.tira} {...deslizar.panHandlers}>
          {dias.map((dia, i) => {
            const conEpoca = delDiaConEpoca(dia);
            const ocupados = conEpoca.eventos.map(intervaloDe);
            const hayHito = conEpoca.epoca?.hitos.some((h) => h.fecha === dia) ?? false;
            const minutosTareas = tareasPendientes(eventos, dia, hoy).reduce((t, e) => t + duracionTarea(e), 0);
            const carga = cargaDelDia(ocupados, minutosTareas, conEpoca.jornada);
            const esElegido = dia === elegido;
            const fecha = fechaDesdeClave(dia);
            return (
              <Pressable
                key={dia}
                accessibilityRole="button"
                accessibilityLabel={`${formatearDiaCorto(fecha)}, ${Math.round(carga.proporcion * 100)} % ocupado${hayHito ? ', con examen o entrega' : ''}`}
                accessibilityState={{ selected: esElegido }}
                onPress={() => setElegido(dia)}
                style={({ pressed }) => [estilos.dia, pressed && estilos.pulsado]}>
                <Texto pequeno secundario>
                  {DIAS_SEMANA_LETRA[i]}
                </Texto>
                <View style={[estilos.numero, esElegido && estilos.numeroElegido]}>
                  <Texto
                    fuerte
                    style={[esElegido && estilos.numeroTextoElegido, !esElegido && dia === hoy && estilos.numeroHoy]}>
                    {fecha.getDate()}
                  </Texto>
                </View>
                <View style={[estilos.marcaHito, hayHito && estilos.marcaHitoVisible]} />
                <View style={estilos.barraFondo}>
                  <View
                    style={[
                      estilos.barra,
                      {
                        height: Math.min(carga.proporcion, 1) * ALTURA_BARRA,
                        backgroundColor: carga.alta ? colores.aviso : colores.cargaNormal,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </Tarjeta>

        <LayoutAnimationConfig skipEntering>
          <Animated.View key={elegido} entering={CAMBIO_DE_DIA} style={estilos.contenidoDia}>
            <Titulo nivel={2} style={estilos.seccion}>
              {elegido === hoy ? `Hoy, ${formatearDiaCorto(fechaElegida)}` : formatearDiaCorto(fechaElegida)}
            </Titulo>

            {hitosElegido.map((h) => (
              <Texto key={h.id} fuerte style={estilos.hito}>
                ★ {h.nombre} a las {h.hora}
              </Texto>
            ))}
            {delDia.length === 0 && tareas.length === 0 ? (
              <Texto secundario>Este día lo tienes libre.</Texto>
            ) : null}
            {delDia.length > 0 ? (
              <LineaDeHoras
                eventos={delDia}
                ventana={diaElegido.ventana}
                minutoAhora={elegido === hoy ? minutosDelDia(ahora) : null}
              />
            ) : null}

            {/* Huecos de 2 h o más: "Proponer plan" abre el formulario con esa hora (fase 8). */}
            {huecosPlan.map((hueco) => (
              <HuecoPlan
                key={hueco.inicio}
                hueco={hueco}
                alProponer={() =>
                  router.push({
                    pathname: '/plan-nuevo',
                    params: {
                      dia: elegido,
                      hora: horaParaHueco(hueco, elegido, perfil, DURACION_POR_DEFECTO.amigos),
                    },
                  })
                }
              />
            ))}

            {tareas.length > 0 ? (
              <>
                <Titulo nivel={3} style={estilos.seccion}>
                  Sin hora fija
                </Titulo>
                {tareas.map((tarea) => (
                  <Pressable
                    key={tarea.id}
                    accessibilityRole="button"
                    onPress={() => abrirEvento(tarea.id)}
                    style={({ pressed }) => [
                    estilos.tarea,
                    { borderLeftColor: colorEvento(tarea) },
                    pressed && estilos.pulsado,
                  ]}>
                    <Ionicons
                      name={tarea.hecha ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={colores.texto}
                    />
                    <Texto style={[estilos.textos, tarea.hecha && estilos.tachada]}>{tarea.titulo}</Texto>
                    <Texto pequeno secundario>
                      {formatearDuracion(duracionTarea(tarea))}
                    </Texto>
                  </Pressable>
                ))}
              </>
            ) : null}
          </Animated.View>
        </LayoutAnimationConfig>
      </Pantalla>
      <BotonFlotante etiqueta="Añadir evento" onPress={() => nuevoEvento(elegido)} />
    </View>
  );
}

type PropsLinea = {
  eventos: Evento[];
  ventana: { inicio: number; fin: number };
  minutoAhora: number | null;
};

// Día con su línea de horas: cada evento ocupa la altura de lo que dura.
function LineaDeHoras({ eventos, ventana, minutoAhora }: PropsLinea) {
  const tramos = eventos.map(intervaloDe);
  const desde = Math.floor(Math.min(ventana.inicio, ...tramos.map((t) => t.inicio)) / 60) * 60;
  const hasta = Math.ceil(Math.max(ventana.fin, ...tramos.map((t) => t.fin)) / 60) * 60;
  const { medidas } = useDensidad();
  const y = (minuto: number) => ((minuto - desde) / 60) * medidas.pxPorHora;
  const horas = Array.from({ length: (hasta - desde) / 60 + 1 }, (_, i) => desde + i * 60);

  return (
    <View style={[estilos.linea, { height: y(hasta) }]}>
      {horas.map((minuto) => (
        <View key={minuto} style={[estilos.marcaHora, { top: y(minuto) }]}>
          <Texto pequeno secundario style={estilos.etiquetaHora}>
            {horaDesdeMinutos(minuto)}
          </Texto>
          <View style={estilos.rayaHora} />
        </View>
      ))}

      <View style={estilos.zonaEventos}>
        {colocarEnCarriles(eventos, intervaloDe).map(({ elemento: evento, carril, carriles }) => {
          const { inicio, fin } = intervaloDe(evento);
          const ancho = 100 / carriles;
          return (
            <Pressable
              key={evento.id}
              accessibilityRole="button"
              accessibilityLabel={`${rangoHoras(evento)}, ${evento.titulo}${evento.foco ? ', protegido' : ''}`}
              onPress={() => abrirEvento(evento.id)}
              style={({ pressed }) => [
                estilos.bloque,
                evento.foco ? estilos.bloqueFoco : { borderLeftColor: colorEvento(evento) },
                evento.id.startsWith(`${PREFIJO_EPOCA}bloque:`) && estilos.bloqueEpoca,
                {
                  top: y(inicio) + 1,
                  height: Math.max(y(fin) - y(inicio) - 2, 26),
                  left: `${carril * ancho}%`,
                  width: `${ancho}%`,
                },
                pressed && estilos.pulsado,
              ]}>
              <Texto pequeno fuerte numberOfLines={1} style={evento.foco && estilos.textoClaro}>
                {evento.titulo}
              </Texto>
              {y(fin) - y(inicio) >= 40 ? (
                <Texto pequeno numberOfLines={1} style={evento.foco ? estilos.textoClaro : estilos.secundario}>
                  {evento.foco ? `Protegido · ${rangoHoras(evento)}` : rangoHoras(evento)}
                </Texto>
              ) : null}
            </Pressable>
          );
        })}
        {minutoAhora !== null && minutoAhora >= desde && minutoAhora <= hasta ? (
          <View style={[estilos.ahora, { top: y(minutoAhora) }]} accessibilityLabel="Ahora" />
        ) : null}
      </View>
    </View>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <View style={estilos.leyendaItem}>
      <View style={[estilos.punto, { backgroundColor: color }]} />
      <Texto pequeno secundario>
        {texto}
      </Texto>
    </View>
  );
}

type PropsIcono = {
  icono: 'chevron-back' | 'chevron-forward';
  etiqueta: string;
  onPress: () => void;
};

function BotonIcono({ icono, etiqueta, onPress }: PropsIcono) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [estilos.botonIcono, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={22} color={colores.texto} />
    </Pressable>
  );
}

const ANCHO_HORAS = 48;

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  contenido: { paddingBottom: 120 }, // deja sitio al botón "+"
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  textos: { flex: 1 },
  botonIcono: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.normal,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.7 },
  leyendaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leyenda: { flexDirection: 'row', gap: espacio.m },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
  botonHoy: {
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
    justifyContent: 'center',
  },
  tira: { flexDirection: 'row', paddingHorizontal: espacio.xs, gap: 0 },
  dia: { flex: 1, alignItems: 'center', gap: espacio.xs, paddingVertical: espacio.xs },
  numero: {
    width: 36,
    height: 36,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroElegido: { backgroundColor: colores.principal },
  numeroTextoElegido: { color: colores.textoOscuro },
  numeroHoy: { color: colores.principal },
  barraFondo: {
    width: 8,
    height: ALTURA_BARRA,
    borderRadius: radio.chip,
    backgroundColor: colores.fondo,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: { width: '100%', borderRadius: radio.chip },
  seccion: { marginTop: espacio.s },
  contenidoDia: { gap: espacio.m },
  linea: { position: 'relative', marginTop: espacio.s },
  marcaHora: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -9,
  },
  etiquetaHora: { width: ANCHO_HORAS, ...cifras, fontFamily: fuentes.hora, fontSize: 12 },
  rayaHora: { flex: 1, height: 1, backgroundColor: colores.borde },
  zonaEventos: { position: 'absolute', top: 0, bottom: 0, left: ANCHO_HORAS, right: 0 },
  bloque: {
    position: 'absolute',
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4, // barra del color de su tipo
    overflow: 'hidden',
  },
  bloqueFoco: { backgroundColor: colores.acentoSuave, borderLeftColor: colores.principal },
  // Bloques de estudio de la Época dorada: como un bloque de foco, con la barra dorada.
  bloqueEpoca: { borderLeftColor: colores.dorado },
  marcaHito: { width: 6, height: 6, borderRadius: 3 },
  marcaHitoVisible: { backgroundColor: colores.dorado },
  hito: { marginTop: -espacio.s },
  textoClaro: { color: colores.principal },
  secundario: { color: colores.textoSecundario, fontSize: tamanos.pequeno },
  ahora: { position: 'absolute', left: -4, right: 0, height: 2, backgroundColor: colores.principal },
  tarea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: alturaTactil + 8,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4, // barra del color de su tipo
  },
  tachada: { textDecorationLine: 'line-through' },
});
