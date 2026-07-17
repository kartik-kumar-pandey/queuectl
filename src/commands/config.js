import * as config from '../core/config.js';
import { sectionHeader, table, keyValue, success, error, C, actionWrapper } from '../cli-ui/format.js';

export function register(program) {
  const configCmd = program.command('config').description('Manage queue configuration');

  configCmd
    .command('set')
    .description('Set a config key to a value')
    .argument('<key>', 'Config key (max-retries, backoff-base)')
    .argument('<value>', 'Config value')
    .action(actionWrapper((key, value) => {
      const validKeys = ['max-retries', 'backoff-base'];
      if (!validKeys.includes(key)) {
        throw new Error(`Invalid key "${key}". Valid keys: ${validKeys.join(', ')}`);
      }
      config.set(key, value);
      sectionHeader('CONFIGURATION UPDATED', '⚙');
      keyValue([[key, value]]);
      success('Configuration saved.');
    }));

  configCmd
    .command('list')
    .description('List all configs')
    .action(actionWrapper(() => {
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
    }));
}
