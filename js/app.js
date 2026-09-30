// UI do xadrez — tabuleiro com click-move + drag & drop, placar, 3 modos (PvP, PC, Impossível).
// O IA roda no browser (Minimax com poda). Promoção: dialog com escolha de peça.

import { estadoInicial, movimentosLegais, aplicar, estadoJogo, corDe, tipoDe, estaEmCheck, BRANCO, PRETO } from './chess-rules.js';
import { escolheJogada } from './ai-minimax.js';

const GLIFOS = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };

let estado = estadoInicial();
let legais = movimentosLegais(estado);
let selecionada = -1;
let modo = 'pc'; // 'pvp' | 'pc' (800ms) | 'impossivel' (2500ms)
let placar = { w: 0, b: 0 }; // contador de vitórias por sessão
let animando = false;
let historico = {}; // posição → contagem (regra da repetição tripla)

const $tab = document.getElementById('tabuleiro');
const $status = document.getElementById('status');
const $placar = document.getElementById('placar');
const $selModo = document.getElementById('modo');
const $reiniciar = document.getElementById('reiniciar');
const $dialogPromo = document.getElementById('promo-dialog');

function constroiTabuleiro() {
  $tab.innerHTML = '';
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const i = rank * 8 + file;
      const casa = document.createElement('div');
      // a1 é escura: casa clara quando (file + rank) é ímpar
      casa.className = `casa ${(file + rank) % 2 === 1 ? 'clara' : 'escura'}`;
      casa.dataset.i = i;
      casa.addEventListener('click', () => clique(i));
      casa.addEventListener('dragover', (e) => e.preventDefault());
      casa.addEventListener('drop', (e) => { e.preventDefault(); clique(i); });
      $tab.appendChild(casa);
    }
  }
}

function pinta() {
  const emCheck = estaEmCheck(estado.tabuleiro, estado.turno);
  for (const casa of $tab.children) {
    const bi = parseInt(casa.dataset.i, 10); // índice do TABULEIRO (a ordem do DOM é rank 8 primeiro)
    const p = estado.tabuleiro[bi];
    casa.textContent = p ? GLIFOS[p] : '';
    casa.classList.toggle('branco', p && corDe(p) === 'w');
    casa.classList.toggle('preto', p && corDe(p) === 'b');
    casa.classList.toggle('sel', bi === selecionada);
    casa.classList.toggle('alvo', legais.some(m => m.from === selecionada && m.to === bi));
    casa.classList.toggle('check', p && tipoDe(p) === 'K' && corDe(p) === estado.turno && emCheck);
  }
  $placar.textContent = `Brancas ${placar.w} × ${placar.b} Pretas`;
}

function avisa(msg) {
  $status.textContent = msg;
}

function clique(i) {
  if (animando) return;
  const fim = estadoJogo(estado);
  if (fim !== 'andamento') return;

  const p = estado.tabuleiro[i];
  if (selecionada >= 0) {
    const cand = legais.filter(m => m.from === selecionada && m.to === i);
    if (cand.length) {
      const m = cand.length > 1 && cand[0].promo ? escolhePromocao(cand) : cand[0];
      joga(m);
      return;
    }
  }
  if (p && corDe(p) === estado.turno) {
    selecionada = i;
    pinta();
  } else {
    selecionada = -1;
    pinta();
  }
}

function escolhePromocao(cand) {
  // dialog síncrono simples: devolve a jogada da peça escolhida
  const ordem = { Q: 0, R: 1, B: 2, N: 3 };
  const escolha = prompt('Promover para: (Q) rainha, (R) torre, (B) bispo, (N) cavalo', 'Q');
  const tipo = (escolha || 'Q').toUpperCase().trim();
  return cand.find(c => c.promo === (ordem[tipo] !== undefined ? tipo : 'Q')) || cand[0];
}

function joga(m) {
  estado = aplicar(estado, m);
  selecionada = -1;
  legais = movimentosLegais(estado);
  const fim = estadoJogo(estado);
  // repetição tripla: a mesma posição 3× = empate
  const pos = estado.tabuleiro.map(p => p || '.').join('') + estado.turno;
  historico[pos] = (historico[pos] || 0) + 1;
  pinta();
  if (historico[pos] >= 3) {
    avisa('Empate por repetição (a mesma posição 3 vezes).');
    return;
  }
  if (fim === 'mate') {
    const vencedor = estado.turno === 'w' ? 'Pretas' : 'Brancas';
    placar[estado.turno === 'w' ? 'b' : 'w']++;
    avisa(`Xeque-mate! ${vencedor} vencem. Clique em Reiniciar para nova partida.`);
    pinta();
    return;
  }
  if (fim === 'afogamento') { avisa('Empate por afogamento (rei sem lances e sem xeque).'); return; }
  avisa(estado.turno === 'w' ? 'Vez das brancas' : 'Vez das pretas');
  if (estado.turno === PRETO && modo !== 'pvp') {
    animando = true;
    avisa('A IA está pensando...');
    setTimeout(() => {
      const tempo = modo === 'impossivel' ? 2500 : 800; // iterative deepening: quanto mais tempo, mais fundo
      const m2 = escolheJogada(estado, tempo);
      animando = false;
      if (m2) joga(m2);
      else {
        const fim2 = estadoJogo(estado);
        avisa(fim2 === 'mate' ? 'Xeque-mate!' : 'Empate.');
      }
    }, 120);
  }
}

$selModo.addEventListener('change', () => {
  modo = $selModo.value;
  reinicia();
});
$reiniciar.addEventListener('click', reinicia);

function reinicia() {
  estado = estadoInicial();
  legais = movimentosLegais(estado);
  selecionada = -1;
  animando = false;
  historico = {};
  avisa(estado.turno === 'w' ? 'Vez das brancas' : 'Vez das pretas');
  pinta();
}

constroiTabuleiro();
reinicia();
