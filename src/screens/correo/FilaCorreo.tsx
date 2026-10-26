import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import type { CorreoResumido } from '@/data/correos';
import { esPlazo, NOMBRE_PROVEEDOR, quitarPlazo, textoVence } from '@/services/correo';
import { formatearHora } from '@/services/fechas';
import { alturaTactil, cifras, colores, colorTipo, espacio, fuentes, radio } from '@/theme';

// Un correo resumido en Resúmenes (fase 11): remitente, hora, título, plazo y resumen.
// Al tocarlo se abre: "Abrir en Gmail/Outlook", "Ver la tarea" y "No es un plazo".

export function FilaCorreo({ correo, hoy, nuevo }: { correo: CorreoResumido; hoy: string; nuevo: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const plazo = esPlazo(correo) ? correo.fechaLimite : null;
  const hora = formatearHora(new Date(correo.recibido));
  const donde = correo.origen ? NOMBRE_PROVEEDOR[correo.origen] : 'Gmail';
  return (
    <View style={[estilos.fila, plazo && estilos.filaPlazo]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={[
          nuevo ? 'Nuevo.' : '',
          `${correo.titulo}.`,
          `De ${correo.de}, a las ${hora}.`,
          plazo ? `${textoVence(plazo, hoy)}.` : '',
          abierta ? '' : correo.resumen,
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
        {plazo ? (
          <Texto pequeno fuerte style={plazo <= hoy ? estilos.aviso : undefined}>
            {textoVence(plazo, hoy)}
            {correo.tarea && correo.tarea !== correo.titulo ? ` · ${correo.tarea}` : ''}
          </Texto>
        ) : null}
        {correo.resumen ? (
          <Texto pequeno secundario numberOfLines={abierta ? undefined : 3}>
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
            <Boton variante="secundario" titulo="No es un plazo" onPress={() => quitarPlazo(correo.id).catch(() => {})} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { backgroundColor: colores.tarjeta },
  // Los plazos son tareas tuyas: barra del color de "Yo".
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
