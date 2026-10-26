import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';

import { Boton, Casilla, Texto, Titulo } from '@/components';
import { guardarAjuste, leerAjuste } from '@/data/ajustes';
import { clasificarTarea, type Cuadrante, type Evento } from '@/data/eventos';
import { marcarHechaDeAgenda } from '@/services/empresa';
import { CUADRANTES, DATOS_CUADRANTE, agruparPorCuadrante } from '@/services/agenda';
import { alturaTactil, colores, espacio, radio } from '@/theme';

import { abrirEvento } from '../calendario/textos';
import { SelectorCuadrante, iconoCuadrante } from './SelectorCuadrante';

// Vista "Matriz" de las tareas de Hoy: las pendientes en las cuatro cajas de la matriz
// de Eisenhower y, arriba, las que aún no tienen sitio. Al tocar una sale el selector
// para colocarla (o moverla) sin abrir la ficha.

export type ModoTareas = 'horas' | 'matriz';

// Se recuerda cómo prefiere ver las tareas (organizy:vistaTareas).
let modoEnMemoria: ModoTareas | null = null;

export function useModoTareas(): [ModoTareas, (modo: ModoTareas) => void] {
  const [modo, setModo] = useState<ModoTareas>(modoEnMemoria ?? 'horas');
  useEffect(() => {
    if (modoEnMemoria) return;
    leerAjuste<ModoTareas>('vistaTareas', 'horas').then((guardado) => {
      modoEnMemoria = guardado === 'matriz' ? 'matriz' : 'horas';
      setModo(modoEnMemoria);
    });
  }, []);
  const cambiar = (nuevo: ModoTareas) => {
    modoEnMemoria = nuevo;
    setModo(nuevo);
    guardarAjuste('vistaTareas', nuevo);
  };
  return [modo, cambiar];
}

const RECOLOCAR = LinearTransition.duration(220);
const APARECER = FadeIn.duration(180);
const DESAPARECER = FadeOut.duration(120);

export function MatrizTareas({ tareas }: { tareas: Evento[] }) {
  const [elegida, setElegida] = useState<string | null>(null);
  const grupos = agruparPorCuadrante(tareas);
  const tarea = tareas.find((t) => t.id === elegida) ?? null;
  // Las tareas de la empresa ya traen su prioridad (la pone quien la asigna): se abren.
  const elegir = (id: string) => {
    if (tareas.find((t) => t.id === id)?.empresa) abrirEvento(id);
    else setElegida((actual) => (actual === id ? null : id));
  };

  const clasificador = tarea ? (
    <Clasificador
      tarea={tarea}
      alElegir={(c) => {
        setElegida(null);
        clasificarTarea(tarea.id, c);
      }}
    />
  ) : null;

  return (
    <LayoutAnimationConfig skipEntering>
      <View style={estilos.contenedor}>
        {grupos.sinClasificar.length > 0 ? (
          <View style={estilos.grupo}>
            <Texto pequeno secundario>
              Sin colocar todavía. Toca una para ponerla en su sitio.
            </Texto>
            {grupos.sinClasificar.map((t) => (
              <Animated.View key={t.id} layout={RECOLOCAR} entering={APARECER} exiting={DESAPARECER} style={estilos.grupo}>
                <FilaMatriz tarea={t} elegida={t.id === elegida} alTocar={() => elegir(t.id)} ancha />
                {t.id === elegida ? clasificador : null}
              </Animated.View>
            ))}
          </View>
        ) : null}

        <View style={estilos.rejilla}>
          {CUADRANTES.map((c) => (
            <Caja key={c} cuadrante={c} tareas={grupos[c]} elegida={elegida} alTocar={elegir} />
          ))}
        </View>
        {tarea?.cuadrante ? clasificador : null}
      </View>
    </LayoutAnimationConfig>
  );
}

type PropsCaja = {
  cuadrante: Cuadrante;
  tareas: Evento[];
  elegida: string | null;
  alTocar: (id: string) => void;
};

function Caja({ cuadrante, tareas, elegida, alTocar }: PropsCaja) {
  const datos = DATOS_CUADRANTE[cuadrante];
  const color = cuadrante === 'hazlo' ? colores.aviso : colores.texto;
  return (
    <View style={estilos.caja} accessibilityLabel={`${datos.nombre}: ${datos.descripcion}. ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}`}>
      <View style={estilos.cabeceraCaja}>
        <Ionicons name={iconoCuadrante(cuadrante)} size={18} color={color} />
        <Texto fuerte style={[estilos.nombreCaja, { color }]} numberOfLines={1}>
          {datos.nombre}
        </Texto>
      </View>
      <Texto pequeno secundario>
        {datos.descripcion}
      </Texto>
      {tareas.length === 0 ? (
        <Texto pequeno secundario style={estilos.vacia}>
          Nada
        </Texto>
      ) : (
        tareas.map((t) => (
          <Animated.View key={t.id} layout={RECOLOCAR} entering={APARECER} exiting={DESAPARECER}>
            <FilaMatriz tarea={t} elegida={t.id === elegida} alTocar={() => alTocar(t.id)} />
          </Animated.View>
        ))
      )}
    </View>
  );
}

type PropsFila = { tarea: Evento; elegida: boolean; alTocar: () => void; ancha?: boolean };

function FilaMatriz({ tarea, elegida, alTocar, ancha }: PropsFila) {
  return (
    <View style={[estilos.fila, ancha && estilos.filaAncha, elegida && estilos.filaElegida]}>
      <Casilla
        marcada={tarea.hecha}
        alCambiar={(hecha) => marcarHechaDeAgenda(tarea.id, hecha)}
        etiqueta={`Marcar como hecha: ${tarea.titulo}`}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tarea.titulo}. Cambiar dónde va`}
        accessibilityState={{ expanded: elegida }}
        onPress={alTocar}
        style={({ pressed }) => [estilos.filaTexto, pressed && estilos.pulsado]}>
        <Texto pequeno={!ancha} fuerte={ancha} numberOfLines={3}>
          {tarea.titulo}
        </Texto>
      </Pressable>
    </View>
  );
}

function Clasificador({ tarea, alElegir }: { tarea: Evento; alElegir: (c: Cuadrante | null) => void }) {
  return (
    <Animated.View entering={APARECER} style={estilos.clasificador}>
      <Titulo nivel={3}>¿Dónde va «{tarea.titulo}»?</Titulo>
      <SelectorCuadrante valor={tarea.cuadrante ?? null} alCambiar={alElegir} />
      <Boton variante="secundario" titulo="Abrir la tarea" onPress={() => abrirEvento(tarea.id)} />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.m },
  grupo: { gap: espacio.s },
  // Dos cajas por fila, como la matriz.
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  caja: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 132,
    padding: espacio.s + 4,
    gap: espacio.xs,
    borderRadius: radio.grande,
    backgroundColor: colores.tarjeta,
  },
  cabeceraCaja: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  nombreCaja: { flexShrink: 1 },
  vacia: { marginTop: espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -espacio.s,
    borderRadius: radio.normal,
  },
  filaAncha: { marginLeft: 0, paddingRight: espacio.m, backgroundColor: colores.tarjeta, borderRadius: 0 },
  // La que se está colocando, con el fondo del papel para distinguirla.
  filaElegida: { backgroundColor: colores.fondo },
  filaTexto: { flex: 1, minHeight: alturaTactil, justifyContent: 'center' },
  pulsado: { transform: [{ scale: 0.99 }] },
  clasificador: {
    gap: espacio.m,
    padding: espacio.m,
    borderRadius: radio.grande,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
  },
});
