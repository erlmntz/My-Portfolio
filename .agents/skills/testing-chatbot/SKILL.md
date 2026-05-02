# Testing the AI chatbot

This portfolio is a static HTML/CSS/JS site with one Vercel serverless function at `api/chat.js` that proxies messages to Google Gemini using a system prompt built from `PORTFOLIO_INFO`. The chat widget lives in `index.html` (markup), `style.css` (styles), and `chatbot.js` (logic). All four files are wired together and don't share state with anything else.

## Devin secrets needed

- `GEMINI_API_KEY` — Google AI Studio API key (free tier works). Get one at https://aistudio.google.com/app/apikey. Saved here as a repo-scoped secret so future Devin sessions inherit it.

## Running locally for tests (no Vercel login needed)

Vercel CLI (`vercel dev`) requires a Vercel account/login and project linking, which adds friction. To skip that, use a tiny Node server that serves the static files and routes `POST /api/chat` directly into `api/chat.js`. The function accepts a plain `(req, res)` pair with `req.body` and `res.status(...).json(...)`, so emulation is one file:

```js
// /tmp/local-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const STATIC_DIR = process.env.STATIC_DIR || process.cwd();
const handler = require(path.join(STATIC_DIR, 'api/chat.js'));
const MIME = { '.html':'text/html;charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf' };
http.createServer(async (req, res) => {
  const u = url.parse(req.url);
  if (req.method === 'POST' && u.pathname === '/api/chat') {
    let raw = ''; req.on('data', c => raw += c);
    req.on('end', async () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch {}
      const fakeRes = { _s: 200, _h: {}, setHeader(k,v){this._h[k]=v;}, status(c){this._s=c;return this;}, json(o){res.writeHead(this._s,{...this._h,'Content-Type':'application/json'});res.end(JSON.stringify(o));} };
      await handler({ method: req.method, headers: req.headers, body }, fakeRes);
    });
    return;
  }
  let p = u.pathname || '/'; if (p === '/') p = '/index.html';
  const fp = path.join(STATIC_DIR, p);
  if (!fp.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.stat(fp, (e, s) => {
    if (e || !s.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
}).listen(process.env.PORT || 3000);
```

Run:
```bash
export STATIC_DIR=$(pwd)
export PORT=3000
# GEMINI_API_KEY must already be exported in the shell (e.g. via Devin secret)
nohup node /tmp/local-server.js > /tmp/server.log 2>&1 &
sleep 1
curl -s -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","text":"Where did Earl intern?"}]}'
```

If the curl reply contains `NIA`, the chain is healthy. Then test in Chrome at http://localhost:3000/.

**Heads up:** when starting the server in a background subshell with `&`, env vars from the parent shell don't always propagate. Use `nohup ... &` after `export GEMINI_API_KEY=...` (or run the server in the foreground and check `/tmp/server.log` for `GEMINI_API_KEY is not configured.`).

## Adversarial assertions

The whole point of the system prompt is to inject `PORTFOLIO_INFO` so the model can answer about Earl. Pick assertions that would fail if the system prompt weren't being sent.

Good (distinguish working vs. broken):
- Ask about the **NIA internship** — reply must contain `NIA`. Gemini won't invent that acronym without the system prompt.
- Ask **"How can I contact Earl?"** — reply must contain `earlsumalbag@gmail.com` (or whatever email is in `PORTFOLIO_INFO`). The exact string only exists in the system prompt.
- Ask **"What is the capital of France?"** — reply must NOT directly answer `Paris` and must redirect to questions about Earl. A broken/missing system prompt would just answer the geography question.

Weak (avoid):
- "Tell me about Earl" — too generic; both a broken bot (just echoing portfolio HTML scraped at training time, hallucinating) and a working one might pass.
- "Is the chat working?" — model could reply "yes" either way.

## Where the bot's knowledge lives

`api/chat.js` → top-level `PORTFOLIO_INFO` constant. Edit that string to update the bot's facts (new internship, new project, new email, etc.) — no other file needs to change. Keep the formatting (key: value blocks, dashed lists) since the system prompt instructs the bot to use it as authoritative.

## Production deployment

Vercel is the supported host (other serverless platforms like Netlify Functions or Cloudflare Workers would need handler-shape adjustments). Required env var on the Vercel project: `GEMINI_API_KEY`. The static site continues to render fine on GitHub Pages, but `/api/chat` only exists on Vercel — so the chat will only work where the function is deployed.

## Common failure modes & how to spot them

- All replies show `"Sorry, I couldn't reach the server. Please try again later."` → `/api/chat` is unreachable (server not running, or you're on GitHub Pages). Check network tab.
- All replies show `"The chatbot isn't configured yet. Please try again later."` → server is running but `GEMINI_API_KEY` is missing/empty in the runtime env. Check `process.env.GEMINI_API_KEY` server-side.
- All replies show `"The AI service is temporarily unavailable."` → the Gemini upstream returned a non-2xx (likely invalid key, model name typo, or quota). Check server logs for the upstream status code.
- Replies are generic/wrong (e.g. answering "Paris") → `systemInstruction` not being passed; check the request payload built in `api/chat.js`.
