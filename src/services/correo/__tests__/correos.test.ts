import { describe, expect, it } from '@jest/globals';

import type { CorreoRemoto, CorreoResumido } from '@/data/correos';
import type { Perfil } from '@/data/perfil';
import { avisosDePlazos } from '@/services/avisos/correos';

import {
  avisaSiempre,
  bandejasCorreo,
  cambiarSiempre,
  cambiarVetados,
  correosSinTarea,
  deVetado,
  iaEncendida,
  leerEnlace,
  mezclarCorreos,
  sinCuenta,
  tareaDeCorreo,
  textoGrupo,
  textoParaDia,
  textoVuelta,
  validarRemoto,
} from '../correos';

const HOY = '2026-09-27';
const AHORA = new Date(2026, 8, 27, 10, 0);

function remoto(cambios: Partial<CorreoRemoto> = {}): CorreoRemoto {
  return {
    id: 'm1',
    recibido: new Date(2026, 8, 27, 9, 0).toISOString(),
    de: 'Gestoría',
    asunto: 'RE: IVA',
    titulo: 'IVA',
    resumen: 'Necesito las facturas.',
    fechaLimite: null,
    tarea: null,
    via: 'reglas',
    enlace: 'https://mail.google.com/mail/?authuser=yo#all/abc',
    ...cambios,
  };
}

const local = (cambios: Partial<CorreoResumido> = {}): CorreoResumido => ({
  ...remoto(),
  visto: false,
  eventoId: null,
  noEsPlazo: false,
  ...cambios,
});

describe('leerEnlace', () => {
  it('acepta la URL de la aplicación web de Google y la limpia', () => {
    const id = 'AKfycbx1234567890abcdefghijk';
    expect(leerEnlace(`  https://script.google.com/macros/s/${id}/exec  `)).toBe(`https://script.google.com/macros/s/${id}/exec`);
    expect(leerEnlace(`https://script.google.com/macros/s/${id}/exec?x=1`)).toBe(`https://script.google.com/macros/s/${id}/exec`);
    expect(leerEnlace(`https://script.google.com/a/midominio.es/macros/s/${id}/exec`)).not.toBeNull();
  });

  it('rechaza lo que no lo es', () => {
    expect(leerEnlace('https://script.google.com/home/projects/abc/edit')).toBeNull();
    expect(leerEnlace('https://script.google.com/macros/s/AKfycbx1234567890abcdefghijk/dev')).toBeNull();
    expect(leerEnlace('http://script.google.com/macros/s/AKfycbx1234567890abcdefghijk/exec')).toBeNull();
    expect(leerEnlace('https://evil.com/macros/s/AKfycbx1234567890abcdefghijk/exec')).toBeNull();
  });
});

describe('validarRemoto', () => {
  it('se queda con lo válido', () => {
    expect(validarRemoto(remoto())).toEqual({ ...remoto(), hora: null, importante: false });
    expect(validarRemoto({ ...remoto(), importante: true })?.importante).toBe(true);
    expect(validarRemoto({ ...remoto(), fechaLimite: '5 oct', tarea: 'Algo' })).toMatchObject({ fechaLimite: null, tarea: null });
    expect(validarRemoto({ ...remoto(), enlace: 'https://otro.com' })?.enlace).toBe('');
    expect(validarRemoto({ ...remoto(), via: 'x' })?.via).toBe('reglas');
  });

  it('descarta lo que no cuadra', () => {
    expect(validarRemoto(null)).toBeNull();
    expect(validarRemoto({ ...remoto(), id: '' })).toBeNull();
    expect(validarRemoto({ ...remoto(), recibido: 'ayer' })).toBeNull();
    expect(validarRemoto({ ...remoto(), titulo: '  ' })).toBeNull();
  });
});

