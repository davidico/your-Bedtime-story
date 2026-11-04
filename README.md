# Your Story

Cuenta un cuento en voz alta y se dibuja solo. Dibujos sencillos, a lápiz y con colores planos, siempre iguales para que un niño pequeño los reconozca.

- Reconocimiento de voz en español con la Web Speech API del navegador (sin servidor, sin claves).
- Motor de dibujo propio en `<canvas>`: cielo / suelo / mar, trazo animado, noche y día.
- Entiende colocación ("un gato **sobre** la casa"), tamaño ("un dragón **grande**"), artículos ("**el** gato" = el que ya está) y cámara ("miro a la **izquierda**", "caminamos **hacia** el castillo").

## Estructura

```
app/            layout, página y estilos globales (Next.js App Router)
components/     StoryCanvas.jsx  → pantalla: canvas, micrófono, subtítulos, botones
lib/figures.js  → las figuras (cada una en una caja 100×100) y la paleta
lib/vocab.js    → palabras en español → figura, preposiciones, adjetivos, órdenes
lib/scene.js    → motor de escena: colocación, relaciones, cámara, dibujo a lápiz
lib/useSpeech.js→ hook de reconocimiento de voz continuo
public/         icono y manifest (se puede añadir a la pantalla de inicio)
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # genera el sitio estático en /out
```

El micrófono solo funciona en `localhost` o en una web con **https**. Un archivo abierto desde el disco no puede escuchar.

## Publicar en Cloudflare Pages (gratis)

1. Sube este proyecto a un repositorio de GitHub (ver abajo).
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, elige el repositorio.
3. Ajustes de build:
   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npm run build`
   - Build output directory: `out`
4. Deploy. Cada `git push` vuelve a publicar solo.
5. Abre la URL `*.pages.dev` en el móvil, permite el micrófono y a contar.

## Subir a GitHub por primera vez

```bash
cd your-story
git init
git add .
git commit -m "Your Story: app que dibuja mientras cuentas un cuento"
git branch -M main
git remote add origin https://github.com/USUARIO/your-story.git
git push -u origin main
```

## Añadir palabras nuevas

1. Dibuja la figura en `lib/figures.js` dentro de una caja de 100×100 (el suelo es y=100) con `S()` (forma con relleno) y `L()` (línea). Indica `band` (`sky`, `ground`, `water`) y `size` (alto en píxeles).
2. Añade la palabra y sus variantes (diminutivos, sinónimos) en `WORDS` de `lib/vocab.js`, sin tildes.

## Navegadores

Chrome y Edge (Android, Windows, Mac), Safari (iPhone, iPad, Mac). Firefox no trae reconocimiento de voz.
