import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Selector, Tarjeta, Texto } from '@/components';
import {
  cerrarSesion,
  comprobarConfirmacion,
  correoValido,
  crearCuenta,
  entrar,
  LARGO_MINIMO,
  olvideContrasena,
  ponerContrasena,
  reenviarConfirmacion,
  TEXTO_FALLO,
  useCuenta,
  type Resultado,
} from '@/services/cuenta';
import { cuandoFueLaCopia, type ResumenCopia } from '@/services/copia/formato';
import {
  olvidarNube,
  resumenDeLaNube,
  sincronizar,
  subirLoDeAqui,
  traerDeLaNube,
  useNube,
  type EstadoVisible,
} from '@/services/nube';
import { colores, espacio } from '@/theme';

import { MensajeError } from '../formulario-perfil/MensajeError';

// Tu cuenta (27/10/2026): entrar con correo y contraseña desde cualquier dispositivo y
// tener lo mismo en todos. Lo usan Perfil > "Tu cuenta" y la página /cuenta (a la que
// llevan los enlaces de los correos y el "Ya tengo cuenta" de la bienvenida).

const AQUI = Platform.OS === 'web' ? 'esta web' : 'este móvil';

const QUE_SE_GUARDA =
  'Todo lo tuyo (eventos, tareas, épocas, alarmas, planes y tu perfil) se guarda también en el servidor de Rusko, y solo tu cuenta puede verlo. Así, al entrar en otro dispositivo, tienes lo mismo.';

type Modo = 'entrar' | 'crear';
const MODOS = [
  { valor: 'entrar', etiqueta: 'Entrar' },
  { valor: 'crear', etiqueta: 'Crear cuenta' },
] as const;

type Props = {
  // Llegó con el enlace de "He olvidado la contraseña": pide la nueva.
  nuevaContrasena?: boolean;
  alTerminarContrasena?: () => void;
};

