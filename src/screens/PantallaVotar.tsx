import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { usePerfil } from '@/data/perfil';
import { claveNombre, contarVotos, ganadoras, textoGanan } from '@/services/planes/votos';
import {
  codigoDeLaDireccion,
  verPlan,
  votar,
  type ErrorVotacion,
  type PlanVotacion,
} from '@/services/planes/votacion';
import { colores, espacio } from '@/theme';

import { MensajeError } from './formulario-perfil/MensajeError';
import { BaldosaTipo, FilaVotos, textoDia } from './planes/piezas';

// Página de votación (fase 8): la abren los invitados desde el enlace de WhatsApp,
// sin cuenta, sin app y sin pasar por la bienvenida. Escriben su nombre, marcan las
// horas que les van bien y ven cómo va la votación. No se guarda nada en su móvil:
// si vuelven a votar con el mismo nombre, se cambia su voto.
// Dirección: /organizy/votar#código (el código va detrás de "#").

const MENSAJES_ERROR: Record<ErrorVotacion, string> = {
  'no-existe': 'Este plan ya no existe o el enlace está mal copiado.',
  cerrado: 'Este plan ya está cerrado.',
  lleno: 'Ya ha votado mucha gente en este plan.',
  limite: 'Demasiados votos por hoy. Prueba más tarde.',
  'sin-conexion': 'No hay conexión. Prueba otra vez en un momento.',
  'sin-servidor': 'La votación no está disponible ahora mismo.',
};

const enNavegador = Platform.OS === 'web' && typeof window !== 'undefined';

function leerHash(): string {
  return enNavegador ? window.location.hash : '';
}

function escucharDireccion(avisar: () => void): () => void {
  if (!enNavegador) return () => {};
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
}

