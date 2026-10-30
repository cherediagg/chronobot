import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const whatsappRequire = createRequire(require.resolve('whatsapp-web.js'));
const puppeteer = whatsappRequire('puppeteer');

export interface ExistingSession {
  label: string;
  pid?: number;
  token?: string;
  port?: number;
}

type SessionLogger = (level: 'INFO' | 'WARN', message: string) => void;

export class WhatsAppSessionGuard {
  constructor(
    private readonly chronobotPath: string,
    private readonly log: SessionLogger
  ) {}

  isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return !(error instanceof Error && 'code' in error && error.code === 'ESRCH');
    }
  }

  async findExistingSession(): Promise<ExistingSession | null> {
    const authDirectory = path.resolve(process.cwd(), '.wwebjs_auth');
    const sessionLockPath = path.join(authDirectory, 'chronobot.lock');
    const browserPort = this.getExistingBrowserPort();
    if (fs.existsSync(sessionLockPath)) {
      try {
        const lock = JSON.parse(fs.readFileSync(sessionLockPath, 'utf8')) as { pid?: number; token?: string };
        const pid = Number(lock.pid);
        if (Number.isInteger(pid) && pid > 0 && this.isProcessAlive(pid) && this.isChronoBotProcess(pid)) {
          return {
            label: `cliente de ChronoBot (PID ${pid})`,
            pid,
            token: typeof lock.token === 'string' ? lock.token : undefined,
            port: browserPort || undefined
          };
        }
      } catch {
        this.log('WARN', 'No se pudo leer el bloqueo de sesión de ChronoBot; se verificará el navegador activo.');
      }
    }

    return browserPort && await this.isBrowserPortOpen(browserPort)
      ? { label: `navegador de WhatsApp Web (puerto ${browserPort})`, port: browserPort }
      : null;
  }

  async stopExistingSession(existing: ExistingSession): Promise<void> {
    this.log('WARN', `Se cerrará la sesión existente: ${existing.label}.`);
    const authDirectory = path.resolve(process.cwd(), '.wwebjs_auth');
    const commandPath = path.join(authDirectory, 'chronobot-command.json');

    if (existing.pid && existing.token) {
      try {
        fs.writeFileSync(commandPath, JSON.stringify({ action: 'stop', token: existing.token }));
      } catch (error: unknown) {
        this.log('WARN', `No se pudo enviar el cierre controlado a ChronoBot: ${this.errorMessage(error)}`);
      }

      if (await this.waitForProcessExit(existing.pid, 5000)) {
        if (existing.port && await this.isBrowserPortOpen(existing.port)) {
          throw new Error(`ChronoBot finalizó, pero Chrome sigue activo en el puerto ${existing.port}.`);
        }
        this.log('INFO', `La sesión existente (PID ${existing.pid}) se cerró correctamente.`);
        return;
      }
    }

    if (existing.port) {
      await this.closeExistingBrowser(existing.port);
      this.log('INFO', `Chrome liberó el perfil de WhatsApp Web (puerto ${existing.port}).`);
    }

    if (existing.pid && this.isProcessAlive(existing.pid)) {
      if (!this.isChronoBotProcess(existing.pid)) {
        throw new Error(`El PID ${existing.pid} no corresponde a chronobot.js; no se terminará un proceso ajeno.`);
      }

      process.kill(existing.pid, 'SIGTERM');
      if (!await this.waitForProcessExit(existing.pid, 5000)) {
        if (process.platform === 'win32') {
          execFileSync('taskkill.exe', ['/PID', String(existing.pid), '/T', '/F'], {
            encoding: 'utf8',
            timeout: 5000,
            windowsHide: true,
            stdio: 'ignore'
          });
        } else {
          process.kill(existing.pid, 'SIGKILL');
        }
        if (!await this.waitForProcessExit(existing.pid, 2000)) {
          throw new Error(`No se pudo cerrar el proceso ChronoBot (PID ${existing.pid}).`);
        }
      }
    }

    if (existing.port && await this.isBrowserPortOpen(existing.port)) {
      throw new Error(`La sesión de WhatsApp Web sigue activa en el puerto ${existing.port}.`);
    }

    try {
      const pendingCommand = JSON.parse(fs.readFileSync(commandPath, 'utf8')) as { token?: string };
      if (pendingCommand.token === existing.token) fs.unlinkSync(commandPath);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }

  private async isBrowserPortOpen(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = createConnection({ host: '127.0.0.1', port });
      const finish = (isOpen: boolean) => {
        socket.destroy();
        resolve(isOpen);
      };
      socket.setTimeout(1000);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }

  private getExistingBrowserPort(): number | null {
    const activePortPath = path.join(path.resolve(process.cwd(), '.wwebjs_auth'), 'session', 'DevToolsActivePort');
    if (!fs.existsSync(activePortPath)) return null;

    try {
      const port = Number(fs.readFileSync(activePortPath, 'utf8').split(/\r?\n/, 1)[0]);
      return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  private isChronoBotProcess(pid: number): boolean {
    try {
      const commandLine = process.platform === 'win32'
        ? execFileSync('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$process = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($process) { $process.CommandLine }`
        ], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim()
        : fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
      return commandLine.toLowerCase().includes(this.chronobotPath.toLowerCase())
        && /(?:^|\s)node(?:\.exe)?(?:\s|$)/i.test(commandLine);
    } catch (error: unknown) {
      this.log('WARN', `No se pudo verificar que PID ${pid} pertenece a chronobot.js: ${this.errorMessage(error)}`);
      return false;
    }
  }

  private async waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!this.isProcessAlive(pid)) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return !this.isProcessAlive(pid);
  }

  private async closeExistingBrowser(port: number): Promise<void> {
    if (!await this.isBrowserPortOpen(port)) return;

    const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
    await browser.close();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && await this.isBrowserPortOpen(port)) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (await this.isBrowserPortOpen(port)) {
      throw new Error(`Chrome no liberó el perfil tras cerrar la sesión (puerto ${port}).`);
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
