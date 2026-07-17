import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/connection.js';
import * as queue from '../src/core/queue.js';
import { startWorker } from '../src/core/worker.js';

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../queuectl.db');

test('Job persistence across engine restarts - Database connection close and reopen', async (t) => {
  // Clear jobs first on clean connection
  db.exec("DELETE FROM jobs WHERE id = 'restart-test-job'");

  // Enqueue a job
  queue.enqueue({
    id: 'restart-test-job',
    command: 'echo "persistent"',
  });

  // Open a separate db connection to close and reopen
  const dbTest = new Database(dbPath);
  let job = dbTest.prepare('SELECT * FROM jobs WHERE id = ?').get('restart-test-job');
  assert.ok(job, 'Job should exist before closing connection');
  dbTest.close();

  // Re-open fresh connection to the same SQLite file
  const dbFresh = new Database(dbPath);
  const refreshedJob = dbFresh.prepare('SELECT * FROM jobs WHERE id = ?').get('restart-test-job');
  assert.ok(refreshedJob, 'Job should survive connection restart');
  assert.strictEqual(refreshedJob.command, 'echo "persistent"');

  // Clean up
  dbFresh.prepare("DELETE FROM jobs WHERE id = 'restart-test-job'").run();
  dbFresh.close();
});
