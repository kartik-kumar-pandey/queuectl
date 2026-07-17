import * as queue from '../core/queue.js';
import { sectionHeader, keyValue, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  program
    .command('metrics')
    .description('Show execution statistics and performance metrics')
    .action(actionWrapper(() => {
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
    }));
}
