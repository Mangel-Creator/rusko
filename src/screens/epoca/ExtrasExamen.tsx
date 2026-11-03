import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton, CampoTexto, Plegable, Texto } from '@/components';
import { fichaConIA, medirApuntesConIA } from '@/services/epoca/ia';
import {
  MAX_PAGINAS,
  MAX_PAGINAS_ESCANEADO,
  esEscaneado,
  mapaDePaginas,
  temasDelIndice,
} from '@/services/epoca/apuntes';
import { leerPdf } from '@/services/epoca/leerPdf';
import { MAX_LEER_MB, MAX_PDF_MB, aBase64, elegirPdf } from '@/services/epoca/pdf';
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
// internet) y lo que ocupan sus apuntes (se miden, no se resumen). Las dos
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
      setMensaje({ texto: `Ese PDF pasa de ${MAX_LEER_MB} MB. Pártelo y añade las partes de una en una.`, error: true });
      return;
    }
    setOcupado('apuntes');
    const r = await medir(pdf.archivo);
    setOcupado(null);
    if (typeof r === 'string') {
      setMensaje({ texto: r, error: true });
      return;
    }
    actualizar((p) => {
      const anteriores = examenGuardado(p, nombre).apuntes?.temas ?? [];
      const todos = [...anteriores, ...r.temas].slice(0, MAX_TEMAS_APUNTES);
      return conExamen(p, nombre, { apuntes: { temas: todos, fecha: hoy } });
    });
    const cuantos = `${r.temas.length} ${r.temas.length === 1 ? 'tema' : 'temas'}`;
    setMensaje({
      texto: r.conIndice ? `He medido ${cuantos} de ${pdf.nombre} con su índice.` : `He medido ${cuantos} de ${pdf.nombre}.`,
      error: false,
    });
  };

  // Del más barato al más caro: su índice (sin IA), el mapa de páginas o el PDF entero.
  const medir = async (archivo: Blob): Promise<{ temas: TemaMedido[]; conIndice: boolean } | string> => {
    const leido = await leerPdf(archivo);
    if (leido && leido.paginas.length > MAX_PAGINAS) {
      return `Tiene ${leido.paginas.length} páginas. Pártelo en trozos de menos de ${MAX_PAGINAS} y añádelos de uno en uno.`;
    }
    const delIndice = leido ? temasDelIndice(leido) : null;
    if (delIndice) return { temas: delIndice, conIndice: true };
    if (leido && !esEscaneado(leido)) {
      const r = await medirApuntesConIA(nombre, { mapa: mapaDePaginas(leido), leido });
      return r.estado === 'ok' ? { temas: r.datos, conIndice: false } : r.mensaje;
    }
    // Fotos escaneadas: no hay texto, la IA tiene que ver las páginas.
    if (leido && leido.paginas.length > MAX_PAGINAS_ESCANEADO) {
      return `Parece escaneado y tiene ${leido.paginas.length} páginas. Pártelo en trozos de ${MAX_PAGINAS_ESCANEADO} páginas como mucho.`;
    }
    if (archivo.size > MAX_PDF_MB * 1024 * 1024) {
      return `Parece escaneado y pasa de ${MAX_PDF_MB} MB. Pártelo y añade las partes de una en una.`;
    }
    const r = await medirApuntesConIA(nombre, { pdf: await aBase64(archivo) });
    return r.estado === 'ok' ? { temas: r.datos, conIndice: false } : r.mensaje;
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
            Solo miro cuánto ocupa cada tema y lo denso que es, para calcular el tiempo. Los leo en tu móvil: a la IA
            solo le llega cómo empieza cada página, y nada se guarda en ningún servidor. PDF de hasta {MAX_LEER_MB}{' '}
            MB.
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
