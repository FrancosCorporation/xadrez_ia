// UI do xadrez — tabuleiro com click-move + drag & drop, placar, 3 modos (PvP, PC, Impossível).
// O IA roda no browser (Minimax com poda). Promoção: dialog com escolha de peça.

import { estadoInicial, movimentosLegais, aplicar, estadoJogo, corDe, tipoDe, estaEmCheck, BRANCO, PRETO } from './chess-rules.js';
import { escolheJogada } from './ai-minimax.js';
import { escolheViaLLM, carregaWebLLM, placaWebGPU, PADRAO as LLM_PADRAO } from './llm.js';

const GLIFOS = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };

let estado = estadoInicial();
let legais = movimentosLegais(estado);
let selecionada = -1;
let modo = 'medio'; // 'pvp' | 'facil' | 'medio' | 'dificil' | 'llm'
let placar = { w: 0, b: 0 }; // contador de vitórias por sessão
let animando = false;
let historico = {}; // posição → contagem (regra da repetição tripla)
let sessao = 0; // guarda anti-race: reiniciar no meio do "pensando" não deixa a IA jogar no jogo novo

const $tab = document.getElementById('tabuleiro');
const $status = document.getElementById('status');
const $placar = document.getElementById('placar');
const $selModo = document.getElementById('modo');
const $reiniciar = document.getElementById('reiniciar');
const $dialogPromo = document.getElementById('promo-dialog');
const $llmBox = document.getElementById('llm-box');
const $llmModelo = document.getElementById('llm-modelo');
const $llmCarregar = document.getElementById('llm-carregar');
const $llmStatus = document.getElementById('llm-status');

function cfgLLM() {
  return { modelo: $llmModelo.value || LLM_PADRAO.modelo };
}
function salvaCfgLLM() {
  try { localStorage.setItem('xadrez-llm', JSON.stringify({ modelo: $llmModelo.value })); } catch {}
}
try { // recupera o que tava salvo
  const s = JSON.parse(localStorage.getItem('xadrez-llm') || '{}');
  if (s.modelo) $llmModelo.value = s.modelo;
} catch {}
function sincronizaPainelLLM() {
  $llmBox.hidden = modo !== 'llm';
}
// carrega o modelo NA PLACA do jogador (1ª vez baixa ~350MB e fica no cache; depois é 100% local)
async function carregaModeloLLM() {
  const placa = await placaWebGPU();
  if (!placa) {
    $llmStatus.textContent = '⚠ WebGPU desligado — ative UMA vez: chrome://flags/#enable-unsafe-webgpu → Enabled → reabra o navegador (fica pra sempre). Funciona até SEM placa de vídeo: roda na CPU (SwiftShader)';
    return;
  }
  $llmStatus.textContent = 'placa ' + placa.vendor + (placa.arquitetura ? '/' + placa.arquitetura : '') + ' — preparando… 0%';
  try {
    await carregaWebLLM(cfgLLM().modelo, p => {
      $llmStatus.textContent = 'baixando modelo… ' + Math.round(p * 100) + '%';
    });
    $llmStatus.textContent = '✔ modelo pronto na placa (' + placa.vendor + ') — roda 100% local';
  } catch (e) {
    $llmStatus.textContent = '⚠ ' + (e && e.message ? e.message : e);
  }
}
$llmCarregar.addEventListener('click', carregaModeloLLM);
$llmModelo.addEventListener('change', () => { salvaCfgLLM(); if (modo === 'llm') carregaModeloLLM(); });

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
    const idSessao = sessao;
    if (modo === 'llm') {
      avisa('IA LLM pensando…');
      escolheViaLLM(estado, { lance: 1 }, cfgLLM(), {
        progresso: p => { if (sessao === idSessao) $llmStatus.textContent = 'baixando modelo… ' + Math.round(p * 100) + '%'; },
      }).then(r => {
        if (sessao !== idSessao || !animando) return; // reiniciado no meio
        animando = false;
        if (r.origem === 'llm') avisa('IA LLM: ' + r.motivo);
        else avisa('LLM fora — ' + r.motivo + ' (minimax joga)');
        const m2 = r.lance || escolheJogada(estado, 800); // fallback: minimax assume
        if (m2) joga(m2);
        else {
          const fim2 = estadoJogo(estado);
          avisa(fim2 === 'mate' ? 'Xeque-mate!' : 'Empate.');
        }
      });
      return;
    }
    avisa('A IA está pensando...');
    setTimeout(() => {
      if (sessao !== idSessao) return; // reiniciado no meio
      const cfg = modo === 'facil' ? { tempo: 150, opts: { profMax: 1, ruido: 90 } }
                : modo === 'dificil' ? { tempo: 3000 } : { tempo: 800 };
      const m2 = escolheJogada(estado, cfg.tempo, cfg.opts);
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
  sincronizaPainelLLM();
  if (modo === 'llm') carregaModeloLLM(); // começa a baixar o modelo já, no ato de escolher o modo
  else $llmStatus.textContent = '';
  reinicia();
});
$reiniciar.addEventListener('click', reinicia);

function reinicia() {
  sessao++;
  estado = estadoInicial();
  legais = movimentosLegais(estado);
  selecionada = -1;
  animando = false;
  historico = {};
  avisa(estado.turno === 'w' ? 'Vez das brancas' : 'Vez das pretas');
  pinta();
}

constroiTabuleiro();
sincronizaPainelLLM();
reinicia();

window.__xadrez = {
  get estado() { return estado; },
  get legais() { return legais; },
  get fase() { return animando ? 'ia' : 'humano'; },
  get modo() { return modo; },
};
