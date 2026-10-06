// Cross-platform dev loop: compile once, then watch-compile and watch-run.
// (Replaces a POSIX-only `tsc ... & node ...` script; audit P2.)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
const first = spawnSync(tsc, ['-p', 'tsconfig.build.json'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn(tsc, ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
  spawn(
    process.execPath,
    [...(existsSync('.env') ? ['--env-file=.env'] : []), '--watch', 'dist/main.js'],
    { stdio: 'inherit' },
  ),
];

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && stop());
