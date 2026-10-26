import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import {
  Boton,
  CampoTexto,
  Interruptor,
  Pantalla,
  Plegable,
  Selector,
  SelectorFecha,
  SelectorHora,
  SelectorVisual,
  Tarjeta,
  Texto,
  Titulo,
  type Opcion,
  type OpcionVisual,
} from '@/components';
import { useEventos, type Evento } from '@/data/eventos';
import { usePerfil, type Perfil } from '@/data/perfil';
import type { TipoPlan } from '@/data/planes';
import { avisosDisponibles } from '@/services/avisos';
import { abrirAjustesDelTelefono } from '@/services/permisos';
import { contactosDisponibles, elegirContacto, hayPermisoContactos } from '@/services/contactos';
import { claveDia, formatearDuracion, sumarDias } from '@/services/fechas';
import {
  crearPlan,
  DURACION_POR_DEFECTO,
  enlaceVotacion,
  enlaceWhatsapp,
  sugerirHoras,
  textoInvitacion,
  type Sugerencia,
} from '@/services/planes';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { MensajeError } from './formulario-perfil/MensajeError';
import { BotonVolver, BotonWhatsapp, ChipNombre, prepararWhatsapp, textoDia } from './planes/piezas';

// Nuevo plan (fase 8), corto y visual: con quién (amigos o cliente), qué, 2 a 4 horas
// (la app propone huecos libres del calendario) y "Enviar por WhatsApp". Lo opcional
// (cuánto dura, el recordatorio y tu nombre en la invitación) va en "Más ajustes".
// Desde un hueco de Semana llega con ?dia=...&hora=... y esa hora ya propuesta.

const OPCIONES_TIPO: OpcionVisual<TipoPlan>[] = [
  { valor: 'amigos', etiqueta: 'Con amigos', icono: 'people' },
  { valor: 'cliente', etiqueta: 'Con un cliente', icono: 'briefcase' },
];

const OPCIONES_DURACION: Opcion<'60' | '90' | '120' | '180'>[] = [
  { valor: '60', etiqueta: '1 h' },
  { valor: '90', etiqueta: '1 h 30' },
  { valor: '120', etiqueta: '2 h' },
  { valor: '180', etiqueta: '3 h' },
];

const MAX_HORAS = 4;
const MIN_HORAS = 2;

const clave = (s: Sugerencia) => `${s.dia} ${s.hora}`;
const deClave = (k: string): Sugerencia => {
  const [dia, hora] = k.split(' ');
  return { dia, hora };
};

export function PantallaPlanNuevo() {
  const { dia, hora } = useLocalSearchParams<{ dia?: string; hora?: string }>();
  const { perfil } = usePerfil();
  const { cargado, eventos } = useEventos();
  if (!cargado) {
    return (
      <Pantalla>
        <Texto secundario>Cargando…</Texto>
      </Pantalla>
    );
  }
  const propuesta =
    dia && hora && /^\d{4}-\d{2}-\d{2}$/.test(dia) && /^\d{2}:\d{2}$/.test(hora) ? { dia, hora } : null;
  return <Formulario perfil={perfil} eventos={eventos} propuesta={propuesta} />;
}

type Props = { perfil: Perfil | null; eventos: Evento[]; propuesta: Sugerencia | null };

// Las horas marcadas al empezar: la del hueco de Semana (si viene de allí) y las
// primeras sugerencias, hasta 3.
function eleccionInicial(sugerencias: Sugerencia[], propuesta: Sugerencia | null): string[] {
  const otras = sugerencias.filter((s) => !propuesta || s.dia !== propuesta.dia);
  return [...(propuesta ? [propuesta] : []), ...otras].slice(0, 3).map(clave);
}

