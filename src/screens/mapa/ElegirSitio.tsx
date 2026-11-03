import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto, Titulo } from '@/components';
import { direccionDelPunto } from '@/services/lugares';
import type { Punto, SitioEncontrado } from '@/services/rutas';
import { alturaTactil, colores, espacio, fuentes, radio } from '@/theme';

import { MapaRuta } from './MapaRuta';

// «¿Es aquí?» (03/11/2026, como Google Maps y Mapas): basta con el nombre del sitio. Se
// enseña el mejor resultado en un mapa pequeño, los demás debajo para elegir otro, y
// tocando el mapa se mueve la chincheta a mano.

const MAX_CANDIDATOS = 5;

type Props = {
  candidatos: SitioEncontrado[]; // vacío si no se ha encontrado nada
  elegido: SitioEncontrado | null;
  centro: Punto | null; // dónde abrir el mapa si aún no hay nada elegido (tu casa)
  alElegir: (sitio: SitioEncontrado) => void;
};

export function ElegirSitio({ candidatos, elegido, centro, alElegir }: Props) {
  // Si tocas dos veces seguidas, solo vale la dirección del último toque.
  const ultimoToque = useRef(0);
  const tocar = async (punto: Punto) => {
    const toque = ++ultimoToque.current;
    const provisional = { id: 'mapa', nombre: 'Punto del mapa', direccion: 'Punto del mapa', punto };
    alElegir(provisional);
    const direccion = await direccionDelPunto(punto);
    if (direccion && toque === ultimoToque.current) alElegir({ ...provisional, nombre: direccion, direccion });
  };

  return (
    <View style={estilos.caja} accessibilityLiveRegion="polite">
      <Titulo nivel={3}>{elegido ? '¿Es aquí?' : 'No lo encuentro'}</Titulo>
      <MapaRuta
        ubicacion={null}
        destino={elegido?.punto ?? null}
        rutas={[]}
        elegida={0}
        alElegir={() => {}}
        parkings={[]}
        centroInicial={centro}
        alTocar={tocar}
        style={estilos.mapa}
      />
      <Texto pequeno secundario>
        {elegido ? 'Si no es, elige otro o toca en el mapa dónde es.' : 'Toca en el mapa dónde es.'}
      </Texto>
      {candidatos.slice(0, MAX_CANDIDATOS).map((s) => {
        const es = s.id === elegido?.id;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: es }}
            onPress={() => alElegir(s)}
            style={[estilos.fila, es && estilos.filaElegida]}>
            <Texto fuerte style={es ? estilos.textoElegido : undefined}>
              {s.nombre}
            </Texto>
            {s.direccion !== s.nombre ? (
              <Texto pequeno secundario>
                {s.direccion}
              </Texto>
            ) : null}
          </Pressable>
        );
      })}
      {elegido?.id === 'mapa' ? (
        <Texto pequeno>
          Elegido en el mapa: <Texto pequeno fuerte>{elegido.direccion}</Texto>
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: espacio.s },
  mapa: { height: 200, borderRadius: radio.grande },
  fila: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.pequeno,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.elevado,
  },
  filaElegida: { backgroundColor: colores.acentoSuave, borderColor: colores.principal },
  textoElegido: { color: colores.principal, fontFamily: fuentes.textoFuerte },
});
