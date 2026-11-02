import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Plegable, Texto } from '@/components';
import { fichaConIA, medirApuntesConIA } from '@/services/epoca/ia';
import { MAX_PDF_MB, elegirPdf } from '@/services/epoca/pdf';
import { conExamen, examenGuardado, type PerfilEstudio, type TemaMedido } from '@/services/epoca/perfilEstudio';
import type { AsignaturaCuestionario } from '@/services/epoca/validarIA';
import type { ClaveDia } from '@/services/fechas';
import { colores, espacio } from '@/theme';

type Props = {
  asignatura: AsignaturaCuestionario;
  estudio: PerfilEstudio;
  hoy: ClaveDia;
  // Cambia el perfil de estudio a partir del último (puede haber otro examen a la vez).
  actualizar: (cambio: (p: PerfilEstudio) => PerfilEstudio) => void;
};

const MAX_TEMAS_APUNTES = 60;
const DENSIDAD = { baja: 'ligero', media: 'normal', alta: 'denso' } as const;

const paginas = (temas: TemaMedido[]) => temas.reduce((t, x) => t + x.paginas, 0);

// Dentro de cada examen del cuestionario: cómo es el examen (la IA lo busca en
// internet) y lo que ocupan sus apuntes (la IA mide el PDF, no lo resume). Las dos
// cosas se quedan en el perfil de estudio para los próximos planes.
export function ExtrasExamen({ asignatura, estudio, hoy, actualizar }: Props) {
  const nombre = asignatura.nombre.trim();
  const guardado = examenGuardado(estudio, nombre);
  const temas = guardado.apuntes?.temas ?? [];
  const [detalle, setDetalle] = useState('');
  const [ocupado, setOcupado] = useState<'ficha' | 'apuntes' | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const buscar = async () => {
    if (!nombre) {
      setMensaje({ texto: 'Pon antes el nombre del examen.', error: true });
      return;
    }
    setOcupado('ficha');
    setMensaje(null);
    const r = await fichaConIA(nombre, detalle, asignatura.tipoExamen);
    setOcupado(null);
    if (r.estado === 'fallo') {
      setMensaje({ texto: r.mensaje, error: true });
      return;
    }
    actualizar((p) => conExamen(p, nombre, { ficha: { texto: r.datos, fecha: hoy } }));
  };

  const anadirPdf = async () => {
    if (!nombre) {
      setMensaje({ texto: 'Pon antes el nombre del examen.', error: true });
      return;
    }
    setMensaje(null);
    const pdf = await elegirPdf().catch(() => null);
    if (pdf === null) return;
    if (pdf === 'grande') {
      setMensaje({ texto: `Ese PDF pasa de ${MAX_PDF_MB} MB. Pártelo y añade las partes de una en una.`, error: true });
      return;
    }
    setOcupado('apuntes');
    const r = await medirApuntesConIA(nombre, pdf.base64);
    setOcupado(null);
    if (r.estado === 'fallo') {
      setMensaje({ texto: r.mensaje, error: true });
      return;
    }
    actualizar((p) => {
      const anteriores = examenGuardado(p, nombre).apuntes?.temas ?? [];
      const todos = [...anteriores, ...r.datos].slice(0, MAX_TEMAS_APUNTES);
      return conExamen(p, nombre, { apuntes: { temas: todos, fecha: hoy } });
    });
    setMensaje({ texto: `He medido ${r.datos.length} ${r.datos.length === 1 ? 'tema' : 'temas'} de ${pdf.nombre}.`, error: false });
  };

  return (
    <>
      <Plegable
        titulo="Cómo es el examen"
        resumen={guardado.ficha ? 'Ya lo he buscado' : 'Opcional: lo busco en internet'}
      >
        <View style={estilos.bloque}>
          {guardado.ficha ? (
            <Texto>{guardado.ficha.texto}</Texto>
          ) : (
            <Texto secundario>
              Busco las partes, la duración y lo que hace falta para aprobar. Sirve sobre todo para idiomas (B2, C1),
              oposiciones, selectividad y exámenes oficiales.
            </Texto>
          )}
          <CampoTexto
            etiqueta="Para encontrarlo mejor (opcional)"
            placeholder="Cambridge, EOI de Madrid, convocatoria 2027…"
            value={detalle}
            onChangeText={setDetalle}
            maxLength={120}
            autoCapitalize="sentences"
          />
          <Boton
            variante="secundario"
            titulo={
              ocupado === 'ficha'
                ? 'Buscando… (hasta 1 minuto)'
                : guardado.ficha
                  ? 'Buscarlo otra vez'
                  : 'Buscar cómo es este examen'
            }
            disabled={ocupado !== null}
            onPress={buscar}
          />
        </View>
      </Plegable>

      <Plegable
        titulo="Tus apuntes"
        resumen={
          temas.length > 0
            ? `${temas.length} ${temas.length === 1 ? 'tema' : 'temas'}, ${paginas(temas)} páginas`
            : 'Opcional: añade el PDF y mido cada tema'
        }
      >
        <View style={estilos.bloque}>
          <Texto secundario>
            Solo miro cuánto ocupa cada tema y lo denso que es, para calcular el tiempo. No los resumo ni se
            guardan en ningún servidor. PDF de hasta {MAX_PDF_MB} MB; si es más, pártelo y añade las partes.
          </Texto>
          {temas.map((t, i) => (
            <Texto key={`${t.nombre}-${i}`} pequeno>
              {t.nombre}: {t.paginas} {t.paginas === 1 ? 'página' : 'páginas'}, {DENSIDAD[t.densidad]}
            </Texto>
          ))}
          <Boton
            variante="secundario"
            titulo={ocupado === 'apuntes' ? 'Midiendo tus apuntes… (hasta 2 minutos)' : 'Añadir PDF'}
            disabled={ocupado !== null}
            onPress={anadirPdf}
          />
          {temas.length > 0 ? (
            <Boton
              variante="secundario"
              titulo="Quitar los apuntes"
              disabled={ocupado !== null}
              onPress={() => actualizar((p) => conExamen(p, nombre, { apuntes: undefined }))}
            />
          ) : null}
        </View>
      </Plegable>

      {mensaje ? (
        <Texto fuerte style={mensaje.error ? estilos.error : null} accessibilityLiveRegion="polite">
          {mensaje.texto}
        </Texto>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.s },
  error: { color: colores.aviso },
});
