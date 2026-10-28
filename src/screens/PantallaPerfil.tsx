import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { Boton, BotonAtras, Pantalla, Plegable, Selector, Texto, Titulo } from '@/components';
import { guardarDensidad, OPCIONES_DENSIDAD, useDensidad } from '@/data/densidad';
import { borrarEventosEjemplo, crearEventosEjemplo } from '@/data/eventos';
import { guardarPerfil, repetirBienvenida, usePerfil } from '@/data/perfil';
import {
  abrirAjustesDelTelefono,
  consultarPermiso,
  pedirPermiso,
  PERMISOS_DISPONIBLES,
  type EstadoPermiso,
  type Permiso,
} from '@/services/permisos';
import { nombreComunidad } from '@/services/festivos';
import { colores, espacio } from '@/theme';

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
import { MensajeError } from './formulario-perfil/MensajeError';
import { TarjetaPermiso } from './formulario-perfil/permisos';
import { SeccionAvisos } from './perfil/SeccionAvisos';
import { SeccionCalendarios } from './perfil/SeccionCalendarios';
import { SeccionCopia } from './perfil/SeccionCopia';
import { SeccionCuenta } from './perfil/SeccionCuenta';
import { SeccionEpocas } from './perfil/SeccionEpocas';
import { SeccionIA } from './perfil/SeccionIA';
import { SeccionSiri } from './siri/SeccionSiri';

type EstadosPermisos = Record<Permiso, EstadoPermiso | undefined>;

// Perfil: editar los datos de la bienvenida, activar permisos y repetir la bienvenida.
// Es un menú de ajustes: cada apartado, una fila con icono que se abre al tocarla, para
// no tener que bajar por una página larguísima.
const EXPLICACION_DENSIDAD = {
  aire: 'Letra algo mayor y más espacio: unos 3 o 4 eventos por pantalla.',
  equilibrado: 'Unos 5 o 6 eventos por pantalla.',
  compacto: 'Más apretado para días llenos: 8 o más eventos por pantalla.',
} as const;

