import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, Interruptor, Selector, Tarjeta, Texto, Titulo, type Opcion } from '@/components';
import {
  cambiarAjustesAvisos,
  leerAjustesAvisos,
  useAjustesAvisos,
  type CierreSinPendientes,
} from '@/data/avisos';
import { usePerfil } from '@/data/perfil';
import {
  avisosDisponibles,
  contarAvisosProgramados,
  enviarAvisoDePrueba,
  horaCierre,
  probarAvisoDeHoy,
  reprogramarAvisos,
  textoAntelacion,
} from '@/services/avisos';
import {
  activarPush,
  desactivarPush,
  estadoPush,
  prepararPush,
  soportePush,
  type EstadoPush,
  type ResultadoActivar,
} from '@/services/avisos/push';
import { esWeb, type EstadoPermiso } from '@/services/permisos';
import { colores, espacio } from '@/theme';

const OPCIONES_SIN_PENDIENTES: Opcion<CierreSinPendientes>[] = [
  { valor: 'buenas-noches', etiqueta: 'Dar las buenas noches' },
  { valor: 'nada', etiqueta: 'No avisar' },
];

type Props = {
  permiso?: EstadoPermiso; // permiso de notificaciones
  alActivarPermiso: () => void;
};

// Perfil > Avisos: activar o desactivar cada tipo de aviso.
// En la web (26/10/2026) llegan con Web Push: primero hay que activarlos en este navegador.
export function SeccionAvisos({ permiso, alActivarPermiso }: Props) {
  const ajustes = useAjustesAvisos();
  const { perfil } = usePerfil();
  const [programados, setProgramados] = useState<number | null>(null);
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);
  const [push, setPush] = useState<EstadoPush | null>(null);

  useEffect(() => {
    leerAjustesAvisos();
  }, []);

  // Cuántos avisos hay programados (se actualiza al cambiar algo).
  useEffect(() => {
    if (!avisosDisponibles || permiso !== 'concedido') return;
    let vigente = true;
    reprogramarAvisos()
      .then(contarAvisosProgramados)
      .then((n) => vigente && setProgramados(n))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [permiso, ajustes, perfil, push]);

  // Web: si este navegador ya está suscrito a los avisos. La clave se pide ya, para que
  // al tocar "Activar avisos" no haya que esperar a nada antes del permiso.
  useEffect(() => {
    if (!esWeb || !avisosDisponibles) return;
    estadoPush().then(setPush);
    prepararPush().catch(() => {});
  }, []);

  // Web (26/10/2026): los avisos llegan con Web Push, solo con la web instalada.
  if (!avisosDisponibles) {
    return soportePush() === 'instalar' ? (
      <Tarjeta>
        <View style={estilos.cabecera}>
          <Ionicons name="phone-portrait-outline" size={24} color={colores.principal} />
          <Texto fuerte style={estilos.flex}>
            Primero, a la pantalla de inicio
          </Texto>
        </View>
        <Texto secundario>
          El iPhone solo manda avisos a la web si la abres desde su icono. En Safari, toca Compartir
          y luego &quot;Añadir a pantalla de inicio&quot;. Ábrela desde el icono y vuelve aquí.
        </Texto>
      </Tarjeta>
    ) : (
      <Tarjeta>
        <View style={estilos.cabecera}>
          <Ionicons name="notifications-off-outline" size={24} color={colores.textoSecundario} />
          <Texto fuerte style={estilos.flex}>
            Este navegador no puede
          </Texto>
        </View>
        <Texto secundario>
          Aquí no te pueden llegar avisos con la web cerrada. En el iPhone, añádela a la pantalla
          de inicio (iOS 16.4 o más) y actívalos desde ahí.
        </Texto>
      </Tarjeta>
    );
  }

  if (esWeb && !push) return null;
  if (esWeb && push && !push.suscrito) {
    return <ActivarAvisosWeb bloqueado={push.permiso === 'denied'} alActivar={() => estadoPush().then(setPush)} />;
  }

  const sinPermiso = permiso !== undefined && permiso !== 'concedido';
  const antelacion = perfil?.antelacionAvisoMin ?? 30;

  // Sin tipo: un aviso genérico. Con tipo: el resumen o el cierre de hoy tal cual.
  const probar = async (tipo?: 'resumen-manana' | 'cierre-dia' | 'salida') => {
    if (permiso !== 'concedido') {
      alActivarPermiso();
      return;
    }
    try {
      await (tipo ? probarAvisoDeHoy(tipo) : enviarAvisoDePrueba());
      setMensajePrueba(
        esWeb
          ? 'Listo. Te llegará en unos segundos.'
          : 'Listo. Te llegará en 5 segundos (puedes bloquear el móvil).',
      );
    } catch {
      setMensajePrueba('No he podido mandarlo. Mira si tienes conexión y vuelve a probar.');
    }
  };

  const apagarWeb = async () => {
    await desactivarPush();
    setPush(await estadoPush());
  };

  return (
    <>
      {sinPermiso ? (
        <Tarjeta style={estilos.alerta} accessibilityLiveRegion="polite">
          <Titulo nivel={3}>Los avisos están apagados</Titulo>
          <Texto secundario>
            No tengo permiso para enviarte notificaciones, así que no te llegará ninguno de estos
            avisos.
          </Texto>
          {permiso !== 'no-disponible' ? (
            <Boton
              titulo={permiso === 'bloqueado' ? 'Abrir Ajustes del teléfono' : 'Activar notificaciones'}
              onPress={alActivarPermiso}
            />
          ) : null}
        </Tarjeta>
      ) : null}

      <Interruptor
        etiqueta="Antes de cada evento"
        ayuda={`${textoAntelacion(antelacion)} antes, como elegiste en tu ritmo. Puedes cambiarlo en cada evento.`}
        valor={ajustes.eventos}
        alCambiar={(eventos) => cambiarAjustesAvisos({ eventos })}
      />
      <Interruptor
        etiqueta="Sal ya"
        ayuda="Cuándo salir hacia una cita con lugar, con el tráfico previsto y 5 min de margen. Trae un botón para avisar de retraso por WhatsApp."
        valor={ajustes.salida}
        alCambiar={(salida) => cambiarAjustesAvisos({ salida })}
      />
      <Interruptor
        etiqueta="Plazos de tus correos"
        ayuda={`La víspera, a las ${perfil?.horario.levantarse ?? '07:30'}: "Mañana: …". Solo si vinculaste tu correo en la pestaña Correo.`}
        valor={ajustes.plazosCorreo}
        alCambiar={(plazosCorreo) => cambiarAjustesAvisos({ plazosCorreo })}
      />
      <Interruptor
        etiqueta="Resumen de la mañana"
        ayuda={`A las ${perfil?.horario.levantarse ?? '07:30'}, cuando te levantas: cómo viene el día.`}
        valor={ajustes.resumenManana}
        alCambiar={(resumenManana) => cambiarAjustesAvisos({ resumenManana })}
      />
      <Interruptor
        etiqueta="Cierre del día"
        ayuda={`A las ${perfil ? horaCierre(perfil) : '22:30'}, una hora antes de acostarte. Si te quedan tareas, te propongo pasarlas a mañana.`}
        valor={ajustes.cierreDia}
        alCambiar={(cierreDia) => cambiarAjustesAvisos({ cierreDia })}
      />
      {ajustes.cierreDia ? (
        <Selector
          etiqueta="Si no te queda nada pendiente"
          opciones={OPCIONES_SIN_PENDIENTES}
          valor={ajustes.cierreSinPendientes}
          alCambiar={(cierreSinPendientes) => cambiarAjustesAvisos({ cierreSinPendientes })}
        />
      ) : null}

      <Texto pequeno secundario>
        Se programan los próximos 7 días y se renuevan cada vez que abres la app.
        {programados !== null ? ` Ahora hay ${programados} programados.` : ''}
        {esWeb ? ' Si pasas una semana sin abrirla, dejan de llegar.' : ''}
      </Texto>
      <Texto pequeno secundario>
        {esWeb
          ? 'Para probarlos sin esperar: llegan en unos segundos con el contenido de hoy. En la web no llevan botones: al tocarlos se abre Organizy.'
          : 'Para probarlos sin esperar: llegan en 5 segundos con el contenido de hoy.'}
      </Texto>
      <Boton variante="secundario" titulo="Enviar un aviso de prueba" onPress={() => probar()} />
      <Boton
        variante="secundario"
        titulo="Probar el resumen de la mañana"
        onPress={() => probar('resumen-manana')}
      />
      <Boton variante="secundario" titulo="Probar el cierre del día" onPress={() => probar('cierre-dia')} />
      <Boton variante="secundario" titulo="Probar el aviso Sal ya" onPress={() => probar('salida')} />
      {mensajePrueba ? (
        <Texto fuerte style={estilos.bien} accessibilityLiveRegion="polite">
          {mensajePrueba}
        </Texto>
      ) : null}
      {esWeb ? (
        <Boton variante="secundario" titulo="Apagar los avisos en este móvil" onPress={apagarWeb} />
      ) : null}
    </>
  );
}

