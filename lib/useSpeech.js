'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createHolds } from './partials';

/**
 * Reconocimiento de voz continuo en español con la Web Speech API.
 * onEvents(events, {final, index}) recibe SÓLO los eventos nuevos de cada resultado,
 * así los dibujos aparecen mientras la frase aún se está diciendo.
 * Un desconocido al final de un parcial se retiene (ver lib/partials.js) y se emite
 * cuando le sigue otra palabra, el resultado es final o pasan 600 ms sin cambios.
 */
export function useSpeech({ tokenize, onEvents, onCaption }) {
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const holdsRef = useRef(null); // de-dup por resultado + retenidos (lib/partials.js)
  const wakeRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState({ text: '', error: false });

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); setStatus({ text: 'Este navegador no reconoce la voz. Ábrelo en Chrome (Android/ordenador) o Safari (iPhone/iPad).', error: true }); return; }
    const rec = new SR();
    const lang = (navigator.language || '').toLowerCase().startsWith('es') ? navigator.language : 'es-ES';
    rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;

    const holds = holdsRef.current = createHolds(onEvents);
    rec.onstart = () => { holds.reset(); setStatus({ text: 'Te escucho. Cuenta tu historia.', error: false }); };
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        holds.feed(i, tokenize(txt), e.results[i].isFinal);
        if (e.results[i].isFinal) onCaption(txt, ''); else interim += txt;
      }
      if (interim) onCaption('', interim);
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false; setListening(false);
        setStatus({ text: 'El micrófono está bloqueado. Permite el acceso al micrófono en el navegador y vuelve a pulsar.', error: true });
      } else if (e.error === 'network') {
        setStatus({ text: 'El reconocimiento de voz necesita conexión a internet.', error: true });
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setStatus({ text: 'Algo falló con el micrófono (' + e.error + '). Pulsa de nuevo para seguir.', error: true });
      }
    };
    // Los navegadores cortan la escucha cada cierto tiempo: la reanudamos solos.
    rec.onend = () => { if (wantRef.current) { try { rec.start(); } catch (_) { setTimeout(() => { try { wantRef.current && rec.start(); } catch (__) {} }, 300); } } };
    recRef.current = rec;
    return () => { wantRef.current = false; holds.clear(); try { rec.stop(); } catch (_) {} };
  }, [tokenize, onEvents, onCaption]);

  const start = useCallback(async () => {
    if (!recRef.current) return;
    wantRef.current = true; setListening(true);
    try { recRef.current.start(); } catch (_) {}
    try { wakeRef.current = await navigator.wakeLock?.request('screen'); } catch (_) {}
  }, []);
  const stop = useCallback(() => {
    wantRef.current = false; setListening(false);
    holdsRef.current?.clear(); // en pausa no sale nada retenido; si llega un final, lo emite normal
    try { recRef.current?.stop(); } catch (_) {}
    try { wakeRef.current?.release(); } catch (_) {}
    setStatus({ text: 'En pausa.', error: false });
  }, []);
  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { listening, supported, status, start, stop, toggle };
}
