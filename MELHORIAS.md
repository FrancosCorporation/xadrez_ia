# MELHORIAS — xadrez_ia

> **Gerado por análise de código em 2026-10-02** · Stack: Node 18 (servidor estático sem framework) + JS puro no browser, **zero dependências**
> Branch `main` · 1.512 LOC · **3 suites de teste** (764 linhas de teste para 748 de código) · sem CI
>
> **Este arquivo é um plano de execução.** Cada item tem ID, `arquivo:linha`, mudança exata,
> critério de aceite e comando de verificação.

---

## 0. Como usar este documento

1. Execute na ordem **P0 → P1 → P2 → P3**, respeitando as ondas da §8.
2. Ao terminar um item: marque `- [x]`, rode o **Verificação**, comite `fix(<ID>): descrição`.
3. **Este é o código mais maduro do acervo. Não o simplifique.** Especificamente:
   - **LLM 100% local** (`js/llm.js:1-6`) — zero API, zero chave, pesos no cache do navegador.
   - **O LLM nunca inventa lance**: escolhe entre candidatos que o minimax avaliou
     (`llm.js:222-224`) e a escolha é **validada** (`llm.js:232`, `validaEscolha`).
   - **Fallback explícito** para minimax em qualquer falha (`llm.js:248-250`) — o jogo **nunca** trava.
   - **Distinção de falha de GPU vs. download** (`llm.js:190-194`) — não mascara erro de rede.
   - **`system`/`user` separados** no prompt do LLM (`llm.js:202`).
4. **O defeito está no servidor de arquivos, não no jogo.** Não mexa no `llm.js`/`ai-minimax.js`/
   `chess-rules.js` sem causa — estão testados e corretos.
5. **Idioma:** português.

---

## 1. Diagnóstico executivo

Xadrez 8x8 com IA no navegador: o jogador move, o minimax avalia candidatos, e um LLM local
(Qwen2.5-0.5B ou SmolLM2) escolhe **entre** eles. Sem build, sem servidor de lógica, zero
dependências.

**O que está bem (não reaça):**

| Item | Evidência |
|---|---|
| LLM **escolhe entre candidatos avaliados** — não inventa lance | `llm.js:222-224,232` |
| Escolha **validada**; resposta inválida → fallback | `llm.js:232,247` |
| `system` e `user` **separados** no prompt | `llm.js:202` |
| Fallback nunca deixa o jogo quebrar | `llm.js:6,248-250` |
| Falha de GPU vs. download **distinguidas** (não mascara) | `llm.js:190-194` |
| Retry com aviso do limite exato ao modelo | `llm.js:233-238` |
| Extrator de JSON tolerante (fence, objeto no meio, `}}` duplo) | `llm.js:57-64` |
| UI usa `textContent` em tudo — **sem XSS** | `app.js` (nenhum `innerHTML` com dado) |
| **Path traversal bloqueado** (validado em execução) | `server.js:14` — `GET /../etc/passwd` → 404 |
| WebGPU→CPU transparente (roda em máquina sem GPU) | `llm.js:193-197` |
| Hooks de debug/E2E expostos | `llm.js:208,225` |
| 764 linhas de teste (mais que o código) | `test/` (3 suites) |

**O que está quebrado:**

1. **O servidor serve o repositório git inteiro** — validado em execução: `GET /.git/config` → **200**,
   `GET /.git/HEAD` → **200**. `server.js:14` bloqueia travessia de path, mas **não** bloqueia dotfiles:
   quem serve isso entrega histórico, hooks e configuração do git.
2. Sem `Content-Type` charset em CSS/JS, sem headers de segurança — menor.
3. Sem CI: 764 linhas de teste que só rodam se alguém lembrar.

---

## 2. Tabela de prioridades

