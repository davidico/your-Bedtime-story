'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Scene } from '@/lib/scene';
import { tokens, VOCAB_LIST } from '@/lib/vocab';
import { W, H } from '@/lib/figures';
import { useSpeech } from '@/lib/useSpeech';
import { createAI } from '@/lib/ai';
import { createDirector } from '@/lib/director';

const STORY = [
  'Había una vez una princesa que vivía en un castillo grande.',
  'Junto al castillo crecía un bosque lleno de flores.',
  'Un día llegó un perro y un conejo a jugar.',
  'Volaban mariposas y un pájaro sobre la casa.',
  'La princesa caminó hacia el castillo.',
  'Cuando llegó la noche salieron la luna y las estrellas.',
  'Y colorín colorado, este cuento se ha acabado.',
];
// localStorage puede no existir (prerender) o lanzar al tocarlo (modo privado, datos bloqueados): entonces solo memoria
function safeLocalStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

const OPENING = 'Había una vez una niña que vivía en una casa junto a un árbol. El sol brillaba, una nube pasaba y un gato jugaba.';

export default function StoryCanvas() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const demoRef = useRef(null);
  const [words, setWords] = useState([]);   // subtítulos confirmados
  const [interim, setInterim] = useState('');
  const [code, setCodeState] = useState('');  // código de familia guardado ('' = modo local)

  if (!sceneRef.current) sceneRef.current = new Scene();
  const directorRef = useRef(null), aiRef = useRef(null);
  if (!directorRef.current) {
    aiRef.current = createAI({ fetchImpl: (...a) => fetch(...a), storage: safeLocalStorage(), apiBase: process.env.NEXT_PUBLIC_API_BASE || '' });
    directorRef.current = createDirector({ scene: sceneRef.current, ai: aiRef.current });
  }

  const onEvents = useCallback(evs => directorRef.current.onEvents(evs), []);
  const onCaption = useCallback((finalText, live) => {
    if (finalText) setWords(w => w.concat(tokens(finalText)).slice(-14));
    setInterim(live);
  }, []);
  const tell = useCallback(text => { onCaption(text, ''); onEvents(tokens(text).filter(t => t.kind !== 'none')); }, [onCaption, onEvents]);

  const { listening, supported, status, toggle } = useSpeech({ tokenize: tokens, onEvents, onCaption });

  // bucle de dibujo
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    // enlace /?codigo=…: se guarda el código y se quita de la URL (que no quede en el historial ni al compartir)
    const ai = aiRef.current, url = new URL(window.location.href), fromUrl = url.searchParams.get('codigo');
    if (fromUrl !== null) {
      ai.setCode(fromUrl);
      url.searchParams.delete('codigo');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    setCodeState(ai.getCode());
    let raf; const loop = now => { sceneRef.current.frame(ctx, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    tell(OPENING);
    return () => cancelAnimationFrame(raf);
  }, [tell]);

  const clear = () => { clearTimeout(demoRef.current); sceneRef.current.clear(); setWords([]); setInterim(''); };
  const demo = () => {
    clear(); let i = 0;
    const step = () => { if (i < STORY.length) { tell(STORY[i++]); demoRef.current = setTimeout(step, 2800); } };
    step();
  };
  const onCode = e => {
    e.preventDefault(); const i = e.target.elements.codigo;
    aiRef.current.setCode(i.value); setCodeState(aiRef.current.getCode()); i.value = '';
  };
  const onType = e => { e.preventDefault(); const i = e.target.elements.frase; if (i.value.trim()) { tell(i.value); i.value = ''; } };

  return (
    <main className="wrap">
      <header>
        <h1>Your Story<small>Cuenta un cuento en voz alta y se dibuja solo</small></h1>
        <button id="mic" type="button" className={'mic' + (listening ? ' on' : '')} onClick={toggle} disabled={!supported} aria-pressed={listening}>
          <span className="dot" aria-hidden="true" />
          {listening ? 'Escuchando… (parar)' : 'Empezar a contar'}
        </button>
      </header>

      <div className="sheet"><canvas ref={canvasRef} width={W} height={H} aria-label="Dibujo del cuento" /></div>

      <div className="caption" aria-live="polite">
        {words.map((t, i) => <span key={i} className={t.kind === 'noun' ? 'k' : (t.kind === 'none' || t.kind === 'art') ? 'w' : 'c'}>{t.raw} </span>)}
        {interim && <span className="live">{interim}</span>}
      </div>
      <div className={'status' + (status.error ? ' err' : '')}>{status.text}</div>

      <div className="controls">
        <button type="button" onClick={demo}>Cuento de ejemplo</button>
        <button type="button" onClick={clear}>Hoja nueva</button>
      </div>

      <details>
        <summary>Palabras que sabe dibujar y trucos</summary>
        <p>{VOCAB_LIST.join(', ')}.</p>
        <p>“Noche” oscurece la hoja y “día” la aclara. Los plurales dibujan varios. “Bosque” planta árboles y “jardín” flores. Un pez o un barco traen el mar.</p>
        <p>Colocar: “un gato <b>sobre</b> la casa”, “una niña <b>junto a</b> un perro”, “un oso <b>dentro de</b> la casa”. Tamaño: “un dragón <b>grande</b>”, “una casita <b>pequeña</b>”.</p>
        <p>Cámara: “miro a la <b>izquierda</b>”, “<b>caminamos hacia</b> el castillo”, “<b>volvemos</b>”.</p>
        <form onSubmit={onType}><input id="frase" name="frase" placeholder="Sin micrófono: escribe una frase" autoComplete="off" /><button type="submit">Dibujar</button></form>
        <p><b>Código de familia.</b> Con él, también dibuja palabras nuevas que no están en la lista. {code ? 'Este dispositivo ya tiene código.' : 'Sin código, dibuja solo las palabras de la lista.'}</p>
        <form onSubmit={onCode}><input id="codigo" name="codigo" aria-label="Código de familia" placeholder={code ? 'Cambiar código (vacío para quitarlo)' : 'Código de familia'} autoComplete="off" autoCapitalize="none" spellCheck={false} /><button type="submit">Guardar</button></form>
        <p><b>Privacidad.</b> El reconocimiento de voz lo hace el navegador: en Chrome y Safari, el audio lo procesa el servicio de voz del fabricante (Google o Apple). A la IA solo se envía la palabra que hay que dibujar. No guardamos el audio ni el cuento.</p>
      </details>
    </main>
  );
}
