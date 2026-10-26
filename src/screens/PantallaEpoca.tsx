import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, BotonAtras, Interruptor, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { useEnergia } from '@/data/energia';
import {
  borrarEpoca,
  guardarEpoca,
  terminarEpoca,
  useEpocas,
  type AvisosEpoca,
  type Epoca,
  type RegistroBloque,
} from '@/data/epocas';
import { useEventos } from '@/data/eventos';
import { usePerfil, type Perfil } from '@/data/perfil';
import { resolverLugar } from '@/services/agenda';
import { avisosDisponibles } from '@/services/avisos';
import {
  cuentaAtras,
  epocaActiva,
  esDiaLibre,
  estadoEpoca,
  lugarDelDia,
  planificarEpoca,
  progresoHitos,
  progresoSemana,
  resumenEpoca,
  temaActual,
  textoHoras,
  textoQuedan,
  type PlanEpoca,
} from '@/services/epoca';
import { claveDia, DIAS_SEMANA_LETRA, fechaDesdeClave, formatearDiaCorto, sumarDias } from '@/services/fechas';
import { alturaTactil, colores, espacio, radio } from '@/theme';

import { BarraHoras } from './epoca/BarraHoras';
import { RepasoIA } from './epoca/RepasoIA';
import { DESCANSO_TEXTO, formatoHoras, NOMBRE_TIPO, NOMBRES_DIAS } from './epoca/textos';

// Pestaña Época dorada (/epoca o /epoca?id=...). Sin id enseña la activa;
// si no hay ninguna, explica el modo y deja crear una. Con id, "Volver" quita el id.

const dia = (clave: string) => formatearDiaCorto(fechaDesdeClave(clave));

export function PantallaEpoca() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const hoy = claveDia(new Date());
  const { cargado, epocas, registro } = useEpocas();
  const { eventos } = useEventos();
  const { perfil } = usePerfil();
  const [energia] = useEnergia(hoy);

  const epoca = id ? (epocas.find((e) => e.id === id) ?? null) : epocaActiva(epocas, hoy);
  const plan = epoca ? planificarEpoca({ epoca, eventos, registro, hoy, energias: { [hoy]: energia } }) : null;

  return (
    <Pantalla>
      {id ? <BotonAtras texto="Época dorada" etiqueta="Volver" onPress={() => router.setParams({ id: undefined })} /> : null}
      {!cargado ? (
        <Texto secundario>Cargando…</Texto>
      ) : epoca && plan ? (
        <DetalleEpoca epoca={epoca} plan={plan} registro={registro} perfil={perfil} hoy={hoy} />
      ) : id ? (
        <Texto>Esta época ya no existe.</Texto>
      ) : (
        <SinEpoca epocas={epocas} hoy={hoy} />
      )}
    </Pantalla>
  );
}

// Sin época activa: qué es el modo, las programadas y el botón para crear una.
function SinEpoca({ epocas, hoy }: { epocas: Epoca[]; hoy: string }) {
  const programadas = epocas
    .filter((e) => estadoEpoca(e, hoy) === 'programada')
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return (
    <>
      <Etiqueta />
      <Titulo>Época dorada</Titulo>
      <Texto>
        Para épocas de exámenes o de mucho trabajo. Me cuentas cómo va a ser (horario, dónde vas, qué exámenes o
        entregas tienes) y te preparo un plan de estudio día a día, con descansos, que respeta lo que ya tienes en
        el calendario. Cuando termina, vuelves a tu ritmo de siempre.
      </Texto>
      <Boton titulo="Crear una época dorada" onPress={() => router.push('/epoca-editar')} />
      {programadas.length > 0 ? (
        <>
          <Titulo nivel={2} style={estilos.seccion}>
            Programadas
          </Titulo>
          {programadas.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => router.setParams({ id: e.id })}
              style={({ pressed }) => [estilos.filaEpoca, pressed && estilos.pulsado]}>
              <View style={estilos.textos}>
                <Texto fuerte>{e.nombre}</Texto>
                <Texto pequeno secundario>
                  Empieza el {dia(e.inicio)} · termina el {dia(e.fin)}
                </Texto>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colores.textoSecundario} />
            </Pressable>
          ))}
        </>
      ) : null}
    </>
  );
}