| ID | Título | Sev | Arquivo | Depende de |
|---|---|---|---|---|
| SEC-01 | Servidor expõe `.git/` (histórico e config) | **P0** | `server.js:13-20` | — |
| SEC-02 | Sem allowlist de arquivos servidos (serve qualquer coisa da repo) | **P0** | `server.js:13-20` | SEC-01 |
| SEC-03 | Sem headers de segurança no servidor estático | **P1** | `server.js:19` | — |
| SEC-04 | Sem `Content-Security-Policy` (o jogo carrega WASM/WebGPU) | **P2** | `server.js:19` | — |
| BUG-01 | `decodeURIComponent` sem try/catch derruba o servidor | **P1** | `server.js:11` | — |
| BUG-02 | Servidor lê arquivo **síncrono** a cada request | **P2** | `server.js:20` | — |
| IMP-01 | Sem cache de assets (revalida a cada load) | **P2** | `server.js:19-20` | — |
| IMP-02 | Sem `404` amigável (texto plano) | **P3** | `server.js:15-17` | — |
| IMP-03 | Sem página de erro se o JS falhar | **P3** | `index.html` | — |
| TEST-01 | Testes não cobrem o servidor (só a lógica) | **P1** | `test/` | SEC-01 |
| DEVOPS-01 | Sem CI | **P2** | *(ausente)* | — |
| DEVOPS-02 | Sem Dockerfile (roda com `node server.js`) | **P3** | *(ausente)* | — |
| DOC-01 | README não avisa que expor o servidor expõe o repo | **P2** | `README.md` | SEC-01 |
| DOC-02 | Falta `SECURITY.md` | **P3** | *(ausente)* | — |

**Placar: 2 P0 · 2 P1 · 5 P2 · 3 P3 = 12 itens.**

---

## 3. Segurança
### SEC-01 · Servidor expõe `.git/` (histórico e config) · [P0]

- **Arquivo:** `server.js:13-20`
- **Evidência:** validado **em execução real** durante esta análise:
  ```
  GET /.git/config -> 200
  GET /.git/HEAD   -> 200
  GET /../etc/passwd -> 404   (travessia de path bloqueada — correto)
  ```
  A guarda da linha 14 é:
  ```javascript
  if (!arquivo.startsWith(RAIZ) || !existsSync(arquivo)) { /* 404 */ }
  ```
  O check de prefixo impede **sair** da raiz, mas **não** impede **ler dotfiles dentro** dela — e
  `.git/` está na raiz.
- **Impacto:** quem acessa o servidor得到的 **repositório git inteiro**: todo o **histórico**
  (`.git/objects`, via `git` dumb protocol), `.git/config` (remote, branch), `.git/HEAD`, e
  potencialmente **hooks**. Com o histórico, é possível reconstruir versões antigas do código — e se
  algum segredo esteve commitado no passado (item recorrente em outros projetos deste acervo), ele
  **vaza por aqui**. Além disso, expor `.git` de um serviço que devia só entregar o jogo é
  desnecessário por completo: o jogo é 100% estático.
- **Mudança:** (1) **allowlist explícita** do que é servido — só o que o jogo precisa (`index.html`,
  `style.css`, `js/`, e qualquer asset):
  ```javascript
  const PUBLICOS = new Set(['/index.html', '/style.css']);
  const DIRETORIOS_PUBLICOS = ['/js/'];
  function permitido(caminho) {
    if (PUBLICOS.has(caminho)) return true;
    return DIRETORIOS_PUBLICOS.some((d) => caminho.startsWith(d));
  }
  ```
  (2) **ou**, equivalente e mais simples: negar explicitamente qualquer caminho que **comece com
  `.`** (`.git`, `.env`, `.npmrc`) e qualquer `*` escondido — mas a allowlist é mais segura;
  (3) nunca servir dotfiles, mesmo com a raiz travada.
- **Aceite:** `GET /.git/config`, `/.git/HEAD`, `/.env` → **404**; `GET /index.html`, `/js/llm.js` → **200**.
- **Verificação:**
  ```bash
  PORT=3399 node server.js & sleep 1
  for p in /.git/config /.git/HEAD /.env /.gitignore; do
    curl -s -o /dev/null -w "$p -> %{http_code}\n" "http://localhost:3399$p"   # esperado 404
  done
  curl -s -o /dev/null -w '/index.html -> %{http_code}\n' http://localhost:3399/index.html   # 200
  kill %1
  ```

### SEC-02 · Sem allowlist de arquivos servidos (serve qualquer coisa da repo) · [P0]

- **Arquivo:** `server.js:13-20`
- **Evidência:** além do `.git`, o servidor serve **qualquer arquivo existente dentro da raiz** —
  incluindo `package.json`, `README.md`, `test/` (código de teste), e qualquer arquivo que for
  adicionado depois.
