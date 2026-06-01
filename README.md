# Turnero Repuestos

Sistema web de turnos con:

- Super usuario inicial.
- Creación de casas de repuestos.
- QR único por casa, descargable en PNG.
- Usuarios administradores y vendedores.
- Pantalla cliente por QR.
- Panel vendedor.
- Pantalla TV.
- Botón de modo flotante para llamar turnos mientras se usa otra ventana.
- Netlify Functions + Netlify Blobs como almacenamiento simple.


## Instalar

```bash
npm install
```

## Probar local con funciones de Netlify

Lo ideal es usar Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

Entrar a:

```txt
http://localhost:8888
```

## Subir a Netlify

1. Subir el proyecto a GitHub.
2. Crear nuevo sitio en Netlify.
3. Build command:

```txt
npm run build
```

4. Publish directory:

```txt
dist
```

5. Functions directory:

```txt
netlify/functions
```

Netlify Blobs se usa desde las functions para guardar casas, usuarios y turnos.

## Flujo de prueba

1. Entrar como super.
2. Crear una casa de repuestos.
3. Descargar el QR o abrir el link de turno.
4. Crear vendedores desde la administración de la casa.
5. Abrir `/tv/slug-de-la-casa` en la TV.
6. Entrar al panel vendedor y llamar turnos.

## Modo flotante

En Chrome/Edge modernos, el botón intenta abrir una ventana Picture-in-Picture de documento. Si el navegador no lo permite, abre una ventana popup chica. Para que funcione bien, permití ventanas emergentes para el sitio.

