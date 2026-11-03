import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  Boton,
  CampoTexto,
  Interruptor,
  Plegable,
  Selector,
  SelectorCantidad,
  SelectorFecha,
  SelectorHora,
  SelectorVisual,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
} from '@/components';
import { leerEpocas, nuevoIdEpoca } from '@/data/epocas';
import type { DiaSemana } from '@/data/perfil';
import { guardarPerfilEstudio, leerPerfilEstudio } from '@/data/perfilEstudio';
import { planLocal, type PropuestaEpoca } from '@/services/epoca';
import { supervisarPlan } from '@/services/epoca/ia';
import {
  conRecuentos,
  estimarHoras,
  examenGuardado,
  lineasAprendidas,
  PERFIL_ESTUDIO_VACIO,
  type PerfilEstudio,
} from '@/services/epoca/perfilEstudio';
import {
  HABITOS_VACIOS,
  MAX_ASIGNATURAS,
  MAX_INDICE,
  MAX_OTROS,
  type AsignaturaCuestionario,
  type Avance,
  type HabitosCuestionario,
  type RespuestasCuestionario,
  type TipoExamen,
} from '@/services/epoca/validarIA';
import { sumarDias, type ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

import { ExtrasExamen } from './ExtrasExamen';
import { formatoHoras, NOMBRES_DIAS, OPCIONES_DIFICULTAD, OPCIONES_LEJOS, OPCIONES_MOMENTO_VISUAL } from './textos';

type Props = {
  hoy: ClaveDia;
  alPreparar: (propuesta: PropuestaEpoca) => void;
  alSaltar: () => void;
};

const TIPOS_EXAMEN: Opcion<TipoExamen>[] = [
  { valor: 'test', etiqueta: 'Test' },
  { valor: 'test-resta', etiqueta: 'Test que resta' },
  { valor: 'desarrollo', etiqueta: 'Desarrollo' },
  { valor: 'cortas', etiqueta: 'Preguntas cortas' },
  { valor: 'problemas', etiqueta: 'Problemas' },
  { valor: 'oral', etiqueta: 'Oral' },
  { valor: 'trabajo', etiqueta: 'Trabajo o entrega' },
];

const AVANCES: Opcion<Avance>[] = [
  { valor: 'nada', etiqueta: 'Sin empezar' },
  { valor: 'poco', etiqueta: 'Algo' },
  { valor: 'mitad', etiqueta: 'La mitad' },
  { valor: 'casi', etiqueta: 'Casi todo' },
];

type Pregunta = { clave: keyof HabitosCuestionario; texto: string; opciones: Opcion<string>[] };

// Las preguntas de hábitos salen de las guías de técnicas de estudio del COIE de la UNED.
const PREGUNTAS: Pregunta[] = [
  {
    clave: 'constancia',
    texto: '¿Estudias en el mismo sitio y a la misma hora?',
    opciones: [
      { valor: 'siempre', etiqueta: 'Casi siempre' },
      { valor: 'a-veces', etiqueta: 'A veces' },
      { valor: 'nunca', etiqueta: 'Cada día distinto' },
    ],
  },
  {
    clave: 'concentracion',
    texto: '¿Cuánto aguantas concentrado sin parar?',
    opciones: [
      { valor: 'corta', etiqueta: '20-30 min' },
      { valor: 'media', etiqueta: 'Unos 50 min' },
      { valor: 'larga', etiqueta: 'Más de 1 h' },
    ],
  },
  {
    clave: 'arrancar',
    texto: '¿Te cuesta ponerte a estudiar?',
    opciones: [
      { valor: 'facil', etiqueta: 'No' },
      { valor: 'a-veces', etiqueta: 'A veces' },
      { valor: 'cuesta', etiqueta: 'Mucho, lo dejo para luego' },
    ],
  },
  {
    clave: 'sintesis',
    texto: '¿Haces esquemas o resúmenes?',
    opciones: [
      { valor: 'esquemas', etiqueta: 'Siempre' },
      { valor: 'a-veces', etiqueta: 'A veces' },
      { valor: 'releo', etiqueta: 'No, releo' },
    ],
  },
  {
    clave: 'repasos',
    texto: '¿Repasas antes del examen?',
    opciones: [
      { valor: 'varios', etiqueta: 'Varias veces' },
      { valor: 'final', etiqueta: 'Solo al final' },
      { valor: 'no', etiqueta: 'Casi nunca' },
    ],
  },
  {
    clave: 'lectura',
    texto: '¿Cómo lees?',
    opciones: [
      { valor: 'lenta', etiqueta: 'Despacio' },
      { valor: 'normal', etiqueta: 'Normal' },
      { valor: 'rapida', etiqueta: 'Rápido' },
    ],
  },
  {
    clave: 'memoria',
    texto: '¿Cómo se te queda mejor?',
    opciones: [
      { valor: 'viendo', etiqueta: 'Viendo esquemas' },
      { valor: 'escuchando', etiqueta: 'Escuchando o en voz alta' },
      { valor: 'haciendo', etiqueta: 'Escribiendo o con ejercicios' },
    ],
  },
  {
    clave: 'autoexamen',
    texto: '¿Te haces preguntas para ver lo que sabes (fichas, tests)?',
    opciones: [
      { valor: 'si', etiqueta: 'Sí' },
      { valor: 'no-probado', etiqueta: 'No lo he probado' },
      { valor: 'no-gusta', etiqueta: 'No me gusta' },
    ],
  },
  {
    clave: 'mezclar',
    texto: '¿Cuántas asignaturas estudias en un mismo día?',
    opciones: [
      { valor: 'una', etiqueta: 'Una sola' },
      { valor: 'dos', etiqueta: 'Dos como mucho' },
      { valor: 'mezclo', etiqueta: 'Mezclo varias' },
    ],
  },
  {
    clave: 'entender',
    texto: '¿Te cuesta entender lo nuevo?',
    opciones: [
      { valor: 'rapido', etiqueta: 'No, lo pillo rápido' },
      { valor: 'normal', etiqueta: 'Lo normal' },
      { valor: 'cuesta', etiqueta: 'Sí, necesito más tiempo' },
    ],
  },
  {
    clave: 'memorizar',
    texto: '¿Te cuesta memorizar?',
    opciones: [
      { valor: 'facil', etiqueta: 'No' },
      { valor: 'normal', etiqueta: 'Lo normal' },
      { valor: 'cuesta', etiqueta: 'Sí, se me olvida pronto' },
    ],
  },
  {
    clave: 'distraccion',
    texto: '¿Qué te distrae más?',
    opciones: [
      { valor: 'movil', etiqueta: 'El móvil' },
      { valor: 'ruido', etiqueta: 'El ruido' },
      { valor: 'cansancio', etiqueta: 'El cansancio' },
      { valor: 'nada', etiqueta: 'Nada en especial' },
    ],
  },
  {
    clave: 'nervios',
    texto: '¿Te pones nervioso en los exámenes?',
    opciones: [
      { valor: 'no', etiqueta: 'No' },
      { valor: 'algo', etiqueta: 'Algo' },
      { valor: 'mucho', etiqueta: 'Mucho' },
    ],
  },
];

// Con el examen a más de 10 días (DIAS_CERCA), en qué momento prefiere estudiar.
// Cómo le va según el momento: lejos o cerca del examen, el fin de semana y los imprevistos.
const PREGUNTAS_MOMENTO: Pregunta[] = [
  {
    clave: 'lejos',
    texto: '¿Estudias cuando el examen aún queda lejos?',
    opciones: [
      { valor: 'si', etiqueta: 'Sí, con constancia' },
      { valor: 'a-medias', etiqueta: 'Algo, pero me cuesta' },
      { valor: 'no', etiqueta: 'No, arranco cuando se acerca' },
    ],
  },
  {
    clave: 'cerca',
    texto: '¿Cómo llevas las últimas semanas antes del examen?',
    opciones: [
      { valor: 'mejor', etiqueta: 'Rindo más con la presión' },
      { valor: 'igual', etiqueta: 'Igual que siempre' },
      { valor: 'agobio', etiqueta: 'Me agobio y rindo menos' },
    ],
  },
  {
    clave: 'finde',
    texto: '¿Estudias los fines de semana?',
    opciones: [
      { valor: 'ambos', etiqueta: 'Los dos días' },
      { valor: 'uno', etiqueta: 'Solo un día' },
      { valor: 'poco', etiqueta: 'Un rato cada día' },
      { valor: 'nada', etiqueta: 'No' },
    ],
  },
  {
    clave: 'imprevistos',
    texto: '¿Te surgen imprevistos que te tuercen el plan?',
    opciones: [
      { valor: 'casi-nunca', etiqueta: 'Casi nunca' },
      { valor: 'a-veces', etiqueta: 'A veces' },
      { valor: 'a-menudo', etiqueta: 'A menudo' },
    ],
  },
];

const tieneRespuestas = (p: PerfilEstudio) => Object.values(p.habitos).some((v) => v !== null);

function asignaturaNueva(hoy: ClaveDia): AsignaturaCuestionario {
  return {
    id: nuevoIdEpoca(),
    nombre: '',
    fecha: sumarDias(hoy, 21),
    hora: '09:00',
    tipoExamen: 'test',
    temas: 10,
    avance: 'nada',
    dificultad: 'media',
    anteriores: false,
    indice: '',
  };
}

// Cuestionario a fondo antes del formulario: exámenes, tiempo y cómo estudia.
// La app prepara con él el plan sin IA (services/epoca/planLocal.ts: temas, repasos,
// simulacros y consejos según las guías del COIE de la UNED), la IA (Haiku) lo
// supervisa con un resumen corto y rellena los tres pasos para revisarlos.
// Lo que contesta se guarda en su perfil de estudio (data/perfilEstudio.ts): la
// próxima vez sale ya puesto, junto con lo aprendido de sus planes anteriores.
export function CuestionarioIA({ hoy, alPreparar, alSaltar }: Props) {
  const [asignaturas, setAsignaturas] = useState(() => [asignaturaNueva(hoy)]);
  const [horasDia, setHorasDia] = useState(4);
  const [rindeMas, setRindeMas] = useState<RespuestasCuestionario['rindeMas']>('manana');
  const [rindeLejos, setRindeLejos] = useState<RespuestasCuestionario['rindeMas'] | null>(null);
  const [diaLibre, setDiaLibre] = useState<DiaSemana | null>(null);
  const [habitos, setHabitos] = useState(HABITOS_VACIOS);
  const [otros, setOtros] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const [estudio, setEstudio] = useState<PerfilEstudio | null>(null);
  // Si ya contestó otra vez, las preguntas salen plegadas (no se vuelven a pedir).
  const [yaSabido, setYaSabido] = useState(false);

  // Su perfil de estudio, con lo hecho en sus épocas hasta hoy.
  useEffect(() => {
    let vigente = true;
    Promise.all([leerPerfilEstudio(), leerEpocas()])
      .then(([guardado, { epocas, registro }]) => {
        if (!vigente) return;
        const p = conRecuentos(guardado, epocas, registro);
        setEstudio(p);
        if (tieneRespuestas(p)) {
          setHabitos(p.habitos);
          setYaSabido(true);
        }
        if (p.tiempo) {
          setHorasDia(p.tiempo.horasDia);
          setRindeMas(p.tiempo.rindeMas);
          setRindeLejos(p.tiempo.rindeLejos ?? null);
          setDiaLibre(p.tiempo.diaLibre);
        }
      })
      .catch(() => vigente && setEstudio(PERFIL_ESTUDIO_VACIO));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (estudio) guardarPerfilEstudio(estudio).catch(() => {});
  }, [estudio]);

  const actualizarEstudio = (cambio: (p: PerfilEstudio) => PerfilEstudio) =>
    setEstudio((actual) => cambio(actual ?? PERFIL_ESTUDIO_VACIO));

  const cambiarAsignatura = (id: string, cambios: Partial<AsignaturaCuestionario>) =>
    setAsignaturas((actuales) => actuales.map((a) => (a.id === id ? { ...a, ...cambios } : a)));

  const preparar = async () => {
    if (asignaturas.some((a) => !a.nombre.trim())) {
      setMensaje({ texto: 'Pon nombre a cada examen.', error: true });
      return;
    }
    if (asignaturas.some((a) => a.fecha <= hoy)) {
      setMensaje({ texto: 'Las fechas de los exámenes tienen que ser a partir de mañana.', error: true });
      return;
    }
    setMensaje(null);
    // Sus respuestas se quedan para el próximo plan.
    const nuevo: PerfilEstudio = { ...(estudio ?? PERFIL_ESTUDIO_VACIO), habitos, tiempo: { horasDia, rindeMas, rindeLejos, diaLibre } };
    setEstudio(nuevo);
    const respuestas = { asignaturas: asignaturas.map((a) => ({ ...a, nombre: a.nombre.trim() })), horasDia, rindeMas, rindeLejos, diaLibre, habitos, otros };
    // El plan lo hace la app y la IA lo revisa. Si la IA no está, sale el de la app.
    const local = planLocal(respuestas, nuevo);
    setOcupado(true);
    const r = await supervisarPlan(respuestas, local, nuevo);
    setOcupado(false);
    alPreparar(
      r.estado === 'ok'
        ? r.datos
        : {
            ...local,
            notas: otros.trim()
              ? 'La IA no ha podido revisar el plan ahora, así que no he tenido en cuenta lo que añadiste en «¿Algo más?». Sale de tus demás respuestas: revísalo antes de guardar.'
              : 'La IA no ha podido revisar el plan ahora. Sale de tus respuestas con las reglas de Rusko: revísalo antes de guardar.',
          },
    );
  };

  const opcionesLibre: Opcion<string>[] = [
    { valor: 'ninguno', etiqueta: 'Ninguno' },
    ...NOMBRES_DIAS.map((nombre, i) => ({ valor: String(i), etiqueta: nombre })),
  ];

  const ritmo = { habitos, ritmo: estudio?.ritmo ?? 1 };
  const aprendido = estudio ? lineasAprendidas(estudio, true) : [];
  const selectores = (preguntas: Pregunta[]) =>
    preguntas.map((p) => (
      <Selector
        key={p.clave}
        etiqueta={p.texto}
        opciones={p.opciones}
        valor={habitos[p.clave]}
        alCambiar={(valor) => setHabitos((actuales) => ({ ...actuales, [p.clave]: valor }))}
      />
    ));
  const preguntasHabitos = (
    <>
      <Texto secundario>Contesta lo que quieras. Con esto ajusto el tiempo, los descansos, los repasos y los consejos.</Texto>
      {selectores(PREGUNTAS)}
      <Titulo nivel={3}>Según el momento</Titulo>
      {selectores(PREGUNTAS_MOMENTO)}
    </>
  );

  return (
    <>
      <Titulo>Tu plan de estudio</Titulo>
      <Texto secundario>
        {yaSabido
          ? 'Ya sé cómo estudias de la otra vez. Dime los exámenes y preparo tu plan: temas, repasos y simulacros según las guías del COIE de la UNED.'
          : 'Unas preguntas (unos 4 minutos, solo esta vez: me las guardo). Con ellas preparo tu plan: temas, repasos y simulacros según las guías de técnicas de estudio del COIE de la UNED. Luego lo revisas todo antes de guardar.'}
      </Texto>
      {aprendido.length > 0 ? (
        <Tarjeta style={estilos.tarjeta}>
          <Titulo nivel={3}>Lo que he aprendido de ti</Titulo>
          {aprendido.map((linea) => (
            <Texto key={linea}>{linea}</Texto>
          ))}
          <Texto pequeno secundario>
            Lo tengo en cuenta para este plan.
          </Texto>
        </Tarjeta>
      ) : null}

      <Titulo nivel={2}>Tus exámenes</Titulo>
      {asignaturas.map((a, i) => (
        <Tarjeta key={a.id} style={estilos.tarjeta}>
          <CampoTexto
            etiqueta={`Examen ${i + 1}`}
            placeholder="Estadística"
            value={a.nombre}
            onChangeText={(nombre) => cambiarAsignatura(a.id, { nombre })}
            autoCapitalize="sentences"
            maxLength={60}
          />
          <SelectorFecha etiqueta="Fecha" valor={a.fecha} alCambiar={(fecha) => cambiarAsignatura(a.id, { fecha })} />
          <SelectorHora etiqueta="Hora" valor={a.hora} alCambiar={(hora) => cambiarAsignatura(a.id, { hora })} />
          <Selector
            etiqueta="¿Cómo es?"
            opciones={TIPOS_EXAMEN}
            valor={a.tipoExamen}
            alCambiar={(tipoExamen) => cambiarAsignatura(a.id, { tipoExamen })}
          />
          <SelectorCantidad
            etiqueta={a.tipoExamen === 'trabajo' ? 'Partes o temas' : 'Temas'}
            valor={a.temas}
            alCambiar={(temas) => cambiarAsignatura(a.id, { temas })}
            minimo={1}
            maximo={60}
            paso={1}
            formato={String}
          />
          <Selector
            etiqueta="¿Cuánto llevas?"
            opciones={AVANCES}
            valor={a.avance}
            alCambiar={(avance) => cambiarAsignatura(a.id, { avance })}
          />
          <Selector
            etiqueta="¿Cuánto te cuesta?"
            opciones={OPCIONES_DIFICULTAD}
            valor={a.dificultad}
            alCambiar={(dificultad) => cambiarAsignatura(a.id, { dificultad })}
          />
          <Interruptor
            etiqueta="Tengo exámenes de otros años"
            ayuda="Con ellos preparo simulacros."
            valor={a.anteriores}
            alCambiar={(anteriores) => cambiarAsignatura(a.id, { anteriores })}
          />
          <Plegable titulo="Índice del temario" resumen={a.indice.trim() ? 'Puesto' : 'Opcional: pégalo y uso sus nombres'}>
            <CampoTexto
              etiqueta="Pega o escribe los temas"
              placeholder={'1. Estadística descriptiva\n2. Probabilidad\n3. Variables aleatorias'}
              value={a.indice}
              onChangeText={(indice) => cambiarAsignatura(a.id, { indice })}
              multiline
              maxLength={MAX_INDICE}
              style={estilos.campoLargo}
            />
          </Plegable>
          {estudio ? (
            <>
              <ExtrasExamen asignatura={a} estudio={estudio} hoy={hoy} actualizar={actualizarEstudio} />
              <Texto secundario>
                Calculo{' '}
                {formatoHoras(estimarHoras(a, ritmo, examenGuardado(estudio, a.nombre).apuntes?.temas))} para este
                examen, repasos incluidos.
              </Texto>
            </>
          ) : null}
          {asignaturas.length > 1 ? (
            <Boton
              variante="secundario"
              titulo="Quitar este examen"
              onPress={() => setAsignaturas((actuales) => actuales.filter((x) => x.id !== a.id))}
            />
          ) : null}
        </Tarjeta>
      ))}
      {asignaturas.length < MAX_ASIGNATURAS ? (
        <Boton
          variante="secundario"
          titulo="Añadir otro examen"
          onPress={() => setAsignaturas((actuales) => [...actuales, asignaturaNueva(hoy)])}
        />
      ) : null}

      <Titulo nivel={2}>Tu tiempo</Titulo>
      <SelectorCantidad
        etiqueta="Horas de estudio al día"
        valor={horasDia}
        alCambiar={setHorasDia}
        minimo={0.5}
        maximo={12}
        paso={0.5}
        formato={formatoHoras}
      />
      <SelectorVisual
        etiqueta="¿Cuándo rindes más?"
        opciones={OPCIONES_MOMENTO_VISUAL}
        valor={rindeMas}
        alCambiar={setRindeMas}
      />
      <Selector
        etiqueta="Con el examen aún lejos, ¿a qué hora prefieres estudiar?"
        opciones={OPCIONES_LEJOS}
        valor={rindeLejos ?? 'igual'}
        alCambiar={(valor) => setRindeLejos(valor === 'igual' ? null : (valor as RespuestasCuestionario['rindeMas']))}
      />
      <Selector
        etiqueta="Día libre"
        opciones={opcionesLibre}
        valor={diaLibre === null ? 'ninguno' : String(diaLibre)}
        alCambiar={(valor) => setDiaLibre(valor === 'ninguno' ? null : (Number(valor) as DiaSemana))}
      />

      <Titulo nivel={2}>Cómo estudias</Titulo>
      {yaSabido ? (
        <Plegable titulo="Tus respuestas" resumen="Las tengo de la otra vez. Ábrelo si algo ha cambiado">
          {preguntasHabitos}
        </Plegable>
      ) : (
        preguntasHabitos
      )}
      <CampoTexto
        etiqueta="¿Algo más? (opcional)"
        placeholder="Trabajo por las tardes, la Estadística la suspendí en junio…"
        value={otros}
        onChangeText={setOtros}
        multiline
        maxLength={MAX_OTROS}
        autoCapitalize="sentences"
        style={estilos.campoLargo}
      />

      {mensaje ? (
        <Texto fuerte style={mensaje.error ? estilos.error : null} accessibilityLiveRegion="polite">
          {mensaje.texto}
        </Texto>
      ) : null}
      <Boton titulo={ocupado ? 'Preparando y revisando tu plan…' : 'Preparar mi plan'} disabled={ocupado} onPress={preparar} />
      <Boton variante="secundario" titulo="Rellenarlo a mano" disabled={ocupado} onPress={alSaltar} />
      <Texto pequeno secundario>
        El plan lo preparo aquí, en tu dispositivo, y la IA (Claude, de Anthropic) lo revisa: le llega un resumen con
        tus exámenes, el plan, cómo estudias y lo que escribas en «¿Algo más?». También va a la IA la búsqueda de cómo
        es un examen y, de tus apuntes sin índice, cómo empieza cada página. No se guarda en ningún servidor. Tus respuestas y lo que aprendo de tus planes se quedan en tu dispositivo.
      </Texto>
    </>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  campoLargo: { minHeight: 120, paddingVertical: espacio.s, textAlignVertical: 'top' },
  error: { color: colores.aviso },
});
