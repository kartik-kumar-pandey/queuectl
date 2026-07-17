import db from '../db/connection.js';
import * as config from './config.js';

export function enqueue(jobInput) {
  const { id, command, max_retries, priority, run_at, timeout } = jobInput;

  if (!id || typeof id !== 'string') {
    throw new Error('Job must contain a valid string "id"');
  }
  if (!command || typeof command !== 'string') {
    throw new Error('Job must contain a valid string "command"');
  }

  const now = new Date().toISOString();
  const defaultMaxRetries = parseInt(config.get('max-retries') || '3', 10);
  
  const finalMaxRetries = max_retries !== undefined ? parseInt(max_retries, 10) : defaultMaxRetries;
  const finalPriority = priority !== undefined ? parseInt(priority, 10) : 0;
  const finalTimeout = timeout !== undefined ? parseInt(timeout, 10) : null;
  const finalRunAt = run_at ? new Date(run_at).toISOString() : null;

  try {
    db.prepare(`
      INSERT INTO jobs (id, command, state, attempts, max_retries, priority, run_at, timeout, created_at, updated_at)
      VALUES (?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      command,
      finalMaxRetries,
      finalPriority,
      finalRunAt,
      finalTimeout,
      now,
      now
    );
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      throw new Error(`Job with ID "${id}" already exists`);
    }
    throw error;
  }
}

export function getStatus() {
  const jobStats = db.prepare('SELECT state, COUNT(*) as count FROM jobs GROUP BY state').all();
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    dead: 0
  };
  for (const row of jobStats) {
    if (row.state in stats) {
      stats[row.state] = row.count;
    }
  }

  // Active workers (heartbeat within last 10 seconds)
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const activeWorkersCount = db.prepare(`
    SELECT COUNT(*) as count FROM workers 
    WHERE status = 'active' AND last_heartbeat >= ?
  `).get(tenSecondsAgo).count;

  return {
    jobs: stats,
    activeWorkers: activeWorkersCount
  };
}

export function listJobs(state) {
  if (state) {
    return db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at ASC').all(state);
  }
  return db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all();
}

export function getDlq() {
  return db.prepare("SELECT * FROM jobs WHERE state = 'dead' ORDER BY updated_at DESC").all();
}

export function retryDlq(jobId) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND state = 'dead'").get(jobId);
  if (!job) {
    throw new Error(`Job "${jobId}" not found in DLQ`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs 
    SET state = 'pending', attempts = 0, run_at = NULL, error_message = NULL, updated_at = ? 
    WHERE id = ?
  `).run(now, jobId);
}

export function getMetrics() {
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  const completedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE state = 'completed'").get().count;
  const failedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE state = 'dead'").get().count;
  const avgDuration = db.prepare("SELECT AVG(duration_ms) as avg FROM jobs WHERE duration_ms IS NOT NULL").get().avg;
  const maxDuration = db.prepare("SELECT MAX(duration_ms) as max FROM jobs WHERE duration_ms IS NOT NULL").get().max;
  const minDuration = db.prepare("SELECT MIN(duration_ms) as min FROM jobs WHERE duration_ms IS NOT NULL").get().min;
  const totalAttempts = db.prepare("SELECT SUM(attempts) as total FROM jobs").get().total;
  const successRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : '0.0';

  return {
    totalJobs,
    completedJobs,
    failedJobs,
    successRate,
    avgDuration: avgDuration ? Math.round(avgDuration) : 0,
    maxDuration: maxDuration || 0,
    minDuration: minDuration || 0,
    totalAttempts: totalAttempts || 0,
  };
}

export function getJobLogs(jobId) {
  return db.prepare('SELECT * FROM job_logs WHERE job_id = ? ORDER BY attempt ASC').all(jobId);
}