export function PanelCuenta({ nuevaContrasena = false, alTerminarContrasena }: Props) {
  const cuenta = useCuenta();
  const nube = useNube();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [otroCorreo, setOtroCorreo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [salir, setSalir] = useState(false);

  const confirmando = cuenta.tipo === 'confirmando';

  // Mientras espera la confirmación, al volver a la app (después de tocar el enlace) mira sola.
  useEffect(() => {
    if (!confirmando) return;
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') comprobarConfirmacion();
    });
    return () => app.remove();
  }, [confirmando]);

  const hacer = async (accion: () => Promise<Resultado>, exito: string | null): Promise<boolean> => {
    setError(null);
    setMensaje(null);
    setOcupado(true);
    const resultado = await accion();
    setOcupado(false);
    if (resultado.ok) {
      if (exito) setMensaje(exito);
      return true;
    }
    if (resultado.motivo === 'codigo') setPideCodigo(true);
    setError(TEXTO_FALLO[resultado.motivo]);
    return false;
  };

  const comprobarCampos = (conContrasena: boolean): boolean => {
    if (!correoValido(email)) {
      setError(TEXTO_FALLO['correo-malo']);
      return false;
    }
    if (conContrasena && contrasena.length < LARGO_MINIMO) {
      setError(TEXTO_FALLO.debil);
      return false;
    }
    return true;
  };

  const enviarFormulario = async (que: Modo) => {
    if (!comprobarCampos(true)) return;
    if (que === 'entrar') {
      const ok = await hacer(
        () => entrar(email, contrasena),
        `Dentro. Si en ${AQUI} tenías activados los avisos o el Atajo del Reloj, vuelve a activarlos.`,
      );
      if (ok) setContrasena('');
      return;
    }
    const ok = await hacer(() => crearCuenta(email, contrasena), null);
    if (ok) {
      setOtroCorreo(false);
      setContrasena('');
    }
  };

  const olvide = async () => {
    if (!correoValido(email)) {
      setError('Escribe arriba tu correo y vuelve a tocar «He olvidado la contraseña».');
      return;
    }
    await hacer(
      () => olvideContrasena(email),
      `Te he mandado un enlace a ${email.trim()}. Ábrelo y elige otra contraseña (caduca en una hora).`,
    );
  };

  const guardarContrasena = async () => {
    if (contrasena.length < LARGO_MINIMO) {
      setError(TEXTO_FALLO.debil);
      return;
    }
    const ok = await hacer(
      () => ponerContrasena(contrasena, pideCodigo ? codigo : undefined),
      nuevaContrasena ? 'Contraseña cambiada. Ya puedes entrar con ella en todos tus dispositivos.' : 'Listo: ya tienes cuenta.',
    );
    if (ok) {
      setContrasena('');
      setCodigo('');
      setPideCodigo(false);
      alTerminarContrasena?.();
    }
  };

  const confirmarSalir = async () => {
    const ok = await hacer(cerrarSesion, `Has salido. Lo de ${AQUI} se queda, pero ya no se guarda en tu cuenta.`);
    if (ok) await olvidarNube();
    setSalir(false);
  };

  if (cuenta.tipo === 'sin-servidor') {
    return <Texto secundario>Las cuentas aún no están activadas en esta versión.</Texto>;
  }
  if (cuenta.tipo === 'cargando') return <Texto secundario>Mirando tu cuenta…</Texto>;

  const avisos = (
    <>
      <MensajeError texto={error} />
      {mensaje ? (
        <Texto fuerte accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}
    </>
  );

  const campoContrasena = (etiqueta: string, nueva: boolean) => (
    <CampoTexto
      etiqueta={etiqueta}
      ayuda={nueva ? `Al menos ${LARGO_MINIMO} letras o números.` : undefined}
      value={contrasena}
      onChangeText={setContrasena}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={nueva ? 'new-password' : 'current-password'}
      textContentType={nueva ? 'newPassword' : 'password'}
    />
  );

  // Con el enlace de "He olvidado la contraseña", o tras confirmar el correo sin la
  // contraseña en memoria.
  if ((nuevaContrasena && cuenta.tipo !== 'sin-cuenta') || cuenta.tipo === 'sin-contrasena') {
    return (
      <>
        <Texto>
          {nuevaContrasena ? 'Elige tu nueva contraseña' : 'Correo confirmado. Ahora elige tu contraseña'}
          {'email' in cuenta ? ` para ${cuenta.email}.` : '.'}
        </Texto>
        {campoContrasena('Contraseña', true)}
        {pideCodigo ? (
          <CampoTexto
            etiqueta="Código del correo"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
        ) : null}
        <Boton titulo={ocupado ? 'Guardando…' : 'Guardar la contraseña'} onPress={guardarContrasena} disabled={ocupado} />
        {avisos}
      </>
    );
  }

  if (cuenta.tipo === 'confirmando' && !otroCorreo) {
    return (
      <>
        <Texto>
          Te he mandado un correo a <Texto fuerte>{cuenta.email}</Texto>. Toca el enlace que trae y vuelve aquí.
        </Texto>
        <Texto pequeno secundario>
          Si no llega en un par de minutos, mira en Spam o Promociones.
        </Texto>
        <Boton
          titulo={ocupado ? 'Mirando…' : 'Ya lo he confirmado'}
          disabled={ocupado}
          onPress={() =>
            hacer(async () => {
              const ahora = await comprobarConfirmacion();
              return ahora.tipo === 'confirmando' ? { ok: false, motivo: 'sin-confirmar' } : { ok: true };
            }, null)
          }
        />
        <Boton
          variante="secundario"
          titulo="Reenviar el correo"
          disabled={ocupado}
          onPress={() => hacer(() => reenviarConfirmacion(cuenta.email), 'Enviado otra vez.')}
        />
        <Boton variante="secundario" titulo="Usar otro correo" disabled={ocupado} onPress={() => setOtroCorreo(true)} />
        {avisos}
      </>
    );
  }

  if (cuenta.tipo === 'dentro') {
    return (
      <>
        {nube.situacion === 'elegir' ? <Elegir /> : null}
        <Texto>
          Has entrado como <Texto fuerte>{cuenta.email}</Texto>.
        </Texto>
        <EstadoNube nube={nube} />
        <Boton
          variante="secundario"
          titulo="Guardar ahora"
          disabled={nube.situacion === 'subiendo' || nube.situacion === 'trayendo' || nube.situacion === 'elegir'}
          onPress={() => sincronizar()}
        />
        {salir ? (
          <Tarjeta>
            <Texto>
              Lo de {AQUI} se queda, pero deja de guardarse en tu cuenta. Tus otros dispositivos siguen igual.
            </Texto>
            <Boton titulo="Sí, cerrar sesión" onPress={confirmarSalir} disabled={ocupado} />
            <Boton variante="secundario" titulo="Cancelar" onPress={() => setSalir(false)} disabled={ocupado} />
          </Tarjeta>
        ) : (
          <Boton variante="secundario" titulo="Cerrar sesión" onPress={() => setSalir(true)} />
        )}
        {avisos}
      </>
    );
  }

  // Sin cuenta (o cambiando el correo de una a medio crear).
  return (
    <>
      <Texto secundario>{QUE_SE_GUARDA}</Texto>
      {otroCorreo ? null : <Selector opciones={MODOS} valor={modo} alCambiar={setModo} />}
      <CampoTexto
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      {campoContrasena(modo === 'crear' || otroCorreo ? 'Elige una contraseña' : 'Contraseña', modo === 'crear' || otroCorreo)}
      <Boton
        titulo={ocupado ? 'Un momento…' : modo === 'entrar' && !otroCorreo ? 'Entrar' : 'Crear mi cuenta'}
        onPress={() => enviarFormulario(otroCorreo ? 'crear' : modo)}
        disabled={ocupado}
      />
      {modo === 'crear' || otroCorreo ? (
        <Texto pequeno secundario>
          Te llegará un correo para confirmar que es tuyo. Lo que ya tienes en {AQUI} pasa a tu cuenta.
        </Texto>
      ) : (
        <Boton variante="secundario" titulo="He olvidado la contraseña" onPress={olvide} disabled={ocupado} />
      )}
      {otroCorreo ? (
        <Boton variante="secundario" titulo="Cancelar" onPress={() => setOtroCorreo(false)} disabled={ocupado} />
      ) : null}
      {avisos}
    </>
  );
}