- **Impacto:** vazamento de código-fonte além do necessário (o `test/` expõe a lógica de teste;
  `package.json` expõe metadados). Pior, é um **armadilha de recorrência**: qualquer segredo novo
  colocado na raiz (`.npmrc`, `.env`, chave em arquivo de config) **vaza automaticamente** ao ser
  servido. É o mesmo modo de falha do `webhook-relay` (destino sem allowlist).
- **Mudança:** a mesma **allowlist** do `SEC-01`, aplicada a todo caminho — o padrão é "negar por
  omissão", não "permitir tudo na raiz". Incluir explicitamente só o necessário para o jogo.
- **Aceite:** `GET /package.json`, `/README.md`, `/test/llm-test.mjs` → **404**.
- **Verificação:**
  ```bash
  for p in /package.json /README.md /test/llm-test.mjs; do
    curl -s -o /dev/null -w "$p -> %{http_code}\n" "http://localhost:3399$p"   # esperado 404
  done
  ```

### SEC-03 · Sem headers de segurança no servidor estático · [P1]

- **Arquivo:** `server.js:19`
- **Evidência:** `res.writeHead(200, { 'Content-Type': MIME[...] })` — só o Content-Type, sem
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` nem HSTS.
- **Impacto:** o jogo é estático e roda no browser com WebGPU/WASM. Sem `nosniff`, um arquivo
  interpretado como tipo errado; sem `X-Frame-Options`, o jogo pode ser **embutido** (clickjacking —
 though baixo risco aqui); sem CSP, qualquer injeção futura no próprio JS roda sem restrição.
- **Mudança:** adicionar headers no `writeHead` (sem dependência, como o resto do projeto):
  ```javascript
  res.writeHead(200, {
    'Content-Type': ...,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'no-referrer',
  });
  ```
- **Aceite:** respostas trazem `nosniff` e `X-Frame-Options`.
- **Verificação:**
  ```bash
  curl -sI http://localhost:3399/index.html | grep -iE 'x-content-type-options|x-frame-options'
  ```

### SEC-04 · Sem `Content-Security-Policy` (WASM/WebGPU) · [P2]

- **Arquivo:** `server.js:19`
- **Evidência:** nenhuma CSP nas respostas.
- **Impacto:** o jogo carrega WASM (llama.cpp em WebAssembly, `llm.js:4`) e possivelmente módulos
  remotos. Sem CSP, umacomprometimento do HTML/JS serve sem restriction. É defesa em profundidade
  (com `SEC-03` já é bom), mas vale como item de P2.
- **Mudança:** CSP que cubra `default-src 'self'`, permita `wasm-unsafe-eval` (necessário pro WASM) e
  o `connect-src` do modelo; `script-src 'self'`.
- **Aceite:** resposta traz `Content-Security-Policy`; o jogo **ainda funciona** (WASM carrega).
- **Verificação:**
  ```bash
  curl -sI http://localhost:3399/index.html | grep -i content-security-policy
  # e o jogo abre e o modelo baixa (validar no browser)
  ```
---

## 4. Bugs e defeitos funcionais

### BUG-01 · `decodeURIComponent` sem try/catch derruba o servidor · [P1]

- **Arquivo:** `server.js:11`
- **Evidência:** `let caminho = decodeURIComponent(req.url.split('?')[0]);` — `decodeURIComponent`
  lança `URIError` em string malformada (ex.: `%`, `%zz`, `%E0%A4%A`).
- **Impacto:** a exceção é lançada **dentro** do handler do `createServer` e não é capturada — o
  processo **não morre** (é async por nature), mas a requisição fica **sem resposta** (o socket
  fecha sem status) e o `console` mostra stack. Um `curl 'http://host/%'` causa req por request.
- **Mudança:** envolver em `try/catch` e devolver `400`:
  ```javascript
  let caminho;
  try { caminho = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); res.end('400'); return; }
  ```
- **Aceite:** `GET /%` → **400**, sem exceção no log.
- **Verificação:**
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3399/%'   # 400
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3399/%zz'  # 400
  ```

### BUG-02 · Servidor lê arquivo **síncrono** a cada request · [P2]

