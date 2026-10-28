import { Plegable } from '@/components';
import { useCuenta } from '@/services/cuenta';
import { useNube } from '@/services/nube';

import { PanelCuenta } from '../cuenta/PanelCuenta';

// Perfil > Tu cuenta: entrar con correo y contraseña y tener lo mismo en todos tus
// dispositivos (27/10/2026). Se abre sola si hay que elegir con qué quedarse.
export function SeccionCuenta() {
  const cuenta = useCuenta();
  const nube = useNube();
  const resumen =
    cuenta.tipo === 'dentro'
      ? cuenta.email
      : cuenta.tipo === 'confirmando'
        ? 'Falta confirmar el correo'
        : 'Para tener lo mismo en todos tus dispositivos';
  return (
    <Plegable titulo="Tu cuenta" icono="person-circle-outline" color="azul" resumen={resumen} abierto={nube.situacion === 'elegir' || undefined}>
      <PanelCuenta />
    </Plegable>
  );
}
