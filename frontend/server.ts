import express from 'express';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Python backend (single source of truth, honest pipeline data) ───────
// The React frontend NEVER fabricates results. All /api/* routes are
// proxied to the TrendLens Python backend (src/api.py), which serves data
// measured by the real CLIP/FAISS/BLIP pipeline. If the backend is down we
// return an explicit offline message — no invented demo numbers.
const PY_BACKEND_HOST = process.env.TRENDLENS_API_HOST || '127.0.0.1';
const PY_BACKEND_PORT = parseInt(process.env.TRENDLENS_API_PORT || '8000', 10);

function proxyToPython(req: express.Request, res: express.Response) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const body = req.method !== 'GET' && req.body ? JSON.stringify(req.body) : null;
  if (body) headers['Content-Length'] = String(Buffer.byteLength(body));

  const upstream = http.request(
    {
      host: PY_BACKEND_HOST,
      port: PY_BACKEND_PORT,
      path: req.originalUrl,
      method: req.method,
      headers,
    },
    (up) => {
      res.status(up.statusCode || 500);
      for (const [k, v] of Object.entries(up.headers)) {
        if (v !== undefined) res.setHeader(k, v);
      }
      up.pipe(res);
    }
  );

  upstream.on('error', () => {
    res.status(502).json({
      status: 'backend-offline',
      error: 'TrendLens Python backend is not reachable.',
      answer: [
        '⚠️ **TrendLens Python backend offline**',
        '',
        'The React frontend does not fabricate results — it only serves data from the real pipeline.',
        'Start the backend:',
        '```',
        'cd trendlens && source venv/bin/activate && python -m src.api',
        '```',
      ].join('\n'),
      retrievedClusters: [],
      totalClustersAnalyzed: 0,
      sources: [],
    });
  });

  if (body) upstream.write(body);
  upstream.end();
}

// ── Express app ────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// All API routes proxy to the Python backend (health, rag-query, trends,
// clusters, predict-popularity).
app.all('/api/*', proxyToPython);

// ── Vite / Static Files setup ─────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrendLens frontend on http://0.0.0.0:${PORT}`);
    console.log(`[TrendLens] /api/* proxied to Python backend at http://${PY_BACKEND_HOST}:${PY_BACKEND_PORT} — honest pipeline data only (no fabricated results).`);
  });
}

startServer();
