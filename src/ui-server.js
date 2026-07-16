import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as queue from './queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, 'public');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
  });
}

export function startUiServer(port = 5000) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    // Helper for sending JSON
    const sendJson = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Helper for sending error
    const sendError = (msg, status = 400) => {
      sendJson({ message: msg }, status);
    };

    try {
      // 1. Static HTML File
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const filePath = path.join(publicDir, 'index.html');
        const content = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // 2. API Endpoints
      // GET /api/status
      if (url.pathname === '/api/status' && method === 'GET') {
        const status = queue.getStatus();
        sendJson(status);
        return;
      }

      // GET /api/jobs
      if (url.pathname === '/api/jobs' && method === 'GET') {
        const jobs = queue.listJobs();
        sendJson(jobs);
        return;
      }

      // GET /api/metrics
      if (url.pathname === '/api/metrics' && method === 'GET') {
        const metrics = queue.getMetrics();
        sendJson(metrics);
        return;
      }

      // GET /api/logs
      if (url.pathname === '/api/logs' && method === 'GET') {
        const jobId = url.searchParams.get('id');
        if (!jobId) return sendError('Missing job ID');
        const logs = queue.getJobLogs(jobId);
        sendJson(logs);
        return;
      }

      // POST /api/enqueue
      if (url.pathname === '/api/enqueue' && method === 'POST') {
        const body = await parseBody(req);
        queue.enqueue(body);
        sendJson({ success: true, jobId: body.id });
        return;
      }

      // POST /api/dlq/retry
      if (url.pathname === '/api/dlq/retry' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.jobId) return sendError('Missing jobId');
        queue.retryDlq(body.jobId);
        sendJson({ success: true });
        return;
      }

      // 404 Fallback
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');

    } catch (err) {
      sendError(err.message, 500);
    }
  });

  server.listen(port, () => {
    // Spawns clean startup log in terminal
  });

  return server;
}
