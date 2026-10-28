import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Boton, LogoMarca, Texto } from '@/components';
import type { ConexionCorreo, CuentaCorreo, ProveedoresCorreo } from '@/data/correos';
import { desconectarCorreo, NOMBRE_PROVEEDOR, quitarCuenta, vincularCuenta } from '@/services/correo';
import { claveDia, formatearHora } from '@/services/fechas';
import { alturaTactil, colores, espacio, radio } from '@/theme';

import { VincularAyudante, VincularCorreo } from './VincularCorreo';

// "Tus cuentas" en Correo (fase 11): un desplegable pequeño justo debajo del chip de la
// cuenta (28/10/2026, lo pidió el usuario: antes se abría en grande). Una línea por
// cuenta (logo, dirección, cuándo se miró, "Volver a entrar" si caducó y "Quitar") y, al
// final, "Vincular otra cuenta", que abre ahí mismo los botones de Gmail y Outlook.

function hace(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const fecha = new Date(iso);
  return claveDia(fecha) === claveDia(new Date()) ? `a las ${formatearHora(fecha)}` : 'hace más de un día';
}

type Props = {
  cuentas: CuentaCorreo[];
  conexion: ConexionCorreo | null;
  proveedores: ProveedoresCorreo | null;
  actualizando: boolean;
  alTerminar: (mensaje: { bien: boolean; texto: string }) => void;
};

export function CuentasCorreo({ cuentas, conexion, proveedores, actualizando, alTerminar }: Props) {
  // Qué se está a punto de quitar: el id de una cuenta o "ayudante".
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  const confirmarQuitar = async () => {
    const id = quitando;
    if (!id) return;
    setOcupado(true);
    if (id === 'ayudante') {
      await desconectarCorreo().catch(() => {});
      alTerminar({ bien: true, texto: 'He desconectado el ayudante. Para que deje de mirar tu correo, ejecuta «desinstalar» en script.google.com.' });
    } else {
      const cuenta = cuentas.find((c) => c.id === id);
      const ok = cuenta ? await quitarCuenta(cuenta).catch(() => false) : true;
      alTerminar(
        ok
          ? { bien: true, texto: `Hecho: ${cuenta?.email ?? 'la cuenta'} ya no está vinculada. Tus tareas se quedan.` }
          : { bien: false, texto: 'No se ha podido quitar. Prueba otra vez cuando tengas conexión.' },
      );
    }
    setOcupado(false);
    setQuitando(null);
  };

  const volverAEntrar = async (cuenta: CuentaCorreo) => {
    const r = await vincularCuenta(cuenta.proveedor).catch(() => ({ ok: false as const, motivo: 'error' as const }));
    if (r.ok === 'redirigiendo') return;
    alTerminar(
      r.ok
        ? { bien: true, texto: `Listo: ${r.email ?? cuenta.email} vuelve a estar vinculado.` }
        : { bien: false, texto: 'No se ha podido volver a entrar. Prueba otra vez.' },
    );
  };

  const nombreQuitando =
    quitando === 'ayudante' ? 'el ayudante de Gmail' : cuentas.find((c) => c.id === quitando)?.email ?? '';

  return (
    <View style={estilos.panel}>
      {cuentas.map((c) => {
        const caducada = c.estado === 'caducada';
        const revisada = hace(c.ultimaRevision);
        return (
          <Fila
            key={c.id}
            logo={
              <View accessible accessibilityLabel={NOMBRE_PROVEEDOR[c.proveedor]}>
                <LogoMarca proveedor={c.proveedor === 'gmail' ? 'google' : 'microsoft'} tamano={16} />
              </View>
            }
            titulo={c.email}
            estado={
              caducada
                ? 'Tienes que volver a entrar'
                : actualizando
                  ? 'Mirando si hay algo nuevo…'
                  : revisada
                    ? `Revisado ${revisada}`
                    : 'Vinculado'
            }
            mal={caducada}
            accion={caducada ? { texto: 'Entrar', alPulsar: () => volverAEntrar(c) } : null}
            alQuitar={() => setQuitando(c.id)}
          />
        );
      })}
      {conexion ? (
        <Fila
          logo={<Ionicons name="code-slash-outline" size={16} color={colores.texto} />}
          titulo="Ayudante de Gmail"
          estado={
            actualizando
              ? 'Mirando si hay algo nuevo…'
              : conexion.error === 'sin-conexion'
                ? 'Sin conexión'
                : conexion.error === 'no-responde'
                  ? 'No responde: mira script.google.com'
                  : hace(conexion.ultimaRevision)
                    ? `Revisado ${hace(conexion.ultimaRevision)}`
                    : 'Conectado'
          }
          mal={!!conexion.error && !actualizando}
          accion={null}
          alQuitar={() => setQuitando('ayudante')}
        />
      ) : null}

      {quitando ? (
        <View style={estilos.confirmar}>
          <Texto pequeno fuerte>¿Desvinculo {nombreQuitando}?</Texto>
          <Texto pequeno secundario>
            {quitando === 'ayudante'
              ? 'Dejo de pedirle correos y borro sus resúmenes de aquí. Las tareas se quedan.'
              : 'Borro del servidor el permiso para leer tu correo y sus resúmenes. Las tareas se quedan.'}
          </Texto>
          <View style={estilos.botones}>
            <Boton titulo={ocupado ? 'Quitando…' : 'Desvincular'} onPress={confirmarQuitar} disabled={ocupado} style={estilos.boton} />
            <Boton variante="secundario" titulo="Cancelar" onPress={() => setQuitando(null)} disabled={ocupado} style={estilos.boton} />
          </View>
        </View>
      ) : null}

      <View style={estilos.raya} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: vinculando }}
        onPress={() => setVinculando((v) => !v)}
        style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
        <Ionicons name="add-circle-outline" size={18} color={colores.principal} />
        <Texto pequeno fuerte style={estilos.vincular}>
          Vincular otra cuenta
        </Texto>
        <Ionicons name={vinculando ? 'chevron-up' : 'chevron-down'} size={16} color={colores.textoSecundario} />
      </Pressable>
      {vinculando ? (
        <View style={estilos.vincularDentro}>
          <VincularCorreo proveedores={proveedores} alTerminar={alTerminar} />
          {conexion ? null : <VincularAyudante alTerminar={alTerminar} />}
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <Texto pequeno secundario>
          En la web no llegan avisos: lo nuevo sale marcado aquí.
        </Texto>
      ) : null}
    </View>
  );
}

