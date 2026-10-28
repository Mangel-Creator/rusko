import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { BarraProgreso, Boton, Pantalla, Texto, Titulo } from '@/components';
import { completarBienvenida, usePerfil } from '@/data/perfil';
import { supabaseConfigurado } from '@/data/supabase';
import { PERMISOS_DISPONIBLES, pedirPermiso } from '@/services/permisos';
import { espacio } from '@/theme';

import {
  borradorDesdePerfil,
  comprobarFestivos,
  comprobarPaso1,
  comprobarPaso2,
  hayErrores,
  perfilDesdeBorrador,
  type Borrador,
  type Errores,
} from './formulario-perfil/borrador';
import { CamposFestivos } from './formulario-perfil/CamposFestivos';
import { CamposRitmo } from './formulario-perfil/CamposRitmo';
import { CamposSobreTi } from './formulario-perfil/CamposSobreTi';
import { TarjetaPermiso } from './formulario-perfil/permisos';

type Paso = 1 | 'festivos' | 2 | 'permisos';

const NUMERO_PASO: Record<Paso, number> = { 1: 1, festivos: 2, 2: 3, permisos: 3 };

// Formulario de bienvenida. Sale solo la primera vez (o tras "Repetir bienvenida").
// Al terminar, el diseño de rutas (_layout.tsx) lleva a las pestañas automáticamente.
export function PantallaBienvenida() {
  const { perfil } = usePerfil();
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDesdePerfil(perfil));
  const [errores, setErrores] = useState<Errores>({});
  const [paso, setPaso] = useState<Paso>(1);
  const [ocupado, setOcupado] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const cambiar = (cambios: Partial<Borrador>) => {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    // Quita el error de los campos que se acaban de tocar.
    setErrores((actuales) => {
      const quedan = { ...actuales };
      for (const clave of Object.keys(cambios)) delete quedan[clave as keyof Borrador];
      return quedan;
    });
  };

  const irA = (nuevo: Paso) => {
    setPaso(nuevo);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const siguiente = async () => {
    setOcupado(true);
    const resultado = await comprobarPaso1(borrador);
    setOcupado(false);
    setBorrador(resultado.borrador);
    setErrores(resultado.errores);
    if (hayErrores(resultado.errores)) {
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    irA('festivos');
  };

  const siguienteFestivos = () => {
    const nuevos = comprobarFestivos(borrador);
    setErrores(nuevos);
    if (!hayErrores(nuevos)) irA(2);
  };

  const empezar = () => {
    const nuevos = comprobarPaso2(borrador);
    setErrores(nuevos);
    if (!hayErrores(nuevos)) irA('permisos');
  };

  const terminar = async (pedirPermisos: boolean) => {
    setOcupado(true);
    if (pedirPermisos) {
      // Se piden uno detrás de otro. Diga lo que diga el usuario, se sigue adelante.
      for (const permiso of PERMISOS_DISPONIBLES) {
        await pedirPermiso(permiso);
      }
    }
    await completarBienvenida(perfilDesdeBorrador(borrador));
  };

  return (
    <Pantalla ref={scroll}>
      <BarraProgreso paso={NUMERO_PASO[paso]} total={3} />

      {paso === 1 ? (
        <>
          <Titulo>Cuéntame un poco de ti</Titulo>
          <CamposSobreTi borrador={borrador} cambiar={cambiar} errores={errores} />
          <Boton
            titulo={ocupado ? 'Comprobando…' : 'Siguiente'}
            disabled={ocupado}
            onPress={siguiente}
          />
          {/* Ya usa Rusko en otro dispositivo: entra y se trae todo (sin rellenar esto). */}
          {supabaseConfigurado ? (
            <Boton variante="secundario" titulo="Ya tengo cuenta: entrar" onPress={() => router.push('/cuenta')} />
          ) : null}
        </>
      ) : null}

      {paso === 'festivos' ? (
        <>
          <Titulo>Tus festivos</Titulo>
          <CamposFestivos borrador={borrador} cambiar={cambiar} errores={errores} />
          <View style={estilos.botones}>
            <Boton titulo="Siguiente" onPress={siguienteFestivos} />
            <Boton variante="secundario" titulo="Atrás" onPress={() => irA(1)} />
          </View>
        </>
      ) : null}

      {paso === 2 ? (
        <>
          <Titulo>Tu ritmo</Titulo>
          <CamposRitmo borrador={borrador} cambiar={cambiar} errores={errores} />
          <View style={estilos.botones}>
            <Boton titulo="Empezar" onPress={empezar} />
            <Boton variante="secundario" titulo="Atrás" onPress={() => irA('festivos')} />
          </View>
        </>
      ) : null}

      {paso === 'permisos' ? (
        <>
          <Titulo>{PERMISOS_DISPONIBLES.length === 1 ? 'Un permiso' : 'Dos permisos'}</Titulo>
          <Texto secundario>
            {PERMISOS_DISPONIBLES.length === 1
              ? 'Te lo pido ahora para que Rusko funcione del todo. Si dices que no, la app sigue funcionando y puedes activarlo más tarde desde Perfil.'
              : 'Te los pido ahora para que Rusko funcione del todo. Si dices que no, la app sigue funcionando y puedes activarlos más tarde desde Perfil.'}
          </Texto>
          {PERMISOS_DISPONIBLES.map((permiso) => (
            <TarjetaPermiso key={permiso} permiso={permiso} />
          ))}
          <View style={estilos.botones}>
            <Boton
              titulo={ocupado ? 'Un momento…' : 'Continuar'}
              disabled={ocupado}
              onPress={() => terminar(true)}
            />
            <Boton
              variante="secundario"
              titulo="Ahora no"
              disabled={ocupado}
              onPress={() => terminar(false)}
            />
          </View>
        </>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  botones: { gap: espacio.s, marginTop: espacio.s },
});
