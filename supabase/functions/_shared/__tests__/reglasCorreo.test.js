import { describe, expect, it } from '@jest/globals';

// Reglas de los correos (sin IA): las usan el servidor y el ayudante de Gmail.
import * as reglas from '../reglasCorreo.js';

// Domingo 27 de septiembre de 2026, 10:00.
const RECIBIDO = new Date(2026, 8, 27, 10, 0);
const HOY = '2026-09-27';

describe('fechaLimiteEn', () => {
  it('encuentra fechas escritas junto a una palabra de plazo', () => {
    expect(reglas.fechaLimiteEn('El plazo para presentar la documentación acaba el 5 de octubre.', HOY)).toBe('2026-10-05');
    expect(reglas.fechaLimiteEn('Fecha límite: 05/10/2026', HOY)).toBe('2026-10-05');
    expect(reglas.fechaLimiteEn('Recuerda pagar antes del 15/10', HOY)).toBe('2026-10-15');
    expect(reglas.fechaLimiteEn('La factura vence el 3 oct.', HOY)).toBe('2026-10-03');
    expect(reglas.fechaLimiteEn('Tienes hasta el 1 de noviembre de 2026 para renovarlo', HOY)).toBe('2026-11-01');
    expect(reglas.fechaLimiteEn('El 12 de octubre vence el recibo', HOY)).toBe('2026-10-12');
  });

  it('entiende mañana y los días de la semana si la palabra es clara', () => {
    expect(reglas.fechaLimiteEn('Tienes que entregarlo mañana sin falta', HOY)).toBe('2026-09-28');
    expect(reglas.fechaLimiteEn('La fecha límite es el viernes', HOY)).toBe('2026-10-02');
    expect(reglas.fechaLimiteEn('El plazo termina a final de mes', HOY)).toBe('2026-09-30');
  });

  it('no confunde despedidas, horas, rangos ni fechas pasadas', () => {
    expect(reglas.fechaLimiteEn('Hasta el lunes, que vaya bien', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Hay que entregar 3-4 copias', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Entrega a las 10.30', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('El plazo acabó el 3 de septiembre', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Pásate por la mañana antes de nada', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('El plazo es largo. El 5 de octubre lo vemos', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Fecha del pedido: 27/09/2026', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Puedes consultar tu factura del 15/10', HOY)).toBeNull();
    expect(reglas.fechaLimiteEn('Mesa para el 12/10 de 4 personas', HOY)).toBeNull();
  });

  it('apunta las citas y las fechas escritas con año (27/10/2026)', () => {
    expect(reglas.fechaLimiteEn('Prueba 11/11/2026', HOY)).toBe('2026-11-11');
    expect(reglas.fechaLimiteEn('Tengo cita el 11/11/2026', HOY)).toBe('2026-11-11');
    expect(reglas.fechaLimiteEn('Examen el 11/11/2026', HOY)).toBe('2026-11-11');
    expect(reglas.fechaLimiteEn('Cita médica el 11 de noviembre', HOY)).toBe('2026-11-11');
    expect(reglas.fechaLimiteEn('Nos vemos el 5 de octubre en la cena', HOY)).toBe('2026-10-05');
    expect(reglas.fechaLimiteEn('Quedamos mañana para el pádel', HOY)).toBe('2026-09-28');
    expect(reglas.fechaLimiteEn('Te veo el día 3/10', HOY)).toBe('2026-10-03');
  });

  it('saca la hora que va detrás de la fecha', () => {
    expect(reglas.horaEn('Reunión 11/11/2026 a las 10', HOY)).toBe('10:00');
    expect(reglas.horaEn('Quedamos mañana a las 17:30', HOY)).toBe('17:30');
    expect(reglas.horaEn('Reunión el 5 de oct, 9:00', HOY)).toBe('09:00');
    expect(reglas.horaEn('Cena el viernes a las 9 de la noche', HOY)).toBe('21:00');
    expect(reglas.horaEn('Partido el sábado a las 5', HOY)).toBe('17:00');
    expect(reglas.horaEn('Examen el 11/11/2026', HOY)).toBeNull();
    expect(reglas.horaEn('Mesa para el 12/10/2026 de 4 personas', HOY)).toBeNull();
  });

  it('en diciembre, "5 de enero" es del año que viene', () => {
    expect(reglas.fechaLimiteEn('Plazo hasta el 5 de enero', '2026-12-20')).toBe('2027-01-05');
  });

  it('se queda con la primera si hay varias', () => {
    expect(reglas.fechaLimiteEn('Plazo: 20/10. Entrega del borrador antes del 10/10.', HOY)).toBe('2026-10-10');
  });
});

describe('limpiar y resumir', () => {
  it('limpia el asunto y el remitente', () => {
    expect(reglas.limpiarAsunto('RE: RV: [EXTERNO] Factura de octubre')).toBe('Factura de octubre');
    expect(reglas.limpiarAsunto('   ')).toBe('(Sin asunto)');
    expect(reglas.nombreRemitente('"Gestoría López" <info@gl.es>')).toBe('Gestoría López');
    expect(reglas.nombreRemitente('<info@gl.es>')).toBe('info@gl.es');
    expect(reglas.nombreRemitente('info@gl.es')).toBe('info@gl.es');
  });

  it('quita saludo, despedida, citas y enlaces', () => {
    const cuerpo = [
      'Hola Miguel,',
      '',
      'Te mando el presupuesto de la reforma. Incluye la cocina y el baño (https://ejemplo.com/p.pdf).',
      'Dime algo cuando puedas.',
      '',
      'Un saludo,',
      'Laura',
      '',
      'El vie, 25 sept 2026 a las 9:00, Miguel <m@x.es> escribió:',
      '> ¿Me pasas el presupuesto?',
    ].join('\n');
    expect(reglas.resumir(cuerpo)).toBe(
      'Te mando el presupuesto de la reforma. Incluye la cocina y el baño. Dime algo cuando puedas.',
    );
  });

  it('no se come la frase si el saludo no termina en coma', () => {
    expect(reglas.resumir('Hola te escribo para quedar el jueves')).toBe('Hola te escribo para quedar el jueves');
  });

  it('en un reenvío, resume lo reenviado', () => {
    const cuerpo = [
      '---------- Forwarded message ---------',
      'De: Banco <avisos@banco.es>',
      'Date: vie, 25 sept 2026',
      'Subject: Tu tarjeta caduca',
      'To: <yo@icloud.com>',
      '',
      'Tu tarjeta caduca pronto. Te enviaremos una nueva a casa.',
    ].join('\n');
    expect(reglas.resumir(cuerpo)).toBe('Tu tarjeta caduca pronto. Te enviaremos una nueva a casa.');
  });

  it('recorta los correos largos en una frase', () => {
    const largo = 'Primera frase con cosas importantes que contar. '.repeat(10);
    const resumen = reglas.resumir(largo);
    expect(resumen.length).toBeLessThanOrEqual(240);
    expect(resumen.endsWith('.')).toBe(true);
  });
});

describe('analizarCorreo y avisos', () => {
  it('un correo con plazo lleva fecha, tarea y un resumen corto', () => {
    const a = reglas.analizarCorreo({
      asunto: 'RE: Declaración trimestral',
      de: 'Gestoría <g@g.es>',
      cuerpo: 'Buenos días,\nNecesito las facturas antes del 10 de octubre para presentar el IVA.\nGracias',
      recibido: RECIBIDO,
    });
    expect(a).toEqual({
      titulo: 'Declaración trimestral',
      resumen: 'Necesito las facturas antes del 10 de octubre para presentar el IVA.',
      fechaLimite: '2026-10-10',
      hora: null,
      tarea: 'Declaración trimestral',
      importante: false,
      automatico: false,
      via: 'reglas',
    });
  });

  it('un correo normal no tiene fecha ni es importante', () => {
    const a = reglas.analizarCorreo({ asunto: 'Fotos del finde', de: 'Ana', cuerpo: '¡Mira qué bien salimos!', recibido: RECIBIDO });
    expect(a.fechaLimite).toBeNull();
    expect(a.tarea).toBeNull();
    expect(a.importante).toBe(false);
  });

  it('avisa de lo que tiene fecha y de lo importante; del resto, nada', () => {
    const normal = (i) => ({ titulo: `Correo ${i}`, de: 'Ana', resumen: '', fechaLimite: null, tarea: null, importante: false });
    const importante = (i) => ({ ...normal(i), importante: true, resumen: 'Te pide que confirmes hoy.' });
    const avisos = reglas.avisosDeCorreos(
      [{ titulo: 'IVA', de: 'Gestoría', resumen: '', fechaLimite: '2026-10-05', tarea: 'Mandar facturas' }, normal(1), normal(2), importante(3)],
      RECIBIDO,
    );
    expect(avisos).toEqual([
      { titulo: 'Tienes que mandar facturas el lunes 5 de octubre', cuerpo: 'Te lo he apuntado en las tareas. Correo de Gestoría.' },
      { titulo: 'Ana: Correo 3', cuerpo: 'Te pide que confirmes hoy.' },
    ]);
    expect(reglas.avisosDeCorreos([normal(1), normal(2)], RECIBIDO)).toEqual([]);
    expect(
      reglas.avisosDeCorreos([{ titulo: 'Cena', de: 'Y', resumen: '', fechaLimite: '2026-09-28', tarea: 'Cena' }], RECIBIDO)[0].titulo,
    ).toBe('Tienes cena mañana');
    expect(reglas.textoCuando(HOY, HOY)).toBe('Hoy');
    const cita = { titulo: 'Dentista', de: 'Clínica', resumen: '', fechaLimite: '2026-09-28', hora: '10:00', tarea: 'Dentista' };
    expect(reglas.avisosDeCorreos([cita], RECIBIDO)[0]).toEqual({
      titulo: 'Tienes dentista mañana a las 10:00',
      cuerpo: 'Te lo he apuntado en el calendario. Correo de Clínica.',
    });
  });

  it('muchos importantes van en un solo aviso', () => {
    const imp = (i) => ({ titulo: `Asunto ${i}`, de: `Persona ${i}`, resumen: '', fechaLimite: null, tarea: null, importante: true });
    const avisos = reglas.avisosDeCorreos([imp(1), imp(2), imp(3), imp(4)], RECIBIDO);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe('4 correos importantes');
    expect(reglas.avisosDeCorreos([imp(1)], RECIBIDO)[0].cuerpo).toBe('Correo importante.');
  });
});

describe('resultadoDeIA', () => {
  const correo = { asunto: 'RE: Cita', recibido: RECIBIDO };

  it('se queda con lo válido y la línea del aviso solo si es importante', () => {
    expect(
      reglas.resultadoDeIA({ titulo: 'Cita en el dentista', fechaLimite: '2026-10-02', tarea: 'Dentista a las 10', importante: true, resumen: 'Confírmala.' }, correo),
    ).toEqual({
      titulo: 'Cita en el dentista',
      resumen: 'Confírmala.',
      aviso: '',
      fechaLimite: '2026-10-02',
      hora: null,
      tarea: 'Dentista a las 10',
      importante: true,
      automatico: false,
      via: 'ia',
    });
    expect(
      reglas.resultadoDeIA({ titulo: 'Oferta', fechaLimite: null, importante: false, aviso: 'Compra ya', resumen: 'Rebajas', automatico: true }, correo),
    ).toMatchObject({
      resumen: 'Rebajas',
      aviso: '',
      automatico: true,
      importante: false,
      tarea: null,
    });
  });

  it('descarta fechas pasadas, lejanas o mal escritas', () => {
    expect(reglas.resultadoDeIA({ titulo: 'A', fechaLimite: '2026-09-01' }, correo).fechaLimite).toBeNull();
    expect(reglas.resultadoDeIA({ titulo: 'A', fechaLimite: '2028-01-01' }, correo).fechaLimite).toBeNull();
    expect(reglas.resultadoDeIA({ titulo: 'A', fechaLimite: '5 oct' }, correo).fechaLimite).toBeNull();
    expect(reglas.resultadoDeIA({ titulo: '', fechaLimite: null }, correo).titulo).toBe('Cita');
  });
});

describe('resumen de la IA, hora y aviso', () => {
  const correo = { asunto: 'Cita', de: 'Clínica <citas@clinica.es>', cuerpo: 'Te esperamos el jueves. Trae la tarjeta.', recibido: RECIBIDO };

  it('usa la hora si hay fecha, el aviso si es importante y, sin resumen, el de las reglas', () => {
    const r = reglas.resultadoDeIA({ titulo: 'Dentista', fechaLimite: '2026-10-01', hora: '10:30', importante: true, aviso: 'Confirma la cita' }, correo);
    expect(r).toMatchObject({ hora: '10:30', aviso: 'Confirma la cita', resumen: 'Te esperamos el jueves. Trae la tarjeta.' });
    expect(reglas.resultadoDeIA({ titulo: 'A', fechaLimite: null, hora: '10:30' }, correo).hora).toBeNull();
    expect(reglas.resultadoDeIA({ titulo: 'A', fechaLimite: '2026-10-01', hora: '25:00' }, correo).hora).toBeNull();
  });

  it('el aviso de un importante usa su línea antes que el resumen', () => {
    const c = { titulo: 'IVA', de: 'Gestoría', resumen: 'Resumen', aviso: 'Te pide las facturas hoy', fechaLimite: null, importante: true };
    expect(reglas.avisosDeCorreos([c], RECIBIDO)[0].cuerpo).toBe('Te pide las facturas hoy');
    expect(reglas.avisosDeCorreos([{ ...c, aviso: '' }], RECIBIDO)[0].cuerpo).toBe('Resumen');
  });
});

describe('correos automáticos', () => {
  const de = (d, cuerpo) => reglas.esAutomatico({ de: d, cuerpo: cuerpo || 'Hola' });

  it('por el remitente', () => {
    expect(de('Amazon <no-reply@amazon.es>')).toBe(true);
    expect(de('noreply@banco.es')).toBe(true);
    expect(de('Tienda <newsletter@tienda.com>')).toBe(true);
    expect(de('Banco <notificaciones@banco.es>')).toBe(true);
    expect(de('Ana <ana.lopez@gmail.com>')).toBe(false);
    expect(de('Gestoría <info@gl.es>')).toBe(false);
    expect(de('Noelia <noelia@gmail.com>')).toBe(false);
  });

  it('por el texto o las cabeceras', () => {
    expect(de('Tienda <hola@tienda.es>', 'Ofertas.\nSi no quieres recibir más, puedes darte de baja aquí.')).toBe(true);
    expect(de('x@y.es', 'Por favor, no respondas a este correo.')).toBe(true);
    expect(reglas.esAutomatico({ de: 'x@y.es', cuerpo: '', automatico: true })).toBe(true);
    const cab = (datos) => (n) => datos[n] || '';
    expect(reglas.cabecerasAutomaticas(cab({ 'list-unsubscribe': '<mailto:x@y.es>' }))).toBe(true);
    expect(reglas.cabecerasAutomaticas(cab({ precedence: 'bulk' }))).toBe(true);
    expect(reglas.cabecerasAutomaticas(cab({ 'auto-submitted': 'auto-generated' }))).toBe(true);
    expect(reglas.cabecerasAutomaticas(cab({ 'auto-submitted': 'no' }))).toBe(false);
    expect(reglas.cabecerasAutomaticas(cab({}))).toBe(false);
  });

  it('analizarCorreo lo dice', () => {
    const a = reglas.analizarCorreo({ asunto: 'Tu pedido', de: 'no-reply@tienda.es', cuerpo: 'Ya va de camino.', recibido: RECIBIDO });
    expect(a.automatico).toBe(true);
    expect(a.resumen).toBe('Ya va de camino.');
  });
});

describe('«Tienes X el día Y»', () => {
  it('sin nombre, con verbo o sin él y con la fecha larga', () => {
    expect(reglas.textoTienes('Dentista', '2026-11-12', HOY)).toBe('Tienes dentista el jueves 12 de noviembre');
    expect(reglas.textoTienes('Pagar el IBI', HOY, HOY)).toBe('Tienes que pagar el IBI hoy');
    expect(reglas.textoTienes('Taller del coche', '2026-09-28', HOY, '09:00')).toBe('Tienes taller del coche mañana a las 09:00');
    expect(reglas.textoTienes('IBI', '2026-09-28', HOY)).toBe('Tienes IBI mañana');
  });
});

describe('avisarme siempre de', () => {
  it('por nombre, por dirección o por dominio', () => {
    const de = '"Gestoría López" <info@gl.es>';
    expect(reglas.siempreAvisar(de, ['gestoria lopez'])).toBe(true);
    expect(reglas.siempreAvisar(de, ['info@gl.es'])).toBe(true);
    expect(reglas.siempreAvisar(de, ['@gl.es'])).toBe(true);
    expect(reglas.siempreAvisar(de, ['López'])).toBe(false);
    expect(reglas.siempreAvisar(de, ['.es'])).toBe(false);
    expect(reglas.siempreAvisar(de, [])).toBe(false);
  });

  it('veta por dirección, sin importar mayúsculas', () => {
    const de = '"Tienda" <Ofertas@Tienda.es>';
    expect(reglas.direccionRemitente(de)).toBe('ofertas@tienda.es');
    expect(reglas.direccionRemitente('ana@x.com')).toBe('ana@x.com');
    expect(reglas.direccionRemitente('Ana')).toBe('');
    expect(reglas.vetado(de, ['ofertas@tienda.es'])).toBe(true);
    expect(reglas.vetado(de, ['otra@tienda.es'])).toBe(false);
    expect(reglas.vetado(de, [])).toBe(false);
    expect(reglas.leerVetados('a@b.es')).toBeNull();
    expect(reglas.leerVetados([' A@B.es ', 'a@b.es', 'tienda', '@b.es', 3])).toEqual(['a@b.es']);
  });

  it('limpia la lista que manda la app', () => {
    expect(reglas.leerSiempre('Ana')).toBeNull();
    expect(reglas.leerSiempre([' Ana ', '', 3, 'x'.repeat(121)])).toEqual(['Ana']);
    expect(reglas.leerSiempre(Array.from({ length: 40 }, (_, i) => `P${i}`))).toHaveLength(30);
  });
});
describe('búsqueda de Gmail', () => {
  it('vale también sin pestañas (Google Workspace): sin category:primary', () => {
    expect(reglas.BUSQUEDA_GMAIL).not.toContain('category:primary');
    expect(reglas.BUSQUEDA_GMAIL).toContain('in:inbox');
    for (const c of ['promotions', 'social', 'updates', 'forums']) expect(reglas.BUSQUEDA_GMAIL).toContain(`-category:${c}`);
    expect(reglas.BUSQUEDA_GMAIL).toContain('-from:me');
  });
});
