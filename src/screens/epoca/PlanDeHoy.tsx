import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Casilla, Tarjeta, Texto, Titulo } from '@/components';
import { marcarBloque, type Epoca, type RegistroBloque } from '@/data/epocas';
import type { Perfil } from '@/data/perfil';
import { resolverLugar, type Energia } from '@/services/agenda';
import {
  cuentaAtras,
  esDiaLibre,
  lugarDelDia,
  progresoHitos,
  progresoSemana,
  temasDelPlan,
  textoHoras,
  type BloquePlan,
  type PlanEpoca,
} from '@/services/epoca';
import { claveDia, horaDesdeMinutos, minutosDelDia } from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes } from '@/theme';

import { BarraHoras } from './BarraHoras';
import { DESCANSO_TEXTO } from './textos';

type Props = {
  epoca: Epoca;
  plan: PlanEpoca;
  registro: RegistroBloque[];
  perfil: Perfil | null;
  ahora: Date;
  energia: Energia;
};

// Lo que Hoy enseña durante una época dorada. Cada cosa va en su propia caja
// redondeada para que no se mezcle con el resto del día (lo pidió el usuario):
// la cuenta atrás, el plan de hoy, el aviso si algo no cabe y "Cómo vas".
// Dentro del plan, lo que se repite (sitio, largo de los bloques y descanso) se
// dice una vez arriba, y cada bloque queda en una línea: casilla, hora y examen.
export function PlanDeHoy({ epoca, plan, registro, perfil, ahora, energia }: Props) {
  const hoy = claveDia(ahora);
  const minuto = minutosDelDia(ahora);
  const bloques = plan.bloques.filter((b) => b.dia === hoy);
  const hechos = bloques.filter((b) => b.estado === 'hecho').length;
  const siguiente = cuentaAtras(epoca, ahora);
  const lugar = resolverLugar(lugarDelDia(epoca, hoy), perfil);
  // "Biblioteca, Calle Mayor 5, Madrid" -> "Biblioteca": la dirección entera no cabe en una línea.
  const nombreLugar = lugar ? (lugar.nombre ?? lugar.direccion.split(',')[0]) : null;
  const semana = progresoSemana(epoca, registro, plan, hoy);
  const hitos = progresoHitos(epoca, registro, plan).filter((p) => p.hito.fecha >= hoy);
  const noCaben = hitos.filter((p) => p.faltanMin > 0);
  const nombreHito = (id: string) => epoca.hitos.find((h) => h.id === id)?.nombre ?? 'Estudio';
  const temas = temasDelPlan(epoca, registro, plan, hoy);
  const libre = esDiaLibre(epoca, hoy);
  const subtitulo = [nombreLugar ? `En ${nombreLugar}` : null, DESCANSO_TEXTO[epoca.ritmo.descanso]]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={estilos.contenedor}>
      {siguiente ? (
        <Tarjeta style={estilos.cuenta}>
          <Ionicons name="hourglass-outline" size={18} color={colores.texto} />
          <Texto fuerte style={estilos.flex}>
            {siguiente.texto}
          </Texto>
        </Tarjeta>
      ) : null}

      <Tarjeta style={estilos.caja}>
        <View style={estilos.cabecera}>
          <Titulo nivel={3} style={estilos.flex}>
            Plan de hoy
          </Titulo>
          {bloques.length > 0 && !libre ? (
            <Texto pequeno secundario>
              {hechos} de {bloques.length} hechos
            </Texto>
          ) : null}
        </View>
        {libre ? (
          <Texto secundario>Hoy es tu día libre. Descansar también cuenta.</Texto>
        ) : bloques.length === 0 ? (
          <Texto secundario>Hoy no hay bloques de estudio.</Texto>
        ) : (
          <>
            <Texto pequeno secundario numberOfLines={2}>
              {subtitulo}
            </Texto>
            {energia === 'tranqui' ? (
              <Texto pequeno secundario>Vas tranqui: hoy la mitad, el resto pasa a otros días.</Texto>
            ) : null}
            <View style={estilos.lista}>
              {bloques.map((bloque, i) => (
                <FilaBloque
                  key={bloque.id}
                  bloque={bloque}
                  titulo={nombreHito(bloque.hitoId)}
                  tema={temas.get(bloque.id) ?? null}
                  pasado={bloque.fin <= minuto}
                  primera={i === 0}
                />
              ))}
            </View>
          </>
        )}
      </Tarjeta>

      {noCaben.length > 0 ? (
        <Tarjeta style={estilos.cuenta}>
          <Ionicons name="alert-circle-outline" size={18} color={colores.aviso} />
          <View style={estilos.flex}>
            {noCaben.map((p) => (
              <Texto key={p.hito.id} pequeno>
                No te caben {textoHoras(p.faltanMin)} de {p.hito.nombre} antes de la fecha.
              </Texto>
            ))}
            <Texto pequeno secundario>
              Sube las horas al día o quita algo del calendario.
            </Texto>
          </View>
        </Tarjeta>
      ) : null}

      <Tarjeta style={estilos.caja}>
        <Titulo nivel={3}>Cómo vas</Titulo>
        <BarraHoras etiqueta="Esta semana" hechoMin={semana.hechoMin} totalMin={semana.planeadoMin} />
        {hitos.map((p) => (
          <BarraHoras key={p.hito.id} etiqueta={p.hito.nombre} hechoMin={p.hechoMin} totalMin={p.totalMin} />
        ))}
      </Tarjeta>
    </View>
  );
}

