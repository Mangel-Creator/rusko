import { describe, expect, it } from '@jest/globals';

// Piezas puras de "Vincular con Gmail / Outlook" (fase 11).
import { cifrar, descifrar } from '../cifrado.ts';
import {
  conResultado,
  emailDeCuenta,
  mensajeDeGmail,
  mensajeDeOutlook,
  textoDeHtml,
  urlAutorizacion,
  vueltaValida,
} from '../proveedoresCorreo.ts';

const b64url = (texto) => Buffer.from(texto, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('urlAutorizacion', () => {
  it('Gmail pide solo leer, con llave que dura y el estado', () => {
    const url = new URL(urlAutorizacion('gmail', 'cliente-1', 'https://x.supabase.co/functions/v1/correo-cuentas', 'abc'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.readonly');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('Outlook pide Mail.Read y offline_access', () => {
    const url = new URL(urlAutorizacion('outlook', 'c', 'https://r', 'e'));
    expect(url.hostname).toBe('login.microsoftonline.com');
    expect(url.searchParams.get('scope')).toContain('offline_access');
    expect(url.searchParams.get('scope')).toContain('Mail.Read');
  });
});

describe('vueltaValida', () => {
  it('acepta la web, el desarrollo y la app', () => {
    expect(vueltaValida('https://mangel-creator.github.io/organizy/resumenes')).toBe(true);
    expect(vueltaValida('https://mangel-creator.github.io/rusko/resumenes')).toBe(true);
    expect(vueltaValida('http://localhost:8081/resumenes')).toBe(true);
    expect(vueltaValida('organizy://correo-vinculado')).toBe(true);
  });

  it('rechaza cualquier otra', () => {
    expect(vueltaValida('https://evil.com/organizy/resumenes')).toBe(false);
    expect(vueltaValida('https://mangel-creator.github.io.evil.com/organizy/')).toBe(false);
    expect(vueltaValida('https://mangel-creator.github.io/organizy/x?redir=https://evil.com')).toBe(false);
    expect(vueltaValida('javascript:alert(1)')).toBe(false);
    expect(vueltaValida(null)).toBe(false);
  });

  it('añade el resultado a la vuelta', () => {
    expect(conResultado('organizy://correo', { correo: 'ok', cuenta: 'a@b.es' })).toBe('organizy://correo?correo=ok&cuenta=a%40b.es');
  });
});

describe('mensajes', () => {
  it('lee un mensaje de Gmail con texto plano', () => {
    const m = mensajeDeGmail(
      {
        id: 'm1',
        threadId: 't1',
        internalDate: String(Date.UTC(2026, 8, 27, 8)),
        labelIds: ['INBOX', 'CATEGORY_PERSONAL'],
        payload: {
          mimeType: 'multipart/alternative',
          headers: [
            { name: 'From', value: 'Gestoría <g@g.es>' },
            { name: 'Subject', value: 'IVA del trimestre' },
          ],
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('Necesito las facturas, ¿vale?') } },
            { mimeType: 'text/html', body: { data: b64url('<p>otra cosa</p>') } },
          ],
        },
      },
      'yo@gmail.com',
    );
    expect(m).toMatchObject({
      id: 'm1',
      de: 'Gestoría <g@g.es>',
      asunto: 'IVA del trimestre',
      cuerpo: 'Necesito las facturas, ¿vale?',
      enlace: 'https://mail.google.com/mail/?authuser=yo%40gmail.com#all/t1',
      principal: true,
    });
    expect(m.recibido.toISOString()).toBe('2026-09-27T08:00:00.000Z');
  });

  it('en Gmail usa el HTML si no hay texto y sabe qué no es Principal', () => {
    const m = mensajeDeGmail(
      {
        id: 'm2',
        threadId: 't2',
        internalDate: '0',
        labelIds: ['CATEGORY_PROMOTIONS'],
        payload: { mimeType: 'text/html', headers: [], body: { data: b64url('<p>Hola &amp; adiós</p><style>x{}</style>') } },
      },
      'yo@gmail.com',
    );
    expect(m.cuerpo).toBe('Hola & adiós');
    expect(m.principal).toBe(false);
  });

  it('lee un mensaje de Outlook', () => {
    const m = mensajeDeOutlook(
      {
        receivedDateTime: '2026-09-27T08:00:00Z',
        subject: 'Reunión',
        from: { emailAddress: { name: 'Laura', address: 'laura@x.es' } },
        body: { contentType: 'text', content: 'Te mando el orden del día.' },
        webLink: 'https://outlook.live.com/owa/?ItemID=1',
        inferenceClassification: 'focused',
      },
      'o:abc',
    );
    expect(m).toMatchObject({ id: 'o:abc', de: 'Laura <laura@x.es>', asunto: 'Reunión', principal: true });
    expect(mensajeDeOutlook({ receivedDateTime: '2026-09-27T08:00:00Z', inferenceClassification: 'other' }, 'o:x').principal).toBe(
      false,
    );
  });

  it('saca el correo de la cuenta', () => {
    expect(emailDeCuenta('gmail', { emailAddress: 'Yo@Gmail.com' })).toBe('yo@gmail.com');
    expect(emailDeCuenta('outlook', { mail: null, userPrincipalName: 'yo@hotmail.com' })).toBe('yo@hotmail.com');
    expect(emailDeCuenta('outlook', {})).toBeNull();
  });

  it('pasa HTML a texto', () => {
    expect(textoDeHtml('<div>Uno</div><div>Dos<br>Tres</div>')).toBe('Uno\n Dos\nTres');
  });
});

describe('cifrado', () => {
  const clave = Buffer.alloc(32, 7).toString('base64');

  it('cifra y descifra, y cada vez sale distinto', async () => {
    const a = await cifrar('llave-secreta', clave);
    const b = await cifrar('llave-secreta', clave);
    expect(a).not.toBe(b);
    expect(a).not.toContain('llave-secreta');
    expect(await descifrar(a, clave)).toBe('llave-secreta');
  });

  it('no descifra con otra clave', async () => {
    const a = await cifrar('x', clave);
    await expect(descifrar(a, Buffer.alloc(32, 8).toString('base64'))).rejects.toThrow();
  });
});
