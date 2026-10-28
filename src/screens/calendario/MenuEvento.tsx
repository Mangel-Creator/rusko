import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Texto, Titulo } from '@/components';
import { marcarHecha, type Evento } from '@/data/eventos';
import { usePerfil } from '@/data/perfil';
import { duracionTarea, resolverLugar } from '@/services/agenda';
import { PREFIJO_EPOCA } from '@/services/epoca';
import { fechaDesdeClave, formatearDiaCorto, formatearDuracion, type ClaveDia } from '@/services/fechas';
import { acentos, alturaTactil, colorBaldosa, colores, espacio, radio } from '@/theme';

import { abrirEvento, ICONO_TIPO, rangoHoras } from './textos';

type Props = {
  // El evento tocado y el día en que se tocó (en una serie, cada repetición es un día).
  tocado: { evento: Evento; dia: ClaveDia } | null;
  alCerrar: () => void;
  // Borra el evento (Semana enseña después "Deshacer").
  alBorrar: (evento: Evento) => void;
};

// Al tocar algo en el calendario, como en Google Calendar: una hoja abajo con lo
// esencial y "Eliminar" a mano, sin tener que entrar en la ficha.
export function MenuEvento({ tocado, alCerrar, alBorrar }: Props) {
  const { perfil } = usePerfil();
  if (!tocado) return null;
  const { evento, dia } = tocado;
  const deEpoca = evento.id.startsWith(PREFIJO_EPOCA);
  const lugar = resolverLugar(evento.lugar, perfil);
  const cuando = evento.flexible
    ? `${formatearDiaCorto(fechaDesdeClave(dia))} · Tarea de ${formatearDuracion(duracionTarea(evento))}`
    : `${formatearDiaCorto(fechaDesdeClave(dia))} · ${rangoHoras(evento)}`;
  const baldosa = deEpoca ? colorBaldosa.estudio : colorBaldosa[evento.tipo];

  const abrir = () => {
    alCerrar();
    abrirEvento(evento.id);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={alCerrar}>
      <Pressable style={estilos.fondo} onPress={alCerrar} accessibilityLabel="Cerrar">
        {/* El toque dentro de la hoja no la cierra. */}
        <Pressable style={estilos.hoja} onPress={() => {}} accessible={false}>
          <View style={estilos.cabecera}>
            <View style={[estilos.icono, { backgroundColor: baldosa.fondo }]}>
              <Ionicons name={deEpoca ? 'book-outline' : ICONO_TIPO[evento.tipo]} size={20} color={baldosa.icono} />
            </View>
            <View style={estilos.textos}>
              <Titulo nivel={3} numberOfLines={2}>
                {evento.titulo || 'Sin título'}
              </Titulo>
              <Texto pequeno secundario>
                {cuando}
              </Texto>
              {lugar ? (
                <Texto pequeno secundario numberOfLines={1}>
                  {lugar.nombre ?? lugar.direccion}
                </Texto>
              ) : null}
            </View>
          </View>

          {deEpoca ? (
            <Texto pequeno secundario>Es de tu plan de estudio: se cambia desde la Época.</Texto>
          ) : evento.repeticion !== 'nunca' ? (
            <Texto pequeno secundario>Se repite: eliminar quita toda la serie.</Texto>
          ) : evento.origen ? (
            <Texto pequeno secundario>Viene de otro calendario: si sigue allí, volverá a traerse.</Texto>
          ) : null}

          <View style={estilos.botones}>
            <BotonHoja icono="open-outline" texto={deEpoca ? 'Ver la época' : 'Abrir'} onPress={abrir} />
            {evento.flexible && !deEpoca ? (
              <BotonHoja
                icono={evento.hecha ? 'square-outline' : 'checkbox-outline'}
                texto={evento.hecha ? 'Sin hacer' : 'Hecha'}
                onPress={() => {
                  alCerrar();
                  marcarHecha(evento.id, !evento.hecha);
                }}
              />
            ) : null}
            {!deEpoca ? (
              <BotonHoja
                icono="trash-outline"
                texto="Eliminar"
                peligro
                onPress={() => {
                  alCerrar();
                  alBorrar(evento);
                }}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type PropsBoton = {
  icono: ComponentProps<typeof Ionicons>['name'];
  texto: string;
  onPress: () => void;
  peligro?: boolean;
};

function BotonHoja({ icono, texto, onPress, peligro }: PropsBoton) {
  const color = peligro ? colores.aviso : colores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [estilos.boton, peligro && estilos.botonPeligro, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={18} color={color} />
      <Texto fuerte style={{ color }}>
        {texto}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  hoja: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: espacio.m,
    padding: espacio.l,
    paddingBottom: espacio.xl,
    backgroundColor: colores.tarjeta,
    borderTopLeftRadius: radio.grande,
    borderTopRightRadius: radio.grande,
  },
  cabecera: { flexDirection: 'row', gap: espacio.m, alignItems: 'flex-start' },
  icono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: alturaTactil,
    paddingHorizontal: espacio.m,
    borderRadius: radio.chip,
    backgroundColor: colores.elevado,
  },
  botonPeligro: { backgroundColor: acentos.rojo.suave },
  pulsado: { transform: [{ scale: 0.97 }] },
});
