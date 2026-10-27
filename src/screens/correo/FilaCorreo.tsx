import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import { useCorreos, type CorreoResumido } from '@/data/correos';
import {
  alternarSiempre,
  avisaSiempre,
  esPlazo,
  NOMBRE_PROVEEDOR,
  quitarPlazo,
  textoParaDia,
  vetarDireccion,
  volverAApuntar,
} from '@/services/correo';
import { formatearHora } from '@/services/fechas';
import { alturaTactil, cifras, colores, colorTipo, espacio, fuentes, radio } from '@/theme';

// Un correo en la pestaña Correo (fase 11): remitente, hora, de qué va, el día que
// importa y, si es importante, la línea del aviso. Sin resúmenes (26/10/2026).
// Si se apuntó algo en el calendario, debajo y siempre a la vista, "¿Eliminar cita?"
// (27/10/2026): por si ese correo no te afecta.
// Al tocarlo se abre: "Abrir en Gmail/Outlook", "Ver en el calendario", "Volver a
// apuntarla", "Avisarme siempre de…" y "Vetar <dirección>".

type Props = {
  correo: CorreoResumido;
  hoy: string;
  nuevo: boolean;
  apuntado: boolean; // su tarea o cita sigue en el calendario, sin hacer
};

export function FilaCorreo({ correo, hoy, nuevo, apuntado }: Props) {
  const { siempre } = useCorreos();
  const [abierta, setAbierta] = useState(false);
  const [vetando, setVetando] = useState(false);
  const plazo = esPlazo(correo) ? correo.fechaLimite : null;
  const quitada = correo.fechaLimite !== null && correo.noEsPlazo;
  const cosa = correo.hora ? 'cita' : 'tarea';
  const hora = formatearHora(new Date(correo.recibido));
  const donde = correo.origen ? NOMBRE_PROVEEDOR[correo.origen] : 'Gmail';
  const conAviso = correo.de ? avisaSiempre(siempre, correo.de) : false;
  const direccion = correo.direccion ?? (correo.de.includes('@') ? correo.de : null);
  return (
    <View style={[estilos.fila, plazo && estilos.filaPlazo]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={[
          nuevo ? 'Nuevo.' : '',
          correo.importante ? 'Importante.' : '',
          `${correo.titulo}.`,
          `De ${correo.de}, a las ${hora}.`,
          plazo ? `${textoParaDia(plazo, hoy, correo.hora)}.` : '',
          correo.resumen,
        ].join(' ')}
        onPress={() => setAbierta((a) => !a)}
        style={({ pressed }) => [estilos.cabecera, pressed && estilos.pulsado]}>
        <View style={estilos.lineaDe}>
          <Texto pequeno secundario numberOfLines={1} style={estilos.de}>
            {correo.de}
          </Texto>
          {nuevo ? (
            <View style={estilos.nuevo}>
              <Texto pequeno fuerte style={estilos.textoNuevo}>
                Nuevo
              </Texto>
            </View>
          ) : null}
          <Texto pequeno secundario style={estilos.hora}>
            {hora}
          </Texto>
        </View>
        <Texto fuerte numberOfLines={abierta ? undefined : 2}>
          {correo.titulo}
        </Texto>
        {correo.importante ? (
          <Texto pequeno fuerte style={estilos.aviso}>
            Importante
          </Texto>
        ) : null}
        {plazo ? (
          <Texto pequeno fuerte style={plazo <= hoy ? estilos.aviso : undefined}>
            {textoParaDia(plazo, hoy, correo.hora)}
            {correo.tarea && correo.tarea !== correo.titulo ? ` · ${correo.tarea}` : ''}
          </Texto>
        ) : null}
        {quitada ? (
          <Texto pequeno secundario>
            No está en tu calendario
          </Texto>
        ) : null}
        {correo.resumen ? (
          <Texto pequeno secundario numberOfLines={abierta ? undefined : 2}>
            {correo.resumen}
          </Texto>
        ) : null}
      </Pressable>

      {plazo && apuntado ? (
        <View style={estilos.eliminar}>
          <Texto pequeno style={estilos.pregunta}>
            ¿Eliminar {cosa}?
          </Texto>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Eliminar la ${cosa} de ${correo.tarea ?? correo.titulo}. No se volverá a crear.`}
            onPress={() => quitarPlazo(correo.id).catch(() => {})}
            style={({ pressed }) => [estilos.pildora, pressed && estilos.pulsado]}>
            <Texto pequeno fuerte>
              Eliminar
            </Texto>
          </Pressable>
        </View>
      ) : null}

      {abierta ? (
        <View style={estilos.acciones}>
          {correo.cuenta || direccion ? (
            <Texto pequeno secundario>
              {[direccion ? `De ${direccion}` : '', correo.cuenta ? `En ${correo.cuenta}` : ''].filter(Boolean).join(' · ')}
            </Texto>
          ) : null}
          {correo.enlace ? (
            <Boton
              variante="secundario"
              titulo={`Abrir en ${donde}`}
              onPress={() => Linking.openURL(correo.enlace).catch(() => {})}
            />
          ) : null}
          {plazo && apuntado && correo.eventoId ? (
            <Boton
              variante="secundario"
              titulo="Ver en el calendario"
              onPress={() => router.push({ pathname: '/evento', params: { id: correo.eventoId ?? '' } })}
            />
          ) : null}
          {quitada && correo.fechaLimite && correo.fechaLimite >= hoy ? (
            <Boton
              variante="secundario"
              titulo={`Volver a apuntar la ${cosa}`}
              onPress={() => volverAApuntar(correo.id).catch(() => {})}
            />
          ) : null}
          {correo.de ? (
            <Boton
              variante="secundario"
              titulo={conAviso ? `Dejar de avisarme siempre de ${correo.de}` : `Avisarme siempre de ${correo.de}`}
              onPress={() => alternarSiempre(correo.de).catch(() => {})}
            />
          ) : null}
          {direccion && !vetando ? (
            <Boton variante="secundario" titulo={`Vetar ${direccion}`} onPress={() => setVetando(true)} />
          ) : null}
          {direccion && vetando ? (
            <View style={estilos.confirmar}>
              <Texto pequeno>
                No volverás a ver nada de {direccion} en Rusko, y se borra lo que haya apuntado sin hacer. En tu correo
                sigue igual.
              </Texto>
              <Boton titulo="Sí, vetarla" onPress={() => vetarDireccion(direccion).catch(() => {})} />
              <Boton variante="secundario" titulo="Mejor no" onPress={() => setVetando(false)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { backgroundColor: colores.tarjeta },
  // Lo que tiene fecha ya está en tu calendario: barra del color de "Yo".
  filaPlazo: { borderLeftWidth: 4, borderLeftColor: colorTipo.yo },
  cabecera: { gap: 2, minHeight: alturaTactil, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  pulsado: { opacity: 0.8 },
  lineaDe: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  de: { flexShrink: 1 },
  hora: { marginLeft: 'auto', ...cifras, fontFamily: fuentes.hora },
  nuevo: {
    paddingHorizontal: espacio.s,
    paddingVertical: 1,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
  },
  textoNuevo: { color: colores.textoSobrePrincipal },
  aviso: { color: colores.aviso },
  eliminar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    paddingBottom: espacio.s,
  },
  pregunta: { flex: 1, color: colores.textoSecundario },
  pildora: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  acciones: { gap: espacio.s, paddingHorizontal: espacio.m, paddingBottom: espacio.m },
  confirmar: { gap: espacio.s, padding: espacio.m, borderRadius: radio.grande, backgroundColor: colores.elevado },
});
