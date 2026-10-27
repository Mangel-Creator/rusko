import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { BotonAtras, Pantalla, Tarjeta, Texto, Titulo } from '@/components';
import { atenderEnlace, comprobarConfirmacion, type Enlace } from '@/services/cuenta';

import { PanelCuenta } from './cuenta/PanelCuenta';

// /cuenta: entrar o crear la cuenta fuera de Perfil. Se llega desde la bienvenida ("Ya
// tengo cuenta") y desde los enlaces de los correos (confirmar el correo y "He olvidado
// la contraseña"), así que funciona aunque no se haya hecho la bienvenida.
const TEXTO_ENLACE: Partial<Record<NonNullable<Enlace>, string>> = {
  confirmado:
    'Correo confirmado. Vuelve a Rusko donde estabas creando la cuenta y toca «Ya lo he confirmado». Si era aquí, sigue abajo.',
  caducado: 'Ese enlace ya no vale: caduca en una hora y solo sirve una vez. Pide otro.',
};

export function PantallaCuenta() {
  const [enlace, setEnlace] = useState<Enlace | undefined>(undefined);

  useEffect(() => {
    atenderEnlace().then((recibido) => {
      setEnlace(recibido);
      if (recibido === 'confirmado') comprobarConfirmacion();
    });
  }, []);

  return (
    <Pantalla>
      <BotonAtras texto="Volver" etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Titulo>Tu cuenta</Titulo>
      <Texto secundario>Entra con tu correo y tu contraseña y tendrás lo mismo en el móvil, en la web y en el ordenador.</Texto>
      {enlace && TEXTO_ENLACE[enlace] ? (
        <Tarjeta accessibilityLiveRegion="polite">
          <Texto>{TEXTO_ENLACE[enlace]}</Texto>
        </Tarjeta>
      ) : null}
      {enlace === undefined ? null : (
        <PanelCuenta
          nuevaContrasena={enlace === 'nueva-contrasena'}
          alTerminarContrasena={() => setEnlace(null)}
        />
      )}
    </Pantalla>
  );
}