describe('mezclarCorreos', () => {
  it('los nuevos entran sin ver y los que ya estaban conservan lo del móvil', () => {
    const antes = [local({ id: 'm1', visto: true, eventoId: 'e1', resumen: 'viejo' })];
    const mezcla = mezclarCorreos(antes, [remoto({ id: 'm1', resumen: 'nuevo' }), remoto({ id: 'm2' })], AHORA);
    expect(mezcla.find((c) => c.id === 'm1')).toMatchObject({ visto: true, eventoId: 'e1', resumen: 'nuevo' });
    expect(mezcla.find((c) => c.id === 'm2')).toMatchObject({ visto: false, eventoId: null, noEsPlazo: false });
  });

  it('olvida los de hace más de 30 días y ordena del más nuevo al más viejo', () => {
    const viejo = local({ id: 'viejo', recibido: new Date(2026, 7, 1).toISOString() });
    const mezcla = mezclarCorreos(
      [viejo],
      [remoto({ id: 'a', recibido: new Date(2026, 8, 26).toISOString() }), remoto({ id: 'b' })],
      AHORA,
    );
    expect(mezcla.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('plazos y tareas', () => {
  const conPlazo = local({ id: 'p', fechaLimite: '2026-10-05', tarea: 'Mandar las facturas' });

  it('solo los plazos de hoy en adelante, sin tarea y que no se hayan descartado', () => {
    const lista = [
      conPlazo,
      local({ id: 'pasado', fechaLimite: '2026-09-20' }),
      local({ id: 'con-tarea', fechaLimite: '2026-10-05', eventoId: 'e1' }),
      local({ id: 'descartado', fechaLimite: '2026-10-05', noEsPlazo: true }),
      local({ id: 'normal' }),
    ];
    expect(correosSinTarea(lista, HOY).map((c) => c.id)).toEqual(['p']);
  });

  it('la tarea va ese día, de 30 min, tipo Yo y con el correo en las notas', () => {
    const tarea = tareaDeCorreo(conPlazo, 'e9');
    expect(tarea).toMatchObject({
      id: 'e9',
      titulo: 'Mandar las facturas',
      fecha: '2026-10-05',
      tipo: 'yo',
      flexible: true,
      duracionMin: 30,
      horaInicio: null,
      hecha: false,
    });
    expect(tarea.notas).toContain('Del correo de Gestoría: «RE: IVA».');
    expect(tarea.notas).toContain('https://mail.google.com/');
  });

  it('con hora es una cita de 1 h en el calendario', () => {
    const cita = tareaDeCorreo(local({ fechaLimite: '2026-10-05', hora: '10:00', tarea: 'Dentista' }), 'e8');
    expect(cita).toMatchObject({ fecha: '2026-10-05', horaInicio: '10:00', horaFin: '11:00', flexible: false, duracionMin: null });
    expect(tareaDeCorreo(local({ fechaLimite: '2026-10-05', hora: '23:30' }), 'e7').horaFin).toBe('23:59');
  });

  it('textos del día y de grupo', () => {
    expect(textoParaDia('2026-09-28', HOY, '10:00')).toBe('Para mañana a las 10:00');
    expect(textoParaDia('2026-09-27', HOY)).toBe('Para hoy');
    expect(textoParaDia('2026-09-28', HOY)).toBe('Para mañana');
    expect(textoParaDia('2026-10-05', HOY)).toBe('Para el lun 5 oct');
    expect(textoParaDia('2026-09-25', HOY)).toBe('Era el vie 25 sept');
    expect(textoGrupo('2026-09-27', HOY)).toBe('Hoy');
    expect(textoGrupo('2026-09-26', HOY)).toBe('Ayer');
    expect(textoGrupo('2026-09-24', HOY)).toBe('jue 24 sept');
  });

  it('bandejas: todo por día (también lo apuntado), con fecha y resúmenes', () => {
    const diaDe = (iso: string) => iso.slice(0, 10);
    const b = bandejasCorreo(
      [
        local({ id: 'normal-hoy', recibido: '2026-09-27T09:00:00.000Z' }),
        local({ id: 'plazo-lejos', fechaLimite: '2026-10-20', recibido: '2026-09-27T08:00:00.000Z' }),
        local({ id: 'plazo-cerca', fechaLimite: '2026-10-01', recibido: '2026-09-27T07:00:00.000Z' }),
        local({ id: 'plazo-pasado', fechaLimite: '2026-09-25', recibido: '2026-09-24T07:00:00.000Z' }),
        local({ id: 'plazo-descartado', fechaLimite: '2026-10-01', noEsPlazo: true, recibido: '2026-09-26T09:00:00.000Z' }),
        local({ id: 'importante', importante: true, recibido: '2026-09-26T08:00:00.000Z' }),
      ],
      HOY,
      diaDe,
    );
    expect(b.todos.map((g) => [g.dia, g.correos.map((c) => c.id)])).toEqual([
      ['2026-09-27', ['normal-hoy', 'plazo-lejos', 'plazo-cerca']],
      ['2026-09-26', ['plazo-descartado', 'importante']],
      ['2026-09-24', ['plazo-pasado']],
    ]);
    expect(b.conFecha.map((c) => c.id)).toEqual(['plazo-cerca', 'plazo-lejos']);
    expect(b.pasados.map((c) => c.id)).toEqual(['plazo-pasado']);
    expect(b.resumenes.map((c) => c.id)).toEqual(['importante']);
    expect(iaEncendida([local()])).toBe(false);
    expect(iaEncendida([local({ via: 'ia' })])).toBe(true);
  });
});

describe('remitentes vetados', () => {
  it('se vetan direcciones, en minúsculas y sin repetir', () => {
    expect(cambiarVetados([], ' Ofertas@Tienda.es ', true)).toEqual(['ofertas@tienda.es']);
    expect(cambiarVetados(['ofertas@tienda.es'], 'ofertas@tienda.es', true)).toEqual(['ofertas@tienda.es']);
    expect(cambiarVetados(['ofertas@tienda.es'], 'ofertas@tienda.es', false)).toEqual([]);
    expect(cambiarVetados([], 'Tienda', true)).toBeNull();
  });

  it('lo vetado no entra ni se queda en el móvil', () => {
    const vetados = ['spam@x.es'];
    expect(deVetado({ de: 'Spam', direccion: 'spam@x.es' }, vetados)).toBe(true);
    expect(deVetado({ de: 'spam@x.es' }, vetados)).toBe(true);
    expect(deVetado({ de: 'Ana', direccion: 'ana@x.es' }, vetados)).toBe(false);
    const mezcla = mezclarCorreos(
      [local({ id: 'viejo', direccion: 'spam@x.es' })],
      [remoto({ id: 'nuevo', direccion: 'spam@x.es' }), remoto({ id: 'bueno' })],
      AHORA,
      vetados,
    );
    expect(mezcla.map((c) => c.id)).toEqual(['bueno']);
  });

  it('del servidor llegan la dirección y la hora, comprobadas', () => {
    const c = validarRemoto({ ...remoto(), direccion: 'Info@GL.es', fechaLimite: '2026-10-05', hora: '10:30' });
    expect(c).toMatchObject({ direccion: 'info@gl.es', hora: '10:30' });
    expect(validarRemoto({ ...remoto(), direccion: 'nada', hora: '25:00', fechaLimite: '2026-10-05' })).toMatchObject({ hora: null });
    expect(validarRemoto({ ...remoto(), direccion: 'nada' })?.direccion).toBeUndefined();
  });
});

describe('aviso de la víspera', () => {
  const perfil = { horario: { levantarse: '07:30' } } as Perfil;
  const tarea = tareaDeCorreo(local({ fechaLimite: '2026-10-05', tarea: 'Pagar el IBI' }), 'e1');
  const correo = local({ fechaLimite: '2026-10-05', tarea: 'Pagar el IBI', eventoId: 'e1' });

  it('la víspera a la hora de levantarse, si la tarea sigue sin hacer', () => {
    const [aviso] = avisosDePlazos([correo], [tarea], perfil, '2026-10-04');
    expect(aviso).toMatchObject({
      tipo: 'plazo-correo',
      titulo: 'Mañana: Pagar el IBI',
      destino: { pantalla: 'evento', id: 'e1' },
    });
    expect(aviso.cuando).toEqual(new Date(2026, 9, 4, 7, 30));
    expect(avisosDePlazos([correo], [tarea], perfil, '2026-10-03')).toEqual([]);
  });

  it('sin aviso si la tarea está hecha o borrada, o si no es un plazo', () => {
    expect(avisosDePlazos([correo], [{ ...tarea, hecha: true }], perfil, '2026-10-04')).toEqual([]);
    expect(avisosDePlazos([correo], [], perfil, '2026-10-04')).toEqual([]);
    expect(avisosDePlazos([{ ...correo, noEsPlazo: true }], [tarea], perfil, '2026-10-04')).toEqual([]);
  });
});

describe('cuentas vinculadas', () => {
  it('acepta enlaces de Outlook, el origen y la cuenta', () => {
    const r = validarRemoto({
      ...remoto(),
      enlace: 'https://outlook.live.com/owa/?ItemID=1',
      origen: 'outlook',
      cuenta: 'yo@hotmail.com',
    });
    expect(r).toMatchObject({ enlace: 'https://outlook.live.com/owa/?ItemID=1', origen: 'outlook', cuenta: 'yo@hotmail.com' });
    expect(validarRemoto({ ...remoto(), origen: 'yahoo', cuenta: 'no-es-correo' })).not.toHaveProperty('origen');
  });

  it('al quitar una cuenta se van sus resúmenes y se quedan los demás', () => {
    const lista = [local({ id: 'a', cuenta: 'yo@gmail.com' }), local({ id: 'b', cuenta: 'otro@hotmail.com' }), local({ id: 'c' })];
    expect(sinCuenta(lista, 'yo@gmail.com').map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('dice qué pasó al volver de iniciar sesión', () => {
    expect(textoVuelta({ correo: 'ok', cuenta: 'yo@gmail.com' })).toEqual({
      bien: true,
      texto: 'Listo: yo@gmail.com ya está vinculado. Te aviso de lo que importe.',
    });
    expect(textoVuelta({ correo: 'cancelado' })?.bien).toBe(false);
    expect(textoVuelta({ correo: 'error', motivo: 'demasiadas' })?.texto).toContain('5 cuentas');
    expect(textoVuelta({})).toBeNull();
  });
});

describe('avisarme siempre de', () => {
  it('pone y quita al remitente sin mirar mayúsculas', () => {
    const lista = cambiarSiempre([], 'Gestoría López');
    expect(lista).toEqual(['Gestoría López']);
    expect(avisaSiempre(lista, 'gestoría lópez ')).toBe(true);
    expect(cambiarSiempre(lista, 'GESTORÍA LÓPEZ')).toEqual([]);
    expect(cambiarSiempre(lista, '  ')).toBe(lista);
  });

  it('guarda como mucho 30', () => {
    let lista: string[] = [];
    for (let i = 0; i < 35; i++) lista = cambiarSiempre(lista, `Persona ${i}`);
    expect(lista).toHaveLength(30);
    expect(lista[0]).toBe('Persona 5');
  });
});