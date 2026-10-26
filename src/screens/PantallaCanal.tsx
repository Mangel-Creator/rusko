import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, type ScrollViewInstance, StyleSheet, TextInput, View } from 'react-native';

import { Pantalla, Texto, Titulo } from '@/components';
import type { DatosEmpresa, MensajeChat } from '@/data/empresa';
import { actualizarEmpresa, marcarCanalLeidoAqui } from '@/services/empresa';
import { motivoDe } from '@/services/empresa/base';
import { agruparMensajes, nombreAutor, nombreCanal, otraPersona, textoDia } from '@/services/empresa/chat';
import { personasDe } from '@/services/empresa/roles';
import { borrarMensaje, enviarMensaje, escucharCanal, leerMensajes } from '@/services/empresa/servidor';
import { textoFallo } from '@/services/empresa/textos';
import { claveDia, formatearHora } from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { BotonVolver, Confirmar, Mensaje, useDatosEmpresa } from './empresa/piezas';

// /empresa-canal?id=…: una conversación del chat de empresa (General, un equipo o un chat
// privado). Los mensajes llegan al momento (Supabase Realtime) y, por si acaso, se miran
// cada 15 segundos. Lo mío, a la derecha en tinta; lo de los demás, a la izquierda.

export function PantallaCanal() {
  const datos = useDatosEmpresa();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const canal = datos?.canales.find((c) => c.id === id) ?? null;
  if (!datos || !canal) {
    return (
      <Pantalla>
        <BotonVolver texto="Chat" destino="/empresa-chat" />
        <Texto secundario>{datos ? 'Esta conversación ya no está.' : 'Aún no estás dentro de una empresa.'}</Texto>
      </Pantalla>
    );
  }
  return <Conversacion key={canal.id} datos={datos} canalId={canal.id} />;
}

