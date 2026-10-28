import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { useDensidad } from '@/data/densidad';
import type { Evento } from '@/data/eventos';
import { colocarEnCarriles, intervaloDe } from '@/services/agenda';
import { PREFIJO_EPOCA } from '@/services/epoca';
import { DIAS_SEMANA_LETRA, fechaDesdeClave, horaDesdeMinutos, type ClaveDia } from '@/services/fechas';
import { cifras, colorBaldosa, colores, colorEvento, espacio, fuentes, radio } from '@/theme';

export type DiaRejilla = {
  dia: ClaveDia;
  eventos: Evento[]; // con hora
  tareas: Evento[]; // sin hora fija
  hayHito: boolean;
  carga: { proporcion: number; alta: boolean }; // la misma cuenta que la vista "Día"
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

// Varios días en carriles redondeados con su línea de horas: arriba cada día en una
// píldora con lo cargado que va (tócala para verlo solo), luego lo que no tiene hora y
// debajo cada cita ocupando lo que dura, en el color de su tipo. Hoy va en naranja
// suave y la hora de ahora, en una píldora a la izquierda. Tocar un hueco crea una cita.
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
        <View style={{ width: ANCHO_HORAS - 3 }} />
        {dias.map(({ dia, hayHito, carga }) => {
          const fecha = fechaDesdeClave(dia);
          const esHoy = dia === hoy;
          return (
            <Pressable
              key={dia}
              accessibilityRole="button"
              accessibilityLabel={`Ver solo el ${fecha.getDate()}`}
              onPress={() => alTocarDia(dia)}
              style={({ pressed }) => [
                estilos.cabeceraDia,
                esHoy && estilos.cabeceraHoy,
                pressed && estilos.pulsado,
              ]}>
              <Texto pequeno style={[estilos.letra, esHoy && estilos.textoHoy]}>
                {DIAS_SEMANA_LETRA[(fecha.getDay() + 6) % 7]}
              </Texto>
              <Texto fuerte style={[estilos.numeroTexto, esHoy && estilos.textoHoy]}>
                {fecha.getDate()}
              </Texto>
              <View style={[estilos.cargaFondo, esHoy && estilos.cargaFondoHoy]}>
                <View
                  style={[
                    estilos.carga,
                    {
                      width: `${Math.min(carga.proporcion, 1) * 100}%`,
                      backgroundColor: esHoy ? colores.textoOscuro : carga.alta ? colores.aviso : colores.cargaNormal,
                    },
                  ]}
                />
              </View>
              <View style={[estilos.marcaHito, hayHito && estilos.marcaHitoVisible]} />
            </Pressable>
          );
        })}
      </View>

      {hayTareas ? (
        <View style={estilos.filaTareas}>
          <Texto pequeno secundario style={estilos.sinHora}>
            Sin hora
          </Texto>
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
                    { backgroundColor: colorBaldosa[t.tipo].fondo },
                    pressed && estilos.pulsado,
                  ]}>
                  <Texto
                    numberOfLines={1}
                    style={[estilos.textoBloque, { color: colorEvento(t) }, t.hecha && estilos.tachada]}>
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
          <Texto key={minuto} pequeno secundario style={[estilos.etiquetaHora, { top: y(minuto) - 8 }]}>
            {horaDesdeMinutos(minuto)}
          </Texto>
        ))}
        {minutoAhora >= desde && minutoAhora <= hasta && dias.some((d) => d.dia === hoy) ? (
          <View style={[estilos.pildoraAhora, { top: y(minutoAhora) - 9 }]} accessibilityLabel="Ahora">
            <Texto style={estilos.textoAhora}>{horaDesdeMinutos(minutoAhora)}</Texto>
          </View>
        ) : null}

        <View style={estilos.columnas}>
          {dias.map(({ dia, eventos }) => (
            <View key={dia} style={[estilos.columna, dia === hoy && estilos.columnaHoy, { height: y(hasta) }]}>
              {horas.slice(1, -1).map((minuto) => (
                <View key={minuto} style={[estilos.rayaHora, { top: y(minuto) }]} />
              ))}
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
                const colorTexto = deEpoca ? colores.dorado : evento.foco ? colores.principal : colorEvento(evento);
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
                      },
                      pressed && estilos.pulsado,
                    ]}>
                    <Texto
                      numberOfLines={Math.max(1, Math.floor((alto - 4) / 14))}
                      style={[estilos.textoBloque, { color: colorTexto }, compacta && estilos.textoCompacto]}>
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
                <View style={[estilos.ahora, { top: y(minutoAhora) - 1 }]} />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  filaCabecera: { flexDirection: 'row', gap: 3, paddingBottom: espacio.s },
  // Cada día, una píldora alta con letra, número y una barrita de lo cargado que va.
  cabeceraDia: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: espacio.s,
    paddingBottom: espacio.xs,
    borderRadius: radio.chip,
    backgroundColor: colores.tarjeta,
  },
  cabeceraHoy: { backgroundColor: colores.principal },
  letra: { color: colores.textoSecundario, fontSize: 11 },
  numeroTexto: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 17 },
  textoHoy: { color: colores.textoOscuro },
  cargaFondo: { width: '56%', height: 4, borderRadius: 2, backgroundColor: colores.elevado, overflow: 'hidden' },
  cargaFondoHoy: { backgroundColor: colores.principalPulsado },
  carga: { height: '100%', borderRadius: 2 },
  marcaHito: { width: 5, height: 5, borderRadius: 3 },
  marcaHitoVisible: { backgroundColor: colores.dorado },
  filaTareas: { flexDirection: 'row', gap: 3, paddingBottom: espacio.s },
  sinHora: { width: ANCHO_HORAS - 3, fontSize: 10, lineHeight: 12, paddingTop: 4 },
  columnaTareas: { flex: 1, gap: 3 },
  tarea: { minHeight: 22, justifyContent: 'center', paddingHorizontal: 5, borderRadius: radio.chip },
  cuerpo: { position: 'relative', marginTop: espacio.xs },
  etiquetaHora: { position: 'absolute', left: 0, ...cifras, fontFamily: fuentes.hora, fontSize: 11 },
  // La hora de ahora, en una píldora naranja en la columna de las horas.
  pildoraAhora: {
    position: 'absolute',
    left: 0,
    width: ANCHO_HORAS - 4,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.principal,
    zIndex: 1,
  },
  textoAhora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 10, color: colores.textoOscuro },
  columnas: { position: 'absolute', top: 0, left: ANCHO_HORAS, right: 0, flexDirection: 'row', gap: 3 },
  // Cada día es un carril redondeado; las horas, rayas muy suaves dentro. Hoy, en naranja suave.
  columna: { flex: 1, position: 'relative', borderRadius: 14, backgroundColor: colores.tarjeta, overflow: 'hidden' },
  columnaHoy: { backgroundColor: colores.acentoSuave },
  rayaHora: { position: 'absolute', left: 6, right: 6, height: 1, backgroundColor: colores.fondo },
  casillaHora: { position: 'absolute', left: 0, right: 0 },
  casillaPulsada: { backgroundColor: colores.elevado },
  // Citas como pastillas: fondo del color del tipo al 14 % y el texto en su color.
  bloque: {
    position: 'absolute',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  textoBloque: { fontSize: 12, lineHeight: 14, fontFamily: fuentes.textoFuerte, color: colores.texto },
  textoCompacto: { fontSize: 11, lineHeight: 13 },
  horaBloque: { fontSize: 11, lineHeight: 14, color: colores.textoSecundario, ...cifras },
  tachada: { textDecorationLine: 'line-through', color: colores.textoSecundario },
  ahora: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colores.principal },
  pulsado: { opacity: 0.7 },
});

