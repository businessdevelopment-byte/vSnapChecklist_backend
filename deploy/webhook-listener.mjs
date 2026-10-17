// Zero-dependency GitHub webhook listener for the vSnap Checklist Backend.
// Listens on 127.0.0.1:HOOK_PORT (reached only via the IIS secret-path rewrite
// on botivateapi.vsnapu.com). On a signed `push` to main it runs auto-deploy.ps1.
//
// Required env (set in the NSSM service, never in git):
//   WEBHOOK_SECRET  - shared secret configured on the GitHub webhook
//   HOOK_PORT       - optional, defaults to 4055
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = parseInt(process.env.HOOK_PORT || '4055', 10);
const SECRET = process.env.WEBHOOK_SECRET || '';
const BRANCH = 'refs/heads/main';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOY_SCRIPT = path.join(__dirname, 'auto-deploy.ps1');

if (!SECRET) {
  console.error('WEBHOOK_SECRET not set; refusing to start.');
  process.exit(1);
}

const ts = () => new Date().toISOString();

function signaturesMatch(sig, expected) {
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let running = false;

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); return res.end('method not allowed'); }

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 5_000_000) { req.destroy(); return; } // cap body at ~5MB
    chunks.push(c);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const sig = String(req.headers['x-hub-signature-256'] || '');
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    if (!sig || !signaturesMatch(sig, expected)) {
      console.log(ts(), 'rejected: bad or missing signature');
      res.writeHead(401); return res.end('bad signature');
    }

    const event = String(req.headers['x-github-event'] || '');
    if (event === 'ping') { console.log(ts(), 'ping ok'); res.writeHead(200); return res.end('pong'); }
    if (event !== 'push') { res.writeHead(200); return res.end('ignored event'); }

    let payload;
    try { payload = JSON.parse(body.toString('utf8')); }
    catch { res.writeHead(400); return res.end('bad json'); }

    if (payload.ref !== BRANCH) {
      console.log(ts(), 'ignored ref', payload.ref);
      res.writeHead(200); return res.end('ignored ref');
    }
    if (running) { console.log(ts(), 'deploy already running'); res.writeHead(202); return res.end('already running'); }

    running = true;
    const sha = (payload.head_commit && payload.head_commit.id ? payload.head_commit.id.slice(0, 7) : '?');
    console.log(ts(), 'deploy triggered by', sha);
    const child = spawn('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', DEPLOY_SCRIPT],
      { detached: true, stdio: 'ignore' });
    child.on('exit', (code) => { running = false; console.log(ts(), 'deploy exited', code); });
    child.on('error', (e) => { running = false; console.log(ts(), 'spawn error', e.message); });

    res.writeHead(202); return res.end('deploy started');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(ts(), 'webhook listener on 127.0.0.1:' + PORT));