function Fila({
  logo,
  titulo,
  estado,
  mal,
  accion,
  alQuitar,
}: {
  logo: ReactNode;
  titulo: string;
  estado: string;
  mal: boolean;
  accion: { texto: string; alPulsar: () => void } | null;
  alQuitar: () => void;
}) {
  return (
    <View style={estilos.fila}>
      {logo}
      <View style={estilos.textos}>
        <Texto pequeno fuerte numberOfLines={1}>
          {titulo}
        </Texto>
        <Texto pequeno secundario numberOfLines={1} style={[estilos.estado, mal ? estilos.aviso : null]}>
          {estado}
        </Texto>
      </View>
      {accion ? <Enlace texto={accion.texto} etiqueta={`${accion.texto} en ${titulo}`} alPulsar={accion.alPulsar} fuerte /> : null}
      <Enlace texto="Quitar" etiqueta={`Quitar ${titulo}`} alPulsar={alQuitar} />
    </View>
  );
}

function Enlace({ texto, etiqueta, alPulsar, fuerte }: { texto: string; etiqueta: string; alPulsar: () => void; fuerte?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.enlace, pressed && estilos.pulsado]}>
      <Texto pequeno fuerte style={fuerte ? estilos.entrar : estilos.quitar}>
        {texto}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Pegado a la derecha, bajo el chip, y estrecho.
  panel: {
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 340,
    marginTop: -espacio.s,
    gap: espacio.xs,
    paddingVertical: espacio.xs,
    paddingHorizontal: espacio.s + 4,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.normal,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: alturaTactil },
  textos: { flex: 1 },
  estado: { fontSize: 12, lineHeight: 16 },
  aviso: { color: colores.aviso },
  enlace: { minHeight: alturaTactil, justifyContent: 'center', paddingHorizontal: espacio.xs },
  quitar: { color: colores.textoSecundario },
  vincular: { flex: 1, color: colores.principal },
  entrar: { color: colores.principal },
  vincularDentro: { gap: espacio.s, paddingBottom: espacio.s },
  raya: { height: StyleSheet.hairlineWidth, backgroundColor: colores.borde },
  confirmar: { gap: espacio.s, padding: espacio.s, backgroundColor: colores.elevado, borderRadius: radio.pequeno },
  botones: { flexDirection: 'row', gap: espacio.s },
  boton: { flex: 1 },
  pulsado: { opacity: 0.8 },
});
