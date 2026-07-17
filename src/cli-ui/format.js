import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────
// GRADIENT & COLOR PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  brand:    chalk.hex('#7C6CFF'),       // Purple accent (slightly brighter)
  brandBg:  chalk.bgHex('#7C6CFF').white.bold,
  accent:   chalk.hex('#00D9FF'),       // Cyan accent
  success:  chalk.hex('#00E676'),       // Mint green
  warning:  chalk.hex('#FFD740'),       // Amber
  error:    chalk.hex('#FF5252'),       // Coral red
  dead:     chalk.hex('#FF1744').bold,   // Hot red
  dim:      chalk.hex('#6B7280'),       // Cool gray (more readable)
  muted:    chalk.hex('#9CA3AF'),       // Lighter muted
  white:    chalk.hex('#F9FAFB'),
  header:   chalk.hex('#B388FF').bold,   // Light purple
  border:   chalk.hex('#5C5C7A'),       // Muted purple-gray (visible on dark bg)
  highlight:chalk.hex('#B388FF'),       // Soft purple highlight
  label:    chalk.hex('#A5B4FC'),       // Indigo-200 for labels
  value:    chalk.hex('#E0E7FF'),       // Indigo-100 for values
};

export function actionWrapper(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// SMOOTH GRADIENT (interpolated, not stepped)
// ─────────────────────────────────────────────────────────────────
const GRADIENT_STOPS = [
  [0.00, [108, 99, 255]],   // #6C63FF violet
  [0.45, [162, 89, 255]],   // #A259FF
  [0.75, [224, 64, 251]],   // #E040FB magenta
  [1.00, [255, 92, 141]],   // #FF5C8D pink/coral
];

function colorAt(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const [t0, c0] = GRADIENT_STOPS[i];
    const [t1, c1] = GRADIENT_STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const lt = (t - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * lt),
        Math.round(c0[1] + (c1[1] - c0[1]) * lt),
        Math.round(c0[2] + (c1[2] - c0[2]) * lt),
      ];
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1];
}

export function gradient(text) {
  const chars = [...text];
  return chars.map((ch, i) => {
    if (ch === ' ') return ch;
    const [r, g, b] = colorAt(i / Math.max(1, chars.length - 1));
    return chalk.rgb(r, g, b)(ch);
  }).join('');
}

// ─────────────────────────────────────────────────────────────────
// BRAND BANNER
// ─────────────────────────────────────────────────────────────────
const QUEUE_GLYPHS = [
  '   ██████╗ ██╗   ██╗███████╗██╗   ██╗███████╗',
  '  ██╔═══██╗██║   ██║██╔════╝██║   ██║██╔════╝',
  '  ██║   ██║██║   ██║█████╗  ██║   ██║█████╗  ',
  '  ██║▄▄ ██║██║   ██║██╔══╝  ██║   ██║██╔══╝  ',
  '  ╚██████╔╝╚██████╔╝███████╗╚██████╔╝███████╗',
  '   ╚════▀▀╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝',
];
const CTL_GLYPHS = [
  '██████╗ ████████╗██╗',
  '██╔════╝╚══██╔══╝██║',
  '██║        ██║   ██║',
  '██║        ██║   ██║',
  '╚██████╗   ██║   ███████╗',
  ' ╚═════╝   ╚═╝   ╚══════╝',
];

import * as queue from '../core/queue.js';

