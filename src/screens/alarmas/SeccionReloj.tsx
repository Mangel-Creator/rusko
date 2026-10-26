import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Boton, Plegable, Tarjeta, Texto } from '@/components';
import { leerAdelantos, useAlarmas } from '@/data/alarmas';
import { useAlarmasReloj } from '@/data/alarmasReloj';
import { leerSalidas } from '@/data/salidas';
import { enlaceEjecutarAtajo, esWebDeIphone, HORA_AUTOMATIZACION, PASOS_ATAJO } from '@/services/alarmas/atajo';
import { alarmasParaReloj } from '@/services/alarmas/reloj';
import { crearEnlaceReloj, estadoRelojServidor, quitarEnlaceReloj } from '@/services/alarmas/relojServidor';
import { cuandoFue } from '@/services/fechas';
import { colores, espacio } from '@/theme';

// Alarmas en la web (26/10/2026): la web no puede sonar, pero un Atajo del iPhone las pasa
// cada noche al Reloj (que suena aunque el móvil esté en silencio). Aquí se crea el enlace
// personal que lee el Atajo, se copia y se explica cómo montarlo.
export function SeccionReloj() {
  const { alarmas, ajustes } = useAlarmas();
  const reloj = useAlarmasReloj();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ultimaLectura, setUltimaLectura] = useState<string | null | undefined>(undefined);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  // Cuándo leyó el Atajo las alarmas por última vez (para saber que funciona).
  useEffect(() => {
    if (!reloj.enlace) return;
    let vigente = true;
    estadoRelojServidor()
      .then((estado) => vigente && setUltimaLectura(estado?.ultimaLectura ?? null))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [reloj.enlace]);

  const crear = async () => {
    setOcupado(true);
    setMensaje(null);
    try {
      const [adelantos, salidas] = await Promise.all([leerAdelantos(), leerSalidas()]);
      const lista = alarmasParaReloj({
        ahora: new Date(),
        alarmas,
        adelantos,
        salidas: Object.values(salidas),
        eventosConAlarma: ajustes.salidas,
      });
      const enlace = await crearEnlaceReloj(lista);
      setMensaje(enlace ? 'Listo. Ahora copia tu enlace y crea el Atajo.' : 'Sin servidor no se puede.');
      setUltimaLectura(null);
    } catch {
      setMensaje('No he podido crear el enlace. Mira si tienes conexión y vuelve a probar.');
    }
    setOcupado(false);
  };

  const copiar = async () => {
    if (!reloj.enlace) return;
    try {
      await navigator.clipboard.writeText(reloj.enlace);
      setMensaje('Copiado. Pégalo en "Obtener contenido de URL" del Atajo.');
    } catch {
      setMensaje('No he podido copiarlo: mantén el dedo sobre el enlace de abajo y elige Copiar.');
    }
  };

  const quitar = async () => {
    setOcupado(true);
    try {
      await quitarEnlaceReloj();
      setMensaje('Hecho. Ya no se pasan al Reloj. Borra también la automatización en Atajos.');
    } catch {
      setMensaje('No he podido quitarlo. Mira si tienes conexión y vuelve a probar.');
    }
    setConfirmarQuitar(false);
    setOcupado(false);
  };

  return (
    <Tarjeta style={estilos.tarjeta}>
      <View style={estilos.cabecera}>
        <Ionicons name="alarm-outline" size={24} color={colores.principal} />
        <Texto fuerte style={estilos.flex}>
          {reloj.enlace ? 'Pasan cada noche al Reloj' : 'Que suenen en el Reloj del iPhone'}
        </Texto>
      </View>

      {!reloj.enlace ? (
        <>
          <Texto secundario>
            En la web no pueden sonar. Con un Atajo, cada noche a las {HORA_AUTOMATIZACION} se crean en
            el Reloj las de las 24 horas siguientes. Esas suenan aunque tengas el móvil en silencio.
          </Texto>
          <Texto pequeno secundario>
            Para eso guardo en el servidor la hora y el nombre de tus alarmas de los próximos 14 días.
          </Texto>
          <Boton titulo={ocupado ? 'Creando…' : 'Crear mi enlace'} disabled={ocupado} onPress={crear} />
        </>
      ) : (
        <>
          <Texto secundario>
            {ultimaLectura === undefined
              ? `A las ${HORA_AUTOMATIZACION}, el Atajo crea en el Reloj las de las 24 horas siguientes.`
              : ultimaLectura
                ? `El Atajo las pasó ${cuandoFue(new Date(ultimaLectura), new Date())}.`
                : 'El Atajo aún no las ha leído. Créalo con los pasos de abajo.'}
          </Texto>
          <Boton titulo="Copiar mi enlace" onPress={copiar} />
          {esWebDeIphone() ? (
            <Boton
              variante="secundario"
              titulo="Pasarlas ahora al Reloj"
              onPress={() => Linking.openURL(enlaceEjecutarAtajo()).catch(() => {})}
            />
          ) : null}
          <Texto pequeno secundario>
            Si cambias una alarma después de las {HORA_AUTOMATIZACION}, toca &quot;Pasarlas ahora al Reloj&quot;.
          </Texto>
        </>
      )}

      {mensaje ? (
        <Texto pequeno accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}

      <Plegable titulo="Cómo se crea el Atajo" resumen="Una sola vez, en la app Atajos">
        {PASOS_ATAJO.map((paso, i) => (
          <Texto key={i} pequeno>
            {i + 1}. {paso}
          </Texto>
        ))}
        <Texto pequeno secundario>
          Si al ejecutarse te pregunta si quieres borrar las alarmas, toca &quot;Permitir siempre&quot;.
        </Texto>
      </Plegable>

      {reloj.enlace ? (
        <Plegable titulo="Tu enlace" resumen="Verlo, cambiarlo o dejar de usarlo">
          <Texto pequeno selectable style={estilos.enlace}>
            {reloj.enlace}
          </Texto>
          <Texto pequeno secundario>
            Solo deja leer la hora y el nombre de tus alarmas. Si alguien lo consigue, cámbialo y
            pega el nuevo en el Atajo.
          </Texto>
          <Boton variante="secundario" titulo="Cambiar el enlace" disabled={ocupado} onPress={crear} />
          {confirmarQuitar ? (
            <>
              <Texto fuerte>¿Dejo de pasarlas al Reloj? Las que ya estén puestas se quedan.</Texto>
              <Boton titulo="Sí, dejar de pasarlas" disabled={ocupado} onPress={quitar} />
              <Boton variante="secundario" titulo="Mejor no" onPress={() => setConfirmarQuitar(false)} />
            </>
          ) : (
            <Boton variante="secundario" titulo="Dejar de pasarlas al Reloj" onPress={() => setConfirmarQuitar(true)} />
          )}
        </Plegable>
      ) : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
  enlace: { color: colores.textoSecundario },
});
