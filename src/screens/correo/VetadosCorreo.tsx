import { useState } from 'react';

import { Boton, CampoTexto, Plegable, Texto } from '@/components';
import { useCorreos } from '@/data/correos';
import { esDireccion, vetarDireccion } from '@/services/correo';

// "Remitentes vetados" (27/10/2026, lo pidió el usuario): escribes una dirección y sus
// correos no salen nada en Rusko (ni aquí, ni avisos, ni tareas ni citas). En Gmail
// siguen igual. Se puede quitar el veto cuando quieras.

export function VetadosCorreo() {
  const { vetados } = useCorreos();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function vetar() {
    const direccion = texto.trim().toLowerCase();
    if (!esDireccion(direccion)) {
      setError('Escribe solo la dirección, como ofertas@tienda.es.');
      return;
    }
    if (vetados.includes(direccion)) {
      setError('Esa dirección ya está vetada.');
      return;
    }
    setError(null);
    setGuardando(true);
    const ok = await vetarDireccion(direccion).catch(() => false);
    setGuardando(false);
    if (ok) setTexto('');
    else setError('No he podido vetarla. Prueba otra vez.');
  }

  return (
    <Plegable
      titulo="Remitentes vetados"
      icono="ban-outline"
      resumen={vetados.length === 0 ? 'Nadie' : vetados.length === 1 ? vetados[0] : `${vetados.length} direcciones`}>
      <Texto pequeno secundario>
        Lo que te manden estas direcciones no saldrá en Rusko: ni aquí, ni avisos, ni tareas ni citas. En tu correo
        sigue igual.
      </Texto>
      <CampoTexto
        etiqueta="Dirección que no quieres ver"
        placeholder="ofertas@tienda.es"
        value={texto}
        onChangeText={(t) => {
          setTexto(t);
          setError(null);
        }}
        onSubmitEditing={vetar}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="done"
        error={error}
      />
      <Boton titulo={guardando ? 'Vetando…' : 'Vetar'} disabled={guardando || !texto.trim()} onPress={vetar} />
    </Plegable>
  );
}

