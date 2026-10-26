import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import { useCorreos, type CorreoResumido } from '@/data/correos';
import { alternarSiempre, avisaSiempre, esPlazo, NOMBRE_PROVEEDOR, quitarPlazo, textoParaDia } from '@/services/correo';
import { formatearHora } from '@/services/fechas';
import { alturaTactil, cifras, colores, colorTipo, espacio, fuentes, radio } from '@/theme';

// Un correo en la pestaña Correo (fase 11): remitente, hora, de qué va, el día que
// importa y, si es importante, la línea del aviso. Sin resúmenes (26/10/2026).
// Al tocarlo se abre: "Abrir en Gmail/Outlook", "Ver la tarea", "Quitar de las tareas"
// y "Avisarme siempre de…".

export function FilaCorreo({ correo, hoy, nuevo }: { correo: CorreoResumido; hoy: string; nuevo: boolean }) {
  const { siempre } = useCorreos();
  const [abierta, setAbierta] = useState(false);
  const plazo = esPlazo(correo) ? correo.fechaLimite : null;
  const hora = formatearHora(new Date(correo.recibido));
  const donde = correo.origen ? NOMBRE_PROVEEDOR[correo.origen] : 'Gmail';
  const conAviso = correo.de ? avisaSiempre(siempre, correo.de) : false;
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
          plazo ? `${textoParaDia(plazo, hoy)}.` : '',
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
            {textoParaDia(plazo, hoy)}
            {correo.tarea && correo.tarea !== correo.titulo ? ` · ${correo.tarea}` : ''}
          </Texto>
        ) : null}
        {correo.resumen ? (
          <Texto pequeno secundario numberOfLines={abierta ? undefined : 2}>
            {correo.resumen}
          </Texto>
        ) : null}
      </Pressable>
      {abierta ? (
        <View style={estilos.acciones}>
          {correo.cuenta ? (
            <Texto pequeno secundario>
              En {correo.cuenta}
            </Texto>
          ) : null}
          {correo.enlace ? (
            <Boton
              variante="secundario"
              titulo={`Abrir en ${donde}`}
              onPress={() => Linking.openURL(correo.enlace).catch(() => {})}
            />
          ) : null}
          {plazo && correo.eventoId ? (
            <Boton
              variante="secundario"
              titulo="Ver la tarea"
              onPress={() => router.push({ pathname: '/evento', params: { id: correo.eventoId ?? '' } })}
            />
          ) : null}
          {plazo ? (
            <Boton
              variante="secundario"
              titulo="Quitar de las tareas"
              onPress={() => quitarPlazo(correo.id).catch(() => {})}
            />
          ) : null}
          {correo.de ? (
            <Boton
              variante="secundario"
              titulo={conAviso ? `Dejar de avisarme siempre de ${correo.de}` : `Avisarme siempre de ${correo.de}`}
              onPress={() => alternarSiempre(correo.de).catch(() => {})}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { backgroundColor: colores.tarjeta },
  // Lo que tiene fecha ya es una tarea tuya: barra del color de "Yo".
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
  acciones: { gap: espacio.s, paddingHorizontal: espacio.m, paddingBottom: espacio.m },
});