const TEXTOS_ACTIVAR: Record<Exclude<ResultadoActivar, 'ok'>, string> = {
  denegado: 'Sin permiso no te puedo mandar avisos. Si cambias de idea, vuelve a tocar el botón.',
  'sin-servidor': 'No he podido hablar con el servidor. Mira si tienes conexión y vuelve a probar.',
  error: 'Algo ha fallado al activarlos. Cierra Organizy, ábrela otra vez y vuelve a probar.',
};

// Web: la tarjeta para activar los avisos (Web Push) en este navegador.
function ActivarAvisosWeb({ bloqueado, alActivar }: { bloqueado: boolean; alActivar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const activar = async () => {
    setOcupado(true);
    setMensaje(null);
    // activarPush pide el permiso lo primero: Safari solo lo deja justo después del toque.
    const resultado = await activarPush();
    if (resultado === 'ok') {
      await reprogramarAvisos().catch(() => {});
      alActivar();
    } else {
      setMensaje(TEXTOS_ACTIVAR[resultado]);
    }
    setOcupado(false);
  };

  return (
    <Tarjeta style={estilos.activar}>
      <View style={estilos.cabecera}>
        <Ionicons name="notifications-outline" size={24} color={colores.principal} />
        <Texto fuerte style={estilos.flex}>
          Avisos con sonido en este móvil
        </Texto>
      </View>
      <Texto secundario>
        Antes de cada evento, el resumen de la mañana, el cierre del día y el &quot;Sal ya&quot;, con el
        sonido normal del iPhone y aunque tengas Organizy cerrada.
      </Texto>
      <Texto pequeno secundario>
        Para mandártelos a su hora, guardo en el servidor la hora y el texto de los avisos de los
        próximos 7 días. Se borran a los 2 días de mandarlos.
      </Texto>
      {bloqueado ? (
        <Texto pequeno>
          Los tienes bloqueados. En el iPhone: Ajustes &gt; Notificaciones &gt; Organizy &gt; Permitir
          notificaciones. Luego vuelve aquí.
        </Texto>
      ) : (
        <Boton titulo={ocupado ? 'Activando…' : 'Activar avisos'} disabled={ocupado} onPress={activar} />
      )}
      {mensaje ? (
        <Texto pequeno style={estilos.error} accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
  alerta: { borderColor: colores.aviso, borderWidth: 2, gap: espacio.m },
  bien: { color: colores.texto }, // el verde es solo de Amigos
  activar: { gap: espacio.m },
  error: { color: colores.aviso },
});
