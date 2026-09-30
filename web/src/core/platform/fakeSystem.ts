/** E2E stand-in for the native system facts (only wired in `--mode e2e` builds): invented values. */
import type { ProcInfo, SystemInfo, SystemService } from './system';

const GB = 1024 ** 3;

export function createFakeSystem(): SystemService {
  let n = 0;
  return {
    supported: true,
    async info(): Promise<SystemInfo> {
      n++;
      return {
        os: 'Beispiel-Betriebssystem 11',
        uptimeSecs: 3 * 86_400 + 5 * 3600 + 7 * 60,
        cpu: {
          brand: 'Beispiel-Prozessor 3000',
          physicalCores: 8,
          threads: 16,
          usagePercent: 10 + (n % 5),
        },
        memory: { totalBytes: 16 * GB, usedBytes: 9.5 * GB },
        battery: { percent: 64, charging: true, pluggedIn: true },
        gpus: [{ name: 'Beispiel-Grafikkarte', dedicatedBytes: 8 * GB }],
        network: [{ name: 'Ethernet', addresses: ['192.168.1.20', '2001:db8::20'] }],
      };
    },
    async processes(): Promise<ProcInfo[]> {
      return [
        { name: 'browser.exe', memoryBytes: 2.1 * GB, instances: 14 },
        { name: 'editor.exe', memoryBytes: 0.6 * GB, instances: 1 },
        { name: 'dienst.exe', memoryBytes: 0.2 * GB, instances: 3 },
      ];
    },
  };
}
