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
import type { EstadoPermiso } from '@/services/permisos';
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
// En la web solo explica que los avisos son para la app del móvil.
export function SeccionAvisos({ permiso, alActivarPermiso }: Props) {
  const ajustes = useAjustesAvisos();
  const { perfil } = usePerfil();
  const [programados, setProgramados] = useState<number | null>(null);
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);

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
  }, [permiso, ajustes, perfil]);

  if (!avisosDisponibles) {
    return (
      <Tarjeta>
        <View style={estilos.cabecera}>
          <Ionicons name="phone-portrait-outline" size={24} color={colores.principal} />
          <Texto fuerte style={estilos.flex}>
            Solo en la app del móvil
          </Texto>
        </View>
        <Texto secundario>
          Los avisos antes de cada evento, el resumen de la mañana y el cierre del día necesitan la
          app instalada en el móvil. El navegador no puede enviarlos con la web cerrada, así que en
          la web no se programan.
        </Texto>
      </Tarjeta>
    );
  }

  const sinPermiso = permiso !== undefined && permiso !== 'concedido';
  const antelacion = perfil?.antelacionAvisoMin ?? 30;

  // Sin tipo: un aviso genérico. Con tipo: el resumen o el cierre de hoy tal cual.
  const probar = async (tipo?: 'resumen-manana' | 'cierre-dia' | 'salida') => {
    if (permiso !== 'concedido') {
      alActivarPermiso();
      return;
    }
    await (tipo ? probarAvisoDeHoy(tipo) : enviarAvisoDePrueba());
    setMensajePrueba('Listo. Te llegará en 5 segundos (puedes bloquear el móvil).');
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
        ayuda={`La víspera, a las ${perfil?.horario.levantarse ?? '07:30'}: "Mañana vence…". Solo si conectaste tu Gmail en Hoy > Resúmenes.`}
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
      </Texto>
      <Texto pequeno secundario>
        Para probarlos sin esperar: llegan en 5 segundos con el contenido de hoy.
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
    </>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
  alerta: { borderColor: colores.aviso, borderWidth: 2, gap: espacio.m },
  bien: { color: colores.texto }, // el verde es solo de Amigos
});
