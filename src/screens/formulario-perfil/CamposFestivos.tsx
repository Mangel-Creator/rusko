import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Boton, CampoTexto, Selector, Tarjeta, Texto, Titulo, type Opcion } from '@/components';
import { claveDia, fechaDesdeClave, formatearDiaCorto, nombreMes, type ClaveDia } from '@/services/fechas';
import {
  COMUNIDADES,
  NOMBRE_AMBITO,
  SUBZONAS,
  festivosDelAno,
  hayTablaOficial,
  nombreComunidad,
  type CodigoComunidad,
  type Ocupacion,
} from '@/services/festivos';
import { ATRIBUCION_OPENSTREETMAP, buscarComunidad } from '@/services/lugares';
import { acentos, alturaTactil, colores, espacio, fuentes, radio, tamanos } from '@/theme';

import { municipioFestivos, type Borrador, type BorradorFestivos, type Errores } from './borrador';
import { MensajeError } from './MensajeError';

type Props = {
  borrador: Borrador;
  cambiar: (cambios: Partial<Borrador>) => void;
  errores: Errores;
};

const OPCIONES_OCUPACION: Opcion<Ocupacion>[] = [
  { valor: 'trabajo', etiqueta: 'Trabajo' },
  { valor: 'estudios', etiqueta: 'Estudio' },
  { valor: 'las-dos', etiqueta: 'Las dos' },
  { valor: 'ninguna', etiqueta: 'Ninguna' },
];

const PREGUNTA_DONDE: Record<Exclude<Ocupacion, 'ninguna'>, string> = {
  trabajo: '¿Dónde trabajas?',
  estudios: '¿Dónde estudias?',
  'las-dos': '¿Dónde trabajas o estudias?',
};

const OPCIONES_DONDE: Opcion<'casa' | 'otro'>[] = [
  { valor: 'casa', etiqueta: 'Donde vivo' },
  { valor: 'otro', etiqueta: 'En otro municipio' },
];

const OPCIONES_COMUNIDAD: Opcion<CodigoComunidad>[] = COMUNIDADES.map((c) => ({ valor: c.codigo, etiqueta: c.nombre }));

