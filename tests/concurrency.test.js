import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/connection.js';
import * as queue from '../src/core/queue.js';
import { startWorker } from '../src/core/worker.js';

test('Concurrency and locking checks - Multiple workers process jobs without overlap', async (t) => {
  db.exec('DELETE FROM jobs; DELETE FROM job_logs; DELETE FROM workers;');

  // Enqueue a batch of 5 jobs
  const jobIds = ['c-job-1', 'c-job-2', 'c-job-3', 'c-job-4', 'c-job-5'];
  for (const id of jobIds) {
    queue.enqueue({
      id,
      command: 'node -e "setTimeout(() => {}, 200)"',
    });
  }

  // Spawn three workers at the same time to claim the batch of jobs
  const worker1 = startWorker(20001);
  const worker2 = startWorker(20002);
  const worker3 = startWorker(20003);

  // Poll until all jobs are either completed or processing (up to 5 seconds timeout)
  let jobs = [];
  const startPollTime = Date.now();
  while (Date.now() - startPollTime < 5000) {
    jobs = db.prepare("SELECT * FROM jobs WHERE id LIKE 'c-job-%'").all();
    if (jobs.length === 5 && jobs.every(job => job.state === 'completed' || job.state === 'processing')) {
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Verify that all 5 jobs are completed or processing, and none are double executed
  assert.strictEqual(jobs.length, 5, 'All 5 jobs should exist in the database');

  for (const job of jobs) {
    assert.ok(job.state === 'completed' || job.state === 'processing', `Job ${job.id} should be completed or processing`);
    // Verify execution log counts per job
    const logs = db.prepare('SELECT COUNT(*) as count FROM job_logs WHERE job_id = ?').get(job.id);
    assert.ok(logs.count <= 1, `Job ${job.id} should not be executed more than once (actual count: ${logs.count})`);
  }

  // Terminate workers
  db.prepare("UPDATE workers SET status = 'stopping' WHERE pid IN (20001, 20002, 20003)").run();
  await Promise.all([worker1, worker2, worker3]);
});
