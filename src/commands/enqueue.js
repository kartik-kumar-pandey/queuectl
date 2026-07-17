import * as queue from '../core/queue.js';
import * as config from '../core/config.js';
import { banner, sectionHeader, keyValue, success, error, C, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
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
    .action(actionWrapper((jobJson, options) => {
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
    }));
}
