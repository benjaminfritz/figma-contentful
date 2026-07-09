import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = process.cwd()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' }

createServer((request, response) => {
  const pathname = request.url === '/' ? '/preview.html' : new URL(request.url, 'http://localhost').pathname
  const file = normalize(join(root, pathname))
  if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404).end('Not found'); return }
  response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(response)
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'))
