// Regras completas do xadrez em JS puro — sem dependência externa.
// Casa vazia = null | Peça = 'wP','wN','wB','wR','wQ','wK' | 'bP','bN','bB','bR','bQ','bK'
// Índice 0 = a1, índice 63 = h8. file = i % 8 (0=a), rank = i/8 (0=1ª fileira, lado branco).

export const BRANCO = 'w';
export const PRETO = 'b';

const CAVALO = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const REI = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
const LINHAS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const DIAGONAIS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export function tabuleiroInicial() {
  const t = new Array(64).fill(null);
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    t[f] = 'w' + back[f];
    t[8 + f] = 'wP';
    t[48 + f] = 'bP';
    t[56 + f] = 'b' + back[f];
  }
  return t;
}

export function estadoInicial() {
  return {
    tabuleiro: tabuleiroInicial(),
    turno: BRANCO,
    roque: { wK: true, wQ: true, bK: true, bQ: true },
    ep: -1, // casa alvo de en passant (ou -1)
  };
}

export const corDe = (p) => (p ? p[0] : null);
export const tipoDe = (p) => (p ? p[1] : null);
export const noTab = (i) => i >= 0 && i < 64;
const fR = (f, r) => r * 8 + f;

export function estadoJogo(estado) {
  if (movimentosLegais(estado).length === 0) {
    return estaEmCheck(estado.tabuleiro, estado.turno) ? 'mate' : 'afogamento';
  }
  return 'andamento';
}

export function estaEmCheck(tab, cor) {
  const k = tab.indexOf(cor + 'K');
  if (k < 0) return false; // sem rei no tabuleiro (testes isolados de peças)
  return casaAtacada(tab, k, corDe(cor) === 'w' ? PRETO : BRANCO);
}

export function casaAtacada(tab, casa, por) {
  const f = casa % 8, r = Math.floor(casa / 8);

  // peão: ataca na diagonal para frente
  const dir = por === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const ff = f + df, rr = r - dir;
    if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && tab[fR(ff, rr)] === por + 'P') return true;
  }
  // cavalo
  for (const [df, dr] of CAVALO) {
    const ff = f + df, rr = r + dr;
    if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && tab[fR(ff, rr)] === por + 'N') return true;
  }
  // rei
  for (const [df, dr] of REI) {
    const ff = f + df, rr = r + dr;
    if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && tab[fR(ff, rr)] === por + 'K') return true;
  }
  // linhas (torre/rainha)
  for (const [df, dr] of LINHAS) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
      const p = tab[fR(ff, rr)];
      if (p) {
        if (corDe(p) === por && (tipoDe(p) === 'R' || tipoDe(p) === 'Q')) return true;
        break;
      }
      ff += df; rr += dr;
    }
  }
  // diagonais (bispo/rainha)
  for (const [df, dr] of DIAGONAIS) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
      const p = tab[fR(ff, rr)];
      if (p) {
        if (corDe(p) === por && (tipoDe(p) === 'B' || tipoDe(p) === 'Q')) return true;
        break;
      }
      ff += df; rr += dr;
    }
  }
  return false;
}

