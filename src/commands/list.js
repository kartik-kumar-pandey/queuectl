import * as queue from '../core/queue.js';
import { sectionHeader, table, stateBadge, info, C, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  program
    .command('list')
    .description('List jobs by state')
    .option('--state <state>', 'Filter by state (pending, processing, completed, failed, dead)')
    .action(actionWrapper((options) => {
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
    }));
}
