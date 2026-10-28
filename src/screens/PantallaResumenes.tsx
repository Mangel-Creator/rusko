import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pantalla, Plegable, Selector, Tarjeta, Texto, Titulo } from '@/components';
import { useCorreos } from '@/data/correos';
import { useEventos } from '@/data/eventos';
import {
  actualizarCorreos,
  bandejasCorreo,
  conectarCorreo,
  conNivel,
  iaEncendida,
  marcarCorreosVistos,
  textoVuelta,
  type CorreoConNivel,
} from '@/services/correo';
import { claveDia } from '@/services/fechas';
import { colores, espacio, radio } from '@/theme';

import { ChipCuentas } from './correo/ChipCuentas';
import { CuentasCorreo } from './correo/CuentasCorreo';
import { FilaCorreo } from './correo/FilaCorreo';
import { porImportancia } from './correo/RecuadroCorreo';
import { VetadosCorreo } from './correo/VetadosCorreo';
import { VincularAyudante, VincularCorreo } from './correo/VincularCorreo';

// Pestaña Correo (fase 11): /resumenes, desde la barra inferior o al tocar un aviso de
// correo. Sin resúmenes (26/10/2026): de cada correo, de qué va y el día que importa.
// - Sin nada vinculado: "Vincular con Gmail / Outlook" (solo iniciar sesión), cómo
//   meter iCloud y, plegado, el ayudante de Gmail (QR o enlace).
// - Con algo vinculado (27/10/2026): la cuenta como chip junto al título (al tocarlo,
//   "Tus cuentas") y tres bandejas de recuadros de color (FilaCorreo → RecuadroCorreo):
//   "Todo" (fijados arriba y luego por importancia, también lo que se apuntó), "Con
//   fecha" (lo que está en tu calendario, con "¿Eliminar cita?") y "Resúmenes" (lo
//   importante sin fecha; se llena sola al encender la IA). Plegados, "Remitentes
//   vetados" y "Vincular otra cuenta".
// Llegan aquí también la vuelta del inicio de sesión en la web (?correo=ok&cuenta=…) y
// el QR del ayudante (#ayudante=<enlace>, detrás de "#" para que no llegue a ningún
// servidor).

const diaDe = (iso: string) => claveDia(new Date(iso));

