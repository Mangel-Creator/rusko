import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton, Pantalla, Selector, SelectorDias, SelectorHora, Tarjeta, Texto, Titulo } from '@/components';
import type { DatosEmpresa } from '@/data/empresa';
import { buscarHueco, comparteHuecos, franjasDe, resumenDia, type CuandoReunion, type HuecoReunion } from '@/services/empresa/disponibilidad';
import { equiposQueLlevo, gestionoAlgo, nombreDe, personasDe, personasQueLlevo, soyAdmin } from '@/services/empresa/roles';
import {
  DIAS_SEMANA_LETRA,
  claveDia,
  fechaDesdeClave,
  formatearDiaCorto,
  formatearDuracion,
  horaDesdeMinutos,
  inicioDeSemana,
  minutosDesdeHora,
  sumarDias,
} from '@/services/fechas';
import { alturaTactil, cifras, colores, espacio, fuentes, radio } from '@/theme';

import { BotonVolver, Chip, Chips, FilaEmpresa, Mensaje, useDatosEmpresa } from './empresa/piezas';

// /empresa-disponibilidad (quien gestiona): libre u ocupado de cada persona por semana
// (turnos, eventos de empresa y el "Ocupado" que cada uno comparte si quiere) y "Buscar
// hueco para una reunión".

const OPCIONES_DURACION = [
  { valor: '30', etiqueta: '30 min' },
  { valor: '60', etiqueta: '1 h' },
  { valor: '90', etiqueta: '1 h 30' },
  { valor: '120', etiqueta: '2 h' },
] as const;

const OPCIONES_CUANDO: { valor: CuandoReunion; etiqueta: string }[] = [
  { valor: 'horario', etiqueta: 'Cuando nadie está ocupado' },
  { valor: 'turno', etiqueta: 'Cuando están todos de turno' },
];

const ESTADO = {
  turno: { letra: 'T', texto: 'De turno' },
  ocupado: { letra: 'O', texto: 'Ocupado' },
  libre: { letra: '', texto: 'Libre' },
} as const;

export function PantallaDisponibilidad() {
  const datos = useDatosEmpresa();
  if (!datos || !gestionoAlgo(datos)) {
    return (
      <Pantalla>
        <BotonVolver />
        <Texto secundario>Esto es para quien organiza un equipo.</Texto>
      </Pantalla>
    );
  }
  return <Contenido datos={datos} />;
}

