import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Boton, BotonAtras, Pantalla, Plegable, Texto, Titulo } from '@/components';
import { supabaseConfigurado } from '@/data/supabase';
import { usePlanes, type Plan } from '@/data/planes';
import { claveDia } from '@/services/fechas';
import { actualizarPlanes, situacionPlan, textoGanan, votosNuevos, type SituacionPlan } from '@/services/planes';
import { alturaTactil, colorTipo, colores, espacio, radio } from '@/theme';

import { BaldosaTipo, textoDia } from './planes/piezas';

// Planes (fase 8, se abre desde Hoy): los que están votándose, los cerrados y, plegados, los
// pasados. "Nuevo plan" abre el formulario. Al entrar se traen los votos nuevos.

export function PantallaPlanes() {
  const { cargado, planes } = usePlanes();
  const hoy = claveDia(new Date());

  useFocusEffect(
    useCallback(() => {
      actualizarPlanes().catch(() => {});
    }, []),
  );

  const grupos: Record<SituacionPlan, Plan[]> = { votando: [], cerrado: [], pasado: [] };
  for (const plan of planes) grupos[situacionPlan(plan, hoy)].push(plan);
  const primeraHora = (p: Plan) => {
    const elegida = p.horas.find((h) => h.id === p.horaElegida) ?? p.horas[0];
    return elegida ? elegida.dia + elegida.hora : '';
  };
  grupos.votando.sort((a, b) => b.creadoEl.localeCompare(a.creadoEl));
  grupos.cerrado.sort((a, b) => primeraHora(a).localeCompare(primeraHora(b)));
  grupos.pasado.sort((a, b) => primeraHora(b).localeCompare(primeraHora(a)));

  return (
    <Pantalla>
      <BotonAtras texto="Hoy" etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Titulo>Planes</Titulo>
      <Boton titulo="Nuevo plan" onPress={() => router.push('/plan-nuevo')} disabled={!supabaseConfigurado} />
      {!supabaseConfigurado ? (
        <Texto pequeno secundario>Los planes necesitan el servidor de Rusko, que aún no está conectado en esta versión.</Texto>
      ) : null}

      {cargado && planes.length === 0 ? (
        <View style={estilos.vacio}>
          <Ionicons name="people-outline" size={48} color={colores.textoSecundario} />
          <Texto secundario style={estilos.centrado}>
            Propón 2 a 4 horas y que tus amigos voten desde WhatsApp, sin instalar nada.
          </Texto>
        </View>
      ) : null}

      {grupos.votando.length > 0 ? (
        <Seccion titulo="Votando">
          {grupos.votando.map((p) => (
            <FilaPlan key={p.id} plan={p} situacion="votando" />
          ))}
          {Platform.OS === 'web' ? (
            <Texto pequeno secundario>En la web no llegan avisos: los votos nuevos salen marcados aquí.</Texto>
          ) : null}
        </Seccion>
      ) : null}

      {grupos.cerrado.length > 0 ? (
        <Seccion titulo="Cerrados">
          {grupos.cerrado.map((p) => (
            <FilaPlan key={p.id} plan={p} situacion="cerrado" />
          ))}
        </Seccion>
      ) : null}

      {grupos.pasado.length > 0 ? (
        <Plegable titulo={`Pasados (${grupos.pasado.length})`}>
          {grupos.pasado.map((p) => (
            <FilaPlan key={p.id} plan={p} situacion="pasado" />
          ))}
        </Plegable>
      ) : null}
    </Pantalla>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <Titulo nivel={3}>{titulo}</Titulo>
      {children}
    </View>
  );
}

function subtitulo(plan: Plan, situacion: SituacionPlan): string {
  const elegida = plan.horas.find((h) => h.id === plan.horaElegida);
  if (elegida) return `${textoDia(elegida.dia)} · ${elegida.hora}`;
  if (situacion === 'pasado') return 'Se quedó sin cerrar';
  return textoGanan(plan.horas, plan.votos, plan.invitados.length) ?? 'Nadie ha votado aún';
}

function FilaPlan({ plan, situacion }: { plan: Plan; situacion: SituacionPlan }) {
  const nuevos = situacion === 'votando' ? votosNuevos(plan) : 0;
  const pasado = situacion === 'pasado';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `${plan.titulo}.`,
        subtitulo(plan, situacion),
        nuevos ? (nuevos === 1 ? '1 voto nuevo.' : `${nuevos} votos nuevos.`) : '',
      ].join(' ')}
      onPress={() => router.push({ pathname: '/plan', params: { id: plan.id } })}
      style={({ pressed }) => [
        estilos.fila,
        { borderLeftColor: colorTipo[plan.tipo] },
        pasado && estilos.filaPasada,
        pressed && estilos.pulsado,
      ]}>
      <BaldosaTipo tipo={plan.tipo} />
      <View style={estilos.textos}>
        <Texto fuerte numberOfLines={1} style={pasado && estilos.secundario}>
          {plan.titulo}
        </Texto>
        <Texto pequeno secundario numberOfLines={2}>
          {subtitulo(plan, situacion)}
        </Texto>
      </View>
      {nuevos > 0 ? (
        <View style={estilos.nuevos}>
          <Texto pequeno fuerte style={estilos.textoNuevos}>
            {nuevos === 1 ? '1 nuevo' : `${nuevos} nuevos`}
          </Texto>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colores.textoSecundario} />
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  vacio: { alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xl, paddingHorizontal: espacio.l },
  centrado: { textAlign: 'center' },
  seccion: { gap: espacio.s, marginTop: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 24,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4, // barra del color de su tipo
  },
  filaPasada: { backgroundColor: 'transparent' },
  pulsado: { opacity: 0.8 },
  textos: { flex: 1, gap: 2 },
  secundario: { color: colores.textoSecundario },
  nuevos: {
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
  },
  textoNuevos: { color: colores.textoSobrePrincipal },
});
