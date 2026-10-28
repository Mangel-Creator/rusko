import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import {
  alternarSiempre,
  asuntoCorto,
  avisaSiempre,
  esPlazo,
  fijarCorreo,
  NOMBRE_PROVEEDOR,
  opcionesRecordatorio,
  quitarCorreo,
  quitarPlazo,
  recordarCorreo,
  textoGrupo,
  textoRecordatorio,
  textoTienes,
  vetarDireccion,
  volverAApuntar,
  type CorreoConNivel,
} from '@/services/correo';
import { claveDia, formatearHora } from '@/services/fechas';
import { alturaTactil, coloresNivel, espacio, radio } from '@/theme';

import { RecuadroCorreo } from './RecuadroCorreo';

// Un correo en la pestaña Correo (fase 11), como recuadro del color de su nivel
// (RecuadroCorreo, 27/10/2026): remitente, hora (o el día si no es de hoy), asunto
// acortado, «Tienes X el día Y» y, al tocarlo, de qué trata.
// Si se apuntó algo en el calendario, siempre a la vista "¿Eliminar cita?": por si ese
// correo no te afecta.
// Al abrirlo: "Abrir en Gmail/Outlook", "Ver en el calendario", "Volver a apuntarla",
// "Avisarme siempre de…" y "Vetar <dirección>".

type Props = {
  correo: CorreoConNivel;
  hoy: string;
  nuevo: boolean;
  apuntado: boolean; // su tarea o cita sigue en el calendario, sin hacer
};

export function FilaCorreo({ correo, hoy, nuevo, apuntado }: Props) {
  const { siempre } = useCorreos();
  const [vetando, setVetando] = useState(false);
  const plazo = esPlazo(correo) ? correo.fechaLimite : null;
  const quitada = correo.fechaLimite !== null && correo.noEsPlazo;
  const cosa = correo.hora ? 'cita' : 'tarea';
  const recibido = new Date(correo.recibido);
  const dia = claveDia(recibido);
  // Siempre la hora a la que llegó; si no es de hoy, también el día («Ayer · 09:10»).
  const hora = dia === hoy ? formatearHora(recibido) : `${textoGrupo(dia, hoy)} · ${formatearHora(recibido)}`;
  const donde = correo.origen ? NOMBRE_PROVEEDOR[correo.origen] : 'Gmail';
  const conAviso = correo.de ? avisaSiempre(siempre, correo.de) : false;
  const direccion = correo.direccion ?? (correo.de.includes('@') ? correo.de : null);
  const c = coloresNivel[correo.nivel];
  const ahora = new Date();

  return (
    <RecuadroCorreo
      nivel={correo.nivel}
      fijado={correo.fijado}
      asunto={asuntoCorto(correo.titulo)}
      de={correo.de}
      direccion={direccion && direccion.toLowerCase() !== correo.de.toLowerCase() ? direccion : null}
      hora={hora}
      resumen={correo.resumen}
      cuando={plazo ? textoTienes(correo.tarea ?? correo.titulo, plazo, hoy, correo.hora) : null}
      nuevo={nuevo}
      recordatorio={correo.recordatorio ? textoRecordatorio(correo.recordatorio, ahora) : null}
      opcionesRecordar={opcionesRecordatorio(ahora).map((o) => ({
        clave: o.clave,
        texto: o.texto,
        alElegir: () => recordarCorreo(correo.id, o.cuando).catch(() => {}),
      }))}
      alQuitarRecordatorio={() => recordarCorreo(correo.id, null).catch(() => {})}
      alEliminar={() => quitarCorreo(correo.id).catch(() => {})}
      alFijar={() => fijarCorreo(correo.id).catch(() => {})}
      aviso={
        plazo && apuntado ? (
          <View style={estilos.eliminar}>
            <Texto pequeno style={[estilos.pregunta, { color: c.secundario }]}>
              ¿Eliminar {cosa}?
            </Texto>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar la ${cosa} de ${correo.tarea ?? correo.titulo}. No se volverá a crear.`}
              onPress={() => quitarPlazo(correo.id).catch(() => {})}
              style={({ pressed }) => [estilos.pildora, { borderColor: c.texto }, pressed && estilos.pulsado]}>
              <Texto pequeno fuerte style={{ color: c.texto }}>
                Eliminar
              </Texto>
            </Pressable>
          </View>
        ) : quitada ? (
          <Texto pequeno style={{ color: c.secundario }}>
            No está en tu calendario
          </Texto>
        ) : null
      }>
      {correo.cuenta || direccion ? (
        <Texto pequeno style={{ color: c.secundario }}>
          {[direccion ? `De ${direccion}` : '', correo.cuenta ? `En ${correo.cuenta}` : ''].filter(Boolean).join(' · ')}
        </Texto>
      ) : null}
      {correo.enlace ? (
        <Boton variante="secundario" titulo={`Abrir en ${donde}`} onPress={() => Linking.openURL(correo.enlace).catch(() => {})} />
      ) : null}
      {plazo && apuntado && correo.eventoId ? (
        <Boton
          variante="secundario"
          titulo="Ver en el calendario"
          onPress={() => router.push({ pathname: '/evento', params: { id: correo.eventoId ?? '' } })}
        />
      ) : null}
      {quitada && correo.fechaLimite && correo.fechaLimite >= hoy ? (
        <Boton variante="secundario" titulo={`Volver a apuntar la ${cosa}`} onPress={() => volverAApuntar(correo.id).catch(() => {})} />
      ) : null}
      {correo.de ? (
        <Boton
          variante="secundario"
          titulo={conAviso ? `Dejar de avisarme siempre de ${correo.de}` : `Avisarme siempre de ${correo.de}`}
          onPress={() => alternarSiempre(correo.de).catch(() => {})}
        />
      ) : null}
      {direccion && !vetando ? <Boton variante="secundario" titulo={`Vetar ${direccion}`} onPress={() => setVetando(true)} /> : null}
      {direccion && vetando ? (
        <View style={[estilos.confirmar, { backgroundColor: c.boton }]}>
          <Texto pequeno style={{ color: c.texto }}>
            No volverás a ver nada de {direccion} en Rusko, y se borra lo que haya apuntado sin hacer. En tu correo sigue
            igual.
          </Texto>
          <Boton titulo="Sí, vetarla" onPress={() => vetarDireccion(direccion).catch(() => {})} />
          <Boton variante="secundario" titulo="Mejor no" onPress={() => setVetando(false)} />
        </View>
      ) : null}
    </RecuadroCorreo>
  );
}

const estilos = StyleSheet.create({
  pulsado: { opacity: 0.8 },
  eliminar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  pregunta: { flex: 1 },
  pildora: {
    minHeight: alturaTactil,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    borderWidth: 1,
  },
  confirmar: { gap: espacio.s, padding: espacio.m, borderRadius: radio.normal },
});
