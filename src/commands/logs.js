import * as queue from '../core/queue.js';
import { sectionHeader, table, info, C, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  program
    .command('logs')
    .description('Show execution logs for a specific job')
    .argument('<jobId>', 'ID of the job to view logs for')
    .action(actionWrapper((jobId) => {
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
    }));
}