// movimentos pseudo-legais de uma peça (sem filtrar check)
function pseudoLegais(estado, de) {
  const { tabuleiro: tab, turno, roque, ep } = estado;
  const p = tab[de];
  if (!p || corDe(p) !== turno) return [];
  const tipo = tipoDe(p), cor = turno;
  const f = de % 8, r = Math.floor(de / 8);
  const movs = [];
  const add = (to, extra = {}) => movs.push({ from: de, to, ...extra });

  const anda = (alvos) => {
    for (const to of alvos) {
      if (!noTab(to)) continue;
      const alvo = tab[to];
      // o rei NUNCA é capturado (o jogo acaba no mate antes)
      if (!alvo || (corDe(alvo) !== cor && tipoDe(alvo) !== 'K')) add(to);
    }
  };
  const desliza = (dirs) => {
    const alvos = [];
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        alvos.push(fR(ff, rr));
        if (tab[fR(ff, rr)]) break;
        ff += df; rr += dr;
      }
    }
    anda(alvos);
  };

  if (tipo === 'P') {
    const dir = cor === 'w' ? 1 : -1;
    const casaFrente = fR(f, r + dir);
    if (noTab(casaFrente) && !tab[casaFrente]) {
      if ((cor === 'w' && r === 6) || (cor === 'b' && r === 1)) {
        for (const promo of ['Q', 'R', 'B', 'N']) add(casaFrente, { promo });
      } else {
        add(casaFrente);
        const casaDupla = fR(f, r + 2 * dir);
        if (((cor === 'w' && r === 1) || (cor === 'b' && r === 6)) && !tab[casaDupla]) {
          add(casaDupla);
        }
      }
    }
    for (const df of [-1, 1]) {
      const ff = f + df, rr = r + dir;
      if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
      const to = fR(ff, rr);
      const alvo = tab[to];
      if (alvo && corDe(alvo) !== cor) {
        if ((cor === 'w' && rr === 7) || (cor === 'b' && rr === 0)) {
          for (const promo of ['Q', 'R', 'B', 'N']) add(to, { promo });
        } else add(to);
      } else if (to === ep && !alvo) {
        add(to, { ep: true });
      }
    }
  } else if (tipo === 'N') {
    const alvos = [];
    for (const [df, dr] of CAVALO) {
      const ff = f + df, rr = r + dr;
      if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) alvos.push(fR(ff, rr));
    }
    anda(alvos);
  } else if (tipo === 'K') {
    const alvos = [];
    for (const [df, dr] of REI) {
      const ff = f + df, rr = r + dr;
      if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) alvos.push(fR(ff, rr));
    }
    anda(alvos);
    // roque (castling)
    const linhaBase = cor === 'w' ? 0 : 7;
    if (de === fR(4, linhaBase) && !casaAtacada(tab, de, cor === 'w' ? PRETO : BRANCO)) {
      const roqueCor = cor === 'w' ? roque.wK && roque.wQ : roque.bK && roque.bQ;
      const flagK = cor === 'w' ? roque.wK : roque.bK;
      const flagQ = cor === 'w' ? roque.wQ : roque.bQ;
      const torreK = tab[fR(7, linhaBase)], torreQ = tab[fR(0, linhaBase)];
      if (flagK && torreK === cor + 'R' && !tab[fR(5, linhaBase)] && !tab[fR(6, linhaBase)]
        && !casaAtacada(tab, fR(5, linhaBase), cor === 'w' ? PRETO : BRANCO)
        && !casaAtacada(tab, fR(6, linhaBase), cor === 'w' ? PRETO : BRANCO)) {
        add(fR(6, linhaBase), { roque: 'K' });
      }
      if (flagQ && torreQ === cor + 'R' && !tab[fR(1, linhaBase)] && !tab[fR(2, linhaBase)] && !tab[fR(3, linhaBase)]
        && !casaAtacada(tab, fR(3, linhaBase), cor === 'w' ? PRETO : BRANCO)
        && !casaAtacada(tab, fR(2, linhaBase), cor === 'w' ? PRETO : BRANCO)) {
        add(fR(2, linhaBase), { roque: 'Q' });
      }
    }
  } else if (tipo === 'R') desliza(LINHAS);
  else if (tipo === 'B') desliza(DIAGONAIS);
  else if (tipo === 'Q') desliza([...LINHAS, ...DIAGONAIS]);

  return movs;
}

export function movimentosLegais(estado) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    for (const m of pseudoLegais(estado, i)) {
      const novo = aplicar(estado, m);
      if (!estaEmCheck(novo.tabuleiro, estado.turno)) out.push(m);
    }
  }
  return out;
}

// aplica o movimento e devolve o novo estado (sem mutar o original)
export function aplicar(estado, m) {
  const tab = estado.tabuleiro.slice();
  const roque = { ...estado.roque };
  const peca = tab[m.from];
  const cor = corDe(peca);
  let ep = -1;

  tab[m.to] = m.promo ? cor + m.promo : peca;
  tab[m.from] = null;

  // en passant: captura o peão que pulou (uma fileira atrás do alvo, na coluna do alvo)
  if (m.ep) {
    tab[m.to + (cor === 'w' ? -8 : 8)] = null;
  }
  // roque: move a torre junto
  if (m.roque) {
    const linhaBase = cor === 'w' ? 0 : 7;
    if (m.roque === 'K') { tab[fR(5, linhaBase)] = tab[fR(7, linhaBase)]; tab[fR(7, linhaBase)] = null; }
    else { tab[fR(3, linhaBase)] = tab[fR(0, linhaBase)]; tab[fR(0, linhaBase)] = null; }
  }
  // casa alvo de en passant no próximo lance: peão andou 2
  if (tipoDe(peca) === 'P' && Math.abs(Math.floor(m.to / 8) - Math.floor(m.from / 8)) === 2) {
    ep = Math.floor((m.from + m.to) / 2);
  }
  // perde o direito de roar quando rei/torre mexe (ou torre capturada no canto)
  if (tipoDe(peca) === 'K') { if (cor === 'w') { roque.wK = false; roque.wQ = false; } else { roque.bK = false; roque.bQ = false; } }
  for (const [casa, flag] of [[0, 'wQ'], [7, 'wK'], [56, 'bQ'], [63, 'bK']]) {
    if (m.from === casa || m.to === casa) roque[flag] = false;
  }

  return { tabuleiro: tab, turno: cor === 'w' ? PRETO : BRANCO, roque, ep };
}
