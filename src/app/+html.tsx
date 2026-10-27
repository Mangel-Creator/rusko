import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Plantilla HTML de la versión web (solo se usa en web).
// Las etiquetas "apple-*" permiten guardarla en la pantalla de inicio del iPhone
// y que se abra a pantalla completa, como una app.
// Desde el SDK 58 los scripts y estilos de la app llegan en headNodes y bodyNodes:
// sin ellos la página publicada sale en blanco.
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="es" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Rusko</title>
        <meta name="theme-color" content="#0F0D0C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Rusko" />
        <link rel="apple-touch-icon" href="/organizy/icono-app.png" />
        {/* Manifiesto de la web instalada (public/manifest.json): los avisos web del iPhone lo necesitan. */}
        <link rel="manifest" href="/organizy/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#0F0D0C;color-scheme:dark;}' }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