function EstadoNube({ nube }: { nube: EstadoVisible }) {
  const cuando = nube.ultimaVez ? cuandoFueLaCopia(nube.ultimaVez, new Date()).toLowerCase() : null;
  const texto: Record<EstadoVisible['situacion'], string | null> = {
    apagada: null,
    mirando: 'Mirando tu cuenta…',
    'al-dia': `Todo guardado en tu cuenta${cuando ? ` (${cuando})` : ''}.`,
    subiendo: 'Guardando en tu cuenta…',
    trayendo: 'Trayendo lo de tu cuenta…',
    elegir: null,
    'sin-conexion': 'Sin conexión: lo guardo en tu cuenta cuando vuelva.',
    error: nube.error,
  };
  const linea = texto[nube.situacion];
  if (!linea) return null;
  return (
    <Texto pequeno={nube.situacion !== 'error'} secundario={nube.situacion !== 'error'} style={nube.situacion === 'error' ? estilos.aviso : undefined}>
      {linea}
    </Texto>
  );
}

// Primera vez en un dispositivo que ya tenía cosas: ¿con qué se queda?
function Elegir() {
  const [resumen, setResumen] = useState<ResumenCopia | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [seguroSubir, setSeguroSubir] = useState(false);

  useEffect(() => {
    resumenDeLaNube().then(setResumen);
  }, []);

  const elegir = async (accion: () => Promise<boolean>) => {
    setOcupado(true);
    if (!(await accion())) setOcupado(false);
  };

  return (
    <Tarjeta accessibilityLiveRegion="polite">
      <Texto fuerte>Tu cuenta ya tiene cosas guardadas</Texto>
      {resumen ? (
        <View style={estilos.lista}>
          <Texto pequeno secundario>
            Guardado el {resumen.creada}
            {resumen.nombre ? `, de ${resumen.nombre}` : ''}:
          </Texto>
          {resumen.lineas.map((linea) => (
            <Texto key={linea} pequeno>
              · {linea}
            </Texto>
          ))}
        </View>
      ) : null}
      <Texto>Lo de {AQUI} es distinto. ¿Con qué te quedas?</Texto>
      <Boton
        titulo={ocupado ? 'Un momento…' : 'Traer lo de mi cuenta'}
        onPress={() => elegir(traerDeLaNube)}
        disabled={ocupado}
      />
      <Texto pequeno secundario>
        Lo que hay ahora en {AQUI} se cambia por lo de tu cuenta.
      </Texto>
      {seguroSubir ? (
        <>
          <Texto fuerte style={estilos.aviso}>
            Lo de tu cuenta se cambia por lo de {AQUI}, también en tus otros dispositivos. ¿Seguro?
          </Texto>
          <Boton variante="secundario" titulo="Sí, subir lo de aquí" onPress={() => elegir(subirLoDeAqui)} disabled={ocupado} />
          <Boton variante="secundario" titulo="Cancelar" onPress={() => setSeguroSubir(false)} disabled={ocupado} />
        </>
      ) : (
        <Boton variante="secundario" titulo="Subir lo de aquí a mi cuenta" onPress={() => setSeguroSubir(true)} disabled={ocupado} />
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  aviso: { color: colores.aviso },
  lista: { gap: espacio.s },
});