export function PantallaPerfil() {
  const { nivel: densidad } = useDensidad();
  const { perfil } = usePerfil();
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDesdePerfil(perfil));
  const [errores, setErrores] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoEjemplos, setAvisoEjemplos] = useState<string | null>(null);
  const [avisoFestivos, setAvisoFestivos] = useState<string | null>(null);
  const [permisos, setPermisos] = useState<EstadosPermisos>({
    ubicacion: undefined,
    notificaciones: undefined,
  });
  const scroll = useRef<ScrollViewInstance>(null);

  const leerPermisos = useCallback(async () => {
    const [ubicacion, notificaciones] = await Promise.all([
      consultarPermiso('ubicacion'),
      consultarPermiso('notificaciones'),
    ]);
    setPermisos({ ubicacion, notificaciones });
  }, []);

  // Relee los permisos al entrar y al volver de los Ajustes del teléfono.
  useFocusEffect(
    useCallback(() => {
      leerPermisos();
      const suscripcion = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') leerPermisos();
      });
      return () => suscripcion.remove();
    }, [leerPermisos]),
  );

  const cambiar = (cambios: Partial<Borrador>) => {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setAviso(null);
    setAvisoFestivos(null);
    setErrores((actuales) => {
      const quedan = { ...actuales };
      for (const clave of Object.keys(cambios)) delete quedan[clave as keyof Borrador];
      return quedan;
    });
  };

  const guardar = async () => {
    setOcupado(true);
    const paso1 = await comprobarPaso1(borrador);
    const todos = { ...paso1.errores, ...comprobarPaso2(paso1.borrador) };
    setBorrador(paso1.borrador);
    setErrores(todos);
    if (hayErrores(todos)) {
      setOcupado(false);
      setAviso('Revisa lo que está marcado en rojo.');
      return;
    }
    await guardarPerfil(perfilDesdeBorrador(paso1.borrador));
    setOcupado(false);
    setAviso('Guardado.');
  };

  // Solo los festivos: así no hace falta tener bien todo lo demás para guardarlos.
  const guardarFestivos = async () => {
    const nuevos = comprobarFestivos(borrador);
    setErrores((actuales) => ({ ...actuales, festivos: nuevos.festivos }));
    if (hayErrores(nuevos) || !perfil) return;
    await guardarPerfil({ ...perfil, festivos: perfilDesdeBorrador(borrador).festivos });
    setAvisoFestivos('Guardados');
  };

  const activar = async (permiso: Permiso) => {
    if (permisos[permiso] === 'bloqueado') {
      await abrirAjustesDelTelefono();
      return;
    }
    const estado = await pedirPermiso(permiso);
    setPermisos((actuales) => ({ ...actuales, [permiso]: estado }));
  };

  return (
    <Pantalla ref={scroll}>
      <BotonAtras texto="Hoy" etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />

      <Titulo>Perfil</Titulo>

      <SeccionCuenta />

      <Plegable
        titulo="Sobre ti y tu ritmo"
        icono="person-outline"
        color="naranja"
        resumen={[perfil?.nombre, perfil?.vivienda.direccion].filter(Boolean).join(' · ')}
        abierto={hayErrores(errores)}>
        <Titulo nivel={3}>Sobre ti</Titulo>
        <CamposSobreTi borrador={borrador} cambiar={cambiar} errores={errores} />

        <Titulo nivel={3} style={estilos.seccion}>
          Tu ritmo
        </Titulo>
        <CamposRitmo borrador={borrador} cambiar={cambiar} errores={errores} />

        <View>
          <Boton
            titulo={ocupado ? 'Guardando…' : 'Guardar cambios'}
            disabled={ocupado}
            onPress={guardar}
          />
          {aviso === 'Guardado.' ? (
            <Texto fuerte style={estilos.guardado} accessibilityLiveRegion="polite">
              {aviso}
            </Texto>
          ) : (
            <MensajeError texto={aviso} />
          )}
        </View>
      </Plegable>

      <Plegable
        titulo="Tus festivos"
        icono="flag-outline"
        color="azul"
        resumen={perfil?.festivos ? `${perfil.festivos.municipio} · ${nombreComunidad(perfil.festivos.comunidad)}` : 'Sin poner'}
        abierto={!!errores.festivos}>
        <CamposFestivos borrador={borrador} cambiar={cambiar} errores={errores} />
        <Boton titulo={avisoFestivos ?? 'Guardar festivos'} onPress={guardarFestivos} />
      </Plegable>

      <Plegable titulo="Cómo se ve" icono="contrast-outline" color="blanco" resumen={OPCIONES_DENSIDAD.find((o) => o.valor === densidad)?.etiqueta}>
        <Selector
          etiqueta="Cuánto cabe en Hoy y en Semana"
          opciones={OPCIONES_DENSIDAD}
          valor={densidad}
          alCambiar={guardarDensidad}
        />
        <Texto pequeno secundario>
          {EXPLICACION_DENSIDAD[densidad]} Se aplica al momento.
        </Texto>
      </Plegable>

      <Plegable titulo="Permisos" icono="key-outline" color="azul">
        {PERMISOS_DISPONIBLES.map((permiso) => (
          <TarjetaPermiso
            key={permiso}
            permiso={permiso}
            estado={permisos[permiso]}
            alActivar={() => activar(permiso)}
          />
        ))}
      </Plegable>

      <Plegable titulo="Tu IA" icono="sparkles-outline" color="naranja">
        <SeccionIA />
      </Plegable>

      <Plegable titulo="Avisos" icono="notifications-outline" color="rojo">
        <SeccionAvisos
          permiso={permisos.notificaciones}
          alActivarPermiso={() => activar('notificaciones')}
        />
      </Plegable>

      <Plegable titulo="Épocas doradas" icono="star-outline" color="naranja">
        <SeccionEpocas />
      </Plegable>

      <Plegable titulo="Tus otros calendarios" icono="calendar-outline" color="azul">
        <SeccionCalendarios />
      </Plegable>

      <Plegable titulo="Siri" icono="mic-outline" color="rojo">
        <SeccionSiri />
      </Plegable>

      <Plegable titulo="Copia de seguridad" icono="cloud-upload-outline" color="azul">
        <SeccionCopia />
      </Plegable>

      <Plegable titulo="Pruebas" icono="construct-outline" color="blanco">
        <Texto secundario>
          Vuelve a mostrar el formulario de bienvenida. Tus datos se conservan.
        </Texto>
        <Boton variante="secundario" titulo="Repetir bienvenida" onPress={repetirBienvenida} />

        <Texto secundario style={estilos.separado}>
          Eventos de ejemplo para probar Hoy y Semana.
          {__DEV__ ? ' En modo desarrollo se crean solos la primera vez.' : ''} Tus eventos no se tocan.
        </Texto>
        <Boton
          variante="secundario"
          titulo="Crear eventos de ejemplo"
          onPress={async () => setAvisoEjemplos(`Creados ${await crearEventosEjemplo()} eventos de ejemplo.`)}
        />
        <Boton
          variante="secundario"
          titulo="Borrar eventos de ejemplo"
          onPress={async () => setAvisoEjemplos(`Borrados ${await borrarEventosEjemplo()} eventos de ejemplo.`)}
        />
        {avisoEjemplos ? (
          <Texto fuerte style={estilos.guardado} accessibilityLiveRegion="polite">
            {avisoEjemplos}
          </Texto>
        ) : null}
      </Plegable>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  pulsado: { opacity: 0.6 },
  seccion: { marginTop: espacio.s },
  guardado: { color: colores.texto, marginTop: espacio.xs }, // el verde es solo de Amigos
  separado: { marginTop: espacio.s },
});
