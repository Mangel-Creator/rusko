import { Linking } from 'react-native';

import { leerAgenda } from '@/data/agenda';
import { leerNavegador } from '@/data/navegador';
import { leerPerfil } from '@/data/perfil';
import type { ClaveDia } from '@/services/fechas';

import { citaDe } from './citas';
import { enlaceNavegador, type Navegador } from './navegador';
import type { Punto } from './tipos';

// Abrir la ruta en Waze, Google Maps o Mapas (26/10/2026). Organizy no guía: te
// manda a tu app de siempre con el destino puesto.

// Abre la app elegida (o la de "Abrir siempre con") navegando hasta "destino".
export async function abrirEnNavegador(destino: Punto, app?: Navegador): Promise<void> {
  const [elegido, perfil] = await Promise.all([app ?? leerNavegador(), leerPerfil()]);
  await Linking.openURL(enlaceNavegador(elegido, destino, perfil?.transporte)).catch(() => {});
}

// Desde el aviso "Sal ya", la alarma de salida o "Cómo llegar" en Hoy: abre la app de
// navegación con el sitio del evento. Devuelve false si el evento ya no existe o no
// tiene lugar con coordenadas (entonces se enseña el Mapa).
export async function irACita(eventoId: string, dia: ClaveDia): Promise<boolean> {
  const [eventos, perfil] = await Promise.all([leerAgenda({ tareas: false }), leerPerfil()]);
  const evento = eventos.find((e) => e.id === eventoId);
  const cita = evento ? citaDe(evento, dia, perfil) : null;
  if (!cita) return false;
  await abrirEnNavegador(cita.destino);
  return true;
}
