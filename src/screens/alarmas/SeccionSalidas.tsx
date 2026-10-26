import { StyleSheet, View } from 'react-native';

import { Texto, Titulo } from '@/components';
import { alternarAlarmaSalida, useAlarmas } from '@/data/alarmas';
import { useEventos } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { useSalidas } from '@/data/salidas';
import { citasParaAlarma } from '@/services/alarmas';
import { formatearDiaCorto, formatearHora } from '@/services/fechas';
import { claveCita } from '@/services/rutas/citas';
import { modoDeViaje } from '@/services/rutas/tipos';
import { colorEvento, colores, espacio } from '@/theme';

import { useAhora } from '../calendario/useAhora';
import { InterruptorPequeno } from './FilaAlarma';

// "Alarmas de salida · se ajustan al tráfico": las próximas citas con lugar, cada una
// con su interruptor. Suena a la hora de salir que calcula la fase 6 con el tráfico y
// se mueve sola si cambia el evento o el tráfico. Filas planas con la barra del tipo.
export function SeccionSalidas() {
  const ahora = useAhora();
  const { eventos } = useEventos();
  const { perfil } = usePerfil();
  const salidas = useSalidas();
  const { ajustes } = useAlarmas();
  const citas = citasParaAlarma(eventos, perfil, ahora);
  const sinTrafico = !modoDeViaje(perfil?.transporte);

  return (
    <View style={estilos.seccion}>
      <Titulo nivel={3}>Alarmas de salida · se ajustan al tráfico</Titulo>
      {sinTrafico ? (
        <Texto pequeno secundario>
          En transporte público no calculo el tráfico: te aviso con el aviso de cada cita.
        </Texto>
      ) : citas.length === 0 ? (
        <Texto pequeno secundario>
          Cuando tengas una cita con sitio, podrás ponerle alarma aquí.
        </Texto>
      ) : (
        <>
          <View style={estilos.lista}>
            {citas.map((cita) => {
              const salida = salidas[claveCita(cita.evento.id, cita.dia)];
              const activada = ajustes.salidas.includes(cita.evento.id);
              const cuando = salida
                ? `Sal a las ${formatearHora(new Date(salida.salida))}`
                : `Cita a las ${cita.evento.horaInicio}`;
              return (
                <View
                  key={cita.clave}
                  style={[estilos.fila, { borderLeftColor: colorEvento(cita.evento) }]}>
                  <View style={estilos.textos}>
                    <Texto fuerte numberOfLines={1}>
                      {cita.evento.titulo}
                    </Texto>
                    <Texto pequeno secundario numberOfLines={1}>
                      {cuando} · {formatearDiaCorto(cita.llegada)} · {cita.lugar}
                    </Texto>
                  </View>
                  <InterruptorPequeno
                    valor={activada}
                    alCambiar={(valor) => alternarAlarmaSalida(cita.evento.id, valor)}
                    etiqueta={`Alarma para salir hacia ${cita.evento.titulo}`}
                  />
                </View>
              );
            })}
          </View>
          <Texto pequeno secundario>
            La hora de salir se calcula con el tráfico el día antes.
          </Texto>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: espacio.s, marginTop: espacio.m },
  lista: { gap: 2 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
  },
  textos: { flex: 1, gap: 2 },
});