// Paso "Tus festivos" (bienvenida y Perfil): si trabaja o estudia y dónde. Con el
// municipio se busca la comunidad (OpenStreetMap) y salen solos los festivos del año;
// las dos fiestas locales las añade la persona.
export function CamposFestivos({ borrador, cambiar, errores }: Props) {
  const f = borrador.festivos;
  const lugar = municipioFestivos(borrador);
  const [buscando, setBuscando] = useState(false);
  const [cambiandoComunidad, setCambiandoComunidad] = useState(false);
  const hoy = new Date().getFullYear();
  const [ano, setAno] = useState(hoy);

  // La búsqueda tarda: al volver, se cambia sobre el borrador de ese momento.
  const actual = useRef({ borrador, cambiar });
  useLayoutEffect(() => {
    actual.current = { borrador, cambiar };
  });
  const cambiarF = useCallback((cambios: Partial<BorradorFestivos>) => {
    const { borrador: b, cambiar: c } = actual.current;
    c({ festivos: { ...b.festivos, ...cambios } });
  }, []);

  const buscar = useCallback(async () => {
    const b = actual.current.borrador;
    const texto = municipioFestivos(b);
    if (!texto || texto === b.festivos.buscadoPara) return;
    setBuscando(true);
    const resultado = await buscarComunidad(texto);
    setBuscando(false);
    // Si mientras tanto ha cambiado el municipio, esta respuesta ya no vale.
    if (municipioFestivos(actual.current.borrador) !== texto) return;
    if (resultado.estado === 'encontrado') {
      const misma = actual.current.borrador.festivos.comunidad === resultado.comunidad;
      cambiarF({
        comunidad: resultado.comunidad,
        subzona: resultado.subzona ?? (misma ? actual.current.borrador.festivos.subzona : null),
        buscadoPara: texto,
      });
      setCambiandoComunidad(false);
    } else if (resultado.estado === 'no-encontrado') {
      cambiarF({ buscadoPara: texto });
      setCambiandoComunidad(true);
    }
    // Sin conexión: se deja elegir la comunidad a mano.
    else setCambiandoComunidad(true);
  }, [cambiarF]);

  // Donde vive ya está escrito: se busca solo. Otro municipio, al terminar de escribirlo
  // (las normas de OpenStreetMap no dejan buscar mientras se escribe).
  const usaCasa = !f.ocupacion || f.ocupacion === 'ninguna' || f.donde === 'casa';
  useEffect(() => {
    if (f.ocupacion && usaCasa) buscar();
  }, [f.ocupacion, usaCasa, lugar, buscar]);

  const festivos = f.comunidad
    ? festivosDelAno(ano, {
        ocupacion: f.ocupacion ?? 'ninguna',
        donde: f.donde,
        municipio: lugar,
        comunidad: f.comunidad,
        subzona: f.subzona,
        locales: f.locales,
      })
    : [];
  const locales = f.locales.filter((l) => l.fecha.startsWith(`${ano}-`));
  const subzonas = f.comunidad ? SUBZONAS[f.comunidad] : undefined;

  return (
    <>
      <Texto secundario>
        Con esto pongo solos en tu calendario los festivos del año: los nacionales, los de tu comunidad y los de
        tu municipio.
      </Texto>

      <Selector
        etiqueta="¿Trabajas o estudias?"
        opciones={OPCIONES_OCUPACION}
        valor={f.ocupacion}
        alCambiar={(ocupacion) => cambiarF({ ocupacion })}
      />

      {f.ocupacion && f.ocupacion !== 'ninguna' ? (
        <>
          <Selector
            etiqueta={PREGUNTA_DONDE[f.ocupacion]}
            opciones={OPCIONES_DONDE}
            valor={f.donde}
            alCambiar={(donde) => cambiarF({ donde })}
          />
          {f.donde === 'otro' ? (
            <CampoTexto
              etiqueta="Municipio"
              placeholder="Por ejemplo, Elche"
              value={f.municipio}
              onChangeText={(municipio) => cambiarF({ municipio })}
              onBlur={buscar}
              onSubmitEditing={buscar}
              autoCapitalize="words"
              returnKeyType="done"
              ayuda="Cuentan las fiestas del sitio donde trabajas o estudias."
            />
          ) : null}
        </>
      ) : null}

      {f.ocupacion || f.comunidad ? (
        <Tarjeta style={estilos.comunidad}>
          {buscando ? (
            <Texto secundario>Buscando tu comunidad…</Texto>
          ) : f.comunidad && !cambiandoComunidad ? (
            <View style={estilos.fila}>
              <View style={estilos.crece}>
                <Texto pequeno secundario>
                  Tu comunidad
                </Texto>
                <Texto fuerte>{nombreComunidad(f.comunidad)}</Texto>
              </View>
              <Boton variante="secundario" titulo="Cambiar" onPress={() => setCambiandoComunidad(true)} />
            </View>
          ) : (
            <>
              {f.buscadoPara && !f.comunidad ? (
                <Texto secundario>No encuentro «{f.buscadoPara}». Elige tu comunidad:</Texto>
              ) : null}
              <Selector
                etiqueta="Comunidad autónoma"
                opciones={OPCIONES_COMUNIDAD}
                valor={f.comunidad}
                alCambiar={(comunidad) => {
                  cambiarF({ comunidad, subzona: null });
                  setCambiandoComunidad(false);
                }}
              />
            </>
          )}
          <Texto pequeno secundario>
            {ATRIBUCION_OPENSTREETMAP}
          </Texto>
        </Tarjeta>
      ) : null}

      {f.comunidad === 'can' && subzonas ? (
        <Selector
          etiqueta="¿En qué isla?"
          opciones={subzonas}
          valor={f.subzona}
          alCambiar={(subzona) => cambiarF({ subzona })}
        />
      ) : null}
      {f.comunidad === 'cat' ? (
        <Selector
          etiqueta="¿Es en el Valle de Arán?"
          opciones={[
            { valor: 'no', etiqueta: 'No' },
            { valor: 'aran', etiqueta: 'Sí' },
          ]}
          valor={f.subzona ?? 'no'}
          alCambiar={(valor) => cambiarF({ subzona: valor === 'aran' ? 'aran' : null })}
        />
      ) : null}

      <MensajeError texto={errores.festivos} />

      {f.comunidad ? (
        <>
          <View style={estilos.fila}>
            <Titulo nivel={3} style={estilos.crece}>
              Tus festivos de {ano}
            </Titulo>
            <Selector
              opciones={[hoy, hoy + 1].map((a) => ({ valor: `${a}`, etiqueta: `${a}` }))}
              valor={`${ano}`}
              alCambiar={(a) => setAno(Number(a))}
            />
          </View>
          {!hayTablaOficial(ano) ? (
            <Texto pequeno secundario>
              Aún no ha salido la lista oficial de {ano}: de momento, solo las fiestas nacionales.
            </Texto>
          ) : null}
          <Tarjeta style={estilos.lista}>
            {festivos.map((festivo) => (
              <View key={`${festivo.fecha}-${festivo.nombre}`} style={estilos.festivo}>
                <Text style={estilos.fecha}>{formatearDiaCorto(fechaDesdeClave(festivo.fecha))}</Text>
                <View style={estilos.crece}>
                  <Texto>{festivo.nombre}</Texto>
                  <Texto pequeno secundario>
                    {NOMBRE_AMBITO[festivo.ambito]}
                  </Texto>
                </View>
              </View>
            ))}
          </Tarjeta>

          <FiestasLocales
            ano={ano}
            municipio={lugar}
            locales={locales}
            alAnadir={(fiesta) => cambiarF({ locales: [...f.locales, fiesta] })}
            alQuitar={(fecha) => cambiarF({ locales: f.locales.filter((l) => l.fecha !== fecha) })}
          />
        </>
      ) : null}
    </>
  );
}