- **Arquivo:** `server.js:20` (`res.end(readFileSync(arquivo))`)
- **Evidência:** `readFileSync` **bloqueia o event loop** a cada requisição, para um servidor que
  poderia atender várias conexões.
- **Impacto:** o jogo baixa o modelo (~350 MB, `llm.js:2`) — muitas requisições de asset grandes.
  Sync-read serializa tudo: um request de arquivo grande trava os outros. Com poucos usuários é
  irrelevante; num servidor compartilhado (mesma porta), degrada.
- **Mudança:** `readFile` assíncrono (`fs.promises`) + `createServer` com handler async; ou
  pré-carregar os assets em memória no boot (são poucos: html, css, js).
- **Aceite:** requisições concorrentes não se bloqueiam; um asset grande não trava as outras.
- **Verificação:**
  ```bash
  # com 2 requisições simultaneas de arquivos, ambos respondem rapido (curl -w %{time_total})
  ```

### IMP-01 · Sem cache de assets · [P2]

- **Arquivo:** `server.js:19-20`
- **Evidência:** toda requisição relê o arquivo do disco, sem `Cache-Control`/`ETag`.
- **Impacto:** cada reload do jogo rebaixa `js/llm.js`, `js/app.js` etc. Como são poucos KB, o impacto é
  pequeno — mas são requisições repetidas sem cache HTTP.
- **Mudança:** adicionar `ETag` (hash do arquivo, já calculado no boot) e `Cache-Control` curto para
  HTML e longo para JS/assets imutáveis; responder `304` quando bater.
- **Aceite:** segunda requisição do mesmo asset → `304`.
- **Verificação:**
  ```bash
  curl -sI http://localhost:3399/js/llm.js | grep -iE 'etag|cache-control'
  ```

### IMP-02 · `404` em texto plano · [P3]

- **Arquivo:** `server.js:15-17`
- **Evidência:** `res.writeHead(404, {'Content-Type': 'text/plain'}); res.end('404');`
- **Impacto:** o usuário que digitar uma URL errada vê "404" cru em vez da página do jogo. Menor.
- **Mudança:** para `.html`, servir o `index.html` (SPA-like) ou uma página 404 amigável.
- **Aceite:** `GET /qualquer` mostra a página inicial (ou 404 estilizado), não "404" cru.
- **Verificação:** `curl -s http://localhost:3399/qualquer | head -1` mostra HTML.

### IMP-03 · Sem página de erro se o JS falhar · [P3]

- **Arquivo:** `index.html`
- **Evidência:** o jogo é tudo JS; se um módulo falhar ao carregar, a página fica em branco ou
  meio renderizada (só o que não depende do JS).
- **Impacto:** o usuário não entende o que houve; difícil de depurar sem console.
- **Mudança:** um bloco `<noscript>`/fallback no `index.html` com mensagem amigável, e `window.onerror`
  mostrando aviso em vez de tela branca.
- **Aceite:** com JS desabilitado, aparece mensagem clara.
- **Verificação:** `curl -s http://localhost:3399/ | grep -i 'noscript\|erro'`.

---

## 5. Qualidade: testes

### TEST-01 · Testes não cobrem o servidor (só a lógica) · [P1]

- **Arquivo:** `test/` (3 suites: `ai-test`, `chess-rules-test`, `llm-test`)
- **Evidência:** os testes cobrem **exclusivamente** a lógica do jogo e do LLM (minimax, regras,
  extração/validação de escolha). Nenhum toca o `server.js` — por isso o `.git` exposto (P0) passou
  despercebido, e `BUG-01` também.
- **Impacto:** o servidor é a superfície de rede, e está **sem nenhum teste**. Os P0 (`SEC-01`,
  `SEC-02`) são exatamente o que um teste de rota pegaria.
- **Mudança:** `test/servidor-test.mjs` (subindo o `server` com porta aleatória, como as outras
  suites): `/index.html` → 200; `/.git/config` → 404; `/package.json` → 404; `/../etc/passwd` → 404;
  `/%` → 400 (após `BUG-01`); headers de segurança presentes.
- **Aceite:** a suite nova cobre os 2 P0 e falha se a allowlist for removida.
- **Verificação:**
  ```bash
  npm test 2>&1 | tail -3
  ```

---

