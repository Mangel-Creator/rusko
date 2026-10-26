import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components';
import { useDensidad } from '@/data/densidad';
import type { Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { resolverLugar } from '@/services/agenda';
import { cifras, colorBaldosa, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { abrirEvento, ICONO_TIPO } from './textos';

type Props = {
  evento: Evento;
  pasado?: boolean; // ya ha terminado: sin fondo y con el texto en gris
  focoEnNegro?: boolean; // en Semana, los bloques de foco van destacados con "Protegido"
};

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

// Un evento con hora fija, como una fila de movimientos: icono redondo del color de su
// tipo a la izquierda, título y lugar en el centro y la hora, grande, a la derecha.
// Al pulsarlo se abre su ficha.
export function FilaEvento({ evento, pasado, focoEnNegro }: Props) {
  const { perfil } = usePerfil();
  const { medidas } = useDensidad();
  const textoFila = { fontSize: medidas.texto, lineHeight: medidas.interlineado };
  const negro = focoEnNegro && evento.foco;
  const apagado = pasado && !negro;
  const lugar = resolverLugar(evento.lugar, perfil);
  const detalle = [lugar?.nombre ?? lugar?.direccion, evento.foco && !negro ? 'Bloque de foco' : null]
    .filter(Boolean)
    .join(' · ');
  const baldosa = colorBaldosa[evento.tipo];
  const icono: NombreIcono = negro ? 'lock-closed-outline' : ICONO_TIPO[evento.tipo];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${evento.horaInicio}, ${evento.titulo}${negro ? ', protegido' : ''}`}
      onPress={() => abrirEvento(evento.id)}
      style={({ pressed }) => [
        estilos.fila,
        { minHeight: medidas.altoFila, paddingVertical: medidas.rellenoFila },
        negro && estilos.filaFoco,
        apagado && estilos.pasado,
        pressed && estilos.pulsado,
      ]}>
      <View style={[estilos.icono, { backgroundColor: apagado ? colores.elevado : negro ? colores.acentoSuave : baldosa.fondo }]}>
        <Ionicons
          name={icono}
          size={20}
          color={apagado ? colores.textoSecundario : negro ? colores.principal : baldosa.icono}
        />
      </View>
      <View style={estilos.textos}>
        <Texto fuerte style={[textoFila, apagado && estilos.textoApagado]} numberOfLines={2}>
          {evento.titulo}
        </Texto>
        {negro ? (
          <Texto pequeno style={estilos.protegido}>
            Protegido
          </Texto>
        ) : null}
        {detalle ? (
          <Texto pequeno secundario numberOfLines={1}>
            {detalle}
          </Texto>
        ) : null}
      </View>
      <View style={estilos.horas}>
        <Texto style={[estilos.hora, apagado && estilos.textoApagado]}>{evento.horaInicio}</Texto>
        <View style={estilos.fin}>
          {evento.repeticion !== 'nunca' ? <Ionicons name="repeat" size={13} color={colores.textoSecundario} /> : null}
          <Texto pequeno secundario style={estilos.horaFin}>
            {evento.horaFin}
          </Texto>
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m - 4,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande - 4,
  },
  // Bloque de foco en Semana: en naranja suave, con el candado.
  filaFoco: { backgroundColor: colores.acentoSuave },
  // Sin opacidad: así el texto sigue pasando el contraste mínimo.
  pasado: { backgroundColor: 'transparent' },
  textoApagado: { color: colores.textoSecundario },
  pulsado: { backgroundColor: colores.elevado, transform: [{ scale: 0.99 }] },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  protegido: { color: colores.principal, fontFamily: fuentes.textoMedio },
  // La hora es la "cifra" de la fila: grande, gruesa y alineada a la derecha.
  horas: { alignItems: 'flex-end', gap: 2 },
  hora: { ...cifras, fontFamily: fuentes.horaFuerte, fontSize: tamanos.grande, lineHeight: 22, letterSpacing: -0.3 },
  fin: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  horaFin: { ...cifras, fontFamily: fuentes.hora },
});