function Formulario({ perfil, eventos, propuesta }: Props) {
  const scroll = useRef<ScrollViewInstance>(null);
  const [tipo, setTipo] = useState<TipoPlan>('amigos');
  const [titulo, setTitulo] = useState('');
  const [duracion, setDuracion] = useState(DURACION_POR_DEFECTO.amigos);
  const sugerir = (t: TipoPlan, d: number) =>
    sugerirHoras({ eventos, perfil, ahora: new Date(), tipo: t, duracionMin: d });
  const [extra, setExtra] = useState<Sugerencia[]>(propuesta ? [propuesta] : []);
  const [elegidas, setElegidas] = useState<string[]>(() => eleccionInicial(sugerir('amigos', duracion), propuesta));
  const [invitados, setInvitados] = useState<string[]>([]);
  const [nombre, setNombre] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [organizador, setOrganizador] = useState(perfil?.nombre.trim() ?? '');
  const [otraDia, setOtraDia] = useState(sumarDias(claveDia(new Date()), 1));
  const [otraHora, setOtraHora] = useState('21:00');
  const [explicarAgenda, setExplicarAgenda] = useState(false);
  const [avisoAgenda, setAvisoAgenda] = useState<'denegado' | 'bloqueado' | 'error' | null>(null);
  const [errores, setErrores] = useState<{ titulo?: string; horas?: string; envio?: string }>({});
  const [ocupado, setOcupado] = useState(false);

  const sugerencias = sugerir(tipo, duracion);
  const opciones = [...new Map([...extra, ...sugerencias].map((s) => [clave(s), s])).values()].sort((a, b) =>
    clave(a).localeCompare(clave(b)),
  );

  const cambiarTipo = (nuevo: TipoPlan) => {
    if (nuevo === tipo) return;
    const nuevaDuracion = DURACION_POR_DEFECTO[nuevo];
    setTipo(nuevo);
    setDuracion(nuevaDuracion);
    setElegidas(eleccionInicial(sugerir(nuevo, nuevaDuracion), propuesta));
    setErrores({});
  };

  const alternarHora = (k: string) => {
    setErrores((e) => ({ ...e, horas: undefined }));
    if (elegidas.includes(k)) {
      setElegidas(elegidas.filter((e) => e !== k));
    } else if (elegidas.length >= MAX_HORAS) {
      setErrores((e) => ({ ...e, horas: `Como mucho ${MAX_HORAS} horas: quita una antes.` }));
    } else {
      setElegidas([...elegidas, k]);
    }
  };

  const anadirOtra = () => {
    const nueva = { dia: otraDia, hora: otraHora };
    const k = clave(nueva);
    if (!extra.some((s) => clave(s) === k)) setExtra([...extra, nueva]);
    if (!elegidas.includes(k)) alternarHora(k);
  };

  const anadirNombre = (texto = nombre) => {
    const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (limpio && !invitados.some((n) => n.toLowerCase() === limpio.toLowerCase())) {
      setInvitados([...invitados, limpio]);
    }
    setNombre('');
  };

  const abrirAgenda = async () => {
    setExplicarAgenda(false);
    setAvisoAgenda(null);
    const resultado = await elegirContacto();
    if (resultado.estado === 'elegido') anadirNombre(resultado.nombre);
    else if (resultado.estado !== 'cancelado') setAvisoAgenda(resultado.estado);
  };

  const pulsarAgenda = async () => {
    if (await hayPermisoContactos()) abrirAgenda();
    else setExplicarAgenda(true);
  };

  const enviar = async () => {
    const nuevos: typeof errores = {};
    if (!titulo.trim()) nuevos.titulo = '¿Qué plan es? Escribe algo corto, como «Cena de viernes».';
    if (elegidas.length < MIN_HORAS) nuevos.horas = `Marca al menos ${MIN_HORAS} horas para que voten.`;
    setErrores(nuevos);
    if (nuevos.titulo || nuevos.horas) {
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    // Se prepara WhatsApp ya, al tocar (en la web, si no, el navegador lo bloquea).
    const abrir = prepararWhatsapp();
    setOcupado(true);
    const resultado = await crearPlan({
      tipo,
      titulo,
      organizador,
      invitados,
      horas: elegidas.map(deClave).sort((a, b) => clave(a).localeCompare(clave(b))),
      duracionMin: duracion,
      recordar,
    });
    if (!resultado.ok) {
      abrir(null);
      setOcupado(false);
      setErrores({
        envio:
          resultado.motivo === 'sin-servidor'
            ? 'Los planes necesitan el servidor de Organizy, que aún no está conectado.'
            : 'No he podido crear el plan. ¿Tienes conexión? Prueba otra vez.',
      });
      return;
    }
    const { plan } = resultado;
    abrir(enlaceWhatsapp(textoInvitacion(plan.organizador, plan.titulo, enlaceVotacion(plan.codigo))));
    router.replace({ pathname: '/plan', params: { id: plan.id } });
  };

  const vistaPrevia = textoInvitacion(
    organizador,
    titulo.trim() || (tipo === 'amigos' ? 'Cena de viernes' : 'Reunión'),
    '(enlace)',
  );

  return (
    <Pantalla ref={scroll}>
      <BotonVolver />
      <Titulo>Nuevo plan</Titulo>

      <SelectorVisual opciones={OPCIONES_TIPO} valor={tipo} alCambiar={cambiarTipo} />

      <CampoTexto
        etiqueta="¿Qué?"
        placeholder={tipo === 'amigos' ? 'Cena de viernes' : 'Reunión de presupuesto'}
        value={titulo}
        onChangeText={(t) => {
          setTitulo(t);
          if (errores.titulo) setErrores((e) => ({ ...e, titulo: undefined }));
        }}
        maxLength={80}
        autoCapitalize="sentences"
        error={errores.titulo}
      />

      <View style={estilos.bloque}>
        <Texto fuerte>¿Cuándo? Marca de 2 a 4</Texto>
        {opciones.length === 0 ? (
          <Texto pequeno secundario>
            No veo huecos libres estas dos semanas. Añade tú las horas en «Otra hora».
          </Texto>
        ) : null}
        <View style={estilos.rejilla}>
          {opciones.map((s) => {
            const k = clave(s);
            const marcada = elegidas.includes(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada }}
                accessibilityLabel={`${textoDia(s.dia)} a las ${s.hora}`}
                onPress={() => alternarHora(k)}
                style={({ pressed }) => [estilos.hora, marcada && estilos.horaMarcada, pressed && estilos.pulsado]}>
                <Texto pequeno style={marcada ? estilos.textoClaro : estilos.textoSecundario}>
                  {textoDia(s.dia)}
                </Texto>
                <Texto style={[estilos.horaTexto, marcada && estilos.textoClaro]}>{s.hora}</Texto>
                {marcada ? (
                  <Ionicons name="checkmark-circle" size={20} color={colores.textoSobreTinta} style={estilos.marca} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <MensajeError texto={errores.horas} />
        <Plegable titulo="Otra hora">
          <SelectorFecha etiqueta="Día" valor={otraDia} alCambiar={setOtraDia} />
          <SelectorHora etiqueta="Hora" valor={otraHora} alCambiar={setOtraHora} />
          <Boton titulo="Añadir esta hora" variante="secundario" onPress={anadirOtra} />
        </Plegable>
      </View>

      <View style={estilos.bloque}>
        <Texto fuerte>¿Con quién?</Texto>
        {invitados.length > 0 ? (
          <View style={estilos.chips}>
            {invitados.map((n) => (
              <ChipNombre key={n} nombre={n} alQuitar={() => setInvitados(invitados.filter((x) => x !== n))} />
            ))}
          </View>
        ) : null}
        <View style={estilos.filaNombre}>
          <View style={estilos.flex}>
            <CampoTexto
              placeholder="Escribe un nombre"
              accessibilityLabel="Nombre de un invitado"
              value={nombre}
              onChangeText={setNombre}
              onSubmitEditing={() => anadirNombre()}
              returnKeyType="done"
              autoCapitalize="words"
              maxLength={40}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir nombre"
            onPress={() => anadirNombre()}
            style={({ pressed }) => [estilos.botonMas, pressed && estilos.pulsado]}>
            <Ionicons name="add" size={26} color={colores.textoSobrePrincipal} />
          </Pressable>
        </View>
        {contactosDisponibles ? (
          <Boton titulo="Elegir de la agenda" variante="secundario" onPress={pulsarAgenda} />
        ) : null}
        {explicarAgenda ? (
          <Tarjeta style={estilos.explicacion}>
            <Texto>
              Solo para poner su nombre en el plan. Leo el nombre de quien elijas y nada más: no guardo ni envío tu
              agenda.
            </Texto>
            <Boton titulo="Vale, abrir la agenda" onPress={abrirAgenda} />
            <Boton titulo="Ahora no" variante="secundario" onPress={() => setExplicarAgenda(false)} />
          </Tarjeta>
        ) : null}
        {avisoAgenda === 'bloqueado' ? (
          <Tarjeta style={estilos.explicacion}>
            <Texto>Organizy no tiene permiso para ver la agenda. Puedes darlo en Ajustes o escribir el nombre.</Texto>
            <Boton titulo="Abrir Ajustes" variante="secundario" onPress={() => abrirAjustesDelTelefono()} />
          </Tarjeta>
        ) : avisoAgenda ? (
          <MensajeError texto="No he podido abrir la agenda. Escribe el nombre a mano." />
        ) : null}
      </View>

      <Plegable
        titulo="Más ajustes"
        resumen={[
          `Dura ${formatearDuracion(duracion)}`,
          avisosDisponibles ? (recordar ? 'recordar 3 h antes' : 'sin recordatorio') : null,
          organizador.trim() ? `firmas como ${organizador.trim()}` : 'sin tu nombre',
        ]
          .filter(Boolean)
          .join(' · ')}>
        <Selector
          etiqueta="¿Cuánto dura?"
          opciones={OPCIONES_DURACION}
          valor={String(duracion) as '60' | '90' | '120' | '180'}
          alCambiar={(v) => setDuracion(Number(v))}
        />
        {avisosDisponibles ? (
          <Interruptor
            etiqueta="Recordar a todos 3 h antes"
            ayuda="Te aviso con el mensaje ya escrito para el grupo."
            valor={recordar}
            alCambiar={setRecordar}
          />
        ) : null}
        <CampoTexto
          etiqueta="Tu nombre en la invitación"
          value={organizador}
          onChangeText={setOrganizador}
          maxLength={40}
          autoCapitalize="words"
        />
      </Plegable>

      <Tarjeta style={estilos.vistaPrevia}>
        <Texto pequeno secundario>
          Así les llega
        </Texto>
        <Texto>{vistaPrevia}</Texto>
      </Tarjeta>

      <MensajeError texto={errores.envio} />
      <BotonWhatsapp titulo={ocupado ? 'Creando el plan…' : 'Enviar por WhatsApp'} onPress={enviar} disabled={ocupado} />
      <Texto pequeno secundario style={estilos.centrado}>
        Se abre WhatsApp con el mensaje escrito: tú eliges el chat o el grupo y lo envías.
      </Texto>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.s },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  hora: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: alturaTactil + 20,
    padding: espacio.m,
    borderRadius: radio.grande,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
  },
  horaMarcada: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  horaTexto: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: tamanos.titulo, lineHeight: 28 },
  textoClaro: { color: colores.textoSobreTinta },
  textoSecundario: { color: colores.textoSecundario },
  marca: { position: 'absolute', top: espacio.s, right: espacio.s },
  pulsado: { transform: [{ scale: 0.97 }] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
  botonMas: {
    width: alturaTactil + 6,
    height: alturaTactil + 6,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicacion: { gap: espacio.s },
  vistaPrevia: { gap: espacio.xs },
  centrado: { textAlign: 'center' },
});
