import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { useDensidad } from '@/data/densidad';
import type { Evento } from '@/data/eventos';
import { colocarEnCarriles, intervaloDe } from '@/services/agenda';
import { PREFIJO_EPOCA } from '@/services/epoca';
import { DIAS_SEMANA_LETRA, fechaDesdeClave, horaDesdeMinutos, type ClaveDia } from '@/services/fechas';
import { cifras, colorBaldosa, colores, colorEvento, espacio, fuentes } from '@/theme';

export type DiaRejilla = {
  dia: ClaveDia;
  eventos: Evento[]; // con hora
  tareas: Evento[]; // sin hora fija
  hayHito: boolean;
};

type Props = {
  dias: DiaRejilla[];
  ventana: { inicio: number; fin: number };
  hoy: ClaveDia;
  minutoAhora: number;
  alTocarDia: (dia: ClaveDia) => void;
  alTocarEvento: (evento: Evento, dia: ClaveDia) => void;
  alTocarHueco: (dia: ClaveDia, minuto: number) => void;
};

const ANCHO_HORAS = 40;

// Varios días en columnas con su línea de horas, como Google Calendar: arriba el día
// (tócalo para verlo solo), luego lo que no tiene hora y debajo cada cita ocupando lo
// que dura. Tocar un hueco vacío crea una cita a esa hora.
export function RejillaSemana({ dias, ventana, hoy, minutoAhora, alTocarDia, alTocarEvento, alTocarHueco }: Props) {
  const { medidas } = useDensidad();
  const tramos = dias.flatMap((d) => d.eventos.map(intervaloDe));
  const desde = Math.floor(Math.min(ventana.inicio, ...tramos.map((t) => t.inicio)) / 60) * 60;
  const hasta = Math.ceil(Math.max(ventana.fin, ...tramos.map((t) => t.fin)) / 60) * 60;
  const y = (minuto: number) => ((minuto - desde) / 60) * medidas.pxPorHora;
  const horas = Array.from({ length: (hasta - desde) / 60 + 1 }, (_, i) => desde + i * 60);
  const hayTareas = dias.some((d) => d.tareas.length > 0);
  const compacta = dias.length > 3;

  return (
    <View>
      <View style={estilos.filaCabecera}>
        <View style={{ width: ANCHO_HORAS }} />
        {dias.map(({ dia, hayHito }) => {
          const fecha = fechaDesdeClave(dia);
          const esHoy = dia === hoy;
          return (
            <Pressable
              key={dia}
              accessibilityRole="button"
              accessibilityLabel={`Ver solo el ${fecha.getDate()}`}
              onPress={() => alTocarDia(dia)}
              style={({ pressed }) => [estilos.cabeceraDia, pressed && estilos.pulsado]}>
              <Texto pequeno style={[estilos.letra, esHoy && estilos.letraHoy]}>
                {DIAS_SEMANA_LETRA[(fecha.getDay() + 6) % 7]}
              </Texto>
              <View style={[estilos.numero, esHoy && estilos.numeroHoy]}>
                <Texto fuerte style={[estilos.numeroTexto, esHoy && estilos.numeroTextoHoy]}>
                  {fecha.getDate()}
                </Texto>
              </View>
              <View style={[estilos.marcaHito, hayHito && estilos.marcaHitoVisible]} />
            </Pressable>
          );
        })}
      </View>

      {hayTareas ? (
        <View style={estilos.filaTareas}>
          <View style={{ width: ANCHO_HORAS }} />
          {dias.map(({ dia, tareas }) => (
            <View key={dia} style={estilos.columnaTareas}>
              {tareas.map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tarea: ${t.titulo}`}
                  onPress={() => alTocarEvento(t, dia)}
                  style={({ pressed }) => [
                    estilos.tarea,
                    { borderLeftColor: colorEvento(t) },
                    pressed && estilos.pulsado,
                  ]}>
                  <Texto numberOfLines={1} style={[estilos.textoBloque, t.hecha && estilos.tachada]}>
                    {t.titulo}
                  </Texto>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <View style={[estilos.cuerpo, { height: y(hasta) + 8 }]}>
        {horas.map((minuto) => (
          <View key={minuto} style={[estilos.marcaHora, { top: y(minuto) }]}>
            <Texto pequeno secundario style={estilos.etiquetaHora}>
              {horaDesdeMinutos(minuto)}
            </Texto>
            <View style={estilos.rayaHora} />
          </View>
        ))}

        <View style={estilos.columnas}>
          {dias.map(({ dia, eventos }) => (
            <View key={dia} style={[estilos.columna, { height: y(hasta) }]}>
              {/* Una casilla por hora, debajo de las citas: al tocarla se crea una a esa hora. */}
              {horas.slice(0, -1).map((minuto) => (
                <Pressable
                  key={minuto}
                  accessibilityLabel={`Crear una cita el ${fechaDesdeClave(dia).getDate()} a las ${horaDesdeMinutos(minuto)}`}
                  onPress={() => alTocarHueco(dia, Math.min(minuto, 23 * 60))}
                  style={({ pressed }) => [
                    estilos.casillaHora,
                    { top: y(minuto), height: medidas.pxPorHora },
                    pressed && estilos.casillaPulsada,
                  ]}
                />
              ))}
              {colocarEnCarriles(eventos, intervaloDe).map(({ elemento: evento, carril, carriles }) => {
                const { inicio, fin } = intervaloDe(evento);
                const ancho = 100 / carriles;
                const alto = Math.max(y(fin) - y(inicio) - 2, 20);
                const deEpoca = evento.id.startsWith(`${PREFIJO_EPOCA}bloque:`);
                const baldosa = deEpoca ? colorBaldosa.estudio : colorBaldosa[evento.tipo];
                return (
                  <Pressable
                    key={evento.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${evento.horaInicio}, ${evento.titulo}`}
                    onPress={() => alTocarEvento(evento, dia)}
                    style={({ pressed }) => [
                      estilos.bloque,
                      {
                        top: y(inicio) + 1,
                        height: alto,
                        left: `${carril * ancho}%`,
                        width: `${ancho}%`,
                        backgroundColor: evento.foco && !deEpoca ? colores.acentoSuave : baldosa.fondo,
                        borderLeftColor: deEpoca ? colores.dorado : evento.foco ? colores.principal : colorEvento(evento),
                      },
                      pressed && estilos.pulsado,
                    ]}>
                    <Texto
                      numberOfLines={Math.max(1, Math.floor((alto - 4) / 14))}
                      style={[estilos.textoBloque, compacta && estilos.textoCompacto]}>
                      {evento.titulo}
                    </Texto>
                    {!compacta && alto >= 40 ? (
                      <Texto numberOfLines={1} style={estilos.horaBloque}>
                        {evento.horaInicio}
                      </Texto>
                    ) : null}
                  </Pressable>
                );
              })}
              {dia === hoy && minutoAhora >= desde && minutoAhora <= hasta ? (
                <View style={[estilos.ahora, { top: y(minutoAhora) - 1 }]} accessibilityLabel="Ahora">
                  <View style={estilos.puntoAhora} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  filaCabecera: { flexDirection: 'row', paddingBottom: espacio.xs },
  cabeceraDia: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: espacio.xs },
  letra: { color: colores.textoSecundario, fontSize: 12 },
  letraHoy: { color: colores.principal },
  numero: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numeroHoy: { backgroundColor: colores.principal },
  numeroTexto: { ...cifras },
  numeroTextoHoy: { color: colores.textoOscuro },
  marcaHito: { width: 5, height: 5, borderRadius: 3 },
  marcaHitoVisible: { backgroundColor: colores.dorado },
  filaTareas: { flexDirection: 'row', paddingBottom: espacio.xs, borderBottomWidth: 1, borderBottomColor: colores.borde },
  columnaTareas: { flex: 1, gap: 2, paddingHorizontal: 1 },
  tarea: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 6,
    borderLeftWidth: 3,
    backgroundColor: colores.elevado,
  },
  cuerpo: { position: 'relative', marginTop: espacio.s },
  marcaHora: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', marginTop: -8 },
  etiquetaHora: { width: ANCHO_HORAS, ...cifras, fontFamily: fuentes.hora, fontSize: 11 },
  rayaHora: { flex: 1, height: 1, backgroundColor: colores.borde },
  columnas: { position: 'absolute', top: 0, left: ANCHO_HORAS, right: 0, flexDirection: 'row' },
  columna: { flex: 1, position: 'relative', borderLeftWidth: 1, borderLeftColor: colores.borde },
  casillaHora: { position: 'absolute', left: 0, right: 0 },
  casillaPulsada: { backgroundColor: colores.elevado },
  bloque: {
    position: 'absolute',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 6,
    borderLeftWidth: 3,
    overflow: 'hidden',
    marginHorizontal: 1,
  },
  textoBloque: { fontSize: 12, lineHeight: 14, fontFamily: fuentes.textoFuerte, color: colores.texto },
  textoCompacto: { fontSize: 11, lineHeight: 14 },
  horaBloque: { fontSize: 11, lineHeight: 14, color: colores.textoSecundario, ...cifras },
  tachada: { textDecorationLine: 'line-through', color: colores.textoSecundario },
  ahora: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colores.principal },
  puntoAhora: {
    position: 'absolute',
    left: -5,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colores.principal,
  },
  pulsado: { opacity: 0.7 },
});