type Mensaje = { bien: boolean; texto: string };
type Bandeja = 'todo' | 'fecha' | 'resumenes';

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
  const { cargado, conexion, cuentas, proveedores, correos, siempre } = useCorreos();
  const { eventos } = useEventos();
  const [bandeja, setBandeja] = useState<Bandeja>('todo');
  const params = useLocalSearchParams<{ correo?: string; cuenta?: string; motivo?: string; ayudante?: string }>();
  const [actualizando, setActualizando] = useState(false);
  // "Tus cuentas", detrás del chip de la cabecera.
  const [verCuentas, setVerCuentas] = useState(false);
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
  const { todos, conFecha, pasados, resumenes } = bandejasCorreo(correos, hoy, diaDe);
  // Cada correo con su nivel (0-3), que da el color de su recuadro.
  const nivel = (lista: Parameters<typeof conNivel>[0]) => conNivel(lista, hoy, siempre);
  // "Todo" (27/10/2026): fijados arriba y luego de más a menos importante.
  const porNivel = porImportancia(nivel(todos.flatMap((g) => g.correos)));
  const caducada = cuentas.some((c) => c.estado === 'caducada');
  const vinculado = conexion !== null || cuentas.length > 0;
  // Lo apuntado que sigue en el calendario sin hacer: ahí sale "¿Eliminar cita?".
  const pendientes = new Set(eventos.filter((e) => !e.hecha).map((e) => e.id));
  const fila = (c: CorreoConNivel) => (
    <FilaCorreo key={c.id} correo={c} hoy={hoy} nuevo={!c.visto} apuntado={!!c.eventoId && pendientes.has(c.eventoId)} />
  );
  const conCuenta = (n: number) => (n > 0 ? ` · ${n}` : '');

  return (
    <Pantalla>
      {/* La cuenta, como chip pequeño junto al título (27/10/2026): no estorba. */}
      <View style={estilos.cabecera}>
        <Titulo>Correo</Titulo>
        {cargado && vinculado ? (
          <ChipCuentas cuentas={cuentas} conexion={conexion} abierto={verCuentas || caducada} alPulsar={() => setVerCuentas((v) => !v)} />
        ) : null}
      </View>

      {/* Solo lo que ha ido mal: lo de "ya está vinculado" sobraba (ya lo dice el chip). */}
      {mensaje && !mensaje.bien ? (
        <Tarjeta style={estilos.mensaje}>
          <Texto fuerte style={estilos.aviso} accessibilityLiveRegion="polite">
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
              Te aviso de lo que importa, y lo que tenga fecha (un plazo o una cita) te lo apunto en el calendario. Solo
              tienes que iniciar sesión.
            </Texto>
          </View>
          <VincularCorreo proveedores={proveedores} alTerminar={setMensaje} />
          <VincularAyudante alTerminar={setMensaje} />
        </>
      ) : (
        <>
          {verCuentas || caducada ? (
            <CuentasCorreo cuentas={cuentas} conexion={conexion} actualizando={actualizando} alTerminar={setMensaje} />
          ) : null}

          <Selector
            opciones={[
              { valor: 'todo', etiqueta: 'Todo' },
              { valor: 'fecha', etiqueta: `Con fecha${conCuenta(conFecha.length)}` },
              { valor: 'resumenes', etiqueta: `Resúmenes${conCuenta(resumenes.length)}` },
            ]}
            valor={bandeja}
            alCambiar={setBandeja}
          />

          {bandeja === 'todo' ? (
            correos.length === 0 ? (
              <Vacio icono="mail-open-outline" texto="Nada nuevo en tu correo. Cuando llegue algo a tu bandeja de entrada, lo verás aquí." />
            ) : (
              <View style={estilos.seccion}>{porNivel.map(fila)}</View>
            )
          ) : null}

          {bandeja === 'fecha' ? (
            <View style={estilos.seccion}>
              <Texto pequeno secundario>
                Lo que traía un plazo o una cita: ya está en tu calendario ese día. Si no te afecta, «Eliminar» y no vuelve.
              </Texto>
              {conFecha.length === 0 ? (
                <Vacio icono="calendar-outline" texto="Ningún correo con fecha por delante." />
              ) : (
                nivel(conFecha).map(fila)
              )}
              {pasados.length > 0 ? (
                <>
                  <Titulo nivel={3}>Ya pasados</Titulo>
                  {nivel(pasados).map(fila)}
                </>
              ) : null}
            </View>
          ) : null}

          {bandeja === 'resumenes' ? (
            <View style={estilos.seccion}>
              <Texto pequeno secundario>
                {iaEncendida(correos)
                  ? 'Los correos importantes que no tienen fecha, con una línea de qué va.'
                  : 'Aquí saldrán los correos importantes que no tienen fecha, con una línea de qué van. Se llenará sola cuando se encienda la IA; mientras, solo los de «Avisarme siempre de…».'}
              </Texto>
              {resumenes.length === 0 ? (
                <Vacio icono="sparkles-outline" texto="Nada importante por ahora." />
              ) : (
                nivel(resumenes).map(fila)
              )}
            </View>
          ) : null}

          <VetadosCorreo />

          <Plegable titulo="Vincular otra cuenta" resumen="Gmail, Outlook, iCloud…">
            <VincularCorreo proveedores={proveedores} alTerminar={setMensaje} />
            {conexion ? null : <VincularAyudante alTerminar={setMensaje} />}
          </Plegable>
        </>
      )}
    </Pantalla>
  );
}

function Vacio({ icono, texto }: { icono: ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={estilos.vacio}>
      <Ionicons name={icono} size={48} color={colores.textoSecundario} />
      <Texto secundario style={estilos.centrado}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  pulsado: { opacity: 0.8 },
  mensaje: { gap: espacio.xs },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
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
