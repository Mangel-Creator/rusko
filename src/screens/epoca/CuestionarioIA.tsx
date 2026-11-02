import { useState } from 'react';
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
import { nuevoIdEpoca } from '@/data/epocas';
import type { DiaSemana, Perfil } from '@/data/perfil';
import type { PropuestaEpoca } from '@/services/epoca';
import { cuestionarioConIA } from '@/services/epoca/ia';
import {
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

import { formatoHoras, NOMBRES_DIAS, OPCIONES_DIFICULTAD, OPCIONES_MOMENTO_VISUAL } from './textos';

type Props = {
  perfil: Perfil | null;
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

// Las preguntas de hábitos salen de las guías de técnicas de estudio del COIE de la UNED.
const PREGUNTAS: { clave: keyof HabitosCuestionario; texto: string; opciones: Opcion<string>[] }[] = [
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

const HABITOS_VACIOS: HabitosCuestionario = {
  constancia: null,
  concentracion: null,
  arrancar: null,
  sintesis: null,
  repasos: null,
  lectura: null,
  nervios: null,
  distraccion: null,
  memoria: null,
};

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
// La IA prepara con él el plan (temas, repasos, simulacros y consejos) siguiendo
// las guías del COIE de la UNED, y rellena los tres pasos para revisarlos.
export function CuestionarioIA({ perfil, hoy, alPreparar, alSaltar }: Props) {
  const [asignaturas, setAsignaturas] = useState(() => [asignaturaNueva(hoy)]);
  const [horasDia, setHorasDia] = useState(4);
  const [rindeMas, setRindeMas] = useState<RespuestasCuestionario['rindeMas']>('manana');
  const [diaLibre, setDiaLibre] = useState<DiaSemana | null>(null);
  const [habitos, setHabitos] = useState(HABITOS_VACIOS);
  const [otros, setOtros] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

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
    setOcupado(true);
    setMensaje(null);
    const r = await cuestionarioConIA(
      { asignaturas: asignaturas.map((a) => ({ ...a, nombre: a.nombre.trim() })), horasDia, rindeMas, diaLibre, habitos, otros },
      perfil,
    );
    setOcupado(false);
    if (r.estado === 'fallo') {
      setMensaje({ texto: r.mensaje, error: r.motivo !== 'sin-clave' && r.motivo !== 'sin-configurar' });
      return;
    }
    alPreparar(r.datos);
  };

  const opcionesLibre: Opcion<string>[] = [
    { valor: 'ninguno', etiqueta: 'Ninguno' },
    ...NOMBRES_DIAS.map((nombre, i) => ({ valor: String(i), etiqueta: nombre })),
  ];

  return (
    <>
      <Titulo>Tu plan de estudio</Titulo>
      <Texto secundario>
        Unas preguntas (unos 3 minutos). Con ellas preparo tu plan: temas, repasos y simulacros según las guías de
        técnicas de estudio del COIE de la UNED. Luego lo revisas todo antes de guardar.
      </Texto>

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
        etiqueta="Día libre"
        opciones={opcionesLibre}
        valor={diaLibre === null ? 'ninguno' : String(diaLibre)}
        alCambiar={(valor) => setDiaLibre(valor === 'ninguno' ? null : (Number(valor) as DiaSemana))}
      />

      <Titulo nivel={2}>Cómo estudias</Titulo>
      <Texto secundario>Contesta lo que quieras. Con esto ajusto los descansos, los repasos y los consejos.</Texto>
      {PREGUNTAS.map((p) => (
        <Selector
          key={p.clave}
          etiqueta={p.texto}
          opciones={p.opciones}
          valor={habitos[p.clave]}
          alCambiar={(valor) => setHabitos((actuales) => ({ ...actuales, [p.clave]: valor }))}
        />
      ))}
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
      <Boton titulo={ocupado ? 'Preparando tu plan… (hasta 1 minuto)' : 'Preparar mi plan'} disabled={ocupado} onPress={preparar} />
      <Boton variante="secundario" titulo="Rellenarlo a mano" disabled={ocupado} onPress={alSaltar} />
      <Texto pequeno secundario>
        Lo que escribas se envía a la IA (Claude, de Anthropic) solo para preparar el plan. No se guarda en ningún
        servidor.
      </Texto>
    </>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  campoLargo: { minHeight: 120, paddingVertical: espacio.s, textAlignVertical: 'top' },
  error: { color: colores.aviso },
});
