import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { cargarEventos } from '@/data/eventos';
import { cargarPerfil, usePerfil } from '@/data/perfil';
import { vigilarActualizacionesWeb } from '@/services/actualizacionWeb';
import { atenderAlarmasNativas, iniciarAlarmas } from '@/services/alarmas';
import { atenderRespuesta, escucharRespuestas, iniciarAvisos } from '@/services/avisos';
import { iniciarCalendarios } from '@/services/calendarios';
import { formatearHora } from '@/services/fechas';
import { completarCoordenadasPendientes } from '@/services/lugares';
import { iniciarCorreo } from '@/services/correo';
import { iniciarNube } from '@/services/nube';
import { iniciarPlanes } from '@/services/planes';
import { irACita } from '@/services/rutas/abrir';
import { iniciarTrafico } from '@/services/rutas/actualizar';
// Registra la tarea de navegación con el móvil bloqueado (solo en la app propia).
import { colores } from '@/theme';

// Mantiene la pantalla de carga hasta que las letras estén listas.
SplashScreen.preventAutoHideAsync();

// Tema de navegación con nuestros colores (solo modo oscuro).
const temaNavegacion = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colores.principal,
    background: colores.fondo,
    card: colores.tarjeta,
    text: colores.texto,
    border: colores.borde,
  },
};

export default function LayoutRaiz() {
  const [letrasListas, errorLetras] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const { cargado: perfilCargado, bienvenidaCompletada } = usePerfil();
  const listo = (letrasListas || !!errorLetras) && perfilCargado;

  useEffect(() => {
    // Lee el perfil guardado y calcula las coordenadas que falten
    // (por ejemplo, si se rellenó sin conexión).
    cargarPerfil().then(() => completarCoordenadasPendientes());
    cargarEventos();
    // Programa los avisos de los próximos días y los mantiene al día (solo en el móvil).
    return iniciarAvisos();
  }, []);

  // En la web, recarga sola si se ha publicado una versión nueva.
  useEffect(() => vigilarActualizacionesWeb(), []);

  // Hora de salida de las próximas citas y horas punta (fase 6), siempre al día.
  useEffect(() => iniciarTrafico(), []);

  // Alarmas (fase 7): adelanto de la inteligente y alarmas de verdad en la app propia.
  useEffect(() => iniciarAlarmas(), []);

  // Votos de los planes (fase 8): al abrir la app, al volver a ella y al llegar un aviso.
  useEffect(() => iniciarPlanes(), []);
  // Resúmenes de correo (fase 11): los trae del ayudante de Gmail al abrir y al volver.
  useEffect(() => iniciarCorreo(), []);
  // Otros calendarios (Google, iCloud...): lo nuevo de fuera, al abrir y al volver.
  useEffect(() => iniciarCalendarios(), []);
  // Tu cuenta (27/10/2026): sube lo de aquí a la nube y trae lo de tus otros dispositivos.
  useEffect(() => iniciarNube(), []);

  useEffect(() => {
    if (listo) {
      SplashScreen.hideAsync();
    }
  }, [listo]);

  // Al tocar un aviso (o uno de sus botones), abre la pantalla que corresponda.
  // Espera a que se vean las pestañas: antes no se puede navegar.
  useEffect(() => {
    if (!listo || !bienvenidaCompletada) return;
    return escucharRespuestas(async (respuesta) => {
      const destino = await atenderRespuesta(respuesta);
      if (destino.pantalla === 'ninguna') return;
      if (destino.pantalla === 'evento') {
        router.push({ pathname: '/evento', params: { id: destino.id } });
      } else if (destino.pantalla === 'plan') {
        router.push({ pathname: '/plan', params: { id: destino.id } });
      } else if (destino.pantalla === 'resumenes') {
        router.push('/resumenes');
      } else if (destino.pantalla === 'mapa') {
        // "Sal ya" y "Cómo llegar": directo a Waze (o la app elegida) con el sitio puesto.
        if (!(await irACita(destino.id, destino.dia))) {
          router.navigate({ pathname: '/mapa', params: { evento: destino.id, dia: destino.dia } });
        }
      } else if (destino.pantalla === 'alarmas') {
        router.navigate({ pathname: '/alarmas', params: destino.pospuesta ? { pospuesta: destino.pospuesta } : {} });
      } else {
        router.navigate({
          pathname: '/',
          params: destino.movidas !== undefined ? { movidas: String(destino.movidas) } : {},
        });
      }
    });
  }, [listo, bienvenidaCompletada]);

  // Alarmas de verdad (app propia): si se abrió la app desde "Posponer" o "Cómo
  // llegar", se atiende al abrir y cada vez que vuelve a primer plano.
  useEffect(() => {
    if (!listo || !bienvenidaCompletada) return;
    const atender = async () => {
      const resultado = await atenderAlarmasNativas();
      if (resultado?.que === 'como-llegar') {
        if (!(await irACita(resultado.eventoId, resultado.dia))) {
          router.navigate({ pathname: '/mapa', params: { evento: resultado.eventoId, dia: resultado.dia } });
        }
      } else if (resultado?.que === 'pospuesta') {
        router.navigate({ pathname: '/alarmas', params: { pospuesta: formatearHora(resultado.hasta) } });
      }
    };
    atender();
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') atender();
    });
    return () => app.remove();
  }, [listo, bienvenidaCompletada]);

  if (!listo) {
    return null;
  }

  // Hasta completar la bienvenida solo se puede ver esa pantalla. Al completarla,
  // "bienvenidaCompletada" pasa a true y la app salta sola a las pestañas.
  // redirectTo hace falta: sin él, expo-router manda a la primera pantalla libre, /votar.
  return (
    <ThemeProvider value={temaNavegacion}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Protected guard={bienvenidaCompletada} redirectTo="/bienvenida">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="perfil" />
          <Stack.Screen name="evento" />
          <Stack.Screen name="epoca-editar" />
          <Stack.Screen name="alarma" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="plan-nuevo" />
          <Stack.Screen name="planes" />
          <Stack.Screen name="alarmas" />
        </Stack.Protected>
        <Stack.Protected guard={!bienvenidaCompletada} redirectTo="/">
          <Stack.Screen name="bienvenida" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        {/* Página de votación de un plan (fase 8): la abren los invitados desde el enlace
            de WhatsApp, sin cuenta ni bienvenida. Fuera de las rutas protegidas. */}
        <Stack.Screen name="votar" />
        {/* Tu cuenta: entrar desde la bienvenida y los enlaces de los correos. */}
        <Stack.Screen name="cuenta" />
      </Stack>
    </ThemeProvider>
  );
}
