import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Pantalla, Texto, Titulo } from '@/components';
import type { CanalChat, DatosEmpresa } from '@/data/empresa';
import { actualizarEmpresa } from '@/services/empresa';
import { motivoDe } from '@/services/empresa/base';
import { canalesDeGrupo, chatsPrivados, nombreCanal, vistaPrevia } from '@/services/empresa/chat';
import { nombreDe, personasDe } from '@/services/empresa/roles';
import { abrirPrivado } from '@/services/empresa/servidor';
import { textoFallo } from '@/services/empresa/textos';
import { claveDia, formatearHora } from '@/services/fechas';
import { alturaTactil, cifras, colorBaldosa, colores, espacio, fuentes, radio } from '@/theme';

import { BotonVolver, Chip, Chips, Mensaje, useDatosEmpresa } from './empresa/piezas';

// /empresa-chat: el chat de la empresa, como en Teams. Arriba los canales (General, para
// toda la empresa, y uno por equipo) y debajo los chats privados entre dos personas.

export function PantallaChat() {
  const datos = useDatosEmpresa();
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al entrar, los "sin leer" al día.
  useFocusEffect(
    useCallback(() => {
      actualizarEmpresa();
    }, []),
  );

  if (!datos) {
    return (
      <Pantalla>
        <BotonVolver />
        <Texto secundario>Aún no estás dentro de una empresa.</Texto>
      </Pantalla>
    );
  }

  const privados = chatsPrivados(datos);
  const gente = personasDe(datos, null).filter((m) => m.usuario !== datos.yo);

  const abrirCon = async (persona: string) => {
    setError(null);
    try {
      const id = await abrirPrivado(persona);
      setNuevo(false);
      await actualizarEmpresa();
      router.push({ pathname: '/empresa-canal', params: { id } });
    } catch (e) {
      setError(textoFallo(motivoDe(e)));
    }
  };

  return (
    <Pantalla>
      <BotonVolver />
      <Titulo>Chat</Titulo>

      <Titulo nivel={2}>Canales</Titulo>
      {canalesDeGrupo(datos).map((c) => (
        <FilaCanal key={c.id} datos={datos} canal={c} />
      ))}

      <View style={estilos.cabecera}>
        <Titulo nivel={2} style={estilos.flex}>
          Chats
        </Titulo>
        {gente.length > 0 ? (
          <Boton variante="secundario" titulo={nuevo ? 'Cancelar' : 'Nuevo chat'} onPress={() => setNuevo((n) => !n)} />
        ) : null}
      </View>
      {nuevo ? (
        <>
          <Texto pequeno secundario>
            ¿Con quién? Solo lo leeréis vosotros dos.
          </Texto>
          <Chips>
            {gente.map((m) => (
              <Chip key={m.usuario} texto={nombreDe(m)} elegido={false} onPress={() => abrirCon(m.usuario)} />
            ))}
          </Chips>
        </>
      ) : null}
      <Mensaje texto={error} />
      {privados.length === 0 && !nuevo ? (
        <Texto secundario>Aún no tienes chats privados. Con «Nuevo chat» hablas con alguien a solas.</Texto>
      ) : null}
      {privados.map((c) => (
        <FilaCanal key={c.id} datos={datos} canal={c} />
      ))}
      <Texto pequeno secundario style={estilos.nota}>
        Los mensajes se guardan en el servidor de Organizy y se borran solos a los 180 días. Los chats privados solo los
        leéis los dos: tampoco el jefe.
      </Texto>
    </Pantalla>
  );
}

function FilaCanal({ datos, canal }: { datos: DatosEmpresa; canal: CanalChat }) {
  const nombre = nombreCanal(datos, canal);
  const hoy = claveDia(new Date());
  const cuando = canal.ultimo
    ? claveDia(new Date(canal.ultimo.el)) === hoy
      ? formatearHora(new Date(canal.ultimo.el))
      : new Date(canal.ultimo.el).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nombre}${canal.sinLeer ? `, ${canal.sinLeer} sin leer` : ''}. ${vistaPrevia(datos, canal)}`}
      onPress={() => router.push({ pathname: '/empresa-canal', params: { id: canal.id } })}
      style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}>
      <View style={estilos.icono}>
        {canal.tipo === 'privado' ? (
          <Texto fuerte style={estilos.inicial}>
            {nombre.slice(0, 1).toUpperCase()}
          </Texto>
        ) : (
          <Ionicons name={canal.tipo === 'general' ? 'megaphone-outline' : 'people-outline'} size={20} color={colorBaldosa.empresa.icono} />
        )}
      </View>
      <View style={estilos.textos}>
        <View style={estilos.linea}>
          <Texto fuerte numberOfLines={1} style={estilos.flex}>
            {nombre}
          </Texto>
          <Texto pequeno secundario style={estilos.hora}>
            {cuando}
          </Texto>
        </View>
        <View style={estilos.linea}>
          <Texto pequeno secundario numberOfLines={1} style={[estilos.flex, canal.sinLeer > 0 && estilos.sinLeerTexto]}>
            {vistaPrevia(datos, canal)}
          </Texto>
          {canal.sinLeer > 0 ? (
            <View style={estilos.globo}>
              <Texto pequeno style={estilos.globoTexto}>
                {canal.sinLeer > 99 ? '99+' : canal.sinLeer}
              </Texto>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.s },
  nota: { marginTop: espacio.m },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: alturaTactil + 20,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    backgroundColor: colores.tarjeta,
    borderLeftWidth: 4,
    borderLeftColor: colores.empresa,
  },
  pulsado: { opacity: 0.75 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.normal,
    backgroundColor: colorBaldosa.empresa.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: colorBaldosa.empresa.icono },
  textos: { flex: 1, gap: 2 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  hora: { ...cifras, fontFamily: fuentes.hora },
  sinLeerTexto: { color: colores.texto, fontFamily: fuentes.textoMedio },
  globo: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radio.chip,
    backgroundColor: colores.principal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globoTexto: { color: colores.textoSobrePrincipal, fontFamily: fuentes.textoFuerte, lineHeight: 16 },
});