## 6. DevOps / Infra

### DEVOPS-01 · Sem CI · [P2]

- **Arquivo:** *(ausente)* `.github/workflows/`
- **Evidência:** nenhum workflow; `package.json` tem `test` (`node --test "test/*.mjs"`) mas nada o
  executa automaticamente.
- **Impacto:** 764 linhas de teste (mais que o código) que **só rodam se alguém lembrar** — e o
  servidor (sem teste, ver `TEST-01`) nem é exercitado. Um refactor pode quebrar o jogo sem sinal.
- **Mudança:** `ci.yml` em `on: [push, pull_request]`: `npm ci` (não há deps, mas fica o padrão),
  `npm test`, `node --check server.js js/*.js`.
- **Aceite:** PR que quebra o jogo é bloqueado.
- **Verificação:**
  ```bash
  npm test 2>&1 | tail -2 && node --check server.js js/app.js js/llm.js
  ```

### DEVOPS-02 · Sem Dockerfile · [P3]

- **Arquivo:** *(ausente)* `Dockerfile`
- **Evidência:** o projeto roda com `node server.js` (zero dependências — não precisa de `npm i`).
- **Impacto:** baixo — sem dependências, `FROM node:20-alpine` + `COPY . .` + `CMD ["node","server.js"]`
  resolve. Útil para deploy uniforme e para **não expor a pasta do repo** (o `SEC-01` também se
  resolve naturalmente em container, se o build copiar só o necessário).
- **Mudança:** `Dockerfile` mínimo, copiando **apenas** `index.html`, `style.css`, `js/`, `server.js`
  (não o repo inteiro) — defense in depth do `SEC-01`.
- **Aceite:** `docker build` + `docker run` serve o jogo; `.git` nem entra na imagem.
- **Verificação:**
  ```bash
  docker build -t xadrez . && docker run --rm -p 3344:3344 xadrez &
  curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3344/index.html   # 200
  ```

---

## 7. Documentação

### DOC-01 · README não avisa que expor o servidor expõe o repo · [P2]

- **Arquivo:** `README.md`
- **Evidência:** o README explica o jogo e a IA; não menciona que `node server.js` serve a pasta
  inteira (incluindo `.git`).
- **Impacto:** quem publica o jogo (GitHub Pages, servidor próprio) não sabe que precisa da
  allowlist do `SEC-01` — o mesmo modo de falha de outros projetos deste acervo.
- **Mudança:** seção "Servir": comando correto e **aviso** de que o servidor original serve o repo
  (usar `SEC-01` ou servir via GitHub Pages / servidor de estático com allowlist).
- **Aceite:** README avisa sobre a exposição do repo ao servir.
- **Verificação:** `grep -ni 'servidor\|git\|pages' README.md`.

### DOC-02 · Falta `SECURITY.md` · [P3]

- **Arquivo:** *(ausente)* `SECURITY.md`
- **Evidência:** tem LICENSE/README, sem guia de reporte.
- **Impacto:** baixo (projeto pessoal, sem serviço), mas o `SEC-01` é uma classe de bug que reaparece
  em servidor estático.
- **Mudança:** criar com canal + a invariante "servidor estático serve **allowlist**, nunca a raiz".
- **Aceite:** arquivo existe.
- **Verificação:** `ls SECURITY.md`

---

## 8. Ordem de execução (waves)

### Wave 1 — Fechar a exposição do servidor (P0)
1. **`SEC-02`** — allowlist do que é servido (a raiz do problema).
2. **`SEC-01`** — `.git` e dotfiles bloqueados (garantido pela allowlist).

> Depois da Wave 1, o servidor serve só o jogo.

### Wave 2 — Robustez do servidor (P1)
3. **`BUG-01`** — `decodeURIComponent` com try/catch (`400`).
4. **`SEC-03`** — headers de segurança.
5. **`TEST-01`** — suite do servidor (pega os 2 P0).

### Wave 3 — Qualidade/perf (P2)
6. **`BUG-02`** — leitura assíncrona (ou pré-carregar).
7. **`IMP-01`** — ETag/cache.
8. **`SEC-04`** — CSP (com `wasm-unsafe-eval`).
9. **`DEVOPS-01`** — CI.
10. **`DOC-01`** — README sobre servir.

