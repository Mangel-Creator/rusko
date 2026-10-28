import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import type { Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { PREFIJO_EPOCA } from '@/services/epoca';
import { DIAS_SEMANA_LETRA, fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';
import { festivoDelDia } from '@/services/festivos';
import { acentos, cifras, colorBaldosa, colores, colorEvento, fuentes, radio } from '@/theme';

export type DiaMes = {
  dia: ClaveDia;
  cosas: Evento[]; // citas por orden de hora y, detrás, tareas sin hora
  hayHito: boolean;
};

type Props = {
  dias: DiaMes[]; // semanas enteras, de lunes a domingo
  mes: number; // 0-11: los días de otros meses van apagados
  hoy: ClaveDia;
  alTocarDia: (dia: ClaveDia) => void;
};

const MAXIMO_A_LA_VISTA = 3;

// El mes entero, semana a semana. Cada día enseña sus primeras cosas en pastillas
// del color de su tipo (y "+2" si hay más); al tocarlo se abre ese día en "Día".
export function RejillaMes({ dias, mes, hoy, alTocarDia }: Props) {
  const { perfil } = usePerfil();
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.fila}>
        {DIAS_SEMANA_LETRA.map((letra) => (
          <Texto key={letra} pequeno style={estilos.letra}>
            {letra}
          </Texto>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0].dia} style={estilos.fila}>
          {semana.map(({ dia, cosas, hayHito }) => {
            const fecha = fechaDesdeClave(dia);
            const esHoy = dia === hoy;
            const delMes = fecha.getMonth() === mes;
            const festivo = festivoDelDia(dia, perfil?.festivos);
            // Un festivo ocupa una de las líneas: su nombre, en azul, va primero.
            const caben = festivo ? MAXIMO_A_LA_VISTA - 1 : MAXIMO_A_LA_VISTA;
            const sobran = cosas.length - caben;
            return (
              <Pressable
                key={dia}
                accessibilityRole="button"
                accessibilityLabel={`${formatearDiaCorto(fecha)}, ${cosas.length === 0 ? 'libre' : `${cosas.length} ${cosas.length === 1 ? 'cosa' : 'cosas'}`}${festivo ? `, festivo: ${festivo.nombre}` : ''}`}
                onPress={() => alTocarDia(dia)}
                style={({ pressed }) => [
                  estilos.celda,
                  !delMes && estilos.celdaFuera,
                  esHoy && estilos.celdaHoy,
                  pressed && estilos.pulsado,
                ]}>
                <View style={estilos.cabeceraCelda}>
                  <View style={[estilos.numero, festivo && estilos.numeroFestivo, esHoy && estilos.numeroHoy]}>
                    <Texto
                      style={[
                        estilos.numeroTexto,
                        !delMes && estilos.textoFuera,
                        festivo && estilos.textoFestivo,
                        esHoy && estilos.textoHoy,
                      ]}>
                      {fecha.getDate()}
                    </Texto>
                  </View>
                  {hayHito ? <View style={estilos.marcaHito} /> : null}
                </View>
                {festivo ? (
                  <View style={[estilos.pastilla, estilos.pastillaFestivo]}>
                    <Texto numberOfLines={1} style={[estilos.textoPastilla, estilos.textoFestivo]}>
                      {festivo.nombre}
                    </Texto>
                  </View>
                ) : null}
                {cosas.slice(0, caben).map((cosa) => {
                  const deEpoca = cosa.id.startsWith(`${PREFIJO_EPOCA}bloque:`);
                  return (
                    <View
                      key={cosa.id}
                      style={[
                        estilos.pastilla,
                        { backgroundColor: deEpoca ? colorBaldosa.estudio.fondo : colorBaldosa[cosa.tipo].fondo },
                      ]}>
                      <Texto
                        numberOfLines={1}
                        style={[
                          estilos.textoPastilla,
                          { color: deEpoca ? colores.dorado : colorEvento(cosa) },
                          cosa.hecha && estilos.tachada,
                        ]}>
                        {cosa.titulo}
                      </Texto>
                    </View>
                  );
                })}
                {sobran > 0 ? <Texto style={estilos.mas}>+{sobran}</Texto> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: 3 },
  fila: { flexDirection: 'row', gap: 3 },
  letra: { flex: 1, textAlign: 'center', color: colores.textoSecundario, fontSize: 11, paddingBottom: 2 },
  // Cada día, una caja redondeada; los de otros meses, sin fondo.
  celda: {
    flex: 1,
    minHeight: 84,
    gap: 2,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colores.tarjeta,
    overflow: 'hidden',
  },
  celdaFuera: { backgroundColor: 'transparent' },
  celdaHoy: { backgroundColor: colores.acentoSuave },
  cabeceraCelda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numero: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  numeroHoy: { backgroundColor: colores.principal },
  numeroFestivo: { backgroundColor: acentos.azul.suave },
  numeroTexto: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: 13, lineHeight: 16, color: colores.texto },
  textoFuera: { color: colores.textoSecundario },
  textoFestivo: { color: acentos.azul.color },
  textoHoy: { color: colores.textoOscuro },
  marcaHito: { width: 6, height: 6, borderRadius: 3, marginRight: 2, backgroundColor: colores.dorado },
  pastilla: { borderRadius: radio.chip, paddingHorizontal: 3, paddingVertical: 1 },
  pastillaFestivo: { backgroundColor: acentos.azul.suave },
  textoPastilla: { fontSize: 9, lineHeight: 12, fontFamily: fuentes.textoFuerte },
  tachada: { textDecorationLine: 'line-through' },
  mas: { fontSize: 9, lineHeight: 11, color: colores.textoSecundario, fontFamily: fuentes.textoFuerte, paddingLeft: 3 },
  pulsado: { opacity: 0.7 },
});
