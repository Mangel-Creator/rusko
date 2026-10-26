import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pantalla, Plegable, Tarjeta, Texto, Titulo } from '@/components';
import { useCorreos } from '@/data/correos';
import {
  actualizarCorreos,
  conectarCorreo,
  marcarCorreosVistos,
  ordenarCorreos,
  textoGrupo,
  textoVuelta,
} from '@/services/correo';
import { claveDia } from '@/services/fechas';
import { colores, espacio, radio } from '@/theme';

import { CuentasCorreo } from './correo/CuentasCorreo';
import { FilaCorreo } from './correo/FilaCorreo';
import { VincularAyudante, VincularCorreo } from './correo/VincularCorreo';

// Pestaña Correo (fase 11): /resumenes, desde la barra inferior o al tocar un aviso de
// correo. Sin resúmenes (26/10/2026): de cada correo, de qué va y el día que importa.
// - Sin nada vinculado: "Vincular con Gmail / Outlook" (solo iniciar sesión), cómo
//   meter iCloud y, plegado, el ayudante de Gmail (QR o enlace).
// - Con algo vinculado: tus cuentas, lo que tiene fecha (ya en las tareas) y el
//   resto de correos, por día; "Vincular otra cuenta" plegado.
// Llegan aquí también la vuelta del inicio de sesión en la web (?correo=ok&cuenta=…) y
// el QR del ayudante (#ayudante=<enlace>, detrás de "#" para que no llegue a ningún
// servidor).

const diaDe = (iso: string) => claveDia(new Date(iso));

type Mensaje = { bien: boolean; texto: string };

// Quita de la dirección de la web el resultado o el enlace del QR (si no, al recargar
// saldría otra vez). Con un momento de espera: al abrir, el enrutador la reescribe.
function limpiarDireccion() {
  setTimeout(() => window.history.replaceState(null, '', window.location.pathname), 500);
}

// El enlace del QR del ayudante: "#ayudante=…" en la web o "?ayudante=…".
function enlaceDelQR(parametro: string | undefined): string | null {
  if (parametro) return parametro;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const m = window.location.hash.match(/ayudante=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function PantallaResumenes() {
  const { cargado, conexion, cuentas, proveedores, correos } = useCorreos();
  const params = useLocalSearchParams<{ correo?: string; cuenta?: string; motivo?: string; ayudante?: string }>();
  const [actualizando, setActualizando] = useState(false);
  // El QR del ayudante de Gmail (se conecta solo, abajo).
  const [ayudante] = useState(() => enlaceDelQR(params.ayudante));
  // Al abrir: qué pasó al iniciar sesión en la web, o que se está conectando el ayudante.
  const [mensaje, setMensaje] = useState<Mensaje | null>(
    () =>
      textoVuelta({ correo: params.correo, cuenta: params.cuenta, motivo: params.motivo }) ??
      (ayudante ? { bien: true, texto: 'Conectando el ayudante de Gmail…' } : null),
  );

  // Al entrar, trae lo nuevo (y pregunta al servidor qué botones están activados). Los
  // nuevos salen marcados mientras estás aquí y pasan a vistos al salir.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      setActualizando(true);
      actualizarCorreos({ servidor: true })
        .catch(() => {})
        .finally(() => vigente && setActualizando(false));
      return () => {
        vigente = false;
        marcarCorreosVistos().catch(() => {});
      };
    }, []),
  );

  // Vuelta de iniciar sesión en la web: el mensaje ya está puesto; se limpia la dirección.
  const hayVuelta = params.correo !== undefined;
  useEffect(() => {
    if (!hayVuelta) return;
    if (Platform.OS === 'web') limpiarDireccion();
    else router.setParams({ correo: undefined, cuenta: undefined, motivo: undefined });
  }, [hayVuelta]);

  // QR del ayudante de Gmail: se conecta solo.
  useEffect(() => {
    if (!ayudante) return;
    if (Platform.OS === 'web') limpiarDireccion();
    conectarCorreo(ayudante)
      .catch(() => ({ ok: false as const }))
      .then((r) =>
        setMensaje(
          r.ok
            ? { bien: true, texto: 'Listo: el ayudante de Gmail ya está conectado.' }
            : { bien: false, texto: 'No he podido conectar el ayudante. Abre otra vez su enlace o pégalo más abajo.' },
        ),
      );
  }, [ayudante]);

  const hoy = claveDia(new Date());
  const { plazos, grupos } = ordenarCorreos(correos, hoy, diaDe);
  const vinculado = conexion !== null || cuentas.length > 0;

  return (
    <Pantalla>
      <Titulo>Correo</Titulo>

      {mensaje ? (
        <Tarjeta style={estilos.mensaje}>
          <Texto fuerte style={mensaje.bien ? undefined : estilos.aviso} accessibilityLiveRegion="polite">
            {mensaje.texto}
          </Texto>
        </Tarjeta>
      ) : null}

      {!cargado ? null : !vinculado ? (
        <>
          <View style={estilos.intro}>
            <View style={estilos.icono}>
              <Ionicons name="mail-outline" size={28} color={colores.texto} />
            </View>
            <Titulo nivel={2}>Vincula tu correo</Titulo>
            <Texto secundario>
              Te aviso de cada correo nuevo con un resumen, y lo que tenga fecha límite te lo apunto en las tareas. Solo
              tienes que iniciar sesión.
            </Texto>
          </View>
          <VincularCorreo proveedores={proveedores} alTerminar={setMensaje} />
          <VincularAyudante alTerminar={setMensaje} />
        </>
      ) : (
        <>
          <CuentasCorreo cuentas={cuentas} conexion={conexion} actualizando={actualizando} alTerminar={setMensaje} />

          {correos.length === 0 ? (
            <View style={estilos.vacio}>
              <Ionicons name="mail-open-outline" size={48} color={colores.textoSecundario} />
              <Texto secundario style={estilos.centrado}>
                Nada nuevo en tu correo. Cuando llegue algo a Principal, lo verás aquí.
              </Texto>
            </View>
          ) : null}

          {plazos.length > 0 ? (
            <View style={estilos.seccion}>
              <Titulo nivel={3}>Con fecha</Titulo>
              <Texto pequeno secundario>
                Ya están en tus tareas, ese día.
              </Texto>
              {plazos.map((c) => (
                <FilaCorreo key={c.id} correo={c} hoy={hoy} nuevo={!c.visto} />
              ))}
            </View>
          ) : null}

          {grupos.map((grupo) => (
            <View key={grupo.dia} style={estilos.seccion}>
              <Titulo nivel={3}>{textoGrupo(grupo.dia, hoy)}</Titulo>
              {grupo.correos.map((c) => (
                <FilaCorreo key={c.id} correo={c} hoy={hoy} nuevo={!c.visto} />
              ))}
            </View>
          ))}

          <Plegable titulo="Vincular otra cuenta" resumen="Gmail, Outlook, iCloud…">
            <VincularCorreo proveedores={proveedores} alTerminar={setMensaje} />
            {conexion ? null : <VincularAyudante alTerminar={setMensaje} />}
          </Plegable>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  pulsado: { opacity: 0.8 },
  mensaje: { gap: espacio.xs },
  aviso: { color: colores.aviso },
  intro: { gap: espacio.s },
  icono: {
    width: 48,
    height: 48,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.tarjeta,
  },
  vacio: { alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xl, paddingHorizontal: espacio.l },
  centrado: { textAlign: 'center' },
  seccion: { gap: espacio.s, marginTop: espacio.s },
});
