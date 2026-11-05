import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, update, remove } from 'firebase/database';

let environment;
const roomPath = 'rooms/ABC234';
const room = () => ({ hostUid: 'host', state: '{}', ts: Date.now(), createdAt: Date.now() });
const db = uid => uid ? environment.authenticatedContext(uid).database() : environment.unauthenticatedContext().database();

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-poker-air',
    database: { rules: await readFile(new URL('../database.rules.json', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await environment.clearDatabase();
  await assertSucceeds(set(ref(db('host'), roomPath), room()));
});
after(async () => { await environment?.cleanup(); });

async function admit(uid = 'player') {
  const database = db(uid);
  await assertSucceeds(set(ref(database, `${roomPath}/members/${uid}`), true));
  return database;
}

test('bloqueia visitantes sem autenticação e a listagem de todas as salas', async () => {
  await assertFails(get(ref(db(), roomPath)));
  await assertFails(get(ref(db('outsider'), 'rooms')));
  await assertFails(get(ref(db('outsider'), roomPath)));
  await assertFails(set(ref(db(), 'rooms/DEF567'), room()));
});

test('membro lê sua sala, sem acesso ao estado de outra sala', async () => {
  const player = await admit();
  await assertSucceeds(get(ref(player, `${roomPath}/state`)));
  await assertSucceeds(set(ref(db('another-host'), 'rooms/DEF567'), { ...room(), hostUid: 'another-host' }));
  await assertFails(get(ref(player, 'rooms/DEF567/state')));
  await assertFails(set(ref(player, `${roomPath}/members/another-player`), true));
  await assertFails(set(ref(player, 'rooms/ZZZ999/members/player'), true));
});

test('apenas o anfitrião altera ou apaga o estado e o dono é imutável', async () => {
  const player = await admit();
  await assertFails(set(ref(player, `${roomPath}/state`), 'cheat'));
  await assertFails(remove(ref(player, roomPath)));
  await assertFails(update(ref(player, roomPath), { hostUid: 'player' }));
  await assertFails(update(ref(db('host'), roomPath), { hostUid: 'someone-else' }));
  await assertSucceeds(update(ref(db('host'), roomPath), { state: '{"pot":100}', ts: Date.now() }));
  await assertSucceeds(remove(ref(db('host'), roomPath)));
});

test('cada jogador envia apenas seu pedido; o anfitrião confirma removendo', async () => {
  const player = await admit();
  const path = `${roomPath}/requests/player`;
  const request = { type: 'join', id: 'request-1', name: 'Ana', seat: 0 };
  await assertSucceeds(set(ref(player, path), request));
  await assertFails(set(ref(player, `${roomPath}/requests/other`), request));
  await assertFails(set(ref(player, path), { ...request, seat: 1 }));
  await assertSucceeds(remove(ref(db('host'), path)));
  await assertSucceeds(set(ref(player, path), { type: 'action', id: 'request-2', playerId: 'p1', action: { type: 'allin' } }));
  await assertSucceeds(remove(ref(player, path)));
});

test('rejeita pedidos inválidos e valores de aposta inválidos', async () => {
  const player = await admit();
  const target = ref(player, `${roomPath}/requests/player`);
  for (const request of [
    { type: 'join', name: 'Ana', seat: 9 },
    { type: 'join', name: 'Ana', seat: 0, emoji: 'a'.repeat(33) },
    { type: 'join', name: 'Ana', seat: 0, emoji: 123 },
    { type: 'join', name: 'Ana', seat: 0, emoji: '' },
    { type: 'join', name: 'Ana', seat: 0.5 },
    { type: 'join', name: 'a'.repeat(13), seat: 0 },
    { type: 'admin' },
    { type: 'action', playerId: 'p1', action: { type: 'raise', amount: -1 } },
    { type: 'action', playerId: 'p1', action: { type: 'raise' } },
    { type: 'action', playerId: 'p1', action: { type: 'fold', source: 'timeout' } },
  ]) await assertFails(set(target, { ...request, id: 'invalid-request' }));
});

test('diretório de salas pertence ao próprio anfitrião', async () => {
  const summary = { code: 'ABC234', updatedAt: Date.now(), playerCount: 0, phase: 'waiting' };
  await assertSucceeds(set(ref(db('host'), 'roomDirectory/host/ABC234'), summary));
  await assertSucceeds(get(ref(db('host'), 'roomDirectory/host')));
  await assertFails(get(ref(db('outsider'), 'roomDirectory/host')));
  await assertFails(set(ref(db('outsider'), 'roomDirectory/outsider/ABC234'), summary));
  await assertFails(set(ref(db('outsider'), 'roomDirectory/host/ABC234'), summary));
});

test('um segundo anfitrião não pode tomar posse de uma sala existente', async () => {
  await assertFails(set(ref(db('outsider'), roomPath), { ...room(), hostUid: 'outsider' }));
  await assertSucceeds(get(ref(db('outsider'), `${roomPath}/ts`)));
  await assertFails(get(ref(db(), `${roomPath}/ts`)));
});

test('aceita emoji no pedido de entrada e na atualização do próprio avatar', async () => {
  const player = await admit();
  const target = ref(player, `${roomPath}/requests/player`);
  await assertSucceeds(set(target, { type: 'join', id: 'avatar-1', name: 'Ana', seat: 0, emoji: '👩🏽‍🚀' }));
  await assertSucceeds(remove(ref(db('host'), `${roomPath}/requests/player`)));
  await assertSucceeds(set(target, { type: 'join', id: 'avatar-2', name: 'Ana', seat: 0, emoji: '🦊' }));
});
