#!/usr/bin/env node

import { Command } from 'commander';
import { fork, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as queue from '../src/queue.js';
import * as config from '../src/config.js';
import db from '../src/db.js';
import {
  banner, table, stateBadge, sectionHeader, statusCard,
  success, error, info, warn, C, gradient, keyValue, timestamp
} from '../src/ui.js';
import { startRepl } from '../src/repl.js';
import { startUiServer } from '../src/ui-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, '../src/worker.js');

const program = new Command();

program
  .name('queuectl')
  .description('CLI-based background job queue system')
  .version('1.0.0');

// ─────────────────────────────────────────────────────────────────
// ENQUEUE
// ─────────────────────────────────────────────────────────────────
program
  .command('enqueue')
  .description('Add a new job to the queue')
  .argument('[jobJson]', 'JSON string of the job fields')
  .option('--json <json>', 'JSON string of the job fields (fallback)')
  .option('--id <id>', 'Unique ID of the job')
  .option('--command <cmd>', 'Command for the job to execute')
  .option('--retries <count>', 'Maximum number of retries')
  .option('--priority <pri>', 'Execution priority (higher executes first)', '0')
  .option('--timeout <secs>', 'Execution timeout in seconds')
  .option('--run-at <date>', 'Scheduled delay time (e.g. ISO timestamp)')
  .action((jobJson, options) => {
    try {
      let jobInput = {};
      const rawJson = (jobJson && jobJson.trim().startsWith('{')) ? jobJson : options.json;

      if (rawJson) {
        jobInput = JSON.parse(rawJson);
      } else {
        if (!options.id || !options.command) {
          throw new Error('Missing required options: --id and --command must be specified (or pass a JSON string)');
        }
        jobInput = {
          id: options.id,
          command: options.command,
          max_retries: options.retries !== undefined ? parseInt(options.retries, 10) : undefined,
          priority: parseInt(options.priority, 10),
          timeout: options.timeout !== undefined ? parseInt(options.timeout, 10) : undefined,
          run_at: options.runAt,
        };
      }

      queue.enqueue(jobInput);

      banner();
      sectionHeader('JOB ENQUEUED', '📥');
      keyValue([
        ['Job ID',      jobInput.id],
        ['Command',     jobInput.command],
        ['Max Retries', String(jobInput.max_retries ?? config.get('max-retries'))],
        ['Priority',    String(jobInput.priority ?? 0)],
        ['Timeout',     jobInput.timeout ? `${jobInput.timeout}s` : 'None'],
        ['Scheduled',   jobInput.run_at ?? 'Immediate'],
      ]);
      success(`Job ${C.accent(jobInput.id)} added to queue successfully.`);
    } catch (err) {
      error(`Failed to enqueue: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// WORKERS
// ─────────────────────────────────────────────────────────────────
const workerCmd = program.command('worker').description('Manage worker processes');

workerCmd
  .command('start')
  .description('Start one or more workers')
  .option('--count <number>', 'Number of worker processes to spawn', '1')
  .action((options) => {
    const count = parseInt(options.count, 10);
    if (isNaN(count) || count < 1) {
      error('Count must be a positive integer');
      process.exit(1);
    }

    banner();
    sectionHeader('SPAWNING WORKERS', '⚡');

    const children = [];
    for (let i = 0; i < count; i++) {
      const child = fork(workerPath);
      children.push(child);
      console.log(`  ${C.dim('└─')} ${C.muted('PID')} ${C.success(String(child.pid))} ${C.dim('launched')}`);
    }

    success(`${count} worker(s) are now processing jobs.`);
    info('Press Ctrl+C to stop all workers gracefully.');

    const cleanup = () => {
      console.log('');
      warn('Sending graceful shutdown signals...');
      for (const child of children) {
        try {
          db.prepare("UPDATE workers SET status = 'stopping' WHERE pid = ?").run(child.pid);
          child.kill('SIGINT');
        } catch (e) {}
      }
      setTimeout(() => process.exit(0), 1500);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });

workerCmd
  .command('stop')
  .description('Stop running workers gracefully')
  .action(() => {
    try {
      const activeWorkers = db.prepare("SELECT pid FROM workers WHERE status = 'active'").all();
      if (activeWorkers.length === 0) {
        info('No active workers found.');
        return;
      }

      sectionHeader('STOPPING WORKERS', '🛑');

      for (const worker of activeWorkers) {
        db.prepare("UPDATE workers SET status = 'stopping' WHERE pid = ?").run(worker.pid);
        try { process.kill(worker.pid, 'SIGINT'); } catch (e) {}
        console.log(`  ${C.dim('└─')} ${C.muted('PID')} ${C.warning(String(worker.pid))} ${C.dim('→ stop signal sent')}`);
      }
      success(`Graceful stop sent to ${activeWorkers.length} worker(s).`);
    } catch (err) {
      error(`Failed to stop workers: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// STATUS DASHBOARD
// ─────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show summary of all job states & active workers')
  .action(() => {
    try {
      const status = queue.getStatus();
      statusCard(status.jobs, status.activeWorkers);
    } catch (err) {
      error(`Failed to fetch status: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// LIST JOBS
// ─────────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List jobs by state')
  .option('--state <state>', 'Filter by state (pending, processing, completed, failed, dead)')
  .action((options) => {
    try {
      const jobs = queue.listJobs(options.state);
      if (jobs.length === 0) {
        info('No jobs found.');
        return;
      }

      sectionHeader(options.state ? `JOBS ─ ${options.state.toUpperCase()}` : 'ALL JOBS', '📋');

      const columns = [
        { key: 'id',       label: 'ID' },
        { key: 'command',  label: 'COMMAND' },
        { key: 'state',    label: 'STATE' },
        { key: 'attempts', label: 'RETRIES' },
        { key: 'priority', label: 'PRI' },
        { key: 'run_at',   label: 'SCHEDULED' },
      ];

      const rows = jobs.map(j => ({
        id:       C.accent(j.id),
        command:  C.white(j.command.length > 35 ? j.command.slice(0, 32) + '...' : j.command),
        state:    stateBadge(j.state),
        attempts: C.muted(`${j.attempts}/${j.max_retries}`),
        priority: j.priority > 0 ? C.warning(String(j.priority)) : C.dim('0'),
        run_at:   j.run_at ? C.dim(new Date(j.run_at).toLocaleTimeString()) : C.dim('now'),
      }));

      table(columns, rows);
      console.log(`  ${C.dim(`${jobs.length} job(s) shown`)}`);
    } catch (err) {
      error(`Failed to list jobs: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// DLQ (Dead Letter Queue)
// ─────────────────────────────────────────────────────────────────
const dlqCmd = program.command('dlq').description('Manage Dead Letter Queue (DLQ)');

dlqCmd
  .command('list')
  .description('List all jobs in Dead Letter Queue')
  .action(() => {
    try {
      const jobs = queue.getDlq();
      if (jobs.length === 0) {
        success('DLQ is empty — no permanently failed jobs.');
        return;
      }

      sectionHeader('DEAD LETTER QUEUE', '💀');

      const columns = [
        { key: 'id',       label: 'ID' },
        { key: 'command',  label: 'COMMAND' },
        { key: 'attempts', label: 'RETRIES' },
        { key: 'error',    label: 'ERROR' },
        { key: 'failed_at', label: 'FAILED AT' },
      ];

      const rows = jobs.map(j => ({
        id:       C.dead(j.id),
        command:  C.muted(j.command.length > 30 ? j.command.slice(0, 27) + '...' : j.command),
        attempts: C.error(`${j.attempts}/${j.max_retries}`),
        error:    C.error((j.error_message ?? 'Unknown').trim().slice(0, 40)),
        failed_at: C.dim(new Date(j.updated_at).toLocaleString()),
      }));

      table(columns, rows);
      console.log(`  ${C.dim(`${jobs.length} dead job(s)`)}`);
      info(`Use ${C.accent('queuectl dlq retry <job_id>')} to resurrect a job.`);
    } catch (err) {
      error(`Failed to list DLQ: ${err.message}`);
      process.exit(1);
    }
  });

dlqCmd
  .command('retry')
  .description('Retry a permanently failed job from DLQ')
  .argument('<jobId>', 'ID of the job to retry')
  .action((jobId) => {
    try {
      queue.retryDlq(jobId);
      sectionHeader('DLQ RETRY', '🔄');
      success(`Job ${C.accent(jobId)} has been resurrected and moved back to pending.`);
    } catch (err) {
      error(`Failed to retry job: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────
const configCmd = program.command('config').description('Manage queue configuration');

configCmd
  .command('set')
  .description('Set a config key to a value')
  .argument('<key>', 'Config key (max-retries, backoff-base)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    try {
      const validKeys = ['max-retries', 'backoff-base'];
      if (!validKeys.includes(key)) {
        error(`Invalid key "${key}". Valid keys: ${validKeys.join(', ')}`);
        process.exit(1);
      }
      config.set(key, value);
      sectionHeader('CONFIGURATION UPDATED', '⚙');
      keyValue([[key, value]]);
      success('Configuration saved.');
    } catch (err) {
      error(`Failed to set config: ${err.message}`);
      process.exit(1);
    }
  });

configCmd
  .command('list')
  .description('List all configs')
  .action(() => {
    try {
      const allConfigs = config.getAll();
      sectionHeader('CONFIGURATION', '⚙');

      const columns = [
        { key: 'setting', label: 'SETTING' },
        { key: 'value',   label: 'VALUE' },
      ];

      const rows = Object.entries(allConfigs).map(([key, value]) => ({
        setting: C.warning(key),
        value:   C.accent(value),
      }));

      table(columns, rows);
    } catch (err) {
      error(`Failed to list config: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// METRICS (Bonus)
// ─────────────────────────────────────────────────────────────────
program
  .command('metrics')
  .description('Show execution statistics and performance metrics')
  .action(() => {
    try {
      const m = queue.getMetrics();
      sectionHeader('EXECUTION METRICS', '📊');

      keyValue([
        ['Total Jobs',       String(m.totalJobs)],
        ['Completed',        String(m.completedJobs)],
        ['Dead (Failed)',    String(m.failedJobs)],
        ['Success Rate',     `${m.successRate}%`],
        ['Total Attempts',   String(m.totalAttempts)],
        ['Avg Duration',     `${m.avgDuration}ms`],
        ['Min Duration',     `${m.minDuration}ms`],
        ['Max Duration',     `${m.maxDuration}ms`],
      ]);
      console.log('');
    } catch (err) {
      error(`Failed to get metrics: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// LOGS (Bonus)
// ─────────────────────────────────────────────────────────────────
program
  .command('logs')
  .description('Show execution logs for a specific job')
  .argument('<jobId>', 'ID of the job to view logs for')
  .action((jobId) => {
    try {
      const logs = queue.getJobLogs(jobId);
      if (logs.length === 0) {
        info(`No logs found for job "${jobId}".`);
        return;
      }

      sectionHeader(`LOGS ─ ${jobId}`, '📜');

      const columns = [
        { key: 'attempt',    label: 'ATTEMPT' },
        { key: 'exit_code',  label: 'EXIT' },
        { key: 'duration',   label: 'DURATION' },
        { key: 'stdout',     label: 'STDOUT' },
        { key: 'stderr',     label: 'STDERR' },
        { key: 'time',       label: 'TIMESTAMP' },
      ];

      const rows = logs.map(l => ({
        attempt:   C.accent(`#${l.attempt}`),
        exit_code: l.exit_code === 0 ? C.success('0') : C.error(String(l.exit_code)),
        duration:  C.muted(`${l.duration_ms}ms`),
        stdout:    l.stdout ? C.white(l.stdout.trim().slice(0, 30)) : C.dim('—'),
        stderr:    l.stderr ? C.error(l.stderr.trim().slice(0, 30)) : C.dim('—'),
        time:      C.dim(new Date(l.created_at).toLocaleTimeString()),
      }));

      table(columns, rows);
    } catch (err) {
      error(`Failed to get logs: ${err.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// WEB UI (Premium Enhancements)
// ─────────────────────────────────────────────────────────────────
program
  .command('ui')
  .description('Start the built-in HTTP Web UI dashboard')
  .option('--port <number>', 'Port to run the UI server on', '5000')
  .action((options) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      error('Port must be a valid integer between 1 and 65535');
      process.exit(1);
    }

    try {
      startUiServer(port);
      banner();
      sectionHeader('WEB UI DASHBOARD ACTIVE', '🌐');
      keyValue([
        ['Dashboard URL', `http://localhost:${port}`],
        ['Status', 'Running (Listening for changes...)'],
      ]);
      success('Embedded Web Server started.');
      info('Keep this terminal open to keep the Web UI running.');
    } catch (err) {
      error(`Failed to start Web UI server: ${err.message}`);
      process.exit(1);
    }
  });

if (process.argv.length <= 2) {
  startRepl(program);
} else {
  program.parse(process.argv);
}
