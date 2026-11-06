// Run after building into build/local. Uses a fresh Chrome profile and no packages.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn, execFileSync } = require('node:child_process')

async function main () {
  const root = path.resolve(__dirname, '..')
  let chrome = process.env.CHROME_BIN
  if (!chrome && process.platform === 'darwin') chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (!chrome) {
    for (const name of ['chromium', 'google-chrome', 'chromium-browser']) {
      try { chrome = execFileSync('which', [name], { encoding: 'utf8' }).trim(); break } catch {}
    }
  }
  if (!chrome) throw new Error('Set CHROME_BIN to a Chrome or Chromium executable')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mscgen-hidden-'))
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/hidden-check.html') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<div id="chart"></div><pre id="result">running</pre><script src="/core.js"></script><script src="/hidden-check.js"></script>')
      return
    }
    const file = pathname === '/core.js'
      ? path.join(root, 'vendor/mscgenjs-core/dist/bundle/index.min.js')
      : pathname === '/hidden-check.js'
        ? path.join(__dirname, 'hidden-check.browser.js')
        : path.join(root, 'build/local', pathname)
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json' }
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
    fs.readFile(file, (error, data) => {
      response.statusCode = error ? 404 : 200
      response.end(error ? 'Not found' : data)
    })
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=30000', 'http://127.0.0.1:' + server.address().port + '/hidden-check.html'])
    let output = ''; let errors = ''
    browser.stdout.on('data', chunk => { output += chunk })
    browser.stderr.on('data', chunk => { errors += chunk })
    const timeout = setTimeout(() => browser.kill(), 60000)
    try {
      await new Promise((resolve, reject) => {
        browser.on('error', reject)
        browser.on('exit', code => code === 0 ? resolve() : reject(new Error('Chrome exited: ' + code + '\n' + errors)))
      })
    } finally { clearTimeout(timeout) }
    const match = output.match(/<pre id="result">([^<]+)<\/pre>/)
    if (!match) throw new Error('Missing browser report: ' + output.slice(-1000))
    const report = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<'))
    fs.writeFileSync(path.join(root, 'build/browser-check.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
    if (!report.ok) process.exitCode = 1
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(profile, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
