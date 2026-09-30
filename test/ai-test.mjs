// Testes da IA (Minimax com poda): lances legais, mate em 1, captura livre, evita perder material.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, movimentosLegais, aplicar, estadoJogo, tipoDe } from '../js/chess-rules.js';
import { jogadaMinimax, escolheJogada, avaliar } from '../js/ai-minimax.js';

function monta(fenSimplificado) {
  const map = { P: 'wP', N: 'wN', B: 'wB', R: 'wR', Q: 'wQ', K: 'wK', p: 'bP', n: 'bN', b: 'bB', r: 'bR', q: 'bQ', k: 'bK' };
  const linhas = fenSimplificado.split('\n').map(l => l.trim()).filter(Boolean);
  assert.equal(linhas.length, 8, '8 linhas');
  const t = new Array(64).fill(null);
  for (let rIdx = 0; rIdx < 8; rIdx++) {
    const rank = 7 - rIdx;
    for (let f = 0; f < 8; f++) {
      const ch = linhas[rIdx][f];
      if (ch !== '.') t[rank * 8 + f] = map[ch] || null;
    }
  }
  return t;
}

const estadoDe = (s, ep = -1, turno = 'w') => ({ tabuleiro: monta(s), turno, roque: { wK: false, wQ: false, bK: false, bQ: false }, ep });

test('IA devolve lance legal da posição inicial (profundidade 2 e 3)', () => {
  const s = estadoInicial();
  const m2 = jogadaMinimax(s, 2);
  assert.ok(m2, 'profundidade 2 devolve lance');
  assert.ok(movimentosLegais(s).some(x => x.from === m2.from && x.to === m2.to), 'legal');
  const m3 = jogadaMinimax(s, 3);
  assert.ok(m3, 'profundidade 3 devolve lance');
  assert.ok(movimentosLegais(s).some(x => x.from === m3.from && x.to === m3.to), 'legal');
});

test('IA encontra o mate em 1 (mate do pastor: Qxf7#)', () => {
  const s = estadoDe(`r.bqk..r
ppppp.pp
..n..n..
....p..Q
..B.P...
........
PPPP.PPP
RN..K.NR`, 'w');
  const m = jogadaMinimax(s, 2);
  assert.ok(m, 'lance encontrado');
  const novo = aplicar(s, m);
  assert.equal(estadoJogo(novo), 'mate', 'o lance da IA dá xeque-mate');
});

test('IA captura a rainha livre (ganho de material)', () => {
  const s = estadoDe(`.......k
........
........
...q....
....P...
........
........
....K..R`, 'w');
  const m = jogadaMinimax(s, 2);
  assert.ok(m, 'lance encontrado');
  // o peão e4 captura a rainha d5 (ganho de 900) — a IA deve preferir
  const valorCapturado = s.tabuleiro[m.to] ? (tipoDe(s.tabuleiro[m.to]) === 'Q' ? 900 : 100) : 0;
  assert.ok(valorCapturado >= 900, `IA capturou material valioso (capturado: ${valorCapturado})`);
});

test('IA não coloca a rainha em captura gratuita', () => {
  // branco tem várias opções; mover a rainha para d5 (comida pelo peão e6 de graça) é ruim
  const s = estadoDe(`.......k
........
....p...
........
........
........
........
...Q..R.`, 'w');
  const m = jogadaMinimax(s, 2);
  assert.ok(m, 'lance encontrado');
  assert.ok(!(m.from === 3 && m.to === 35), 'IA não jogou Qd5?? (rainha comida de graça pelo peão)');
});

test('avaliar: material a favor do branco dá score positivo', () => {
  const s = estadoDe(`.......k
........
........
........
........
........
.......P
....K..R`, 'w');
  assert.ok(avaliar(s, 'w') > 0, 'branco com peão extra: score > 0');
  assert.ok(avaliar(s, 'b') < 0, 'preto com peão a menos: score < 0');
});

test('performance: profundidade 3 na posição inicial em menos de 5s', () => {
  const s = estadoInicial();
  const t0 = Date.now();
  jogadaMinimax(s, 3);
  const dt = Date.now() - t0;
  assert.ok(dt < 5000, `profundidade 3 levou ${dt}ms (< 5000ms)`);
});

test('IA escapa do mate em 1 quando há escape', () => {
  // torre branca h8 dá xeque na coluna a (linha 8): o rei preto a8 captura a torre ou foge para a7
  const s3 = estadoDe(`k......R
........
........
........
........
........
........
....K...`, -1, 'b');
  const m = jogadaMinimax(s3, 2);
  assert.ok(m, 'lance encontrado sob xeque');
  const novo = aplicar(s3, m);
  // o rei captura a torre (a8->h8) ou foge — o jogo continua (não é mate)
  assert.notEqual(estadoJogo(novo), 'mate', 'a IA escapou do mate');
});


test('modos de dificuldade: fácil (raso + ruído) e difícil (3s) devolvem lance legal', () => {
  const s = estadoInicial();
  const facil = escolheJogada(s, 150, { profMax: 1, ruido: 90 });
  assert.ok(facil, 'fácil devolve lance');
  assert.ok(movimentosLegais(s).some(x => x.from === facil.from && x.to === facil.to), 'fácil: lance legal');
  const dificil = escolheJogada(s, 300, { profMax: 64 });
  assert.ok(dificil, 'difícil devolve lance');
  assert.ok(movimentosLegais(s).some(x => x.from === dificil.from && x.to === dificil.to), 'difícil: lance legal');
});
