import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, BotonEntrarCon, CampoTexto, Plegable, Texto } from '@/components';
import type { ProveedorCorreo, ProveedoresCorreo } from '@/data/correos';
import { conectarCorreo, vincularCuenta, type ResultadoVincular } from '@/services/correo';
import { alturaTactil, colores, espacio, radio } from '@/theme';

// "Vincular con…" (fase 11). Gmail y Outlook solo piden iniciar sesión: van con los
// botones oficiales de Google y Microsoft (BotonEntrarCon; sus normas de marca lo
// exigen). iCloud (y la app Mail del iPhone) no se puede vincular y se explica cómo
// reenviarlo; su fila no lleva el logo de Apple (Apple no deja usarlo en otras apps). Plegado, el ayudante de Gmail (sin guardar nada en el servidor), que
// se vincula escaneando su QR o pegando su enlace.

type NombreIcono = ComponentProps<typeof Ionicons>['name'];
type Opcion = 'icloud' | 'otro';

const BOTONES: { valor: ProveedorCorreo; titulo: string; ayuda: string }[] = [
  { valor: 'gmail', titulo: 'Continuar con Google', ayuda: 'Para vincular tu Gmail.' },
  { valor: 'outlook', titulo: 'Iniciar sesión con Microsoft', ayuda: 'Para vincular Outlook, Hotmail o Live.' },
];

const OPCIONES: { valor: Opcion; icono: NombreIcono; titulo: string; ayuda: string }[] = [
  { valor: 'icloud', icono: 'cloud-outline', titulo: 'iCloud o Mail del iPhone', ayuda: 'Apple no deja vincularlo: te digo cómo' },
  { valor: 'otro', icono: 'mail-outline', titulo: 'Otro correo', ayuda: 'Trabajo, Yahoo…' },
];

const EXPLICACION: Record<'icloud' | 'otro', string> = {
  icloud:
    'Apple no deja que ninguna app lea el correo de iCloud ni la app Mail. Haz que iCloud reenvíe tus correos a tu Gmail u Outlook y vincula ese: en icloud.com/mail, Ajustes > Reenvío > «Reenviar mi correo a». Puedes seguir leyéndolos en Mail como siempre.',
  otro:
    'Si tu correo del trabajo es de Google o de Microsoft (muchos lo son), usa su botón. Si no, reenvíalo solo a tu Gmail u Outlook desde sus ajustes y vincula ese. Algunas empresas no dejan reenviar: pregunta a quien lleve los ordenadores.',
};

function textoFallo(r: Exclude<ResultadoVincular, { ok: true } | { ok: 'redirigiendo' }>, proveedor: ProveedorCorreo) {
  switch (r.motivo) {
    case 'cancelado':
      return 'No se ha vinculado: cancelaste el inicio de sesión.';
    case 'sin-configurar':
      return `Aún no está activado: falta registrar Rusko en ${proveedor === 'gmail' ? 'Google' : 'Microsoft'}. Los pasos están en la guía «Fase 11 - Correo».`;
    case 'sin-servidor':
      return 'Esta versión no está conectada al servidor de Rusko.';
    case 'sin-conexion':
      return 'Sin conexión. Prueba otra vez cuando tengas internet.';
    case 'demasiadas':
      return 'Ya tienes 5 cuentas vinculadas. Quita una para añadir otra.';
    case 'limite':
      return 'Demasiados intentos por hoy. Prueba mañana.';
    default:
      return 'No se ha podido vincular. Prueba otra vez en un rato.';
  }
}

type Props = {
  proveedores: ProveedoresCorreo | null;
  alTerminar: (mensaje: { bien: boolean; texto: string }) => void;
};