export function PantallaVotar() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const { bienvenidaCompletada } = usePerfil();
  // El código se lee de la dirección (en el navegador, detrás de "#"). Al preparar la
  // página en el servidor de GitHub no hay dirección: undefined = "cargando".
  const codigo = useSyncExternalStore(
    escucharDireccion,
    () => codigoDeLaDireccion(leerHash()) ?? codigoDeLaDireccion(c ?? ''),
    () => undefined,
  );
  const [datos, setDatos] = useState<PlanVotacion | null>(null);
  const [error, setError] = useState<ErrorVotacion | null>(null);
  const [nombre, setNombre] = useState('');
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [votado, setVotado] = useState<{ nombre: string; cambiado: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    verPlan(codigo).then((r) => {
      if (r.ok) setDatos(r.datos);
      else setError(r.error);
    });
  }, [codigo]);

  const enviar = async () => {
    if (!codigo) return;
    const limpio = nombre.replace(/\s+/g, ' ').trim();
    if (!limpio) return setErrorForm('Escribe tu nombre para que sepan quién eres.');
    if (marcadas.length === 0) return setErrorForm('Marca al menos una hora que te venga bien.');
    setErrorForm(null);
    setOcupado(true);
    const r = await votar(codigo, limpio, marcadas);
    setOcupado(false);
    if (!r.ok) {
      if (r.error === 'cerrado' || r.error === 'no-existe') setError(r.error);
      else setErrorForm(MENSAJES_ERROR[r.error]);
      return;
    }
    setDatos(r.datos);
    setVotado({ nombre: limpio, cambiado: !!r.datos.cambiado });
  };

  // Al cambiar el voto se recuperan las horas que marcó esa persona.
  const cambiarVoto = () => {
    const mio = datos?.votos.find((v) => votado && claveNombre(v.nombre) === claveNombre(votado.nombre));
    setMarcadas(mio?.horas ?? []);
    setVotado(null);
  };

  // Sin nada detrás de "#" no viene de un enlace de plan: es el dueño abriendo la web, y
  // expo-router lo ha traído aquí al no tener hecha la bienvenida. Se le lleva a su sitio.
  if (codigo === null && !leerHash().replace(/^#/, '') && !c) {
    return <Redirect href={bienvenidaCompletada ? '/' : '/bienvenida'} />;
  }
  if (codigo === undefined || (codigo && !datos && !error)) {
    return (
      <Pantalla contentContainerStyle={estilos.pagina}>
        <Texto secundario>Cargando el plan…</Texto>
      </Pantalla>
    );
  }
  if (!codigo || (error && !datos)) {
    return (
      <Pantalla contentContainerStyle={estilos.pagina}>
        <Ionicons name="alert-circle-outline" size={40} color={colores.textoSecundario} />
        <Titulo nivel={2}>{MENSAJES_ERROR[error ?? 'no-existe']}</Titulo>
        <Texto secundario>Pide a quien te lo mandó que te pase el enlace otra vez.</Texto>
      </Pantalla>
    );
  }
  if (!datos) return null;

  const { plan, horas, votos } = datos;
  const cerrado = plan.estado === 'cerrado' || error === 'cerrado';
  const filas = contarVotos(horas, votos);
  const primeras = ganadoras(filas);
  const total = Math.max(plan.personas, votos.length, 1);
  const elegida = horas.find((h) => h.id === plan.horaElegida);
  const puedeVotar = !cerrado && !votado;

  return (
    <Pantalla contentContainerStyle={estilos.pagina}>
      <View style={estilos.cabecera}>
        <BaldosaTipo tipo={plan.tipo} grande />
        <View style={estilos.textos}>
          <Texto secundario>{plan.organizador ? `${plan.organizador} te invita a` : 'Te invitan a'}</Texto>
          <Titulo>{plan.titulo}</Titulo>
        </View>
      </View>

      {cerrado ? (
        <Tarjeta>
          <Texto pequeno secundario>
            Ya está decidido
          </Texto>
          <Titulo nivel={2}>{elegida ? `${textoDia(elegida.dia)} · ${elegida.hora}` : 'Plan cerrado'}</Titulo>
        </Tarjeta>
      ) : votado ? (
        <Tarjeta>
          <Texto fuerte>
            {votado.cambiado ? `He cambiado tu voto, ${votado.nombre}.` : `Hecho, ${votado.nombre}. Tu voto ya cuenta.`}
          </Texto>
          <Texto secundario>{textoGanan(horas, votos, plan.personas)}</Texto>
          <Boton titulo="Cambiar mi voto" variante="secundario" onPress={cambiarVoto} />
        </Tarjeta>
      ) : (
        <>
          <Texto fuerte>¿Qué horas te vienen bien? Marca todas las que puedas.</Texto>
        </>
      )}

      <View style={estilos.lista}>
        {filas.map((f) => {
          const marcada = marcadas.includes(f.hora.id);
          return (
            <FilaVotos
              key={f.hora.id}
              dia={f.hora.dia}
              hora={f.hora.hora}
              votos={f.votos}
              total={total}
              nombres={f.nombres}
              gana={elegida ? f.hora.id === elegida.id : !puedeVotar && primeras.includes(f)}
              modo={puedeVotar ? 'marcar' : undefined}
              marcada={marcada}
              onPress={
                puedeVotar
                  ? () => {
                      setErrorForm(null);
                      setMarcadas(marcada ? marcadas.filter((m) => m !== f.hora.id) : [...marcadas, f.hora.id]);
                    }
                  : undefined
              }
            />
          );
        })}
      </View>

      {puedeVotar ? (
        <>
          <CampoTexto
            etiqueta="Tu nombre"
            placeholder="Como te conocen en el grupo"
            value={nombre}
            onChangeText={setNombre}
            maxLength={40}
            autoCapitalize="words"
            autoComplete="given-name"
            onSubmitEditing={enviar}
          />
          <MensajeError texto={errorForm} />
          <Boton titulo={ocupado ? 'Enviando…' : 'Votar'} onPress={enviar} disabled={ocupado} />
          <Texto pequeno secundario style={estilos.centrado}>
            Sin cuenta y sin instalar nada. Si vuelves a votar con el mismo nombre, se cambia tu voto.
          </Texto>
        </>
      ) : null}

      <Texto pequeno secundario style={[estilos.centrado, estilos.pie]}>
        Rusko · esta página no guarda nada en tu móvil
      </Texto>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  // En un ordenador, la página no se estira más de lo que se lee bien.
  pagina: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  textos: { flex: 1, gap: 2 },
  lista: { gap: espacio.s },
  centrado: { textAlign: 'center' },
  pie: { marginTop: espacio.l },
});
