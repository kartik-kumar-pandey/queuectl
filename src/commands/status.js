import * as queue from '../core/queue.js';
import { statusCard, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  program
    .command('status')
    .description('Show summary of all job states & active workers')
    .action(actionWrapper(() => {
      const status = queue.getStatus();
      statusCard(status.jobs, status.activeWorkers);
    }));
}
