import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton, Plegable, Texto } from '@/components';
import { useSiri } from '@/data/siri';
import { cuandoFue } from '@/services/fechas';
import {
  crearEnlaceSiri,
  estadoSiriServidor,
  NOMBRE_ALARMA,
  NOMBRE_APUNTAR,
  PASOS_ALARMA,
  PASOS_APUNTAR,
  quitarEnlaceSiri,
} from '@/services/siri';
import { colores } from '@/theme';

// Perfil > Siri (27/10/2026): el enlace personal de los Atajos "Apunta en Rusko" y
// "Alarma en Rusko" y cómo se crean. Lo dicho espera en el servidor hasta que Rusko lo
// recoge (services/siri).
export function SeccionSiri() {
  const siri = useSiri();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ultimoUso, setUltimoUso] = useState<string | null | undefined>(undefined);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  // Cuándo se usó por última vez (para saber que los Atajos funcionan).
  useEffect(() => {
    if (!siri.enlace) return;
    let vigente = true;
    estadoSiriServidor()
      .then((estado) => vigente && setUltimoUso(estado?.ultimoUso ?? null))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [siri.enlace]);

  const crear = async () => {
    setOcupado(true);
    setMensaje(null);
    try {
      const enlace = await crearEnlaceSiri();
      setMensaje(enlace ? 'Listo. Ahora copia tu enlace y crea los Atajos.' : 'Sin servidor no se puede.');
      setUltimoUso(null);
    } catch {
      setMensaje('No he podido crear el enlace. Mira si tienes conexión y vuelve a probar.');
    }
    setOcupado(false);
  };

  const copiar = async () => {
    if (!siri.enlace) return;
    try {
      await navigator.clipboard.writeText(siri.enlace);
      setMensaje('Copiado. Pégalo en "Obtener contenido de URL" de los dos Atajos.');
    } catch {
      setMensaje('No he podido copiarlo: mantén el dedo sobre el enlace de abajo y elige Copiar.');
    }
  };

  const quitar = async () => {
    setOcupado(true);
    try {
      await quitarEnlaceSiri();
      setMensaje('Hecho. Los Atajos ya no apuntan nada. Bórralos también en la app Atajos.');
    } catch {
      setMensaje('No he podido quitarlo. Mira si tienes conexión y vuelve a probar.');
    }
    setConfirmarQuitar(false);
    setOcupado(false);
  };

  return (
    <>
      <Texto secundario>
        Dile a Siri &quot;{NOMBRE_APUNTAR}&quot; y luego lo que sea, por ejemplo «mañana pádel por la tarde».
        O &quot;{NOMBRE_ALARMA}&quot; y la hora: la alarma se pone en el Reloj y también aquí.
      </Texto>
      <Texto pequeno secundario>
        Siri no puede hablar con Rusko directamente, así que lo que le digas espera en el servidor hasta
        que abras Rusko. Entonces lo apunto y se borra de allí (si no, a los 7 días).
      </Texto>

      {!siri.enlace ? (
        <Boton titulo={ocupado ? 'Creando…' : 'Crear mi enlace'} disabled={ocupado} onPress={crear} />
      ) : (
        <>
          <Texto secundario>
            {ultimoUso === undefined
              ? 'Tus Atajos usan este enlace.'
              : ultimoUso
                ? `Lo último que le dijiste a Siri llegó ${cuandoFue(new Date(ultimoUso), new Date())}.`
                : 'Aún no ha llegado nada de Siri. Crea los Atajos con los pasos de abajo.'}
          </Texto>
          <Boton titulo="Copiar mi enlace" onPress={copiar} />
        </>
      )}

      {mensaje ? (
        <Texto pequeno accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}

      <Plegable titulo={`Atajo "${NOMBRE_APUNTAR}"`} resumen="Una sola vez, en la app Atajos">
        {PASOS_APUNTAR.map((paso, i) => (
          <Texto key={i} pequeno>
            {i + 1}. {paso}
          </Texto>
        ))}
      </Plegable>

      <Plegable titulo={`Atajo "${NOMBRE_ALARMA}"`} resumen="Una sola vez, en la app Atajos">
        {PASOS_ALARMA.map((paso, i) => (
          <Texto key={i} pequeno>
            {i + 1}. {paso}
          </Texto>
        ))}
        <Texto pequeno secundario>
          Si Siri no entiende &quot;Rusko&quot;, cambia el nombre del Atajo por otro que te salga mejor: Siri lo
          ejecuta diciendo su nombre.
        </Texto>
      </Plegable>

      {siri.enlace ? (
        <Plegable titulo="Tu enlace" resumen="Verlo, cambiarlo o dejar de usarlo">
          <Texto pequeno selectable style={estilos.enlace}>
            {siri.enlace}
          </Texto>
          <Texto pequeno secundario>
            Con él se pueden apuntar cosas en tu calendario, nada más. Si alguien lo consigue, cámbialo y
            pega el nuevo en los dos Atajos.
          </Texto>
          <Boton variante="secundario" titulo="Cambiar el enlace" disabled={ocupado} onPress={crear} />
          {confirmarQuitar ? (
            <>
              <Texto fuerte>¿Dejo de recoger lo que digas a Siri?</Texto>
              <Boton titulo="Sí, dejar de usarlo" disabled={ocupado} onPress={quitar} />
              <Boton variante="secundario" titulo="Mejor no" onPress={() => setConfirmarQuitar(false)} />
            </>
          ) : (
            <Boton variante="secundario" titulo="Dejar de usar Siri" onPress={() => setConfirmarQuitar(true)} />
          )}
        </Plegable>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  enlace: { color: colores.textoSecundario },
});
