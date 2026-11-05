import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';

let events;
let audioSource;
before(async () => {
  async function compile(entry) {
    const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
    return `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  }
  events = await import(await compile('src/audio/soundEvents.ts'));
  audioSource = await compile('src/audio/gameAudio.ts');
});
const snapshot = (overrides = {}) => ({ hand: 1, board: 0, showdown: false, turn: '', ...overrides });

test('carregamento inicial e atualizações repetidas não tocam sons', () => {
  const current = snapshot({ hand: 25, board: 4, turn: 'my-turn' });
  assert.deepEqual(events.getSoundCues(null, current, true), []);
  assert.deepEqual(events.getSoundCues(current, { ...current }, true), []);
  assert.deepEqual(events.getSoundCues(current, snapshot({ hand: 0 }), true), []);
});

test('nova mão toca abertura e duas cartas, sem repetir as cartas da mão anterior', () => {
  const cues = events.getSoundCues(snapshot({ board: 5, showdown: true }), snapshot({ hand: 2 }), true);
  assert.deepEqual(cues.map(cue => cue.sound), ['newHand', 'deal', 'deal']);
  assert(cues[1].delay > cues[0].delay);
  assert(cues[2].delay > cues[1].delay);
});

test('flop revela três cartas e turn e river revelam uma carta por vez', () => {
  assert.equal(events.getSoundCues(snapshot(), snapshot({ board: 3 }), true).length, 3);
  assert.deepEqual(events.getSoundCues(snapshot({ board: 3 }), snapshot({ board: 4 }), true), [{ sound: 'flip', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(snapshot({ board: 4 }), snapshot({ board: 5 }), true), [{ sound: 'flip', delay: 0 }]);
});

test('avisa a própria vez e uma nova rodada de apostas, sem repetir no relógio', () => {
  const ownTurn = snapshot({ turn: 'hand1:preflop:me:100' });
  assert.deepEqual(events.getSoundCues(snapshot(), ownTurn), [{ sound: 'yourTurn', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(ownTurn, { ...ownTurn }), []);
  assert.deepEqual(events.getSoundCues(ownTurn, snapshot({ turn: 'hand1:flop:me:200' })), [{ sound: 'yourTurn', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(ownTurn, snapshot()), []);
});

test('celular toca apenas sua vez, inclusive na primeira renderização', () => {
  const current = snapshot({ turn: 'first-turn', board: 3 });
  assert.deepEqual(events.getSoundCues(null, current), [{ sound: 'yourTurn', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(snapshot({ hand: 0 }), current), [{ sound: 'yourTurn', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(snapshot({ hand: 0 }), snapshot()), []);
  assert.deepEqual(events.getSoundCues(snapshot(), snapshot({ board: 3 })), []);
  assert.deepEqual(events.getSoundCues(snapshot({ board: 3 }), snapshot({ board: 4 })), []);
  assert(events.getSoundCues(snapshot({ hand: 0 }), current, true).every(cue => cue.sound !== 'yourTurn'));
});

test('showdown revela mãos no host, sem duplicar o som no jogador', () => {
  assert.deepEqual(events.getSoundCues(snapshot({ board: 5 }), snapshot({ board: 5, showdown: true }), true), [{ sound: 'flip', delay: 0 }]);
  assert.deepEqual(events.getSoundCues(snapshot({ board: 5 }), snapshot({ board: 5, showdown: true })), []);
});

test('identifica a vez pelo assento e ignora jogadores fora da ação', () => {
  const state = {
    players: [{ id: 'alice', seat: 0, isFolded: false, isAllIn: false }],
    currentPlayerIndex: 0, phase: 'preflop', handNumber: 1, turnStartTime: 100, communityCards: [],
  };
  assert.notEqual(events.getSoundSnapshot(state, 0).turn, '');
  assert.equal(events.getSoundSnapshot(state, 1).turn, '');
  assert.equal(events.getSoundSnapshot(state).turn, '');
  assert.equal(events.getSoundSnapshot({ ...state, phase: 'showdown' }, 0).turn, '');
  assert.equal(events.getSoundSnapshot({ ...state, players: [{ ...state.players[0], isAllIn: true }] }, 0).turn, '');
});

test('áudio permanece habilitado, ignora preferências antigas e respeita interação e aba oculta', async () => {
  let created = 0;
  let started = 0;
  let stopped = 0;
  let storageReads = 0;
  let storageWrites = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class FakeContext {
    state = 'suspended';
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    constructor() { created++; FakeContext.latest = this; }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() {
      return { playbackRate: parameter(), connect() {}, disconnect() {}, start() { started++; }, stop() { stopped++; } };
    }
    createOscillator() {
      return { frequency: parameter(), connect() {}, disconnect() {}, start() { started++; }, stop() { stopped++; } };
    }
  }
  const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  globalThis.window = { AudioContext: FakeContext };
  globalThis.document = { hidden: false };
  globalThis.localStorage = { getItem: () => { storageReads++; return 'false'; }, setItem: () => { storageWrites++; } };
  try {
    const audio = await import(`${audioSource}#mock-audio`);
    audio.playSoundCues([{ sound: 'yourTurn', delay: 0 }]);
    assert.equal(created, 0, 'Não cria AudioContext antes da interação');
    assert.equal(audio.isAudioReady(), false);
    audio.unlockAudio();
    assert.equal(audio.isAudioReady(), true);
    audio.playSoundCues([{ sound: 'yourTurn', delay: 0 }]);
    assert.equal(started, 3);
    assert.equal('setSoundEnabled' in audio, false);
    assert.equal('isSoundEnabled' in audio, false);
    assert.equal(storageReads, 0);
    assert.equal(storageWrites, 0);
    globalThis.document.hidden = true;
    assert.equal(audio.isAudioReady(), false);
    audio.playSoundCues([{ sound: 'yourTurn', delay: 0 }]);
    assert.equal(started, 3);
    globalThis.document.hidden = false;
    audio.playSoundCues([{ sound: 'newHand', delay: 0 }]);
    assert.equal(started, 6);
    FakeContext.latest.state = 'suspended';
    assert.equal(audio.isAudioReady(), false);
    audio.resumeExistingAudio();
    assert.equal(audio.isAudioReady(), true, 'Retoma o contexto previamente liberado');
    audio.playSoundCues([{ sound: 'yourTurn', delay: 0 }]);
    assert.equal(started, 8);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('registra click e touchend para liberar o áudio em dispositivos móveis', async () => {
  const handlers = new Map();
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: name => handlers.delete(name),
  };
  globalThis.document = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: name => handlers.delete(name),
  };
  try {
    const audio = await import(`${audioSource}#mobile-gestures`);
    const cleanup = audio.installAudioUnlock();
    assert(handlers.has('click'));
    assert(handlers.has('touchend'));
    assert(handlers.has('pointerup'));
    assert(handlers.has('focus'));
    assert(handlers.has('visibilitychange'));
    cleanup();
    assert.equal(handlers.size, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
});