type PropsLocales = {
  ano: number;
  municipio: string;
  locales: BorradorFestivos['locales'];
  alAnadir: (fiesta: { fecha: ClaveDia; nombre: string }) => void;
  alQuitar: (fecha: ClaveDia) => void;
};

// Las dos fiestas locales: cada ayuntamiento elige las suyas cada año y no hay una
// lista oficial única, así que se escriben a mano (con un atajo para buscarlas).
function FiestasLocales({ ano, municipio, locales, alAnadir, alQuitar }: PropsLocales) {
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState<ClaveDia>(`${ano}-06-24`);
  const [error, setError] = useState<string | null>(null);
  const fechaDelAno = `${ano}${fecha.slice(4)}`;

  const anadir = () => {
    if (locales.some((l) => l.fecha === fechaDelAno)) {
      setError('Ese día ya está puesto.');
      return;
    }
    alAnadir({ fecha: fechaDelAno, nombre: nombre.trim() || 'Fiesta local' });
    setNombre('');
    setError(null);
  };

  return (
    <View style={estilos.locales}>
      <View>
        <Titulo nivel={3}>Fiestas locales de {ano}</Titulo>
        <Texto pequeno secundario>
          Cada municipio tiene 2 más, que elige su ayuntamiento. Si las sabes, añádelas.
        </Texto>
      </View>

      {locales.map((local) => (
        <Tarjeta key={local.fecha} style={estilos.fila}>
          <Text style={estilos.fecha}>{formatearDiaCorto(fechaDesdeClave(local.fecha))}</Text>
          <Texto style={estilos.crece}>{local.nombre}</Texto>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${local.nombre}`}
            onPress={() => alQuitar(local.fecha)}
            style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}>
            <Ionicons name="close" size={22} color={colores.textoSecundario} />
          </Pressable>
        </Tarjeta>
      ))}

      {locales.length < 2 ? (
        <Tarjeta>
          <CampoTexto
            etiqueta="Nombre de la fiesta"
            placeholder="Por ejemplo, San Juan"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="sentences"
          />
          <SelectorDiaDelAno ano={ano} valor={fechaDelAno} alCambiar={setFecha} />
          <MensajeError texto={error} />
          <Boton variante="secundario" titulo="Añadir fiesta local" onPress={anadir} />
        </Tarjeta>
      ) : null}

      {municipio ? (
        <Boton
          variante="secundario"
          titulo="Buscarlas en internet"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/search?q=${encodeURIComponent(`fiestas locales ${municipio} ${ano}`)}`,
            )
          }
        />
      ) : null}
    </View>
  );
}