type PropsDetalle = {
  epoca: Epoca;
  plan: PlanEpoca;
  registro: RegistroBloque[];
  perfil: Perfil | null;
  hoy: string;
};

function DetalleEpoca({ epoca, plan, registro, perfil, hoy }: PropsDetalle) {
  const [confirmar, setConfirmar] = useState<'terminar' | 'borrar' | null>(null);
  const estado = estadoEpoca(epoca, hoy);
  const siguiente = estado !== 'pasada' ? cuentaAtras(epoca, new Date()) : null;
  const hitos = progresoHitos(epoca, registro, plan);
  const semana = progresoSemana(epoca, registro, plan, hoy);
  const { ritmo } = epoca;
  const lugar = resolverLugar(ritmo.lugar, perfil);
  const nombreHito = (id: string) => epoca.hitos.find((h) => h.id === id)?.nombre ?? 'Estudio';

  const cuando =
    estado === 'activa'
      ? `Activa · ${textoQuedan(epoca, hoy)}`
      : estado === 'programada'
        ? `Empieza el ${dia(epoca.inicio)}`
        : `Terminó el ${dia(epoca.fin)}`;

  // Próximos 7 días desde hoy (o desde que empieza).
  const desde = epoca.inicio > hoy ? epoca.inicio : hoy;
  const proximos = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)).filter((d) => d <= epoca.fin);

  const cambiarAvisos = (cambios: Partial<AvisosEpoca>) =>
    guardarEpoca({ ...epoca, avisos: { ...epoca.avisos, ...cambios } });

  return (
    <>
      <Etiqueta />
      <Titulo>{epoca.nombre}</Titulo>
      <Texto secundario>
        {NOMBRE_TIPO[epoca.tipo]} · del {dia(epoca.inicio)} al {dia(epoca.fin)}
      </Texto>
      <Texto fuerte>{cuando}</Texto>

      {estado === 'pasada' ? <Resumen epoca={epoca} registro={registro} hoy={hoy} /> : null}

      {siguiente ? (
        <View style={estilos.cuenta}>
          <Ionicons name="hourglass-outline" size={20} color={colores.texto} />
          <Titulo nivel={3}>{siguiente.texto}</Titulo>
        </View>
      ) : null}

      {estado !== 'pasada' ? (
        <>
          <Titulo nivel={2} style={estilos.seccion}>
            Progreso
          </Titulo>
          <Tarjeta style={estilos.progreso}>
            <BarraHoras etiqueta="Esta semana" hechoMin={semana.hechoMin} totalMin={semana.planeadoMin} />
          </Tarjeta>

          <Titulo nivel={2} style={estilos.seccion}>
            Próximos días
          </Titulo>
          {proximos.map((d) => {
            const bloques = plan.bloques.filter((b) => b.dia === d && b.estado !== 'saltado');
            const minutos = bloques.reduce((t, b) => t + (b.fin - b.inicio), 0);
            const hitosDelDia = epoca.hitos.filter((h) => h.fecha === d);
            const sitio = resolverLugar(lugarDelDia(epoca, d), perfil);
            const detalle = esDiaLibre(epoca, d)
              ? 'Día libre'
              : bloques.length === 0
                ? 'Sin bloques'
                : `${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'} · ${textoHoras(minutos)}${
                    sitio ? ` · ${sitio.nombre ?? sitio.direccion}` : ''
                  }`;
            const temas = [...new Set(bloques.map((b) => nombreHito(b.hitoId)))].join(', ');
            return (
              <View key={d} style={estilos.dia}>
                <View style={estilos.textos}>
                  <Texto fuerte>{d === hoy ? `Hoy, ${dia(d)}` : dia(d)}</Texto>
                  <Texto pequeno secundario>
                    {detalle}
                    {temas ? ` · ${temas}` : ''}
                  </Texto>
                  {hitosDelDia.map((h) => (
                    <Texto key={h.id} pequeno fuerte>
                      ★ {h.nombre} a las {h.hora}
                    </Texto>
                  ))}
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      <Titulo nivel={2} style={estilos.seccion}>
        Hitos
      </Titulo>
      {hitos.length === 0 ? <Texto secundario>Aún no hay hitos: sin ellos no hay plan.</Texto> : null}
      <Tarjeta style={estilos.progreso}>
        {hitos.map((p) => (
          <View key={p.hito.id} style={estilos.hito}>
            <BarraHoras
              etiqueta={`${p.hito.nombre} · ${dia(p.hito.fecha)} ${p.hito.hora}`}
              hechoMin={p.hechoMin}
              totalMin={p.totalMin}
            />
            {(() => {
              const actual = temaActual(p.hito, p.hechoMin);
              if (!actual) return null;
              return (
                <Texto pequeno secundario>
                  {actual.terminado
                    ? 'Temas terminados: ahora, repasar.'
                    : `Toca: ${actual.tema.nombre} (${actual.numero} de ${actual.total})`}
                </Texto>
              );
            })()}
            {p.faltanMin > 0 && estado !== 'pasada' ? (
              <Texto pequeno fuerte style={estilos.aviso}>
                No caben {textoHoras(p.faltanMin)} antes de la fecha. Sube las horas al día o libera algo del
                calendario.
              </Texto>
            ) : null}
          </View>
        ))}
      </Tarjeta>
      <Boton
        variante="secundario"
        titulo="Hitos y temarios"
        onPress={() => router.push({ pathname: '/epoca-editar', params: { id: epoca.id, paso: '3' } })}
      />

      {estado === 'activa' && hitos.some((p) => p.hito.fecha >= hoy) ? (
        <>
          <Titulo nivel={2} style={estilos.seccion}>
            ¿Cómo lo llevas?
          </Titulo>
          <RepasoIA epoca={epoca} registro={registro} plan={plan} />
        </>
      ) : null}

      <Titulo nivel={2} style={estilos.seccion}>
        Tu ritmo
      </Titulo>
      <Tarjeta>
        <Texto>
          {ritmo.levantarse} – {ritmo.acostarse} · {formatoHoras(ritmo.horasDia)} al día · {DESCANSO_TEXTO[ritmo.descanso]}
        </Texto>
        <Texto secundario>
          {lugar ? (lugar.nombre ?? lugar.direccion) : 'Casa'} los días{' '}
          {ritmo.diasVas.map((d) => DIAS_SEMANA_LETRA[d]).join(' ') || 'ninguno'} (los demás, en casa)
          {ritmo.diaLibre !== null ? ` · Día libre: ${NOMBRES_DIAS[ritmo.diaLibre].toLocaleLowerCase('es-ES')}` : ''}
        </Texto>
        {ritmo.imprescindibles.length > 0 ? (
          <Texto secundario>
            Sin tocar: {ritmo.imprescindibles.map((i) => `${i.nombre} (${i.horaInicio})`).join(', ')}
          </Texto>
        ) : null}
      </Tarjeta>
      <Boton
        variante="secundario"
        titulo="Editar la época"
        onPress={() => router.push({ pathname: '/epoca-editar', params: { id: epoca.id } })}
      />

      {estado !== 'pasada' ? (
        <>
          <Titulo nivel={2} style={estilos.seccion}>
            Avisos de la época
          </Titulo>
          {avisosDisponibles ? (
            <>
              <Interruptor
                etiqueta="Hora de salir"
                ayuda={`Cuando toca salir hacia tu sitio de estudio (${ritmo.trayectoMin} min antes del primer bloque).`}
                valor={epoca.avisos.salir}
                alCambiar={(salir) => cambiarAvisos({ salir })}
              />
              <Interruptor
                etiqueta="Inicio de cada bloque"
                valor={epoca.avisos.inicioBloque}
                alCambiar={(inicioBloque) => cambiarAvisos({ inicioBloque })}
              />
              <Interruptor
                etiqueta="Fin del descanso"
                valor={epoca.avisos.finDescanso}
                alCambiar={(finDescanso) => cambiarAvisos({ finDescanso })}
              />
              <Interruptor
                etiqueta="Hora de ir a dormir"
                ayuda={`A las ${ritmo.acostarse}, tu hora de acostarte en esta época.`}
                valor={epoca.avisos.dormir}
                alCambiar={(dormir) => cambiarAvisos({ dormir })}
              />
            </>
          ) : (
            <Texto secundario>
              Los avisos de la época (hora de salir, inicio de cada bloque, fin del descanso y hora de dormir) solo
              llegan en la app del móvil: el navegador no puede mandarlos con la web cerrada.
            </Texto>
          )}
        </>
      ) : null}

      <Titulo nivel={2} style={estilos.seccion}>
        Más
      </Titulo>
      {confirmar ? (
        <Tarjeta style={estilos.confirmar}>
          <Titulo nivel={3}>
            {confirmar === 'terminar' ? '¿Terminar la época hoy?' : `¿Borrar «${epoca.nombre}»?`}
          </Titulo>
          <Texto secundario>
            {confirmar === 'terminar'
              ? 'Vuelves ya a tu ritmo normal y te enseño el resumen. Lo hecho se queda guardado.'
              : 'Se borran la época, sus hitos y lo que marcaste. No se puede deshacer.'}
          </Texto>
          <Boton
            titulo={confirmar === 'terminar' ? 'Sí, terminarla' : 'Sí, borrarla'}
            onPress={async () => {
              if (confirmar === 'terminar') {
                await terminarEpoca(epoca.id);
                setConfirmar(null);
              } else {
                router.setParams({ id: undefined });
                await borrarEpoca(epoca.id);
              }
            }}
          />
          <Boton variante="secundario" titulo="No" onPress={() => setConfirmar(null)} />
        </Tarjeta>
      ) : (
        <>
          {estado === 'activa' ? (
            <Boton variante="secundario" titulo="Terminar la época hoy" onPress={() => setConfirmar('terminar')} />
          ) : null}
          <Boton variante="secundario" titulo="Borrar la época" onPress={() => setConfirmar('borrar')} />
        </>
      )}
    </>
  );
}

function Resumen({ epoca, registro, hoy }: { epoca: Epoca; registro: RegistroBloque[]; hoy: string }) {
  const r = resumenEpoca(epoca, registro, hoy);
  return (
    <Tarjeta style={estilos.resumen}>
      <Titulo nivel={3}>Resumen</Titulo>
      <Texto>{textoHoras(r.minutosHechos)} de trabajo</Texto>
      <Texto>
        {r.bloquesHechos} {r.bloquesHechos === 1 ? 'bloque completado' : 'bloques completados'}
      </Texto>
      <Texto>
        {r.hitosSuperados} de {r.hitosTotal} {r.hitosTotal === 1 ? 'hito superado' : 'hitos superados'}
      </Texto>
    </Tarjeta>
  );
}

function Etiqueta() {
  return (
    <View style={estilos.etiqueta}>
      <Ionicons name="star" size={14} color={colores.textoOscuro} />
      <Texto pequeno fuerte style={estilos.textoEtiqueta}>
        Época dorada
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  pulsado: { transform: [{ scale: 0.98 }] },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacio.xs,
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    borderRadius: radio.chip,
    backgroundColor: colores.dorado,
  },
  textoEtiqueta: { color: colores.textoOscuro },
  seccion: { marginTop: espacio.m },
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.s },
  progreso: { gap: espacio.m },
  hito: { gap: espacio.xs },
  aviso: { color: colores.aviso },
  dia: {
    flexDirection: 'row',
    paddingVertical: espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  textos: { flex: 1, gap: 2 },
  filaEpoca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: alturaTactil + 12,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
    borderLeftColor: colores.dorado,
    borderRadius: radio.grande - 4,
  },
  resumen: { borderColor: colores.dorado, borderWidth: 2 },
  confirmar: { borderColor: colores.aviso, borderWidth: 2, gap: espacio.m },
});
