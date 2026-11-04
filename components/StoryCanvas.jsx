'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Scene } from '@/lib/scene';
import { tokens, VOCAB_LIST } from '@/lib/vocab';
import { W, H } from '@/lib/figures';
import { useSpeech } from '@/lib/useSpeech';

const STORY = [
  'Había una vez una princesa que vivía en un castillo grande.',
  'Junto al castillo crecía un bosque lleno de flores.',
  'Un día llegó un perro y un conejo a jugar.',
  'Volaban mariposas y un pájaro sobre la casa.',
  'La princesa caminó hacia el castillo.',
  'Cuando llegó la noche salieron la luna y las estrellas.',
  'Y colorín colorado, este cuento se ha acabado.',
];
const OPENING = 'Había una vez una niña que vivía en una casa junto a un árbol. El sol brillaba, una nube pasaba y un gato jugaba.';

export default function StoryCanvas() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const demoRef = useRef(null);
  const [words, setWords] = useState([]);   // subtítulos confirmados
  const [interim, setInterim] = useState('');

  if (!sceneRef.current) sceneRef.current = new Scene();

  const onEvents = useCallback(evs => { for (const ev of evs) sceneRef.current.handle(ev); }, []);
  const onCaption = useCallback((finalText, live) => {
    if (finalText) setWords(w => w.concat(tokens(finalText)).slice(-14));
    setInterim(live);
  }, []);
  const tell = useCallback(text => { onCaption(text, ''); onEvents(tokens(text).filter(t => t.kind !== 'none')); }, [onCaption, onEvents]);

  const { listening, supported, status, toggle } = useSpeech({ tokenize: tokens, onEvents, onCaption });

  // bucle de dibujo
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
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
      </details>
    </main>
  );
}
