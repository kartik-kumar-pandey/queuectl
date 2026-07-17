import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/connection.js';
import * as queue from '../src/core/queue.js';
import { startWorker } from '../src/core/worker.js';

test('Dead Letter Queue (DLQ) transitions & resurrection', async (t) => {
  db.exec('DELETE FROM jobs; DELETE FROM job_logs; DELETE FROM workers;');

  // Enqueue a job that will fail immediately, max_retries = 1 so it dies after 1 failure
  queue.enqueue({
    id: 'dead-job',
    command: 'node -e "process.exit(1)"',
    max_retries: 1
  });

  const workerPromise = startWorker(10002);

  // Poll until job is dead (up to 5 seconds timeout)
  let deadJob;
  const startPollTime = Date.now();
  while (Date.now() - startPollTime < 5000) {
    deadJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get('dead-job');
    if (deadJob && deadJob.state === 'dead') {
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Should be dead now
  assert.ok(deadJob, 'Job should exist');
  assert.strictEqual(deadJob.state, 'dead', 'Should transition to dead state');

  const dlqJobs = queue.getDlq();
  assert.ok(dlqJobs.some(j => j.id === 'dead-job'), 'Job should be in Dead Letter Queue lists');

  // Resurrect job from DLQ
  queue.retryDlq('dead-job');

  const resurrectedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get('dead-job');
  assert.strictEqual(resurrectedJob.state, 'pending', 'Resurrected job should be pending');
  assert.strictEqual(resurrectedJob.attempts, 0, 'Resurrected job attempts should be reset');
  assert.strictEqual(resurrectedJob.error_message, null, 'Resurrected job error message should be cleared');

  db.prepare("UPDATE workers SET status = 'stopping' WHERE pid = 10002").run();
  await workerPromise;
});
