import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';
import { banner, sectionHeader, success, error, info, warn, C, actionWrapper } from '../cli-ui/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, '../core/worker.js');

export function register(program) {
  const workerCmd = program.command('worker').description('Manage worker processes');

  workerCmd
    .command('start')
    .description('Start one or more workers')
    .option('--count <number>', 'Number of worker processes to spawn', '1')
    .action(actionWrapper((options) => {
      const count = parseInt(options.count, 10);
      if (isNaN(count) || count < 1) {
        throw new Error('Count must be a positive integer');
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
    }));

  workerCmd
    .command('stop')
    .description('Stop running workers gracefully')
    .action(actionWrapper(() => {
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
    }));
}
