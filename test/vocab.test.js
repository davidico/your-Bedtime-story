import { tokens, ADJ, COLORS, DETS, STOP } from '@/lib/vocab';
import { PALETTE_KEYS } from '@/lib/figures';
const kinds = t => tokens(t).filter(x => x.kind !== 'none').map(x => x.kind + ':' + (x.word ?? x.key ?? ''));
test('sustantivo desconocido tras determinante', () => {
  expect(kinds('había una vez un panda')).toEqual(['unk:panda']);
  expect(kinds('un gran dinosaurio')).toContain('unk:dinosaurio');
  expect(tokens('unos dinosaurios').find(t => t.kind === 'unk')).toMatchObject({ word: 'dinosaurios', plural: true });
  expect(kinds('un rato después')).toEqual([]);
  expect(kinds('un gato')).toEqual(['noun:gato']);
  expect(kinds('el panda').at(-1)).toBe('unk:panda');
});
test('colores', () => {
  expect(kinds('una vaca de color tomate')).toEqual(['unk:vaca', 'color:red']);
  expect(kinds('un gato rojo')).toEqual(['noun:gato', 'color:red']);
  expect(kinds('un gato rosa')).toEqual(['noun:gato', 'color:pink']);
  expect(kinds('una rosa')).toEqual(['noun:flor']);
  expect(kinds('color cielo')).toEqual(['color:lblue']);
});
test('detalles: pos, singular, art, gran, tablas', () => {
  expect(tokens('había un panda').map(t => t.pos)).toEqual([0, 1, 2]);
  expect(tokens('un panda').find(t => t.kind === 'unk')).toMatchObject({ raw: 'panda', word: 'panda', plural: false, pos: 1 });
  expect(tokens('el panda')[0]).toMatchObject({ kind: 'art', pos: 0 });
  expect(ADJ.gran).toBe(1.5);
  expect(kinds('un gran dinosaurio')).toEqual(['adj:', 'unk:dinosaurio']);
  expect(kinds('un panda')).toEqual(['unk:panda']);
  expect(kinds('panda')).toEqual([]); // sin determinante no hay unk
  expect(kinds('un oso')).toEqual(['noun:oso']);
  expect(kinds('al final')).toEqual(['art:']);
  expect(kinds('un ratón')).toEqual(['unk:raton']);
  for (const v of Object.values(COLORS)) expect(PALETTE_KEYS).toContain(v);
  expect(DETS.has('unos')).toBe(true); expect(STOP.has('vez')).toBe(true);
});
test('colores ambiguos y comparaciones', () => {
  expect(kinds('un pez naranja')).toEqual(['noun:pez', 'color:orange']);
  expect(kinds('una naranja')).toEqual(['unk:naranja']);
  expect(kinds('un chocolate')).toEqual(['unk:chocolate']);
  expect(kinds('una fresa')).toEqual(['unk:fresa']);
  expect(kinds('un limón')).toEqual(['unk:limon']);
  expect(kinds('naranja')).toEqual([]);
  expect(kinds('una vaca de color naranja')).toEqual(['unk:vaca', 'color:orange']);
  expect(kinds('una rosa')).toEqual(['noun:flor']);
  expect(kinds('un gato rosa')).toEqual(['noun:gato', 'color:pink']);
  expect(kinds('un tomate')).toEqual(['unk:tomate']);
  expect(kinds('un gato tomate')).toEqual(['noun:gato']);
  expect(kinds('unas rosas')).toEqual(['noun:flor']);
  expect(kinds('una vaca azul')).toEqual(['unk:vaca', 'color:blue']);
  expect(kinds('el cielo')).toEqual(['art:']); // STOP: no dibujable
  expect(tokens('el cielo')[1]).toMatchObject({ kind: 'none', gap: true }); expect(tokens('cielo')[0].gap).toBeUndefined();
});
test('el determinante sobrevive a colores y adjetivos de STOP', () => {
  expect(kinds('un rojo dinosaurio')).toEqual(['color:red', 'unk:dinosaurio']);
  expect(kinds('una nueva amiga')).toEqual(['noun:nina']);
  expect(kinds('una nueva jirafa')).toEqual(['unk:jirafa']);
  expect(kinds('un buen amigo')).toEqual(['noun:nino']);
  expect(kinds('unos viejos piratas')).toEqual(['unk:piratas']);
  expect(kinds('unos grandes dinosaurios')).toEqual(['unk:dinosaurios']);
  expect(kinds('un rato rojo')).toEqual(['color:red']);
});

// --- revisión final ---
test('adjetivos de cuento delante del sustantivo no son figura y mantienen el determinante', () => {
  expect(kinds('el feroz lobo')).toEqual(['art:', 'noun:lobo']);
  expect(kinds('la hermosa casa')).toEqual(['art:', 'noun:casa']);
  expect(kinds('los feroces lobos')).toEqual(['art:', 'noun:lobo']);
  expect(kinds('una linda jirafa')).toEqual(['unk:jirafa']);
  expect(kinds('unos jóvenes piratas')).toEqual(['unk:piratas']);
});
test('plural solo si el singular cambia', () => {
  expect(tokens('un autobús')[1]).toMatchObject({ kind: 'unk', plural: false });
  expect(tokens('un paraguas')[1]).toMatchObject({ kind: 'unk', plural: false });
  expect(tokens('dos ratones')[1]).toMatchObject({ kind: 'unk', plural: true });
  expect(tokens('unas naranjas')[1]).toMatchObject({ kind: 'unk', plural: true });
});