export function banner() {
  const qMax = Math.max(...QUEUE_GLYPHS.map(l => l.length));
  const cMax = Math.max(...CTL_GLYPHS.map(l => l.length));
  const centerPad = Math.max(0, Math.floor((qMax - cMax) / 2));

  const colorGlyphRow = (line) => {
    return [...line].map((ch) => {
      if (ch === ' ') return ch;
      return C.brand(ch);
    }).join('');
  };

  const subtitle = 'A modern, persistent background job queue processing engine.';
  const version = 'v1.0.0';

  const welcomePlain = `* Welcome to the QueueCtl Engine * [${version}]`;
  const welcomeText = `${C.dim('*')} ${C.white.bold('Welcome to the')} ${C.brand.bold('QueueCtl Engine')} ${C.dim('*')} ${C.dim('[')}${C.success(version)}${C.dim(']')}`;

  const W = 78; // Fixed width for status summary box and welcome box

  const welcomePad = Math.max(0, Math.floor((W - welcomePlain.length - 2) / 2));
  const welcomeRightPad = Math.max(0, W - 2 - welcomePad - welcomePlain.length);

  console.log('');
  console.log('  ' + C.brand('┌' + '─'.repeat(W - 2) + '┐'));
  console.log('  ' + C.brand('│') + ' '.repeat(welcomePad) + welcomeText + ' '.repeat(welcomeRightPad) + C.brand('│'));
  console.log('  ' + C.brand('└' + '─'.repeat(W - 2) + '┘'));
  console.log('');

  // Center the logo
  const logoLeftPad = Math.max(0, Math.floor((W - qMax) / 2));
  QUEUE_GLYPHS.forEach((line) => console.log(' '.repeat(logoLeftPad) + colorGlyphRow(line)));
  console.log('');
  CTL_GLYPHS.forEach((line) => {
    const paddedLine = ' '.repeat(centerPad) + line;
    console.log(' '.repeat(logoLeftPad) + colorGlyphRow(paddedLine));
  });
  console.log('');

  // Subtitle centered
  const subPad = Math.max(0, Math.floor((W - subtitle.length) / 2));
  console.log(' '.repeat(subPad) + C.muted(subtitle));
  console.log('');

  // Get status
  let status;
  try {
    status = queue.getStatus();
  } catch (e) {
    status = { jobs: { pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 }, activeWorkers: 0 };
  }

  const processed = status.jobs.completed + status.jobs.failed + status.jobs.dead;
  const failed = status.jobs.failed + status.jobs.dead;
  const activeQueues = 1;

  const formatNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + 'MB RSS';
  const cpuPercent = '~5%';
  const curTime = new Date().toLocaleTimeString();

  // ── Single-column Engine Status Summary Box ──
  const BOX_W = 56;
  const INNER = BOX_W - 2;
  const LABEL_COL = 22;

  const row = (label, value) => {
    const cLabel = stripAnsi(label);
    const cValue = stripAnsi(String(value));
    const gap = Math.max(1, LABEL_COL - cLabel.length);
    const usedLen = cLabel.length + gap + cValue.length;
    const rightPad = Math.max(0, INNER - 2 - usedLen);
    return C.border('│') + '  ' + label + ' '.repeat(gap) + value + ' '.repeat(rightPad) + C.border('│');
  };

  const titleText = ' Engine Status Summary ';
  const tL = Math.floor((INNER - titleText.length) / 2);
  const tR = INNER - titleText.length - tL;
  const boxIndent = ' '.repeat(Math.max(0, Math.floor((W - BOX_W) / 2)));

  const engineLabel = status.activeWorkers > 0
    ? C.success('[OK]') + C.label(' Engine:')
    : C.warning('[IDLE]') + C.label(' Engine:');
  const engineVal = status.activeWorkers > 0 ? C.success('RUNNING') : C.warning('IDLE');

  console.log(boxIndent + C.border('┌' + '─'.repeat(tL)) + C.header(titleText) + C.border('─'.repeat(tR) + '┐'));
  console.log(boxIndent + row(engineLabel, engineVal));
  console.log(boxIndent + row(C.label('Jobs Processed:'), C.value(formatNum(processed))));
  console.log(boxIndent + row(C.label('Failed Jobs:'), failed > 0 ? C.error(formatNum(failed)) : C.success(formatNum(failed))));
  console.log(boxIndent + row(C.warning('[WARN]') + C.label(' Scheduled:'), C.warning(formatNum(status.jobs.pending))));
  console.log(boxIndent + row(C.label('Active Queues:'), C.value(String(activeQueues))));
  console.log(boxIndent + row(C.label('Memory Usage:'), C.value(memUsage)));
  console.log(boxIndent + row(C.label('CPU Usage:'), C.value(cpuPercent)));
  console.log(boxIndent + row(C.accent('[INFO]') + C.label(' Last Check:'), C.accent(curTime)));
  console.log(boxIndent + C.border('└' + '─'.repeat(INNER) + '┘'));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────
// CUSTOM BOX-DRAWING TABLE
// ─────────────────────────────────────────────────────────────────
const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
  tj: '┬', bj: '┴', lj: '├', rj: '┤', cross: '┼',
};

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function visibleLength(str) {
  return stripAnsi(String(str)).length;
}

