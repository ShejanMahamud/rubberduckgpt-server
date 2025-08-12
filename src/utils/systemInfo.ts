import * as os from 'os';

function formatBytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes} minutes ${remainingSeconds} seconds`;
}

export function getSystemInfoJson() {
  return {
    hostname: os.hostname(),
    osType: os.type(),
    platform: os.platform(),
    architecture: os.arch(),
    uptime: formatUptime(os.uptime()),
    memory: {
      total: formatBytes(os.totalmem()),
      free: formatBytes(os.freemem()),
      used: formatBytes(os.totalmem() - os.freemem()),
    },
    cpu: {
      coreCount: os.cpus().length,
    },
  };
}