### Wave 4 — Polimento (P3)
11. **`IMP-02`**, **`IMP-03`**, **`DEVOPS-02`**, **`DOC-02`**.

**Dependências que não podem ser invertidas:**
`SEC-02` antes de `SEC-01` (a allowlist é a solução; `SEC-01` é o caso visível) ·
`TEST-01` depois dos P0 (o teste existe para travá-los) · `BUG-01` junto com `TEST-01` (o `%` é um dos
casos) · `SEC-03`/`SEC-04` depois que a allowlist está (senão ainda serve coisa errada).

---

## 9. Fora de escopo / riscos

| Item | Decisão | Motivo |
|---|---|---|
| Migrar o servidor estático para Express | **Não** | Zero dependências é uma escolha de qualidade. Uma allowlist resolve o `SEC-01` em ~8 linhas. |
| Servir via GitHub Pages (sem servidor Node) | **Não, aqui** | Compatível (é 100% estático), mas é decisão de deploy, não correção — mencionar no `DOC-01`. |
| Colocar o LLM num servidor (API) | **Nunca** | A escolha de LLM local (`llm.js:1-6`) é o diferencial: zero chave, zero custo, privacidade. **Não** regredir disso. |
| Trocar o modelo default (Qwen2.5-0.5B) | **Não** | Dois modelos já offers e fallback CPU/GPU. Performance é escolha; não é defeito. |
| Adicionar rating/persistencia de partida | **Não** | Feature de jogo, não correção. |

**Riscos desta execução:**

- **`SEC-02` (allowlist) pode quebrar o jogo** se esquecer um asset (ex.: um `.wasm`, fonte, ou
  `favicon`). Testar o jogo **inteiro** no browser após a mudança (abrir, jogar um lance, ativar a IA,
  baixar o modelo) — a lista pública precisa cobrir tudo que `index.html` carrega.
- **`SEC-04` (CSP) pode quebrar o WASM** se esquecer `wasm-unsafe-eval` — testar o download do modelo
  no browser, não só o header.
- **`BUG-02` (assíncron) muda o handler** — o `createServer` precisa de handler async; testar que o
  404 e o 200 continuam.
- **Este item se aplica aos 6 jogos do mesmo padrão** (`damas_ia`, `lig4_ia`, `botao_ia`,
  `jogo_da_velha_ia`, `calculadora` têm o mesmo `server.js` com `startsWith(RAIZ)`). A correção feita
  aqui deve ser replicada — ver `PLANO_MELHORIAS_MASTER.md`.

---

## 10. Definição de pronto (DoD)

**Segurança**
- [ ] `SEC-01` — `/.git/config`, `/.git/HEAD`, `/.env` → 404
- [ ] `SEC-02` — `/package.json`, `/test/*` → 404; só o jogo é servido
- [ ] `SEC-03` — `nosniff`, `X-Frame-Options`, `Referrer-Policy` nas respostas
- [ ] `SEC-04` — CSP presente e o jogo + WASM **ainda funcionam**

**Funcional**
- [ ] `BUG-01` — `/%` → 400, sem exceção no log
- [ ] `BUG-02` — requisições concorrentes não se bloqueiam
- [ ] `IMP-01` — asset com `ETag` → `304` na segunda
- [ ] `IMP-02` — rota desconhecida mostra página do jogo (ou 404 amigável)
- [ ] `IMP-03` — falha de JS mostra aviso, não tela branca

**Testes e infra**
- [ ] `TEST-01` — suite do servidor cobrindo os 2 P0
- [ ] `DEVOPS-01` — CI rodando `npm test`
- [ ] `DEVOPS-02` — Dockerfile servindo só o necessário

**Documentação**
- [ ] `DOC-01` — README sobre servir com segurança
- [ ] `DOC-02` — `SECURITY.md`

**Validação final:**
```bash
npm test 2>&1 | tail -2
node --check server.js
PORT=3399 node server.js & sleep 1
curl -s -o /dev/null -w '/.git/config -> %{http_code}\n' http://localhost:3399/.git/config   # 404
kill %1
```

---

*Fim do plano. Gerado por leitura direta do código em 2026-10-02. Nenhum item já estava corrigido*
*— todos apontam para defeitos ainda presentes.*
