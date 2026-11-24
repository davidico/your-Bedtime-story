# Your Story

Cuenta un cuento en voz alta y se dibuja solo. Dibujos sencillos, a lápiz y con colores planos, siempre iguales para que un niño pequeño los reconozca.

- Reconocimiento de voz en español con la Web Speech API del navegador (sin servidor, sin claves).
- Opcional: con un código de familia, la IA dibuja también palabras que no están en la lista (ver abajo).
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
lib/ai.js       → cliente de la API de figuras (código de familia, caché local)
lib/director.js → reparte palabras: conocidas a la escena, desconocidas a la IA
worker/         → Worker de Cloudflare: /api/figure (Claude o simulación) + web estática
public/         icono y manifest (se puede añadir a la pantalla de inicio)
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # genera el sitio estático en /out
```

El micrófono solo funciona en `localhost` o en una web con **https**. Un archivo abierto desde el disco no puede escuchar.

## Dibujos nuevos con IA (código de familia)

Las palabras de la lista se dibujan siempre, sin red. Con un **código de familia**, la app también pide a la IA (Claude) las palabras que no conoce: "una vaca", "un panda"… La figura se guarda y la próxima vez sale al instante. Sin código, o sin red, la app funciona igual que siempre.

- El código se escribe una vez por dispositivo en **Palabras que sabe dibujar y trucos → Código de familia**, o se abre el enlace `https://TU-DOMINIO/?codigo=EL-CODIGO` (la app guarda el código y lo quita de la barra de direcciones). Reparte ese enlace solo a quien quieras.
- Para quitar un código, vuelve a guardar `FAMILY_CODES` sin él (ver abajo).
- Privacidad: el reconocimiento de voz lo hace el navegador (en Chrome y Safari, el servicio de voz del fabricante). A la IA solo se envía la palabra que hay que dibujar. No se guarda audio ni el cuento.

## Probar en local con el Worker (`npm run preview`)

```bash
cp .dev.vars.example .dev.vars   # MOCK_AI=1, FAMILY_CODES=dev: figuras de prueba sin clave ni red
npm run preview                  # next build && wrangler dev → http://localhost:8787/?codigo=dev
```

`.dev.vars` guarda secretos locales y **nunca** se sube a git. Para probar con Claude de verdad, quita `MOCK_AI=1` y pon tu `ANTHROPIC_API_KEY`.

`npm run dev` sigue sirviendo solo la interfaz, sin `/api`: la app funciona en modo local (solo las palabras de la lista).

## Publicar en Cloudflare Workers (gratis)

Un solo Worker sirve la web estática (`/out`) y la API (`/api/*`). Toda la configuración está en `wrangler.jsonc`.

1. Inicia sesión: `npx wrangler login`.
2. Crea el almacén de figuras y pega el `id` que te devuelve en `kv_namespaces` de `wrangler.jsonc` (donde pone `<pendiente>`):
   ```bash
   npx wrangler kv namespace create FIGURES
   ```
3. Guarda los secretos (se piden por teclado, no se escriben en ningún archivo):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY   # clave de la consola de Anthropic
   npx wrangler secret put FAMILY_CODES        # códigos separados por comas, p. ej. abuela-luna,casa-sol
   ```
4. Publica: `npm run build && npx wrangler deploy`. Abre la URL `*.workers.dev` en el móvil, permite el micrófono y a contar.
5. En `vars` de `wrangler.jsonc`: `DAILY_FIGURE_CAP` (figuras nuevas al día, 300) y `ALLOWED_ORIGINS` (orígenes permitidos separados por comas, p. ej. `https://tu-dominio.com`; vacío = no se comprueba).

**Entorno de pruebas** (`preview`): tiene su propio KV y sus propios secretos. Crea el KV con `npx wrangler kv namespace create FIGURES --env preview`, pega el id en `env.preview`, repite el paso 3 con `--env preview` (con un código de familia distinto) y publica con `npx wrangler deploy --env preview`.

**Límite de gasto**: usa una clave de un workspace propio y pon en la consola de Anthropic (**Settings → Limits**) un límite de gasto mensual de **10 $**. Es el último cortafuegos: además, el Worker limita a 20 figuras por minuto por código y dirección IP, y a `DAILY_FIGURE_CAP` figuras nuevas al día en total. Un cuento típico cuesta céntimos.

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