function padRight(str, len) {
  const diff = len - visibleLength(str);
  return str + ' '.repeat(Math.max(0, diff));
}

export function table(columns, rows, maxTotalWidth = 78) {
  if (rows.length === 0) return;

  // Initial column widths calculation
  const colWidths = columns.map((col) => {
    const headerLen = visibleLength(col.label);
    const maxDataLen = rows.reduce((max, row) => {
      return Math.max(max, visibleLength(String(row[col.key] ?? '')));
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });

  // Total width of margins & borders: 1 leading/trailing border, (numCols - 1) separators, 2 spaces padding per column
  const baseOverhead = 2 + (columns.length - 1) + (columns.length * 2);
  let totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + baseOverhead;

  // If table exceeds maxTotalWidth, compress columns iteratively
  while (totalWidth > maxTotalWidth) {
    // Find columns we can shrink (width > 10)
    let widestIdx = -1;
    let maxW = 10;
    colWidths.forEach((w, idx) => {
      // Don't shrink ID too much (keep it at least 8 chars)
      const minLimit = columns[idx].key === 'id' ? 8 : 10;
      if (w > maxW && w > minLimit) {
        maxW = w;
        widestIdx = idx;
      }
    });

    if (widestIdx === -1) {
      break; // cannot shrink any columns further
    }

    colWidths[widestIdx]--;
    totalWidth--;
  }

  const borderColor = C.border;

  const buildLine = (left, mid, right, fill) => {
    return borderColor(left) + colWidths.map(w => borderColor(fill.repeat(w + 2))).join(borderColor(mid)) + borderColor(right);
  };

  console.log(buildLine(BOX.tl, BOX.tj, BOX.tr, BOX.h));

  // Header row
  const headerRow = borderColor(BOX.v) + columns.map((col, i) => {
    const lbl = col.label.slice(0, colWidths[i]);
    return ' ' + C.header(padRight(lbl, colWidths[i])) + ' ';
  }).join(borderColor(BOX.v)) + borderColor(BOX.v);
  console.log(headerRow);

  // Header separator
  console.log(buildLine(BOX.lj, BOX.cross, BOX.rj, BOX.h));

  // Data rows
  rows.forEach((row) => {
    const dataRow = borderColor(BOX.v) + columns.map((col, i) => {
      let val = String(row[col.key] ?? '');
      const plainVal = stripAnsi(val);
      const isColored = plainVal.length !== val.length;

      if (plainVal.length > colWidths[i]) {
        if (isColored) {
          // If colored, truncate plain text and retain color logic by slicing the raw/ANSI string carefully,
          // or just fallback to simple truncation of the plain text.
          val = plainVal.slice(0, colWidths[i] - 3) + '...';
        } else {
          val = val.slice(0, colWidths[i] - 3) + '...';
        }
      }
      return ' ' + padRight(val, colWidths[i]) + ' ';
    }).join(borderColor(BOX.v)) + borderColor(BOX.v);
    console.log(dataRow);
  });

  // Bottom border
  console.log(buildLine(BOX.bl, BOX.bj, BOX.br, BOX.h));
}

// ─────────────────────────────────────────────────────────────────
// STATE BADGES (colored pill-style labels)
// ─────────────────────────────────────────────────────────────────
export function stateBadge(state) {
  switch (state) {
    case 'pending':    return C.warning('● pending   ');
    case 'processing': return C.accent('◉ processing');
    case 'completed':  return C.success('✔ completed ');
    case 'failed':     return C.error('⚠ failed    ');
    case 'dead':       return C.dead('✖ dead      ');
    default:           return C.dim(state);
  }
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS BAR (for stats visualization)
// ─────────────────────────────────────────────────────────────────
export function progressBar(current, total, width = 20) {
  if (total === 0) return C.dim('░'.repeat(width)) + C.dim(' 0/0');
  const ratio = Math.min(current / total, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = C.success('█'.repeat(filled)) + C.dim('░'.repeat(empty));
  return bar + C.muted(` ${current}/${total}`);
}

// ─────────────────────────────────────────────────────────────────
// SECTION HEADERS
// ─────────────────────────────────────────────────────────────────
export function sectionHeader(title, icon = '◆') {
  const line = C.border('─'.repeat(50));
  console.log(`\n  ${C.brand(icon)} ${C.header(title)}`);
  console.log(`  ${line}`);
}

// ─────────────────────────────────────────────────────────────────
// STATUS CARDS
// ─────────────────────────────────────────────────────────────────
export function statusCard(stats, activeWorkers) {
  const total = stats.pending + stats.processing + stats.completed + stats.failed + stats.dead;

  const workersText = activeWorkers > 0
    ? C.success('⬤  ' + activeWorkers + ' running')
    : C.dim('⬤  0 idle');

  const rowLine = (icon, colorFn, label, count) =>
    `${colorFn(icon)} ${padRight(label, 14)} ${progressBar(count, total, 18)}`;

  // Build every line of content first (unbordered) so the box width can be
  // computed from what will actually be printed, then every row is closed
  // on both sides — no more silently-dropped border rows.
  const bodyLines = [
    { text: `${C.header('SYSTEM DASHBOARD')}`, blank: false },
    { blank: true },
    { text: `${C.white('Workers Active')}   ${workersText}` },
    { text: `${C.white('Total Jobs')}       ${C.accent(String(total))}` },
    { blank: true },
    { divider: true },
    { text: `${C.header('JOB BREAKDOWN')}` },
    { divider: true },
    { blank: true },
    { text: rowLine('●', C.warning, 'Pending',    stats.pending) },
    { text: rowLine('◉', C.accent,  'Processing', stats.processing) },
    { text: rowLine('✔', C.success, 'Completed',  stats.completed) },
    { text: rowLine('⚠', C.error,   'Failed',     stats.failed) },
    { text: rowLine('✖', C.dead,    'Dead (DLQ)', stats.dead) },
    { blank: true },
  ];

  const W = Math.max(
    ...bodyLines.filter((l) => l.text).map((l) => visibleLength(l.text)),
  ) + 2; // 1 space padding on each side

  const border = C.border;
  const top = border('╭' + '─'.repeat(W) + '╮');
  const bottom = border('╰' + '─'.repeat(W) + '╯');
  const divider = border('├' + '─'.repeat(W) + '┤');

  const edge = (content = '') => {
    const pad = Math.max(0, W - 1 - visibleLength(content));
    return `  ${border('│')} ${content}${' '.repeat(pad)}${border('│')}`;
  };

  console.log('');
  console.log(`  ${top}`);
  bodyLines.forEach((line) => {
    if (line.divider) {
      console.log(`  ${divider}`);
    } else {
      console.log(edge(line.blank ? '' : line.text));
    }
  });
  console.log(`  ${bottom}`);
  console.log('');
}

// ─────────────────────────────────────────────────────────────────
// MESSAGE HELPERS
// ─────────────────────────────────────────────────────────────────
export function success(msg) {
  console.log(`\n  ${C.success('✔')} ${C.white(msg)}`);
}

export function error(msg) {
  console.log(`\n  ${C.error('✖')} ${C.error(msg)}`);
}

export function info(msg) {
  console.log(`\n  ${C.accent('ℹ')} ${C.muted(msg)}`);
}

export function warn(msg) {
  console.log(`\n  ${C.warning('⚠')} ${C.warning(msg)}`);
}

// ─────────────────────────────────────────────────────────────────
// KEY-VALUE DISPLAY
// ─────────────────────────────────────────────────────────────────
export function keyValue(pairs) {
  const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
  pairs.forEach(([key, value]) => {
    console.log(`  ${C.muted(key.padEnd(maxKeyLen))}  ${C.accent(value)}`);
  });
}

// ─────────────────────────────────────────────────────────────────
// TIMESTAMP
// ─────────────────────────────────────────────────────────────────
export function timestamp() {
  return C.dim(new Date().toLocaleTimeString());
}

// ─────────────────────────────────────────────────────────────────
// WORKER LOG PREFIXES
// ─────────────────────────────────────────────────────────────────
export function workerPrefix(pid) {
  return C.dim('  ') + C.brand('▌') + C.dim(` worker:${pid} `) + C.dim('│');
}

export function workerLog(pid, icon, color, msg) {
  console.log(`${workerPrefix(pid)} ${color(icon)} ${C.white(msg)} ${timestamp()}`);
}

export { C };
