import * as queue from '../core/queue.js';
import { sectionHeader, table, success, error, info, C, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  const dlqCmd = program.command('dlq').description('Manage Dead Letter Queue (DLQ)');

  dlqCmd
    .command('list')
    .description('List all jobs in Dead Letter Queue')
    .action(actionWrapper(() => {
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
    }));

  dlqCmd
    .command('retry')
    .description('Retry a permanently failed job from DLQ')
    .argument('<jobId>', 'ID of the job to retry')
    .action(actionWrapper((jobId) => {
      queue.retryDlq(jobId);
      sectionHeader('DLQ RETRY', '🔄');
      success(`Job ${C.accent(jobId)} has been resurrected and moved back to pending.`);
    }));
}
