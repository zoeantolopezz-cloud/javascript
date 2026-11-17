const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.PORT) || 3000;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function findHtmlFiles(directory, relativeDirectory = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findHtmlFiles(fullPath, relativePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(relativePath);
    }
  }

  return files;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function createHomePage() {
  const files = (await findHtmlFiles(root)).sort((a, b) => a.localeCompare(b));
  const links = files.map((file) => {
    const href = file.split(path.sep).map(encodeURIComponent).join('/');
    return `<li><a href="/${href}">${escapeHtml(file.replaceAll(path.sep, '/'))}</a></li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prácticas de JavaScript</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; max-width: 760px; margin: 3rem auto; padding: 0 1rem; color: #172033; }
    h1 { margin-bottom: .25rem; }
    p { color: #526078; }
    ul { padding-left: 1.25rem; }
    li { margin: .45rem 0; }
    a { color: #155eef; }
  </style>
</head>
<body>
  <h1>Prácticas de JavaScript</h1>
  <p>Selecciona una página para abrirla en localhost.</p>
  <ul>${links || '<li>No se encontraron páginas HTML.</li>'}</ul>
</body>
</html>`;
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  if (pathname === '/') {
    const page = await createHomePage();
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : page);
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
    } else {
      response.end(await fs.readFile(filePath));
    }
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Servidor listo: http://${host}:${port}`);
});