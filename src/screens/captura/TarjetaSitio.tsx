import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, Tarjeta, Texto, Titulo } from '@/components';
import { guardarEvento, type Evento } from '@/data/eventos';
import { etiquetaSitio, type ResultadoCandidatos } from '@/services/lugares';
import type { Punto, SitioEncontrado } from '@/services/rutas';
import { colores, espacio } from '@/theme';

import { ElegirSitio } from '../mapa/ElegirSitio';

// «La clase de inglés es en el Basic Fit de Montera» (03/11/2026): pone el sitio a una
// cita ya apuntada. Enseña en el mapa lo encontrado («¿Es aquí?») y nada se guarda sin
// "Guardar el sitio".

type Props = {
  evento: Evento;
  sitio: string; // tal cual lo dijo
  resultado: ResultadoCandidatos;
  centro: Punto | null;
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
};

export function TarjetaSitio({ evento, sitio, resultado, centro, alGuardar, alCancelar }: Props) {
  const candidatos = resultado.estado === 'ok' ? resultado.sitios : [];
  const [elegido, setElegido] = useState<SitioEncontrado | null>(candidatos[0] ?? null);
  const [guardando, setGuardando] = useState(false);

  // Sin conexión se guarda lo dicho; el Mapa lo busca al ir.
  const sinConexion = resultado.estado === 'no-disponible';
  const direccion = elegido ? etiquetaSitio(elegido) : sitio;
  const guardar = async () => {
    setGuardando(true);
    const coordenadas = elegido ? { latitud: elegido.punto[0], longitud: elegido.punto[1] } : null;
    await guardarEvento({ ...evento, lugar: { tipo: 'otro', direccion, coordenadas } });
    alGuardar(`Hecho: «${evento.titulo}» es en ${direccion}.`);
  };

  return (
    <Tarjeta style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <Texto>
        Sitio de «{evento.titulo}»: <Texto fuerte>{sitio}</Texto>
      </Texto>
      {sinConexion ? (
        <>
          <Titulo nivel={3}>¿Lo apunto así?</Titulo>
          <Texto pequeno style={estilos.aviso}>
            Sin conexión no puedo comprobar el sitio. Lo guardo como lo has dicho.
          </Texto>
        </>
      ) : (
        <ElegirSitio candidatos={candidatos} elegido={elegido} centro={centro} alElegir={setElegido} />
      )}
      {evento.lugar ? (
        <Texto pequeno secundario>
          Ahora tiene otro sitio apuntado: lo cambio por este.
        </Texto>
      ) : null}
      <View style={estilos.botones}>
        <Boton
          titulo={guardando ? 'Guardando…' : 'Guardar el sitio'}
          disabled={guardando || (!elegido && !sinConexion)}
          onPress={guardar}
        />
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
