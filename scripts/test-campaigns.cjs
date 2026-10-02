const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { test } = require('node:test');
const source = fs.readFileSync(
  path.join(__dirname, '../lib/tournament/campaigns.ts'),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { score, campaigns } = exportsObject;
const match = (overrides = {}) => ({
  id: 'one',
  date: '2026-09-25',
  opponent: 'Adversário',
  result: 'win',
  color: 'white',
  type: 'tournament',
  time_control: 'Rápido',
  notes: 'Escolar · Rodada 1',
  source: 'chessresults',
  source_id: '100-7-r1',
  ...overrides,
});

test('Aproveitamento inclui meio ponto por empate: 31/45', () => {
  const result = score([
    ...Array(30).fill({ result: 'win' }),
    ...Array(2).fill({ result: 'draw' }),
    ...Array(13).fill({ result: 'loss' }),
  ]);
  assert.equal(result.points, 31);
  assert.ok(Math.abs(result.percent - 68.8888888889) < 0.00001);
  assert.equal(score([]).percent, 0);
  assert.equal(score([{ result: 'draw' }]).percent, 50);
});
test('Agrupa por ID de torneio, ordena rodadas numericamente e mantém eventos separados', () => {
  const input = [
    match({ id: '10', source_id: '100-7-r10' }),
    match({ id: '2', source_id: '100-7-r2', result: 'draw' }),
    match({ id: 'other', source_id: '101-7-r1' }),
  ];
  const result = campaigns(input);
  assert.equal(result.length, 2);
  assert.equal(
    result
      .find((g) => g.tnr === '100')
      .matches.map((m) => m.id)
      .join(','),
    '2,10'
  );
  assert.equal(result.find((g) => g.tnr === '100').points, 1.5);
  assert.equal(input[0].id, '10');
});
test('Não mistura partidas avulsas, online ou torneios sem identificador', () => {
  const result = campaigns([
    match({ id: 'manual-1', source: 'manual', source_id: null }),
    match({ id: 'manual-2', source: 'manual', source_id: null }),
    match({ id: 'online', type: 'chesscom' }),
  ]);
  assert.equal(result.length, 2);
  assert.ok(result.every((g) => g.tnr === null && g.total === 1));
});