type PropsFila = { bloque: BloquePlan; titulo: string; tema: string | null; pasado: boolean; primera: boolean };

// Un bloque en una línea: casilla, "08:30 – 09:20" y el examen. "Saltar" a la derecha.
function FilaBloque({ bloque, titulo, tema, pasado, primera }: PropsFila) {
  const saltado = bloque.estado === 'saltado';
  const apagado = saltado || (pasado && bloque.estado === 'pendiente');
  const marcar = (estado: 'hecho' | 'saltado' | null) => marcarBloque(bloque, estado);

  return (
    <View style={[estilos.bloque, !primera && estilos.separador]}>
      <Casilla
        marcada={bloque.estado === 'hecho'}
        alCambiar={(hecho) => marcar(hecho ? 'hecho' : null)}
        etiqueta={`Marcar como hecho: ${titulo}, ${horaDesdeMinutos(bloque.inicio)}`}
      />
      <View style={estilos.flex}>
        <Texto pequeno secundario style={estilos.hora}>
          {horaDesdeMinutos(bloque.inicio)} – {horaDesdeMinutos(bloque.fin)}
          {saltado ? ' · saltado' : ''}
        </Texto>
        <Texto fuerte numberOfLines={1} style={[apagado && estilos.secundario, saltado && estilos.tachado]}>
          {titulo}
        </Texto>
        {tema ? (
          <Texto pequeno secundario numberOfLines={1}>
            {tema}
          </Texto>
        ) : null}
      </View>
      {bloque.estado === 'pendiente' ? (
        <BotonTexto texto="Saltar" etiqueta={`Saltar el bloque de ${titulo}`} alPulsar={() => marcar('saltado')} />
      ) : saltado ? (
        <BotonTexto texto="Deshacer" etiqueta={`Deshacer: no saltar ${titulo}`} alPulsar={() => marcar(null)} />
      ) : null}
    </View>
  );
}

function BotonTexto({ texto, etiqueta, alPulsar }: { texto: string; etiqueta: string; alPulsar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.botonTexto, pressed && estilos.pulsado]}>
      <Texto pequeno fuerte style={estilos.enlace}>
        {texto}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  flex: { flex: 1 },
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  caja: { gap: espacio.s },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  lista: { marginTop: espacio.xs },
  bloque: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, minHeight: alturaTactil + 8 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde },
  hora: { ...cifras, fontFamily: fuentes.hora },
  tachado: { textDecorationLine: 'line-through' },
  // Sin opacidad: texto secundario (ver CLAUDE.md > Diseño).
  secundario: { color: colores.textoSecundario },
  botonTexto: { minHeight: alturaTactil, paddingHorizontal: espacio.s, justifyContent: 'center' },
  enlace: { color: colores.principal },
  pulsado: { transform: [{ scale: 0.96 }] },
});
