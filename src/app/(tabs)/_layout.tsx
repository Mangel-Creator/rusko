import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colores, fuentes } from '@/theme';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

function icono(nombre: NombreIcono, nombreActivo: NombreIcono) {
  function IconoPestana({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? nombreActivo : nombre} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return IconoPestana;
}

// Barra inferior con las 5 pestañas de Organizy. Planes y Alarmas no están aquí
// (lo pidió el usuario el 26/10): se abren desde las acciones rápidas de Hoy.
export default function LayoutPestanas() {
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
        name="resumenes"
        options={{ title: 'Correo', tabBarIcon: icono('mail-outline', 'mail') }}
      />
      <Tabs.Screen
        name="mapa"
        options={{ title: 'Mapa', tabBarIcon: icono('map-outline', 'map') }}
      />
      <Tabs.Screen
        name="epoca"
        options={{ title: 'Época', tabBarIcon: icono('star-outline', 'star') }}
      />
    </Tabs>
  );
}
