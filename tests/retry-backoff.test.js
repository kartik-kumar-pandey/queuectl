import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/connection.js';
import * as queue from '../src/core/queue.js';
import { startWorker } from '../src/core/worker.js';

test('Exponential backoff and retry behavior', async (t) => {
  db.exec('DELETE FROM jobs; DELETE FROM job_logs; DELETE FROM workers;');

  // Set configuration
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('max-retries', '2')").run();
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('backoff-base', '2')").run();

  // Enqueue a job that is guaranteed to fail
  queue.enqueue({
    id: 'failing-job',
    command: 'node -e "process.exit(1)"',
    max_retries: 2
  });

  const workerPromise = startWorker(10001);

  // Poll until job fails the first time (up to 5 seconds timeout)
  let jobAfterFirstFail;
  const startPollTime = Date.now();
  while (Date.now() - startPollTime < 5000) {
    jobAfterFirstFail = db.prepare('SELECT * FROM jobs WHERE id = ?').get('failing-job');
    if (jobAfterFirstFail && jobAfterFirstFail.attempts === 1 && jobAfterFirstFail.state === 'failed') {
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  assert.ok(jobAfterFirstFail, 'Job should exist after execution');
  assert.strictEqual(jobAfterFirstFail.state, 'failed', 'Should transition to failed state first');
  assert.strictEqual(jobAfterFirstFail.attempts, 1);
  assert.ok(jobAfterFirstFail.run_at, 'Should schedule a future retry time');

  // Verify backoff delay: base 2^1 = 2 seconds.
  const now = Date.now();
  const runAt = new Date(jobAfterFirstFail.run_at).getTime();
  const diffSecs = Math.round((runAt - now) / 1000);
  assert.ok(diffSecs >= 0 && diffSecs <= 3, `Backoff scheduled time should be in ~2 seconds (got ${diffSecs}s)`);

  // Stop worker gracefully by updating worker status in DB
  db.prepare("UPDATE workers SET status = 'stopping' WHERE pid = 10001").run();
  await workerPromise;
});
