import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton, Tarjeta, Texto } from '@/components';
import { obtenerSupabase } from '@/data/supabase';
import {
  agotado,
  consultarEstadoIA,
  cuandoSeLibera,
  dolares,
  lineaLimite,
  miles,
  porcentaje,
  porcentajeClave,
  quedaDeLaClave,
  textoExtra,
  textoTokens,
  tokensQuedan,
  type EstadoIA,
  type LimiteIA,
  type MotivoLimiteIA,
  type SaldoClave,
} from '@/services/ia';
import { cifras, colores, espacio, fuentes, radio, tamanos } from '@/theme';

type Carga = { estado: 'cargando' } | { estado: 'listo'; ia: EstadoIA } | { estado: 'error' };

// Perfil > Tu IA: cuánta IA te queda, en dos barras como en Claude (estas 5 horas y
// esta semana), cuándo se libera cada una y el saldo extra. Comprar más aún no se
// puede: el botón lo explica.
export function SeccionIA() {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [verCompra, setVerCompra] = useState(false);
  const hayServidor = obtenerSupabase() !== null;

  useFocusEffect(
    useCallback(() => {
      if (!hayServidor) return;
      let vivo = true;
      consultarEstadoIA().then((ia) => {
        if (vivo) setCarga(ia ? { estado: 'listo', ia } : { estado: 'error' });
      });
      return () => {
        vivo = false;
      };
    }, [hayServidor]),
  );

  if (!hayServidor) {
    return <Texto secundario>La IA no está activada en esta versión de Rusko.</Texto>;
  }

  const ahora = new Date();
  const ia = carga.estado === 'listo' ? carga.ia : null;
  const extra = ia ? textoExtra(ia.extra, ia.semana.limite) : null;
  const sinIA = ia !== null && (agotado(ia.ventana) || agotado(ia.semana)) && ia.extra <= 0;

  return (
    <>
      {ia?.sinLimite ? (
        <Texto secundario>
          Tú no tienes límites: la IA nunca se te para. Las barras son solo para que veas lo que gastas.
        </Texto>
      ) : (
        <Texto secundario>
          Como en Claude, la IA tiene dos límites: uno cada {ia?.horas ?? 5} horas y otro por semana. Si llegas a
          uno, Rusko sigue funcionando sin IA hasta que se libere.
        </Texto>
      )}

      {carga.estado === 'cargando' ? <Texto secundario>Mirando cuánta te queda…</Texto> : null}
      {carga.estado === 'error' ? (
        <Texto secundario>No he podido ver cuánta IA te queda. Mira la conexión y vuelve a entrar.</Texto>
      ) : null}

      {ia ? (
        <View style={estilos.barras} accessibilityLiveRegion="polite">
          <Barra titulo={`Estas ${ia.horas} horas`} limite={ia.ventana} tipo="ventana" horas={ia.horas} ahora={ahora} />
          <Barra titulo="Esta semana" limite={ia.semana} tipo="semana" horas={ia.horas} ahora={ahora} />
        </View>
      ) : null}

      {extra ? <Texto fuerte>{extra}</Texto> : null}

      {ia?.clave ? <SaldoDeLaClave clave={ia.clave} /> : null}

      {ia && !ia.sinLimite ? (
        <Boton
          variante={sinIA ? 'principal' : 'secundario'}
          titulo="Conseguir más IA"
          onPress={() => setVerCompra((v) => !v)}
        />
      ) : null}

      {ia && verCompra ? (
        <Tarjeta accessibilityLiveRegion="polite">
          <Texto fuerte>Aún no se puede comprar más IA.</Texto>
          <Texto>
            Llegará cuando Rusko esté en las tiendas: podrás recargar un poco más cuando se te acabe, sin esperar.
          </Texto>
          <Texto secundario>{textoMientras(ia, ahora)}</Texto>
        </Tarjeta>
      ) : null}
    </>
  );
}

// Solo para el dueño: lo gastado de la clave de Anthropic y lo que queda del saldo.
function SaldoDeLaClave({ clave }: { clave: SaldoClave }) {
  const valor = porcentajeClave(clave);
  const color = valor >= 80 ? colores.aviso : colores.principal;
  const [, mes, dia] = clave.desde.split('-');
  return (
    <Tarjeta>
      <View
        style={estilos.barra}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Saldo de la clave"
        accessibilityValue={{ min: 0, max: 100, now: valor, text: `Quedan ${dolares(quedaDeLaClave(clave), true)}` }}>
        <View style={estilos.fila}>
          <Texto fuerte>Saldo de la clave</Texto>
          <Text style={[estilos.cifra, valor >= 80 && { color: colores.aviso }]}>
            Quedan {dolares(quedaDeLaClave(clave), true)}
          </Text>
        </View>
        <View style={estilos.fondoBarra}>
          <View style={[estilos.relleno, { width: `${valor}%`, backgroundColor: color }]} />
        </View>
        <Texto pequeno secundario>
          Gastado {dolares(clave.gastado)} de {dolares(clave.saldo)}
          {dia ? ` desde el ${dia}/${mes}` : ''}.
        </Texto>
      </View>
      <Texto>
        Tokens gastados: {miles(clave.entrada)} de entrada y {miles(clave.salida)} de salida, en{' '}
        {miles(clave.llamadas)} {clave.llamadas === 1 ? 'vez' : 'veces'}.
      </Texto>
      <Texto>Te quedan {textoTokens(tokensQuedan(clave))}, al ritmo de ahora.</Texto>
      <Texto pequeno secundario>
        Es la cuenta de Rusko, de todo el que usa la IA. La cifra exacta está en la consola de Anthropic.
      </Texto>
    </Tarjeta>
  );
}

function textoMientras(ia: EstadoIA, ahora: Date): string {
  const limite = agotado(ia.semana) ? ia.semana : agotado(ia.ventana) ? ia.ventana : null;
  const libre = limite?.libre ? new Date(limite.libre) : null;
  if (limite && libre && libre > ahora) return `Mientras, se libera sola ${cuandoSeLibera(libre, ahora)}.`;
  return 'Mientras, te queda IA de sobra para lo normal.';
}

function Barra({
  titulo,
  limite,
  tipo,
  horas,
  ahora,
}: {
  titulo: string;
  limite: LimiteIA;
  tipo: MotivoLimiteIA;
  horas: number;
  ahora: Date;
}) {
  const valor = porcentaje(limite);
  // Granate a partir del 80 %, como los días cargados de Semana.
  const color = valor >= 80 ? colores.aviso : colores.principal;
  return (
    <View
      style={estilos.barra}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={titulo}
      accessibilityValue={{ min: 0, max: 100, now: valor, text: `${valor} % usado` }}>
      <View style={estilos.fila}>
        <Texto fuerte>{titulo}</Texto>
        <Text style={[estilos.cifra, valor >= 80 && { color: colores.aviso }]}>{valor} % usado</Text>
      </View>
      <View style={estilos.fondoBarra}>
        <View style={[estilos.relleno, { width: `${valor}%`, backgroundColor: color }]} />
      </View>
      <Texto pequeno secundario>
        {lineaLimite(limite, tipo, horas, ahora)}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  barras: { gap: espacio.m },
  barra: { gap: espacio.xs },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cifra: { ...cifras, fontFamily: fuentes.hora, fontSize: tamanos.normal, color: colores.texto },
  fondoBarra: { height: 8, borderRadius: radio.chip, backgroundColor: colores.borde, overflow: 'hidden' },
  relleno: { height: 8, borderRadius: radio.chip },
});