function Conversacion({ datos, canalId }: { datos: DatosEmpresa; canalId: string }) {
  const canal = datos.canales.find((c) => c.id === canalId)!;
  const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<MensajeChat | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const hoy = claveDia(new Date());

  const cargar = useCallback(async () => {
    try {
      const nuevos = await leerMensajes(canalId);
      setMensajes(nuevos);
      setError(null);
      marcarCanalLeidoAqui(canalId);
    } catch (e) {
      setError(textoFallo(motivoDe(e)));
    }
  }, [canalId]);

  // Al entrar, al llegar un mensaje y cada 15 s. Al salir, se ponen al día los "sin leer".
  useFocusEffect(
    useCallback(() => {
      cargar();
      const parar = escucharCanal(canalId, cargar);
      const cada = setInterval(cargar, 15000);
      return () => {
        parar();
        clearInterval(cada);
        actualizarEmpresa();
      };
    }, [canalId, cargar]),
  );

  // Siempre abajo del todo, en lo último.
  useEffect(() => {
    if (mensajes) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
  }, [mensajes]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      await enviarMensaje(datos.empresa.id, canalId, limpio);
      setTexto('');
      await cargar();
    } catch (e) {
      setError(textoFallo(motivoDe(e)));
    }
    setEnviando(false);
  };

  const quienes =
    canal.tipo === 'privado'
      ? 'Solo lo leéis los dos.'
      : `${personasDe(datos, canal.tipo === 'equipo' ? canal.equipoId : null).length} personas`;

  return (
    <View style={estilos.contenedor}>
      <Pantalla ref={scroll} contentContainerStyle={estilos.contenido}>
        <BotonVolver texto="Chat" destino="/empresa-chat" />
        <View>
          <Titulo>{nombreCanal(datos, canal)}</Titulo>
          <Texto secundario>{canal.tipo === 'privado' ? `Chat privado · ${quienes}` : `Canal · ${quienes}`}</Texto>
        </View>

        {mensajes === null ? <Texto secundario>Cargando…</Texto> : null}
        {mensajes?.length === 0 ? (
          <Texto secundario>
            {canal.tipo === 'privado'
              ? `Escríbele a ${nombreAutor(datos, otraPersona(datos, canal))}.`
              : 'Aún no hay mensajes. Rompe el hielo.'}
          </Texto>
        ) : null}

        {agruparMensajes(mensajes ?? []).map((tramo) => (
          <View key={tramo.dia} style={estilos.tramo}>
            <Texto pequeno secundario style={estilos.dia}>
              {textoDia(tramo.dia, hoy)}
            </Texto>
            {tramo.burbujas.map(({ mensaje, primeroDelGrupo }) => {
              const mio = mensaje.autor === datos.yo;
              return (
                <View key={mensaje.id} style={[estilos.fila, mio ? estilos.filaMia : null, primeroDelGrupo && estilos.separada]}>
                  {primeroDelGrupo && !mio ? (
                    <Texto pequeno fuerte style={estilos.autor}>
                      {nombreAutor(datos, mensaje.autor)}
                    </Texto>
                  ) : null}
                  <Pressable
                    accessibilityRole={mio && !mensaje.borrado ? 'button' : undefined}
                    accessibilityLabel={`${mio ? 'Tú' : nombreAutor(datos, mensaje.autor)}, ${formatearHora(new Date(mensaje.creado))}: ${mensaje.borrado ? 'mensaje borrado' : mensaje.texto}`}
                    disabled={!mio || mensaje.borrado}
                    onLongPress={() => setBorrar(mensaje)}
                    onPress={() => setBorrar(mensaje)}
                    style={[estilos.burbuja, mio ? estilos.burbujaMia : estilos.burbujaOtra]}>
                    <Texto style={[mio && estilos.textoMio, mensaje.borrado && estilos.borrado]}>
                      {mensaje.borrado ? 'Mensaje borrado' : mensaje.texto}
                    </Texto>
                    <Texto pequeno style={[estilos.hora, mio && estilos.horaMia]}>
                      {formatearHora(new Date(mensaje.creado))}
                    </Texto>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}

        {borrar ? (
          <Confirmar
            texto="¿Borrar este mensaje? Los demás verán «Mensaje borrado»."
            si="Borrar el mensaje"
            alSi={async () => {
              const m = borrar;
              setBorrar(null);
              try {
                await borrarMensaje(m.id);
                await cargar();
              } catch (e) {
                setError(textoFallo(motivoDe(e)));
              }
            }}
            alNo={() => setBorrar(null)}
          />
        ) : null}
        <Mensaje texto={error} />

        <View style={estilos.escribir}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={canal.tipo === 'privado' ? 'Escribe un mensaje' : `Escribe en ${nombreCanal(datos, canal)}`}
            placeholderTextColor={colores.textoSecundario}
            multiline
            maxLength={2000}
            style={estilos.campo}
            accessibilityLabel="Mensaje"
            onSubmitEditing={enviar}
            blurOnSubmit={false}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            disabled={!texto.trim() || enviando}
            onPress={enviar}
            style={({ pressed }) => [estilos.enviar, (!texto.trim() || enviando) && estilos.apagado, pressed && estilos.pulsado]}>
            <Ionicons name="send" size={20} color={colores.textoSobrePrincipal} />
          </Pressable>
        </View>
      </Pantalla>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  contenido: { paddingBottom: espacio.xl },
  tramo: { gap: 3 },
  dia: { alignSelf: 'center', marginVertical: espacio.s },
  fila: { alignItems: 'flex-start', maxWidth: '100%' },
  filaMia: { alignItems: 'flex-end' },
  separada: { marginTop: espacio.s },
  autor: { marginLeft: espacio.xs, marginBottom: 2, color: colores.textoSecundario },
  burbuja: {
    maxWidth: '85%',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.grande,
    gap: 2,
  },
  burbujaMia: { backgroundColor: colores.tinta },
  burbujaOtra: { backgroundColor: colores.tarjeta, borderLeftWidth: 3, borderLeftColor: colores.empresa },
  textoMio: { color: colores.textoSobreTinta },
  borrado: { fontStyle: 'italic', color: colores.textoSecundario },
  hora: { ...cifras, fontFamily: fuentes.hora, fontSize: 11, color: colores.textoSecundario, alignSelf: 'flex-end' },
  horaMia: { color: colores.textoSecundarioSobreTinta },
  escribir: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s, marginTop: espacio.m },
  campo: {
    flex: 1,
    minHeight: alturaTactil,
    maxHeight: 140,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.pequeno,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.tarjeta,
    fontFamily: fuentes.texto,
    fontSize: tamanos.normal,
    color: colores.texto,
  },
  enviar: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.normal,
    backgroundColor: colores.principal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apagado: { backgroundColor: colores.cargaNormal },
  pulsado: { transform: [{ scale: 0.95 }] },
});
