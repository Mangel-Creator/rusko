import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Texto } from '@/components';
import type { Hito, TemaHito } from '@/data/epocas';
import { horasDeTemas } from '@/services/epoca';
import { temasConIA } from '@/services/epoca/ia';
import { MAX_TEXTO_TEMARIO, type PropuestaTemas } from '@/services/epoca/validarIA';
import { cifras, colores, espacio, fuentes } from '@/theme';

import { BotonIcono } from './EditorImprescindibles';
import { formatoHoras } from './textos';

type Props = {
  hito: Hito;
  alCambiar: (hito: Hito) => void;
};

// "Temario por temas": pegas o dictas el temario de un examen y la IA lo parte en
// temas con sus horas. Con temas, cada bloque del plan dice qué toca estudiar.
// Las horas de preparación del hito pasan a ser la suma de los temas.
export function PanelTemario({ hito, alCambiar }: Props) {
  const [temario, setTemario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaTemas | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const temas = hito.temas ?? [];

  const cambiarTemas = (nuevos: TemaHito[]) =>
    alCambiar({
      ...hito,
      temas: nuevos,
      horasPreparacion: nuevos.length > 0 ? Math.max(1, horasDeTemas(nuevos)) : hito.horasPreparacion,
    });

  const repartir = async () => {
    setOcupado(true);
    setMensaje(null);
    setPropuesta(null);
    const r = await temasConIA(hito, temario);
    setOcupado(false);
    if (r.estado === 'fallo') {
      setMensaje({ texto: r.mensaje, error: r.motivo !== 'sin-clave' && r.motivo !== 'sin-configurar' });
      return;
    }
    setPropuesta(r.datos);
  };

  return (
    <View style={estilos.panel}>
      {temas.length > 0 ? (
        <View style={estilos.lista}>
          <Texto fuerte>Temas, en el orden en que los estudiarás</Texto>
          {temas.map((tema, i) => (
            <View key={tema.id} style={estilos.tema}>
              <Texto style={estilos.flex}>
                {i + 1}. {tema.nombre}
              </Texto>
              <Texto secundario style={estilos.horas}>
                {formatoHoras(tema.horas)}
              </Texto>
              <BotonIcono
                icono="close"
                etiqueta={`Quitar ${tema.nombre}`}
                alPulsar={() => cambiarTemas(temas.filter((t) => t.id !== tema.id))}
              />
            </View>
          ))}
          <Texto pequeno secundario>
            En total, {formatoHoras(horasDeTemas(temas))} de preparación.
          </Texto>
          <Boton variante="secundario" titulo="Quitar todos los temas" onPress={() => alCambiar({ ...hito, temas: [] })} />
        </View>
      ) : null}

      {propuesta ? (
        <View style={estilos.lista} accessibilityLiveRegion="polite">
          <Texto fuerte>Te propongo estos temas</Texto>
          {propuesta.temas.map((tema, i) => (
            <View key={tema.id} style={estilos.tema}>
              <Texto style={estilos.flex}>
                {i + 1}. {tema.nombre}
              </Texto>
              <Texto secundario style={estilos.horas}>
                {formatoHoras(tema.horas)}
              </Texto>
            </View>
          ))}
          <Texto pequeno secundario>
            En total, {formatoHoras(horasDeTemas(propuesta.temas))}
            {horasDeTemas(propuesta.temas) !== hito.horasPreparacion
              ? ` (tenías ${formatoHoras(hito.horasPreparacion)})`
              : ''}
            .
          </Texto>
          {propuesta.consejo ? <Texto secundario>{propuesta.consejo}</Texto> : null}
          <Boton
            titulo="Usar estos temas"
            onPress={() => {
              cambiarTemas(propuesta.temas);
              setPropuesta(null);
              setTemario('');
            }}
          />
          <Boton variante="secundario" titulo="Descartar" onPress={() => setPropuesta(null)} />
        </View>
      ) : (
        <>
          <CampoTexto
            etiqueta={temas.length > 0 ? 'Volver a repartir: pega el temario' : 'Pega o dicta el temario'}
            placeholder="Tema 1: Probabilidad. Tema 2: Variables aleatorias. Tema 3: Regresión…"
            value={temario}
            onChangeText={setTemario}
            multiline
            maxLength={MAX_TEXTO_TEMARIO}
            style={estilos.campo}
          />
          <Boton
            variante="secundario"
            titulo={ocupado ? 'Repartiéndolo…' : 'Repartir en temas'}
            disabled={ocupado || !temario.trim()}
            onPress={repartir}
          />
          {mensaje ? (
            <Texto fuerte style={mensaje.error ? estilos.error : null} accessibilityLiveRegion="polite">
              {mensaje.texto}
            </Texto>
          ) : null}
          <Texto pequeno secundario>
            El temario se envía a la IA (Claude, de Anthropic) solo para repartirlo. No se guarda en ningún servidor.
          </Texto>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: { gap: espacio.m, paddingTop: espacio.s, borderTopWidth: 1, borderTopColor: colores.borde },
  lista: { gap: espacio.s },
  tema: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: 32 },
  flex: { flex: 1 },
  horas: { ...cifras, fontFamily: fuentes.hora },
  campo: { minHeight: 110, paddingVertical: espacio.s, textAlignVertical: 'top' },
  error: { color: colores.aviso },
});
