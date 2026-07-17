import { startUiServer } from '../ui-server.js';
import { banner, sectionHeader, keyValue, success, info, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  program
    .command('ui')
    .description('Start the built-in HTTP Web UI dashboard')
    .option('--port <number>', 'Port to run the UI server on', '5000')
    .action(actionWrapper((options) => {
      const port = parseInt(options.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Port must be a valid integer between 1 and 65535');
      }

      startUiServer(port);
      banner();
      sectionHeader('WEB UI DASHBOARD ACTIVE', '🌐');
      keyValue([
        ['Dashboard URL', `http://localhost:${port}`],
        ['Status', 'Running (Listening for changes...)'],
      ]);
      success('Embedded Web Server started.');
      info('Keep this terminal open to keep the Web UI running.');
    }));
}
