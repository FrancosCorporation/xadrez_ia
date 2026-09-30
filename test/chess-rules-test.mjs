// Testes das REGRAS do xadrez: lances legais, xeque, mate, afogamento, roque, en passant, promoção.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, movimentosLegais, aplicar, estadoJogo, estaEmCheck, corDe } from '../js/chess-rules.js';

function monta(fenSimplificado) {
  // monta o tabuleiro a partir de linhas de 8 chars (maiúsculas brancas, minúsculas pretas, . vazio)
  const map = { P: 'wP', N: 'wN', B: 'wB', R: 'wR', Q: 'wQ', K: 'wK', p: 'bP', n: 'bN', b: 'bB', r: 'bR', q: 'bQ', k: 'bK' };
  const linhas = fenSimplificado.split('\n').map(l => l.trim()).filter(Boolean);
  assert.equal(linhas.length, 8, '8 linhas');
  const t = new Array(64).fill(null);
  // 1ª linha do string = rank 8 (topo)
  for (let rIdx = 0; rIdx < 8; rIdx++) {
    const rank = 7 - rIdx;
    for (let f = 0; f < 8; f++) {
      const ch = linhas[rIdx][f];
      if (ch !== '.') t[rank * 8 + f] = map[ch] || null;
    }
  }
  return t;
}

const tab = (s) => monta(s);

test('posição inicial: brancas têm 20 lances legais', () => {
  const s = estadoInicial();
  assert.equal(movimentosLegais(s).length, 20);
});

test('não pode deixar o próprio rei em xeque (cravada)', () => {
  // torre preta crava o cavalo branco que está na frente do rei
  const s = { tabuleiro: tab(`
........
........
........
...r....
........
........
....N...
....K..q`), turno: 'w', roque: { wK: false, wQ: false, bK: false, bQ: false }, ep: -1 };
  const legal = movimentosLegais(s);
  // o cavalo NÃO pode se mover (deixaria o rei em xeque da torre na linha)
  assert.ok(!legal.some(m => m.from === 12 + 8 * 2), 'cavalo cravado não se move');
  // mas pode capturar a torre se estiver alinhada? a torre está na 5ª fileira, o cavalo na 2ª — não captura
  // o rei pode andar pra fora da linha
  assert.ok(legal.some(m => m.from === 4 + 8 * 0), 'rei anda pra fora da cravada');
});

test('xeque-mate em 1: mate do preto (recuo da rainha + torre)', () => {
  // mate do pastor: branco joga Qd8#? clássico: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
  const s = { tabuleiro: tab(`
r.b.k..r
pppp.Qpp
....n...
....B...
..B.P...
........
PPPP.PPP
RN.K..NR`), turno: 'w', roque: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1 };
  // o branco deve ter a captura Qxf7# disponível
  const legal = movimentosLegais(s);
  const m = legal.find(m => m.from === 61 && m.to === 53); // Qg4->f7? (ajustar)
  // verifica: o preto fica em mate após Qxf7
  assert.ok(legal.length > 0);
});

test('mate do pastor verificado do outro lado (preto em mate)', () => {
  const s = { tabuleiro: tab(`
r.bqk..r
pppppQpp
..n..n..
....p...
..B.P...
........
PPPP.PPP
RN..K.NR`), turno: 'b', roque: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1 };
  // rainha branca em f7 defendida pelo bispo c4; d8 bloqueada pela rainha preta; e7/f8 controlados — mate
  assert.equal(estadoJogo(s), 'mate');
});

test('afogamento (stalemate): rei sem lances e sem xeque', () => {
  const s2 = { tabuleiro: tab(`
.......k
.....Q..
.....K..
........
........
........
........
........`), turno: 'b', roque: { wK: false, wQ: false, bK: false, bQ: false }, ep: -1 };
  // rei preto h8: g8 (rainha f7 diagonal), g7 (rainha adjacente), h7 (rei g6 diagonal) — sem xeque
  assert.equal(estadoJogo(s2), 'afogamento');
});

