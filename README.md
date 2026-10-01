# Xadrez com IA

Eu queria jogar xadrez no navegador com uma IA que responde de verdade — sem instalar nada, sem depender de serviço pago. Então construí o meu: o jogo inteiro é HTML, CSS e JavaScript puro, e a IA (Minimax com poda alfa-beta) roda dentro do browser.

## O que tem

- **Regras completas do xadrez** implementadas à mão: lances legais, xeque, xeque-mate, afogamento (stalemate), roque (com todas as condições: caminho livre, rei/torre sem ter mexido, sem passar por casa atacada), en passant e promoção (com escolha de peça)
- **IA de verdade** (negamax): **quiescence search** (não para a busca no meio de trocas — evita blunders de horizonte), **iterative deepening com orçamento de tempo** — quanto mais tempo, mais fundo, **tabelas de posição (PST)** para as 6 peças, **ordenação MVV-LVA** e detecção de **repetição tripla** (empate)
- **4 modos**: Jogador × Jogador · **IA Fácil** (busca rasa + ruído ±90cp na escolha — erra lances de verdade) · **IA Média** (800ms) · **IA Difícil** (3000ms de iterative deepening — mais fundo)
- **Variedade na escolha**: entre lances quase equivalentes (≤ 20 centipeões) a IA sorteia — nunca fica shufflando a mesma peça de ida e volta
- **Placar de sessão** (contador de vitórias brancas × pretas) e destaque de xeque no rei
- **Modo LLM: a IA de verdade roda DENTRO do navegador** (separado abaixo)

## Modo LLM — inteligência artificial local, sem servidor

Escolha "LLM (roda no navegador)" no seletor Modo. Aí o jogo para de usar o minimax e passa a
chamar uma **LLM de verdade** — mas tudo rodando na sua própria máquina:

- **Zero servidor, zero API**: a biblioteca WebLLM está embutida no repositório
  (`js/vendor/webllm.esm.js`) e o modelo (Qwen2.5-0.5B, ~350MB) é baixado **uma única vez**
  pelo navegador, fica no cache local e a inferência acontece via **WebGPU** na sua
  placa de vídeo. Depois do primeiro download, joga 100% offline.
- **O LLM não inventa lance**: o jogo manda pra ele o menu de candidatos que o MINIMAX já
  avaliou (com o score de cada um — mate vale +100000) e ele escolhe UM — respondendo
  `{"i": <nº>, "motivo": "<frase em pt-BR>"}`. Resposta fora do menu, JSON torto
  ou erro de WebGPU → uma segunda tentativa com o limite explícito e, se ainda assim falhar,
  **o minimax clássico assume** (o jogo nunca trava).
- **Modelos testados à mão**: o Qwen2.5-0.5B-Instruct (64,5 tok/s na GPU, JSON perfeito) e o
  SmolLM2-360M (mais leve) ficam disponíveis no painel; o Qwen3-0.6B foi testado e DESCARTADO
  (gasta tokens "pensando" e não obedece o JSON).
- **Funciona até SEM placa de vídeo**: se o navegador não achar a GPU, o WebGPU cai no
  SwiftShader (software, na CPU). O único requisito é **ativar o WebGPU uma vez** — e fica
  pra sempre:
  1. abra `chrome://flags/#enable-unsafe-webgpu` (no Brave: `brave://flags/#enable-unsafe-webgpu`)
  2. ponha **Enabled** e clique em **Relaunch** (reabra o navegador)
  3. recarregue o jogo — pronto, o painel mostra a placa e o modelo carrega
  Com GPU AMD/Intel/Nova que suporta Vulkan, o Chrome usa a placa direto (~64 tok/s no Qwen2.5-0.5B);
  sem placa, roda na CPU mesmo.

## Como rodar

```bash
npm start          # sobe o servidor estático em http://localhost:3344
npm test           # 35 testes: regras + IA minimax + LLM (node --test)
```

**Jogue online agora**: https://francoscorporation.github.io/xadrez_ia/ — o jogo é 100% estático (servidor só serve arquivos). Para rodar local use `npm start` (abrir o index.html direto via file:// não carrega os módulos ES do navegador).

## Como foi testado

35 testes automatizados (node --test) cobrindo as regras, a IA e o modo LLM, todos passando:

- **Regras (11)**: 20 lances legais na posição inicial · cavalo cravado não se move · mate do pastor (Qxf7#) com a rainha preta bloqueando d8 · afogamento clássico (Kh8/Qf7/Kg6) · roque pequeno legal (torre vai pra f1, rei pra g1) · roque negado com a coluna g atacada · en passant completo (avanço duplo → captura → o peão que pulou some) · promoção (4 opções, vira rainha) · captura de torre no canto remove o direito de roque · sem xeque na posição inicial
- **IA (7)**: lances legais nas profundidades 2 e 3 · encontra o mate em 1 do pastor · captura a rainha livre (ganho de 900) · não coloca a rainha em captura gratuita · avaliação por material · profundidade 3 na posição inicial em menos de 5s · escapa do mate em 1 quando há escape
- **Modo LLM (17)**: prompt com tabuleiro compacto + candidatos + limites · notação e2->e4 · candidatos são SEMPRE lances legais (o LLM nunca recebe lance ilegal) · extração de JSON (puro, em ``` e com chave `}}` extra) · validação só aceita índice dentro do menu · retry na 2ª tentativa · fallback no minimax em qualquer falha · o lance do LLM aplica de verdade pelas regras completas (incluindo promo/en passant/roque) · motor WebLLM sobe no browser e a jogada do modelo local aparece com motivo em pt-BR

Três bugs reais encontrados pelos próprios testes e corrigidos: o en passant removia o peão capturado com o offset errado (`to ± 1` em vez de `to ± 8`), a captura de torre no canto adversário limpava a flag de roque da cor errada e o pseudo-legal permitia capturar o rei (no xadrez o jogo acaba no mate antes). O shuffle infinito (a mesma peça de ida e volta para sempre) foi detectado em partida da IA contra ela mesma e corrigido com a variedade na escolha + a regra de repetição tripla.

## Estrutura

```
xadrez_ia/
├── index.html            # o jogo
├── style.css             # tabuleiro 8x8 (branco embaixo), destaque de xeque/alvos
├── server.js             # servidor estático (sem build)
├── js/
│   ├── chess-rules.js    # regras completas (lances legais, mate, roque, en passant, promoção)
│   ├── ai-minimax.js     # Minimax com poda alfa-beta + quiescence + PSTs + candidatos pro LLM
│   ├── llm.js            # modo LLM: prompt, validação de JSON, motor WebLLM, fallback
│   ├── vendor/
│   │   └── webllm.esm.js  # WebLLM embutido (5,8MB) — sem CDN, sem linha de rede pro código
│   └── app.js            # UI: click-move + drag & drop, placar, modos, painel do LLM
└── test/
    ├── chess-rules-test.mjs
    ├── ai-test.mjs
    └── llm-test.mjs
```

## Sobre a série

Este é o segundo jogo da série de jogos com IA (o primeiro é o [Jogo da Velha com IA](https://github.com/FrancosCorporation/jogo_da_velha_ia)): jogos de tabuleiro clássicos no navegador, com IA rodando no browser, sem dependência externa e com testes provando as regras.

Código aberto: https://github.com/FrancosCorporation/xadrez_ia
