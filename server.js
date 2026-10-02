// Servidor estático — o jogo inteiro é estático (HTML/CSS/JS), sem etapa de build.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORTA = process.env.PORT || 3344;
const RAIZ = new URL('.', import.meta.url).pathname;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };

createServer((req, res) => {
  let caminho = decodeURIComponent(req.url.split('?')[0]);
  if (caminho === '/') caminho = '/index.html';
  const arquivo = join(RAIZ, caminho);
  if (!arquivo.startsWith(RAIZ) || !existsSync(arquivo)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(arquivo)] || 'application/octet-stream' });
  res.end(readFileSync(arquivo));
}).listen(PORTA, () => console.log(`Xadrez com IA em http://localhost:${PORTA}`));