type PropsDia = { ano: number; valor: ClaveDia; alCambiar: (valor: ClaveDia) => void };

// Mes y día con − y + (como SelectorFecha, pero de mes en mes para no dar 200 toques).
function SelectorDiaDelAno({ ano, valor, alCambiar }: PropsDia) {
  const mes = Number(valor.slice(5, 7)) - 1;
  const dia = Number(valor.slice(8, 10));
  const poner = (nuevoMes: number, nuevoDia: number) => {
    const m = (nuevoMes + 12) % 12;
    const diasDelMes = new Date(ano, m + 1, 0).getDate();
    const d = nuevoDia < 1 ? diasDelMes : nuevoDia > diasDelMes ? 1 : nuevoDia;
    alCambiar(claveDia(new Date(ano, m, d)));
  };

  return (
    <View style={estilos.selectorDia}>
      <Text style={estilos.etiqueta}>Día</Text>
      <Paso texto={nombreMes(new Date(ano, mes, 1))} etiqueta="mes" alMenos={() => poner(mes - 1, Math.min(dia, 28))} alMas={() => poner(mes + 1, Math.min(dia, 28))} />
      <Paso texto={`${dia}`} etiqueta="día" alMenos={() => poner(mes, dia - 1)} alMas={() => poner(mes, dia + 1)} />
      <Texto pequeno secundario>
        {formatearDiaCorto(fechaDesdeClave(valor))}
      </Texto>
    </View>
  );
}

function Paso({ texto, etiqueta, alMenos, alMas }: { texto: string; etiqueta: string; alMenos: () => void; alMas: () => void }) {
  return (
    <View style={estilos.paso}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Un ${etiqueta} antes`}
        onPress={alMenos}
        style={({ pressed }) => [estilos.botonPaso, pressed && estilos.pulsado]}>
        <Ionicons name="chevron-back" size={22} color={colores.texto} />
      </Pressable>
      <Text style={estilos.textoPaso} accessibilityLiveRegion="polite">
        {texto}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Un ${etiqueta} después`}
        onPress={alMas}
        style={({ pressed }) => [estilos.botonPaso, pressed && estilos.pulsado]}>
        <Ionicons name="chevron-forward" size={22} color={colores.texto} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  comunidad: { gap: espacio.s },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  crece: { flex: 1 },
  lista: { gap: espacio.s },
  festivo: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  fecha: {
    width: 116,
    fontFamily: fuentes.textoFuerte,
    fontSize: tamanos.pequeno,
    color: acentos.azul.color,
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
  },
  locales: { gap: espacio.s },
  quitar: { width: alturaTactil, height: alturaTactil, alignItems: 'center', justifyContent: 'center' },
  pulsado: { opacity: 0.6 },
  selectorDia: { gap: espacio.xs },
  etiqueta: { fontFamily: fuentes.textoMedio, fontSize: tamanos.pequeno, color: colores.textoSecundario },
  paso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.elevado,
    borderRadius: radio.chip,
    padding: espacio.xs,
  },
  botonPaso: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.tarjeta,
  },
  textoPaso: { fontFamily: fuentes.textoFuerte, fontSize: tamanos.grande, color: colores.texto },
});
