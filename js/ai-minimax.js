// IA Minimax com poda alfa-beta — o PC (branco? não: o PC joga com a cor que lhe couber).
// Valores clássicos: peão 100, cavalo 320, bispo 330, torre 500, rainha 900, rei 20000.
// Tabelas de posição (piece-square) simples para peões/cavalos centro.

import { aplicar, movimentosLegais, estadoJogo, corDe, tipoDe } from './chess-rules.js';

const VALOR = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// bônus por centralização (casa perto do centro vale mais)
const BONUS_CENTRO = [0, 2, 6, 10, 6, 2, 0];

export function avaliar(estado, corDaIA) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = estado.tabuleiro[i];
    if (!p) continue;
    const tipo = tipoDe(p);
    let v = VALOR[tipo] || 0;
    if (tipo !== 'K') {
      const f = i % 8, r = Math.floor(i / 8);
      v += BONUS_CENTRO[Math.min(f, 7 - f)] + BONUS_CENTRO[Math.min(r, 7 - r)];
    }
    score += corDe(p) === corDaIA ? v : -v;
  }
  return score;
}

function ordena(estado, movs, corDaIA) {
  // capturas primeiro (peça valiosa capturada primeiro — melhora a poda)
  return movs.map(m => {
    const alvo = estado.tabuleiro[m.to];
    const va = alvo ? (VALOR[tipoDe(alvo)] || 0) : 0;
    return { m, peso: va + (m.promo ? 800 : 0) };
  }).sort((a, b) => b.peso - a.peso).map(x => x.m);
}

function maxValor(estado, profundidade, alpha, beta, corDaIA) {
  const fim = estadoJogo(estado);
  if (fim === 'mate') {
    return estaEmCheckFim(estado, corDaIA) ? -100000 - profundidade * 100 : 100000 + profundidade * 100;
  }
  if (fim === 'afogamento') return 0;
  if (profundidade === 0) return avaliar(estado, corDaIA);

  let melhor = -Infinity;
  for (const m of ordena(estado, movimentosLegais(estado), corDaIA)) {
    const v = minValor(aplicar(estado, m), profundidade - 1, alpha, beta, corDaIA);
    if (v > melhor) melhor = v;
    if (melhor > alpha) alpha = melhor;
    if (alpha >= beta) break; // poda
  }
  return melhor;
}

function minValor(estado, profundidade, alpha, beta, corDaIA) {
  const fim = estadoJogo(estado);
  if (fim === 'mate') {
    return estaEmCheckFim(estado, corDaIA) ? -100000 - profundidade * 100 : 100000 + profundidade * 100;
  }
  if (fim === 'afogamento') return 0;
  if (profundidade === 0) return avaliar(estado, corDaIA);

  let melhor = Infinity;
  for (const m of ordena(estado, movimentosLegais(estado), corDaIA)) {
    const v = maxValor(aplicar(estado, m), profundidade - 1, alpha, beta, corDaIA);
    if (v < melhor) melhor = v;
    if (melhor < beta) beta = melhor;
    if (alpha >= beta) break; // poda
  }
  return melhor;
}

// estaEmCheckFim: o estado é mate e o rei em check é o da IA?
function estaEmCheckFim(estado, corDaIA) {
  // estadoJogo devolve 'mate' quando QUEM TEM A VEZ está em check sem lances;
  // se o turno é o da IA, a IA foi enxadada-mate
  return estado.turno === corDaIA;
}

// escolhe a jogada da IA (a melhor por minimax com poda)
// profundidade: 2 = modo PC (rápido) | 3-4 = modo Impossível
export function jogadaMinimax(estado, profundidade = 2) {
  const corDaIA = estado.turno;
  const movs = movimentosLegais(estado);
  if (!movs.length) return null;

  let melhor = null, melhorV = -Infinity;
  let alpha = -Infinity;
  for (const m of ordena(estado, movs, corDaIA)) {
    const v = minValor(aplicar(estado, m), profundidade - 1, alpha, Infinity, corDaIA);
    if (v > melhorV) { melhorV = v; melhor = m; }
    if (melhorV > alpha) alpha = melhorV;
  }
  return melhor;
}
