// Servidor estático do jogo: publica uma allowlist explícita, nunca a raiz do repositório.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTA = Number(process.env.PORT || 3344);
const HOST = process.env.HOST || '127.0.0.1';
const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PUBLICOS = new Set([
  '/index.html',
  '/404.html',
  '/style.css',
  '/js/app.js',
  '/js/ai-minimax.js',
  '/js/chess-rules.js',
  '/js/llm.js',
  '/js/erro.js',
  '/js/vendor/webllm.esm.js',
  '/js/vendor/wllama/index.js',
  '/js/vendor/wllama/wasm/wllama.wasm'
]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm'
};
const etags = new Map();

if (!Number.isInteger(PORTA) || PORTA < 1 || PORTA > 65535) throw new Error('PORT inválida');

function definirHeadersSeguranca(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co; worker-src 'self' blob:; child-src blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
}

function correspondeEtag(cabecalho, etag) {
  if (!cabecalho) return false;
  return cabecalho.split(',').some((item) => {
    const candidato = item.trim();
    return candidato === '*' || candidato === etag || candidato.replace(/^W\//, '') === etag;
  });
}

async function servir(pathname, req, res) {
  if (!PUBLICOS.has(pathname)) return false;
  const caminho = resolve(RAIZ, `.${pathname}`);
  const info = await stat(caminho, { bigint: true });
  const atual = etags.get(pathname);
  let dados;
  let etag;
  if (atual && atual.tamanho === info.size && atual.mtimeNs === info.mtimeNs) {
    etag = atual.etag;
  } else {
    dados = await readFile(caminho);
    etag = `"${createHash('sha256').update(dados).digest('hex')}"`;
    etags.set(pathname, { tamanho: info.size, mtimeNs: info.mtimeNs, etag });
  }

  res.setHeader('Content-Type', MIME[extname(caminho)] || 'application/octet-stream');
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', pathname === '/index.html' ? 'public, max-age=60, must-revalidate' : 'public, max-age=3600, must-revalidate');
  if (correspondeEtag(req.headers['if-none-match'], etag)) {
    res.writeHead(304);
    res.end();
    return true;
  }

  if (!dados) dados = await readFile(caminho);
  res.writeHead(200, { 'Content-Length': dados.byteLength });
  res.end(req.method === 'HEAD' ? undefined : dados);
  return true;
}

export const server = createServer(async (req, res) => {
  definirHeadersSeguranca(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '405 — método não permitido');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '400 — caminho inválido');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  // Allowlist exata antes de qualquer leitura: .git, dotfiles, testes e o restante da repo nunca são servidos.
  try {
    if (await servir(pathname, req, res)) return;
  } catch (erro) {
    if (erro?.code !== 'ENOENT' && erro?.code !== 'ENOTDIR') {
      console.error('Falha ao servir asset:', erro?.message || erro);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : '500 — não foi possível carregar o arquivo');
      return;
    }
  }

  try {
    const dados = await readFile(resolve(RAIZ, '404.html'));
    res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '404 — página não encontrada');
  }
});

if (process.env.NO_LISTEN !== '1') {
  server.listen(PORTA, HOST, () => console.log(`Xadrez com IA em http://${HOST}:${PORTA}`));
}