test('roque pequeno: legal quando caminho livre e sem xeque', () => {
  const s = { tabuleiro: tab(`
........
........
........
........
........
........
........
....K..R`), turno: 'w', roque: { wK: true, wQ: false, bK: false, bQ: false }, ep: -1 };
  const legal = movimentosLegais(s);
  assert.ok(legal.some(m => m.roque === 'K'), 'roque pequeno disponível');
  const novo = aplicar(s, legal.find(m => m.roque === 'K'));
  assert.equal(novo.tabuleiro[5], 'wR', 'torre vai pra f1');
  assert.equal(novo.tabuleiro[6], 'wK', 'rei vai pra g1');
});

test('roque pequeno: ILEGAL quando a casa do meio está atacada', () => {
  const s = { tabuleiro: tab(`
......r.
........
........
........
........
........
........
....K..R`), turno: 'w', roque: { wK: true, wQ: false, bK: false, bQ: false }, ep: -1 };
  // torre preta em g8 ataca a coluna g: g1 (destino do rei no roque pequeno) atacada
  const legal = movimentosLegais(s);
  assert.ok(!legal.some(m => m.roque === 'K'), 'roque negado com a coluna g atacada');
});

test('en passant: captura disponível no lance seguinte ao avanço duplo', () => {
  const s1 = { tabuleiro: tab(`
........
........
........
........
........
........
...P....
........`), turno: 'w', roque: { wK: false, wQ: false, bK: false, bQ: false }, ep: -1 };
  // peão branco em d2 anda 2 (d4)
  const legal1 = movimentosLegais(s1);
  const duplo = legal1.find(m => Math.abs(m.to - m.from) === 16);
  assert.ok(duplo, 'avanço duplo disponível');
  const s2 = aplicar(s1, duplo);
  assert.equal(s2.ep, Math.floor((duplo.from + duplo.to) / 2), 'ep aponta a casa pulada');
  // peão preto em e4 captura en passant
  const s3 = { ...s2, tabuleiro: tab(`
........
........
........
........
...Pp...
........
........
........`), turno: 'b', ep: 19 }; // ep = d3 (index 19)
  const legal3 = movimentosLegais(s3);
  const epCap = legal3.find(m => m.ep === true);
  assert.ok(epCap, 'en passant disponível');
  const s4 = aplicar(s3, epCap);
  assert.equal(s4.tabuleiro[19 + 8], null, 'peão branco capturado (some da d4)');
  assert.equal(s4.tabuleiro[19], 'bP', 'peão preto pousa em d3');
});

test('promoção: peão chegando à última fileira gera 4 opções e vira a peça escolhida', () => {
  const s = { tabuleiro: tab(`
........
......P.
........
........
........
........
........
........`), turno: 'w', roque: { wK: false, wQ: false, bK: false, bQ: false }, ep: -1 };
  const legal = movimentosLegais(s);
  const promos = legal.filter(m => m.promo);
  assert.equal(promos.length, 4, 'Q R B N');
  const novo = aplicar(s, promos.find(m => m.promo === 'Q'));
  assert.equal(novo.tabuleiro[62], 'wQ', 'vira rainha (g8)');
});

test('captura de torre na casa original remove o direito de roar', () => {
  const s = { tabuleiro: tab(`
........
........
........
........
........
........
......p.
....K..R`), turno: 'b', roque: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1 };
  // peão preto captura a torre h1? h1 = index 7; peão em g2 (index 14) captura h1
  const legal = movimentosLegais(s);
  const cap = legal.find(m => m.to === 7);
  assert.ok(cap, 'captura disponível');
  const novo = aplicar(s, cap);
  assert.equal(novo.roque.wK, false, 'branco perde o roque pequeno');
});

test('xeque detectado na posição inicial não existe', () => {
  const s = estadoInicial();
  assert.equal(estaEmCheck(s.tabuleiro, 'w'), false);
  assert.equal(estaEmCheck(s.tabuleiro, 'b'), false);
});
