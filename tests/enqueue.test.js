import test from 'node:test';
import assert from 'node:assert';
import db from '../src/db/connection.js';
import * as queue from '../src/core/queue.js';

test('Enqueue validation & database persistence', async (t) => {
  // Clear jobs first
  db.exec('DELETE FROM jobs');

  await t.test('Should throw on missing/invalid job details', () => {
    assert.throws(() => queue.enqueue({}), /Job must contain a valid string "id"/);
    assert.throws(() => queue.enqueue({ id: 'test-1' }), /Job must contain a valid string "command"/);
  });

  await t.test('Should successfully enqueue a valid job and save it to the DB', () => {
    queue.enqueue({
      id: 'job-1',
      command: 'echo "test"',
      max_retries: 5,
      priority: 10,
      timeout: 30
    });

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('job-1');
    assert.ok(job, 'Job should exist in database');
    assert.strictEqual(job.command, 'echo "test"');
    assert.strictEqual(job.state, 'pending');
    assert.strictEqual(job.attempts, 0);
    assert.strictEqual(job.max_retries, 5);
    assert.strictEqual(job.priority, 10);
    assert.strictEqual(job.timeout, 30);
  });

  await t.test('Should throw an error if a duplicate job ID is enqueued', () => {
    assert.throws(() => {
      queue.enqueue({
        id: 'job-1',
        command: 'echo "duplicate"'
      });
    }, /Job with ID "job-1" already exists/);
  });
});
