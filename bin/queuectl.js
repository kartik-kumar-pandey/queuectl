#!/usr/bin/env node

import { Command } from 'commander';
import { startRepl } from '../src/repl.js';

// Import CLI commands
import { register as registerEnqueue } from '../src/commands/enqueue.js';
import { register as registerWorker } from '../src/commands/worker.js';
import { register as registerStatus } from '../src/commands/status.js';
import { register as registerList } from '../src/commands/list.js';
import { register as registerDlq } from '../src/commands/dlq.js';
import { register as registerConfig } from '../src/commands/config.js';
import { register as registerMetrics } from '../src/commands/metrics.js';
import { register as registerLogs } from '../src/commands/logs.js';
import { register as registerUi } from '../src/commands/ui.js';

const program = new Command();

program
  .name('queuectl')
  .description('CLI-based background job queue system')
  .version('1.0.0');

// Register all commands
registerEnqueue(program);
registerWorker(program);
registerStatus(program);
registerList(program);
registerDlq(program);
registerConfig(program);
registerMetrics(program);
registerLogs(program);
registerUi(program);

if (process.argv.length <= 2) {
  startRepl(program);
} else {
  program.parse(process.argv);
}
