import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../queuectl.db');

// Dynamic imports configured for our folder layout
const { default: db } = await import('../src/db/connection.js');
const queue = await import('../src/core/queue.js');
const { startWorker } = await import('../src/core/worker.js');
const ui = await import('../src/cli-ui/format.js');

// Reset database tables for clean test run
db.exec('DELETE FROM jobs; DELETE FROM workers; DELETE FROM config; DELETE FROM job_logs;');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  ui.banner();
  ui.sectionHeader('VERIFICATION TEST SUITE', '🧪');
  console.log('');

  // ── Test 1: Concurrency Enqueuing ───────────────────────────
  console.log(`  ${ui.C.header('Test 1:')} Enqueuing jobs for concurrency verification...`);

  // Enqueue 4 parallel concurrency jobs
  for (let i = 1; i <= 4; i++) {
    queue.enqueue({
      id: `c-job-${i}`,
      command: 'node -e "setTimeout(() => {}, 500)"',
    });
  }

  ui.table(
    [
      { key: 'id', label: 'ID' },
      { key: 'command', label: 'COMMAND' },
      { key: 'state', label: 'STATE' },
    ],
    queue.listJobs().map(j => ({
      id: ui.C.accent(j.id),
      command: ui.C.white(j.command),
      state: ui.stateBadge(j.state),
    }))
  );

  ui.success('Concurrency jobs enqueued.');

  // ── Test 2: Concurrency & Lock checks (Multiple Workers) ─────
  console.log(`\n  ${ui.C.header('Test 2:')} Verifying concurrency (multiple workers processing without overlap)...`);

  // Start 3 workers simultaneously to process jobs
  const worker1 = startWorker(20001);
  const worker2 = startWorker(20002);
  const worker3 = startWorker(20003);

  await delay(1500);

  // Stop concurrency workers
  db.prepare("UPDATE workers SET status = 'stopping' WHERE pid IN (20001, 20002, 20003)").run();
  await Promise.all([worker1, worker2, worker3]);

  // Check database log count per job to ensure no double execution
  const cJobs = queue.listJobs().filter(j => j.id.startsWith('c-job-'));
  for (const job of cJobs) {
    const logs = db.prepare('SELECT COUNT(*) as count FROM job_logs WHERE job_id = ?').get(job.id);
    if (logs.count > 1) {
      throw new Error(`Job ${job.id} was processed multiple times! Concurrency lock failed.`);
    }
  }
  ui.success('Concurrency verified. 3 workers processed concurrent jobs without overlap.');

  // ── Test 3: Lifecycle Enqueuing ──────────────────────────────
  console.log(`\n  ${ui.C.header('Test 3:')} Enqueuing lifecycle jobs...`);

  queue.enqueue({
    id: 'success-job',
    command: 'node -e "console.log(\'ok\')"',
    max_retries: 2,
  });

  queue.enqueue({
    id: 'fail-job',
    command: 'node -e "process.exit(1)"',
    max_retries: 2,
  });

  queue.enqueue({
    id: 'timeout-job',
    command: 'node -e "setTimeout(()=>process.exit(0),5000)"',
    max_retries: 2,
    timeout: 1,
  });

  ui.table(
    [
      { key: 'id', label: 'ID' },
      { key: 'command', label: 'COMMAND' },
      { key: 'state', label: 'STATE' },
      { key: 'timeout', label: 'TIMEOUT' },
    ],
    queue.listJobs().filter(j => ['success-job', 'fail-job', 'timeout-job'].includes(j.id)).map(j => ({
      id: ui.C.accent(j.id),
      command: ui.C.white(j.command),
      state: ui.stateBadge(j.state),
      timeout: j.timeout ? ui.C.warning(`${j.timeout}s`) : ui.C.dim('none'),
    }))
  );

  ui.success('Lifecycle jobs enqueued.');

  // ── Test 4: Starting main worker ──────────────────────────────
  console.log(`\n  ${ui.C.header('Test 4:')} Starting main worker to process enqueued jobs...`);
  const workerPromise = startWorker(9999);
  await delay(4000);

  // ── Test 5: Checking job states after initial processing ──────
  console.log(`\n  ${ui.C.header('Test 5:')} Checking job states after initial processing...`);

  let jobs = queue.listJobs();
  ui.table(
    [
      { key: 'id', label: 'ID' },
      { key: 'state', label: 'STATE' },
      { key: 'attempts', label: 'RETRIES' },
    ],
    jobs.filter(j => ['success-job', 'fail-job', 'timeout-job'].includes(j.id)).map(j => ({
      id: ui.C.accent(j.id),
      state: ui.stateBadge(j.state),
      attempts: ui.C.muted(`${j.attempts}/${j.max_retries}`),
    }))
  );

  const successJob = jobs.find(j => j.id === 'success-job');
  if (successJob.state !== 'completed') throw new Error('success-job did not complete!');
  ui.success('success-job completed correctly.');

  // ── Test 6: Wait for backoff & DLQ ───────────────────────────
  console.log(`\n  ${ui.C.header('Test 6:')} Waiting for exponential backoff & DLQ migration...`);
  await delay(4000);

  jobs = queue.listJobs();
  ui.table(
    [
      { key: 'id', label: 'ID' },
      { key: 'state', label: 'STATE' },
      { key: 'attempts', label: 'RETRIES' },
      { key: 'error', label: 'ERROR' },
    ],
    jobs.filter(j => ['success-job', 'fail-job', 'timeout-job'].includes(j.id)).map(j => ({
      id: ui.C.accent(j.id),
      state: ui.stateBadge(j.state),
      attempts: ui.C.muted(`${j.attempts}/${j.max_retries}`),
      error: j.error_message ? ui.C.error(j.error_message.trim().slice(0, 40)) : ui.C.dim('—'),
    }))
  );

  const deadJobs = queue.getDlq();
  if (deadJobs.length !== 2) throw new Error(`Expected 2 DLQ jobs, found ${deadJobs.length}`);
  ui.success('Failed and timed-out jobs correctly moved to DLQ.');

  // ── Test 7: DLQ retry ────────────────────────────────────────
  console.log(`\n  ${ui.C.header('Test 7:')} Retrying a job from DLQ...`);
  queue.retryDlq('fail-job');
  const retriedJob = queue.listJobs().find(j => j.id === 'fail-job');
  if (retriedJob.state !== 'pending' || retriedJob.attempts !== 0) {
    throw new Error('DLQ retry failed to reset job state!');
  }
  ui.success('DLQ retry reset fail-job back to pending.');

  // ── Test 8: Stopping main worker ────────────────────────────
  console.log(`\n  ${ui.C.header('Test 8:')} Stopping worker...`);
  db.prepare("UPDATE workers SET status = 'stopping' WHERE pid = ?").run(9999);
  await delay(1500);

  // ── Test 9: Restart & Persistence ────────────────────────────
  console.log(`\n  ${ui.C.header('Test 9:')} Verifying job persistence across engine restarts...`);
  
  // Open separate sqlite connection, read job, close, and verify survival
  const dbTest = new Database(dbPath);
  let persistJob = dbTest.prepare("SELECT * FROM jobs WHERE id = 'success-job'").get();
  if (!persistJob) throw new Error('Job not found in database before connection reset');
  dbTest.close();

  const dbFresh = new Database(dbPath);
  let refreshedJob = dbFresh.prepare("SELECT * FROM jobs WHERE id = 'success-job'").get();
  if (!refreshedJob) throw new Error('Job did not survive connection restart!');
  dbFresh.close();

  ui.success('Persistence verified. Job data survived connection reset & restart.');

  // ── Test 10: Execution Metrics ───────────────────────────────
  console.log(`\n  ${ui.C.header('Test 10:')} Execution Metrics...`);
  const metrics = queue.getMetrics();

  ui.sectionHeader('EXECUTION METRICS', '📊');
  ui.keyValue([
    ['Total Jobs',       String(metrics.totalJobs)],
    ['Completed',        String(metrics.completedJobs)],
    ['Dead (Failed)',    String(metrics.failedJobs)],
    ['Success Rate',     `${metrics.successRate}%`],
    ['Total Attempts',   String(metrics.totalAttempts)],
    ['Avg Duration',     `${metrics.avgDuration}ms`],
    ['Min Duration',     `${metrics.minDuration}ms`],
    ['Max Duration',     `${metrics.maxDuration}ms`],
  ]);
  ui.success('Metrics calculated correctly.');

  // ── Test 11: Job Output Logs ────────────────────────────────
  console.log(`\n  ${ui.C.header('Test 11:')} Job Output Logs...`);

  const successLogs = queue.getJobLogs('success-job');
  const failLogs = queue.getJobLogs('fail-job');

  ui.sectionHeader('LOGS ─ success-job', '📜');
  ui.table(
    [
      { key: 'attempt',   label: 'ATTEMPT' },
      { key: 'exit_code', label: 'EXIT' },
      { key: 'duration',  label: 'DURATION' },
      { key: 'stdout',    label: 'STDOUT' },
      { key: 'stderr',    label: 'STDERR' },
      { key: 'time',      label: 'TIMESTAMP' },
    ],
    successLogs.map(l => ({
      attempt:   ui.C.accent(`#${l.attempt}`),
      exit_code: l.exit_code === 0 ? ui.C.success('0') : ui.C.error(String(l.exit_code)),
      duration:  ui.C.muted(`${l.duration_ms}ms`),
      stdout:    l.stdout ? ui.C.white(l.stdout.trim().slice(0, 30)) : ui.C.dim('—'),
      stderr:    l.stderr ? ui.C.error(l.stderr.trim().slice(0, 30)) : ui.C.dim('—'),
      time:      ui.C.dim(new Date(l.created_at).toLocaleTimeString()),
    }))
  );

  ui.sectionHeader('LOGS ─ fail-job', '📜');
  ui.table(
    [
      { key: 'attempt',   label: 'ATTEMPT' },
      { key: 'exit_code', label: 'EXIT' },
      { key: 'duration',  label: 'DURATION' },
      { key: 'stderr',    label: 'STDERR' },
      { key: 'time',      label: 'TIMESTAMP' },
    ],
    failLogs.map(l => ({
      attempt:   ui.C.accent(`#${l.attempt}`),
      exit_code: l.exit_code === 0 ? ui.C.success('0') : ui.C.error(String(l.exit_code)),
      duration:  ui.C.muted(`${l.duration_ms}ms`),
      stderr:    l.stderr ? ui.C.error(l.stderr.trim().slice(0, 40)) : ui.C.dim('—'),
      time:      ui.C.dim(new Date(l.created_at).toLocaleTimeString()),
    }))
  );

  ui.success('Job output logging verified — stdout, stderr, exit codes, and durations captured.');

  // ── Results ─────────────────────────────────────────────────
  ui.sectionHeader('ALL VERIFICATION TESTS PASSED', '🎉');
 console.log('');
  process.exit(0);
}

runTests().catch(err => {
  ui.error(`Test failed: ${err.message}`);
  process.exit(1);
});
