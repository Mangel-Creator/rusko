import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Texto, Titulo } from '@/components';
import { borrarEpocasDeEjemplo, crearEpocaDeEjemplo, useEpocas, type Epoca } from '@/data/epocas';
import { cuentaAtras, diasEntre, estadoEpoca, resumenEpoca, textoHoras, textoQuedan } from '@/services/epoca';
import { claveDia, fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';
import { alturaTactil, colores, espacio, radio } from '@/theme';

import { useAhora } from '../calendario/useAhora';
import { NOMBRE_TIPO } from '../epoca/textos';

// Perfil > Épocas doradas: la activa, las programadas y las pasadas.
// Al tocar una se abre su sección (/epoca). La lógica está en services/epoca.

function dia(clave: ClaveDia): string {
  return formatearDiaCorto(fechaDesdeClave(clave));
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function SeccionEpocas() {
  const ahora = useAhora();
  const hoy = claveDia(ahora);
  const { cargado, epocas, registro } = useEpocas();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const deEstado = (estado: ReturnType<typeof estadoEpoca>) =>
    epocas.filter((e) => estadoEpoca(e, hoy) === estado);
  const activas = deEstado('activa').sort((a, b) => a.inicio.localeCompare(b.inicio));
  const programadas = deEstado('programada').sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pasadas = deEstado('pasada').sort((a, b) => b.fin.localeCompare(a.fin));

  // Una línea de detalle distinta según el estado de la época.
  const detalle = (epoca: Epoca): string[] => {
    const fechas = `${dia(epoca.inicio)} – ${dia(epoca.fin)}`;
    const estado = estadoEpoca(epoca, hoy);
    if (estado === 'activa') {
      const cuenta = cuentaAtras(epoca, ahora);
      return [`${fechas} · ${textoQuedan(epoca, hoy)}`, ...(cuenta ? [cuenta.texto] : [])];
    }
    if (estado === 'programada') {
      const dias = diasEntre(hoy, epoca.inicio);
      const empieza = dias === 1 ? 'empieza mañana' : `empieza en ${dias} días`;
      return [`${fechas} · ${empieza}`, plural(epoca.hitos.length, 'hito', 'hitos')];
    }
    const r = resumenEpoca(epoca, registro, hoy);
    return [
      fechas,
      `${textoHoras(r.minutosHechos)} de trabajo · ${plural(r.bloquesHechos, 'bloque hecho', 'bloques hechos')}`,
      `${r.hitosSuperados} de ${r.hitosTotal} ${r.hitosTotal === 1 ? 'hito superado' : 'hitos superados'}`,
    ];
  };

  const fila = (epoca: Epoca) => {
    const activa = estadoEpoca(epoca, hoy) === 'activa';
    const lineas = detalle(epoca);
    return (
      <Pressable
        key={epoca.id}
        accessibilityRole="button"
        accessibilityLabel={`${epoca.nombre}, ${NOMBRE_TIPO[epoca.tipo]}. ${lineas.join('. ')}`}
        accessibilityHint="Abre la época"
        onPress={() => router.push({ pathname: '/epoca', params: { id: epoca.id } })}
        style={({ pressed }) => [estilos.fila, activa && estilos.filaActiva, pressed && estilos.pulsado]}>
        {activa ? <View style={estilos.marca} /> : null}
        <View style={estilos.textos}>
          <Texto fuerte>{epoca.nombre}</Texto>
          <Texto pequeno secundario>
            {NOMBRE_TIPO[epoca.tipo]}
            {epoca.ejemplo ? ' · de ejemplo' : ''}
          </Texto>
          {lineas.map((linea) => (
            <Texto key={linea} pequeno secundario={!activa}>
              {linea}
            </Texto>
          ))}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colores.textoSecundario} />
      </Pressable>
    );
  };

  const grupo = (titulo: string, lista: Epoca[]) =>
    lista.length > 0 ? (
      <View style={estilos.grupo}>
        <Titulo nivel={3}>{titulo}</Titulo>
        {lista.map(fila)}
      </View>
    ) : null;

  return (
    <>
      <Texto secundario>
        Para épocas de exámenes o de trabajo intenso: un plan de estudio día a día. Si es Época dorada,
        mientras dura la app usa el ritmo de la época y al terminar vuelve sola a tu ritmo de siempre.
      </Texto>

      {cargado && epocas.length === 0 ? (
        <Texto secundario>Todavía no tienes ningún plan de estudio.</Texto>
      ) : null}

      {grupo('Activa', activas)}
      {grupo('Programadas', programadas)}
      {grupo('Pasadas', pasadas)}

      <Boton titulo="Nuevo plan de estudio" onPress={() => router.push('/epoca-editar')} />

      <Texto secundario style={estilos.separado}>
        Una época de ejemplo con tres exámenes, para probar el modo sin rellenar nada.
        {__DEV__ ? ' En modo desarrollo se crea sola la primera vez.' : ''} Tus épocas no se tocan.
      </Texto>
      <Boton
        variante="secundario"
        titulo="Crear época de ejemplo"
        onPress={async () => {
          await crearEpocaDeEjemplo();
          setMensaje('Creada la época de ejemplo.');
        }}
      />
      <Boton
        variante="secundario"
        titulo="Borrar época de ejemplo"
        onPress={async () => {
          const n = await borrarEpocasDeEjemplo();
          setMensaje(n === 0 ? 'No había ninguna época de ejemplo.' : 'Borrada la época de ejemplo.');
        }}
      />
      {mensaje ? (
        <Texto fuerte accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: alturaTactil,
    padding: espacio.m,
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
    borderWidth: 1,
    borderColor: colores.borde,
    overflow: 'hidden',
  },
  // La activa lleva el borde y una barra dorada a la izquierda (el dorado es solo de este modo).
  filaActiva: { borderColor: colores.dorado, borderWidth: 2, paddingLeft: espacio.m + espacio.xs },
  marca: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: espacio.s,
    backgroundColor: colores.dorado,
  },
  textos: { flex: 1, gap: 2 },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  separado: { marginTop: espacio.s },
});
