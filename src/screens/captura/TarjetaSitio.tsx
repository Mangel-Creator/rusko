import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { guardarEvento, type Evento } from '@/data/eventos';
import type { ResultadoBusqueda } from '@/services/lugares';
import { colores, espacio } from '@/theme';

// «La clase de inglés es en el Basic Fit de Montera» (03/11/2026): pone el sitio a una
// cita ya apuntada. Enseña lo encontrado y nada se guarda sin "Guardar el sitio".

type Props = {
  evento: Evento;
  sitio: string; // tal cual lo dijo
  resultado: ResultadoBusqueda;
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
};

export function TarjetaSitio({ evento, sitio, resultado, alGuardar, alCancelar }: Props) {
  const [guardando, setGuardando] = useState(false);

  if (resultado.estado === 'no-encontrado') {
    return (
      <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
        <Texto>
          No encuentro «{sitio}». Prueba con el nombre y la zona («Basic Fit Montera») o con la calle.
        </Texto>
        <Boton variante="secundario" titulo="Cerrar" onPress={alCancelar} />
      </Tarjeta>
    );
  }

  // Sin conexión se guarda lo dicho; el Mapa lo busca al ir.
  const direccion = resultado.estado === 'encontrado' ? (resultado.nombre ?? sitio) : sitio;
  const guardar = async () => {
    setGuardando(true);
    const coordenadas = resultado.estado === 'encontrado' ? resultado.coordenadas : null;
    await guardarEvento({ ...evento, lugar: { tipo: 'otro', direccion, coordenadas } });
    alGuardar(`Hecho: «${evento.titulo}» es en ${direccion}.`);
  };

  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Titulo nivel={3}>¿Lo apunto así?</Titulo>
      <Texto>
        «{evento.titulo}» es en <Texto fuerte>{direccion}</Texto>.
      </Texto>
      {evento.lugar ? (
        <Texto pequeno secundario>
          Ahora tiene otro sitio apuntado: lo cambio por este.
        </Texto>
      ) : null}
      {resultado.estado === 'no-disponible' ? (
        <Texto pequeno style={estilos.aviso}>
          Sin conexión no puedo comprobar el sitio. Lo guardo como lo has dicho.
        </Texto>
      ) : null}
      <View style={estilos.botones}>
        <Boton titulo={guardando ? 'Guardando…' : 'Guardar el sitio'} disabled={guardando} onPress={guardar} />
        <Boton variante="secundario" titulo="Cancelar" disabled={guardando} onPress={alCancelar} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  botones: { gap: espacio.s },
  aviso: { color: colores.aviso },
});
