import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';

// Compila os módulos TypeScript em memória, usando o compilador já fornecido pelo Vite.
let game;
before(async () => {
  const { outputFiles } = await build({
    stdin: {
      contents: "export * from './src/game/roomRequests'; export * from './src/game/gameLogic';",
      resolveDir: process.cwd(), loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'node',
  });
  game = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
});

function joinedState() {
  let state = game.createGameState();
  state = game.applyRoomRequest(state, 'alice', { type: 'join', name: 'Alice', seat: 0 });
  state = game.applyRoomRequest(state, 'bob', { type: 'join', name: 'Bob', seat: 1 });
  return state;
}

test('a entrada associa o jogador ao UID autenticado e impede ocupar outro assento', () => {
  const state = joinedState();
  assert.equal(state.players[0].sessionId, 'alice');
  assert.equal(game.applyRoomRequest(state, 'alice', { type: 'join', name: 'Alice', seat: 2 }), state);
  assert.equal(game.applyRoomRequest(state, 'eve', { type: 'join', name: 'Eve', seat: 0 }), state);
});

test('jogador não pode remover ou jogar por outro participante', () => {
  const state = game.startNewHand(joinedState());
  const alice = state.players.find(p => p.sessionId === 'alice');
  assert.equal(game.applyRoomRequest(state, 'bob', { type: 'leave', playerId: alice.id }), state);
  assert.equal(game.applyRoomRequest(state, 'bob', { type: 'action', playerId: alice.id, action: { type: 'fold' } }), state);
});

test('jogador envia sua ação e pode sair da própria mesa', () => {
  const state = game.startNewHand(joinedState());
  const current = state.players[state.currentPlayerIndex];
  const next = game.applyRoomRequest(state, current.sessionId, { type: 'action', playerId: current.id, action: { type: 'fold' } });
  assert.notEqual(next, state);
  const waiting = joinedState();
  const alice = waiting.players.find(p => p.sessionId === 'alice');
  const afterLeaving = game.applyRoomRequest(waiting, 'alice', { type: 'leave', playerId: alice.id });
  assert.equal(afterLeaving.players.some(p => p.id === alice.id), false);
});

test('jogadas fora da vez e tentativas de comandar bots não alteram a partida', () => {
  let state = joinedState();
  state = game.addPlayer(state, 'Bot', 2, true);
  state = game.startNewHand(state);
  const other = state.players.find((p, index) => index !== state.currentPlayerIndex && !p.isBot);
  assert.equal(game.applyRoomRequest(state, other.sessionId, { type: 'action', playerId: other.id, action: { type: 'fold' } }), state);
  const bot = state.players.find(p => p.isBot);
  assert.equal(game.applyRoomRequest(state, 'alice', { type: 'leave', playerId: bot.id }), state);
});
