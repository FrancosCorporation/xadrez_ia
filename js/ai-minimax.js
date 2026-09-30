// IA do xadrez — Minimax (negamax) com poda alfa-beta, QUiescENCE search, iterative deepening
// com orçamento de tempo, tabelas de posição (PST) e ordenação MVV-LVA.
// A IA responde no browser: PC = 800ms (profundidade ~3-4), Impossível = 2500ms (~4-6).

import { aplicar, movimentosLegais, estadoJogo, corDe, tipoDe } from './chess-rules.js';

const VALOR = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// Tabelas de posição (piece-square) — escritas de cima para baixo (a 1ª linha = rank 8),
// do ponto de vista do BRANCO. Para o preto, espelha as linhas (a mesma tabela de costas).
const PST = {
  P: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0],
  N: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  5,  0,  5,-20,-40,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50],
  B: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20],
  R: [
     0,  0,  5,  5,  5,  5,  0,  0,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      5, 10, 10, 10, 10, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0],
  Q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -10,  5,  5,  5,  5,  5,  0,-10,
      0,  0,  5,  5,  5,  5,  0, -5,
     -5,  0,  5,  5,  5,  5,  0, -5,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20],
  K: [
     20, 30, 10,  0,  0, 10, 30, 20,
     20, 20,  0,  0,  0,  0, 20, 20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30],
};

// índice da PST: para o BRANCO a tabela lê de cima (rank 8) — casa i: (7 - rank)*8 + file;
// para o PRETO a mesma tabela de costas: rank*8 + file
function pstIdx(tipo, i, cor) {
  const f = i % 8, r = Math.floor(i / 8);
  return cor === 'w' ? (7 - r) * 8 + f : r * 8 + f;
}

// avaliação do ponto de vista de QUEM TEM A VEZ (negamax)
export function avaliar(estado, cor = estado.turno) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = estado.tabuleiro[i];
    if (!p) continue;
    const tipo = tipoDe(p), c = corDe(p);
    const v = VALOR[tipo] + (PST[tipo] ? PST[tipo][pstIdx(tipo, i, c)] : 0);
    score += c === cor ? v : -v;
  }
  return score;
}

// ordenação MVV-LVA: capturas primeiro (vítima valiosa × agressor barato)
function ordena(estado, movs) {
  return movs.map(m => {
    let peso = 0;
    const alvo = estado.tabuleiro[m.to];
    if (alvo) peso = (VALOR[tipoDe(alvo)] || 0) * 10 - (VALOR[tipoDe(estado.tabuleiro[m.from])] || 0);
    if (m.ep) peso = VALOR.P * 9;
    if (m.promo) peso += 900;
    return { m, peso };
  }).sort((a, b) => b.peso - a.peso).map(x => x.m);
}

// só capturas/promoções (para a quiescence)
function capturas(estado) {
  return movimentosLegais(estado).filter(m => estado.tabuleiro[m.to] || m.ep || m.promo);
}

// quiescence: resolve o efeito horizonte — não para a busca no meio de trocas
function quiesce(estado, alpha, beta, profRestante = 6) {
  const fim = estadoJogo(estado);
  if (fim === 'mate') return -100000;
  if (fim === 'afogamento') return 0;
  const standPat = avaliar(estado);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (profRestante <= 0) return alpha;
  for (const m of ordena(estado, capturas(estado))) {
    const v = -quiesce(aplicar(estado, m), -beta, -alpha, profRestante - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

// busca principal (negamax): o score é do ponto de vista de quem tem a vez
function busca(estado, profundidade, alpha, beta) {
  const fim = estadoJogo(estado);
  if (fim === 'mate') return -100000 - profundidade * 100; // mate mais rápido = pior para o enxadado
  if (fim === 'afogamento') return 0;
  if (profundidade === 0) return quiesce(estado, alpha, beta);

  let melhor = -Infinity;
  for (const m of ordena(estado, movimentosLegais(estado))) {
    const v = -busca(aplicar(estado, m), profundidade - 1, -beta, -alpha);
    if (v > melhor) melhor = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break; // poda
  }
  return melhor;
}

// profundidade FIXA (usado nos testes)
export function jogadaMinimax(estado, profundidade = 2) {
  const movs = movimentosLegais(estado);
  if (!movs.length) return null;
  let melhor = null, melhorV = -Infinity;
  let alpha = -Infinity;
  for (const m of ordena(estado, movs)) {
    const v = -busca(aplicar(estado, m), profundidade - 1, -Infinity, -alpha);
    if (v > melhorV) { melhorV = v; melhor = m; }
    if (melhorV > alpha) alpha = melhorV;
  }
  return melhor;
}

// ITERATIVE DEEPENING com orçamento de tempo: aumenta a profundidade até o tempo acabar,
// e devolve o melhor lance da última profundidade COMPLETA (o que a UI usa).
// Entre lances quase equivalentes (≤ 20 centipeões), sorteia — evita shuffle/repetição infinita.
export function escolheJogada(estado, tempoMs = 1000, opts = {}) {
  const profMax = opts.profMax ?? 64;
  const ruido = opts.ruido ?? 0;
  const movs = movimentosLegais(estado);
  if (!movs.length) return null;
  const t0 = Date.now();
  let melhor = movs[0];
  let scores = new Map(); // chave from-to → score da última profundidade completa
  for (let prof = 1; prof <= profMax; prof++) {
    const scoresProf = new Map();
    let melhorV = -Infinity, melhorDaProf = null;
    let alpha = -Infinity;
    let completo = true;
    for (const m of ordena(estado, movs)) {
      const v = -busca(aplicar(estado, m), prof - 1, -Infinity, -alpha);
      scoresProf.set(m.from + '-' + m.to, v);
      if (v > melhorV) { melhorV = v; melhorDaProf = m; }
      if (melhorV > alpha) alpha = melhorV;
      if (Date.now() - t0 > tempoMs) { completo = false; break; }
    }
    if (completo) {
      scores = scoresProf;
      if (melhorDaProf) melhor = melhorDaProf;
    }
    if (!completo || Date.now() - t0 > tempoMs) break;
  }
  const melhorScore = scores.get(melhor.from + '-' + melhor.to) || 0;
  if (ruido > 0) {
    let melhorComRuido = null, melhorV = -Infinity;
    for (const cand of movs) {
      const v = (scores.get(cand.from + '-' + cand.to) ?? -Infinity) + (Math.random() * 2 - 1) * ruido;
      if (v > melhorV) { melhorV = v; melhorComRuido = cand; }
    }
    return melhorComRuido ?? melhor;
  }
  const candidatos = movs.filter(m => {
    const v = scores.get(m.from + '-' + m.to);
    return v !== undefined && v >= melhorScore - 20;
  });
  if (candidatos.length > 1) return candidatos[Math.floor(Math.random() * candidatos.length)];
  return melhor;
}
