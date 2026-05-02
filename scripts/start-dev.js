const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';

const proxy = spawn(process.execPath, ['./scripts/dev-proxy.js'], {
  stdio: 'inherit',
  env: process.env,
});

const angular = spawn(isWindows ? 'npx.cmd' : 'npx', ['ng', 'serve', '--proxy-config', 'proxy.conf.json'], {
  stdio: 'inherit',
  env: process.env,
});

const shutdown = (code = 0) => {
  if (!proxy.killed) {
    proxy.kill();
  }
  if (!angular.killed) {
    angular.kill();
  }
  process.exit(code);
};

proxy.on('exit', code => {
  if (code) {
    shutdown(code);
  }
});

angular.on('exit', code => {
  shutdown(code || 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
