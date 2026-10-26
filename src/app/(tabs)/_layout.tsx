import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useEmpresa } from '@/data/empresa';
import { anunciosSinLeer, totalSinLeer } from '@/services/empresa/chat';
import { colores, fuentes } from '@/theme';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

function icono(nombre: NombreIcono, nombreActivo: NombreIcono) {
  function IconoPestana({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? nombreActivo : nombre} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return IconoPestana;
}

// Barra inferior con las 5 pestañas de Organizy. Con el plan empresa, "Empresa" ocupa el
// sitio de "Planes" (los planes con amigos no salen), con los mensajes y avisos sin leer.
export default function LayoutPestanas() {
  const { modo, situacion } = useEmpresa();
  const sinLeer = modo && situacion.fase === 'dentro' ? totalSinLeer(situacion.datos) + anunciosSinLeer(situacion.datos).length : 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.principal,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarStyle: {
          backgroundColor: colores.fondo,
          borderTopColor: colores.borde,
          minHeight: 64,
        },
        tabBarLabelStyle: { fontFamily: fuentes.textoMedio, fontSize: 11, letterSpacing: 0.1 },
        sceneStyle: { backgroundColor: colores.fondo },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Hoy', tabBarIcon: icono('today-outline', 'today') }}
      />
      <Tabs.Screen
        name="semana"
        options={{ title: 'Semana', tabBarIcon: icono('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="planes"
        options={{ title: 'Planes', tabBarIcon: icono('people-outline', 'people'), href: modo ? null : undefined }}
      />
      <Tabs.Screen
        name="trabajo"
        options={{
          title: 'Empresa',
          tabBarIcon: icono('business-outline', 'business'),
          href: modo ? undefined : null,
          tabBarBadge: sinLeer > 0 ? sinLeer : undefined,
          tabBarBadgeStyle: { backgroundColor: colores.empresa, color: colores.textoOscuro, fontFamily: fuentes.textoMedio },
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{ title: 'Mapa', tabBarIcon: icono('map-outline', 'map') }}
      />
      <Tabs.Screen
        name="alarmas"
        options={{ title: 'Alarmas', tabBarIcon: icono('alarm-outline', 'alarm') }}
      />
    </Tabs>
  );
}
