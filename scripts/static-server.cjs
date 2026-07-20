const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '.output', 'public')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = path.join(root, requestPath === '/' ? 'index.html' : requestPath)
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (path.extname(requestPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not found')
        return
      }
      filePath = path.join(root, 'index.html')
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    res.writeHead(500)
    res.end(String(error))
  }
}).listen(3200, '0.0.0.0')

