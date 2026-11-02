import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, SelectorFecha, SelectorHora, Tarjeta, Texto, Titulo } from '@/components';
import { guardarAlarma, nuevoIdAlarma, type Alarma } from '@/data/alarmas';
import type { PropuestaAlarma } from '@/services/captura';
import { claveDia, minutosDelDia, minutosDesdeHora } from '@/services/fechas';
import { colores, espacio } from '@/theme';

// "¿Pongo la alarma así?" (30/10/2026): «ponme una alarma mañana a las 7» en la captura
// rápida. Una alarma de una sola vez, como "Un día concreto" en Alarmas. Nada se guarda
// sin "Poner la alarma".

type Props = {
  alarma: PropuestaAlarma;
  alGuardar: (alarma: Alarma) => void;
  alCancelar: () => void;
};

// La alarma de una vez tal cual (también la usa "Guardar todo").
export function alarmaDePropuesta(a: PropuestaAlarma): Alarma {
  return {
    id: nuevoIdAlarma(),
    tipo: 'despertador',
    hora: a.hora,
    dias: [],
    unaVezEl: a.fecha,
    etiqueta: a.etiqueta.trim(),
    sonido: 'alarma',
    activada: true,
    adelantoMaxMin: 20,
  };
}

// ¿Ya ha pasado esa hora de hoy?
export function yaHaPasado(fecha: string, hora: string, ahora = new Date()): boolean {
  return fecha === claveDia(ahora) && minutosDesdeHora(hora) <= minutosDelDia(ahora);
}

export function TarjetaAlarma({ alarma, alGuardar, alCancelar }: Props) {
  const [fecha, setFecha] = useState(alarma.fecha);
  const [hora, setHora] = useState(alarma.hora);
  const [etiqueta, setEtiqueta] = useState(alarma.etiqueta);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (yaHaPasado(fecha, hora)) {
      setError('Esa hora ya ha pasado hoy. Elige otra o mañana.');
      return;
    }
    const nueva = alarmaDePropuesta({ ...alarma, fecha, hora, etiqueta });
    setGuardando(true);
    await guardarAlarma(nueva);
    alGuardar(nueva);
  };

  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Titulo nivel={3}>¿Pongo la alarma así?</Titulo>
      <SelectorHora
        etiqueta="Hora"
        valor={hora}
        pasoMinutos={5}
        alCambiar={(h) => {
          setHora(h);
          setError(null);
        }}
      />
      <SelectorFecha
        etiqueta="Día"
        valor={fecha}
        alCambiar={(f) => {
          setFecha(f);
          setError(null);
        }}
      />
      <CampoTexto
        etiqueta="Nombre (opcional)"
        value={etiqueta}
        onChangeText={setEtiqueta}
        placeholder="Gimnasio, trabajo…"
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      {error ? (
        <Texto pequeno style={estilos.error} accessibilityLiveRegion="assertive">
          {error}
        </Texto>
      ) : null}
      <View style={estilos.botones}>
        <Boton titulo={guardando ? 'Poniéndola…' : 'Poner la alarma'} disabled={guardando} onPress={guardar} />
        <Boton variante="secundario" titulo="Cancelar" disabled={guardando} onPress={alCancelar} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  botones: { gap: espacio.s },
  error: { color: colores.aviso },
});
