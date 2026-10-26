import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton, Tarjeta, Texto } from '@/components';
import { obtenerSupabase } from '@/data/supabase';
import {
  agotado,
  consultarEstadoIA,
  cuandoSeLibera,
  lineaLimite,
  porcentaje,
  textoExtra,
  type EstadoIA,
  type LimiteIA,
  type MotivoLimiteIA,
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
    return <Texto secundario>La IA no está activada en esta versión de Organizy.</Texto>;
  }

  const ahora = new Date();
  const ia = carga.estado === 'listo' ? carga.ia : null;
  const extra = ia ? textoExtra(ia.extra, ia.semana.limite) : null;
  const sinIA = ia !== null && (agotado(ia.ventana) || agotado(ia.semana)) && ia.extra <= 0;

  return (
    <>
      <Texto secundario>
        Como en Claude, la IA tiene dos límites: uno cada {ia?.horas ?? 5} horas y otro por semana. Si llegas a
        uno, Organizy sigue funcionando sin IA hasta que se libere.
      </Texto>

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

      {ia ? (
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
            Llegará cuando Organizy esté en las tiendas: podrás recargar un poco más cuando se te acabe, sin esperar.
          </Texto>
          <Texto secundario>{textoMientras(ia, ahora)}</Texto>
        </Tarjeta>
      ) : null}
    </>
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
