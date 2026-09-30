# Xadrez com IA

Eu queria jogar xadrez no navegador com uma IA que responde de verdade — sem instalar nada, sem depender de serviço pago. Então construí o meu: o jogo inteiro é HTML, CSS e JavaScript puro, e a IA (Minimax com poda alfa-beta) roda dentro do browser.

## O que tem

- **Regras completas do xadrez** implementadas à mão: lances legais, xeque, xeque-mate, afogamento (stalemate), roque (com todas as condições: caminho livre, rei/torre sem ter mexido, sem passar por casa atacada), en passant e promoção (com escolha de peça)
- **IA de verdade** (negamax): **quiescence search** (não para a busca no meio de trocas — evita blunders de horizonte), **iterative deepening com orçamento de tempo** (PC = 800ms, Impossível = 2500ms — quanto mais tempo, mais fundo), **tabelas de posição (PST)** para as 6 peças, **ordenação MVV-LVA** e detecção de **repetição tripla** (empate)
- **Variedade na escolha**: entre lances quase equivalentes (≤ 20 centipeões) a IA sorteia — nunca fica shufflando a mesma peça de ida e volta
- **Placar de sessão** (contador de vitórias brancas × pretas) e destaque de xeque no rei

## Como rodar

```bash
npm start          # sobe o servidor estático em http://localhost:3344
npm test           # 18 testes das regras + da IA (node --test)
```

**Jogue online agora**: https://francoscorporation.github.io/xadrez_ia/ — o jogo é 100% estático (servidor só serve arquivos). Para rodar local use `npm start` (abrir o index.html direto via file:// não carrega os módulos ES do navegador).

## Como foi testado

18 testes automatizados (node --test) cobrindo as regras e a IA, todos passando:

- **Regras (11)**: 20 lances legais na posição inicial · cavalo cravado não se move · mate do pastor (Qxf7#) com a rainha preta bloqueando d8 · afogamento clássico (Kh8/Qf7/Kg6) · roque pequeno legal (torre vai pra f1, rei pra g1) · roque negado com a coluna g atacada · en passant completo (avanço duplo → captura → o peão que pulou some) · promoção (4 opções, vira rainha) · captura de torre no canto remove o direito de roque · sem xeque na posição inicial
- **IA (7)**: lances legais nas profundidades 2 e 3 · encontra o mate em 1 do pastor · captura a rainha livre (ganho de 900) · não coloca a rainha em captura gratuita · avaliação por material · profundidade 3 na posição inicial em menos de 5s · escapa do mate em 1 quando há escape

Três bugs reais encontrados pelos próprios testes e corrigidos: o en passant removia o peão capturado com o offset errado (`to ± 1` em vez de `to ± 8`), a captura de torre no canto adversário limpava a flag de roque da cor errada e o pseudo-legal permitia capturar o rei (no xadrez o jogo acaba no mate antes). O shuffle infinito (a mesma peça de ida e volta para sempre) foi detectado em partida da IA contra ela mesma e corrigido com a variedade na escolha + a regra de repetição tripla.

## Estrutura

```
xadrez_ia/
├── index.html            # o jogo
├── style.css             # tabuleiro 8x8 (branco embaixo), destaque de xeque/alvos
├── server.js             # servidor estático (sem build)
├── js/
│   ├── chess-rules.js    # regras completas (lances legais, mate, roque, en passant, promoção)
│   ├── ai-minimax.js     # Minimax com poda alfa-beta + avaliação
│   └── app.js            # UI: click-move + drag & drop, placar, modos
└── test/
    ├── chess-rules-test.mjs
    └── ai-test.mjs
```

## Sobre a série

Este é o segundo jogo da série de jogos com IA (o primeiro é o [Jogo da Velha com IA](https://github.com/FrancosCorporation/jogo_da_velha_ia)): jogos de tabuleiro clássicos no navegador, com IA rodando no browser, sem dependência externa e com testes provando as regras.

Código aberto: https://github.com/FrancosCorporation/xadrez_ia