function Contenido({ datos }: { datos: DatosEmpresa }) {
  const hoy = claveDia(new Date());
  const [lunes, setLunes] = useState(() => claveDia(inicioDeSemana(new Date())));
  const equipos = soyAdmin(datos) ? datos.equipos : equiposQueLlevo(datos);
  const [equipo, setEquipo] = useState<string | null>(soyAdmin(datos) ? null : equipos[0]?.id ?? null);
  const gente = equipo === null ? personasQueLlevo(datos) : personasDe(datos, equipo);
  const [elegidas, setElegidas] = useState<string[] | null>(null);
  const personas = elegidas ?? gente.map((m) => m.usuario);
  const [detalle, setDetalle] = useState<{ usuario: string; dia: string } | null>(null);
  const [duracion, setDuracion] = useState<'30' | '60' | '90' | '120'>('60');
  const [desde, setDesde] = useState('09:00');
  const [hasta, setHasta] = useState('19:00');
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4]);
  const [cuando, setCuando] = useState<CuandoReunion>('horario');
  const [huecos, setHuecos] = useState<HuecoReunion[] | null>(null);

  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const sinCompartir = gente.filter((m) => !comparteHuecos(datos, m.usuario));

  const buscar = () =>
    setHuecos(
      buscarHueco({
        datos,
        personas,
        desde: hoy,
        dias: 14,
        franja: { inicio: minutosDesdeHora(desde), fin: minutosDesdeHora(hasta) },
        duracion: Number(duracion),
        cuando,
        diasSemana: dias,
        ahora: new Date(),
      }),
    );

  const alternar = (usuario: string) => {
    setHuecos(null);
    setElegidas(personas.includes(usuario) ? personas.filter((p) => p !== usuario) : [...personas, usuario]);
  };

  return (
    <Pantalla>
      <BotonVolver />
      <Titulo>Disponibilidad</Titulo>
      {equipos.length > 1 || soyAdmin(datos) ? (
        <Chips>
          {soyAdmin(datos) ? (
            <Chip
              texto="Todos"
              elegido={equipo === null}
              onPress={() => {
                setEquipo(null);
                setElegidas(null);
                setHuecos(null);
              }}
            />
          ) : null}
          {equipos.map((e) => (
            <Chip
              key={e.id}
              texto={e.nombre}
              elegido={equipo === e.id}
              onPress={() => {
                setEquipo(e.id);
                setElegidas(null);
                setHuecos(null);
              }}
            />
          ))}
        </Chips>
      ) : null}

      <View style={estilos.cabecera}>
        <Texto fuerte style={estilos.flex}>
          Semana del {formatearDiaCorto(fechaDesdeClave(lunes))}
        </Texto>
        <Flecha icono="chevron-back" etiqueta="Semana anterior" onPress={() => setLunes(sumarDias(lunes, -7))} />
        <Flecha icono="chevron-forward" etiqueta="Semana siguiente" onPress={() => setLunes(sumarDias(lunes, 7))} />
      </View>

      <Tarjeta style={estilos.rejilla}>
        <View style={estilos.filaRejilla}>
          <View style={estilos.nombre} />
          {DIAS_SEMANA_LETRA.map((l, i) => (
            <Texto key={l + i} pequeno secundario style={[estilos.celdaCabecera, semana[i] === hoy && estilos.hoy]}>
              {l}
            </Texto>
          ))}
        </View>
        {gente.map((m) => (
          <View key={m.usuario} style={estilos.filaRejilla}>
            <Texto pequeno numberOfLines={1} style={estilos.nombre}>
              {nombreDe(m)}
            </Texto>
            {semana.map((dia) => {
              const estado = resumenDia(datos, m.usuario, dia);
              return (
                <Pressable
                  key={dia}
                  accessibilityRole="button"
                  accessibilityLabel={`${nombreDe(m)}, ${formatearDiaCorto(fechaDesdeClave(dia))}: ${ESTADO[estado].texto}`}
                  onPress={() => setDetalle({ usuario: m.usuario, dia })}
                  style={[estilos.celda, estilos[estado]]}>
                  <Texto pequeno style={estado === 'libre' ? undefined : estilos.letraClara}>
                    {ESTADO[estado].letra}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        ))}
        <Texto pequeno secundario>
          T = de turno · O = ocupado · en blanco, libre. Toca una casilla para ver las horas.
        </Texto>
      </Tarjeta>

      {detalle ? <DetalleDia datos={datos} usuario={detalle.usuario} dia={detalle.dia} /> : null}

      {sinCompartir.length > 0 ? (
        <Texto pequeno secundario>
          {sinCompartir.map((m) => nombreDe(m)).join(', ')} no {sinCompartir.length === 1 ? 'comparte' : 'comparten'} sus huecos
          personales: de su vida fuera del trabajo no sabes nada. Es su decisión.
        </Texto>
      ) : null}

      <Titulo nivel={2}>Buscar hueco para una reunión</Titulo>
      <Texto pequeno secundario>
        ¿Quiénes?
      </Texto>
      <Chips>
        {gente.map((m) => (
          <Chip key={m.usuario} texto={nombreDe(m)} elegido={personas.includes(m.usuario)} onPress={() => alternar(m.usuario)} />
        ))}
      </Chips>
      <Selector etiqueta="Cuánto dura" opciones={OPCIONES_DURACION} valor={duracion} alCambiar={setDuracion} />
      <View style={estilos.cabecera}>
        <SelectorHora etiqueta="Desde" valor={desde} alCambiar={setDesde} />
        <SelectorHora etiqueta="Hasta" valor={hasta} alCambiar={setHasta} />
      </View>
      <SelectorDias etiqueta="Qué días" valor={dias} alCambiar={setDias} />
      <Selector etiqueta="Cuándo" opciones={OPCIONES_CUANDO} valor={cuando} alCambiar={setCuando} />
      <Boton titulo="Buscar hueco" disabled={personas.length === 0} onPress={buscar} />
      {huecos && huecos.length === 0 ? (
        <Mensaje texto="En las próximas dos semanas no hay ningún hueco en el que estén todos. Prueba con menos gente u otras horas." />
      ) : null}
      {huecos?.map((h) => (
        <FilaEmpresa
          key={`${h.dia}-${h.inicio}`}
          titulo={formatearDiaCorto(fechaDesdeClave(h.dia))}
          hora={horaDesdeMinutos(h.inicio)}
          horaFin={horaDesdeMinutos(h.fin)}
          detalle={`Les viene bien a los ${personas.length} · Crear la reunión`}
          onPress={() =>
            router.push({
              pathname: '/empresa-evento',
              params: { fecha: h.dia, inicio: horaDesdeMinutos(h.inicio) },
            })
          }
        />
      ))}
    </Pantalla>
  );
}

function DetalleDia({ datos, usuario, dia }: { datos: DatosEmpresa; usuario: string; dia: string }) {
  const franjas = franjasDe(datos, usuario, dia);
  const persona = datos.miembros.find((m) => m.usuario === usuario);
  return (
    <Tarjeta style={estilos.caja}>
      <Texto fuerte>
        {nombreDe(persona)} · {formatearDiaCorto(fechaDesdeClave(dia))}
      </Texto>
      {franjas.length === 0 ? <Texto secundario>Libre todo el día.</Texto> : null}
      {franjas.map((f, i) => (
        <Texto key={i}>
          <Texto style={estilos.horaMono}>
            {horaDesdeMinutos(f.inicio)} – {f.fin >= 24 * 60 ? '24:00' : horaDesdeMinutos(f.fin)}
          </Texto>
          {'  '}
          {f.que === 'turno' ? 'De turno' : 'Ocupado'} · {formatearDuracion(f.fin - f.inicio)}
        </Texto>
      ))}
    </Tarjeta>
  );
}

function Flecha({ icono, etiqueta, onPress }: { icono: 'chevron-back' | 'chevron-forward'; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [estilos.flecha, pressed && estilos.pulsado]}>
      <Ionicons name={icono} size={22} color={colores.texto} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  flex: { flex: 1 },
  caja: { gap: espacio.xs },
  rejilla: { gap: espacio.xs, paddingHorizontal: espacio.s },
  filaRejilla: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nombre: { width: 72 },
  celdaCabecera: { flex: 1, textAlign: 'center' },
  hoy: { color: colores.principal, fontFamily: fuentes.textoFuerte },
  celda: {
    flex: 1,
    height: alturaTactil,
    borderRadius: radio.pequeno,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  turno: { backgroundColor: colores.empresa, borderColor: colores.empresa },
  ocupado: { backgroundColor: colores.cargaNormal, borderColor: colores.cargaNormal },
  libre: { backgroundColor: colores.tarjeta },
  letraClara: { color: colores.textoSobreTinta, fontFamily: fuentes.textoFuerte },
  horaMono: { ...cifras, fontFamily: fuentes.hora },
  pulsado: { opacity: 0.7 },
  flecha: {
    width: alturaTactil,
    height: alturaTactil,
    borderRadius: radio.normal,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