export function VincularCorreo({ proveedores, alTerminar }: Props) {
  const [explicando, setExplicando] = useState<'icloud' | 'otro' | null>(null);
  const [ocupado, setOcupado] = useState<ProveedorCorreo | null>(null);

  const vincular = async (opcion: ProveedorCorreo) => {
    setOcupado(opcion);
    const r = await vincularCuenta(opcion).catch(() => ({ ok: false as const, motivo: 'error' as const }));
    setOcupado(null);
    if (r.ok === 'redirigiendo') return;
    if (r.ok) alTerminar({ bien: true, texto: `Listo: ${r.email ?? 'tu correo'} ya está vinculado. Te aviso en cuanto llegue algo.` });
    else alTerminar({ bien: false, texto: textoFallo(r, opcion) });
  };

  return (
    <View style={estilos.contenedor}>
      {BOTONES.map((b) => {
        const desactivado = proveedores?.[b.valor] === false;
        return (
          <View key={b.valor} style={estilos.boton}>
            <BotonEntrarCon
              proveedor={b.valor === 'gmail' ? 'google' : 'microsoft'}
              titulo={b.titulo}
              activo={!desactivado && (ocupado === null || ocupado === b.valor)}
              cargando={ocupado === b.valor}
              onPress={() => vincular(b.valor)}
            />
            <Texto pequeno secundario>
              {desactivado ? 'Aún no está activado.' : b.ayuda}
            </Texto>
          </View>
        );
      })}
      {OPCIONES.map((o) => {
        return (
          <View key={o.valor}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${o.titulo}. ${o.ayuda}`}
              accessibilityState={{ expanded: explicando === o.valor }}
              onPress={() => setExplicando((actual) => (actual === o.valor ? null : o.valor))}
              style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
              <View style={estilos.icono}>
                <Ionicons name={o.icono} size={22} color={colores.texto} />
              </View>
              <View style={estilos.textos}>
                <Texto fuerte>{o.titulo}</Texto>
                <Texto pequeno secundario>
                  {o.ayuda}
                </Texto>
              </View>
              <Ionicons
                name={explicando === o.valor ? 'chevron-up' : 'chevron-forward'}
                size={20}
                color={colores.textoSecundario}
              />
            </Pressable>
            {explicando === o.valor ? (
              <Texto pequeno secundario style={estilos.explicacion}>
                {EXPLICACION[o.valor]}
              </Texto>
            ) : null}
          </View>
        );
      })}
      <Texto pequeno secundario>
        Solo inicias sesión en Google o Microsoft: Rusko nunca ve tu contraseña. Para avisarte en cuanto llega algo,
        guarda en su servidor, cifrado, el permiso para leer tu correo (solo leer) y 7 días de resúmenes. Si activas la
        IA, el texto de cada correo se envía a la IA (Claude, de Anthropic) para resumirlo y no se guarda. Lo quitas
        cuando quieras.
      </Texto>
      {proveedores?.gmail ? (
        <Texto pequeno secundario>
          Con Gmail, Google te pedirá volver a entrar cada semana mientras no haya revisado Rusko. Te aviso cuando toque.
        </Texto>
      ) : null}
    </View>
  );
}

// El ayudante de Gmail: se vincula solo al escanear su QR (abre la web de Organizy
// con "#ayudante=…") o pegando aquí su enlace.
export function VincularAyudante({ alTerminar }: { alTerminar: (mensaje: { bien: boolean; texto: string }) => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  const conectar = async () => {
    setConectando(true);
    setError(null);
    const r = await conectarCorreo(texto).catch(() => ({ ok: false as const, motivo: 'no-responde' as const }));
    setConectando(false);
    if (r.ok) {
      setTexto('');
      alTerminar({ bien: true, texto: 'Listo: el ayudante de Gmail ya está conectado.' });
      return;
    }
    setError(
      r.motivo === 'enlace'
        ? 'Eso no parece el enlace del ayudante. Empieza por https://script.google.com/macros/s/ y acaba en /exec.'
        : r.motivo === 'sin-conexion'
          ? 'Sin conexión. Prueba otra vez cuando tengas internet.'
          : 'El ayudante no responde. Revisa que lo implementaste como «Aplicación web» con acceso para «Cualquier usuario».',
    );
  };

  return (
    <Plegable titulo="Sin guardar nada en el servidor" resumen="Ayudante de Gmail, con QR" abierto={!!error}>
      <Texto pequeno secundario>
        Montas un ayudante en tu propia cuenta de Google (guía «Fase 11 - Correo», unos 15 minutos) y tus correos no pasan
        por Rusko. Al terminar te enseña un QR: escanéalo con la cámara del iPhone y se vincula solo. También puedes
        pegar aquí su enlace.
      </Texto>
      <CampoTexto
        etiqueta="Enlace del ayudante"
        placeholder="https://script.google.com/macros/s/…/exec"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={error}
      />
      <Boton
        variante="secundario"
        titulo={conectando ? 'Conectando…' : 'Conectar el ayudante'}
        onPress={conectar}
        disabled={conectando || !texto.trim()}
      />
    </Plegable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  boton: { gap: espacio.xs, marginBottom: espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 16,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
  },
  pulsado: { transform: [{ scale: 0.99 }] },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondo,
  },
  textos: { flex: 1, gap: 2 },
  explicacion: { paddingHorizontal: espacio.m, paddingTop: espacio.s },
});
