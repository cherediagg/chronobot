import fs from 'node:fs';
import path from 'node:path';
import { createConnection } from 'node:net';
import { StringDecoder } from 'node:string_decoder';
import { execFileSync, spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const chronobotPath = path.resolve(process.cwd(), 'chronobot.js');
const chronobotModule = require(chronobotPath);
const whatsappRequire = createRequire(require.resolve('whatsapp-web.js'));
const puppeteer = whatsappRequire('puppeteer');

export const EMPLOYEES_FILE_PATH = path.resolve(process.cwd(), 'data', 'employees.json');

export interface ChronoLogEntry {
  id: string;
  timestamp: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  details?: unknown;
  isQr?: boolean;
  highlightPath?: string;
  highlightSender?: string;
}

export interface ChronoEmployee {
  id: string;
  nombre: string;
  name?: string;
  telefono: string;
  phone?: string;
  activo: boolean;
  authorized?: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface ChronoBotEvent {
  id: string;
  type: 'image_saved' | 'message_received' | 'unauthorized' | 'client_connected' | 'system';
  title: string;
  subtitle: string;
  relativeTime: string;
  timestamp: number;
}

export interface ChronoSavedImage {
  id: string;
  senderName: string;
  senderPhone: string;
  dateFormatted: string;
  timeFormatted: string;
  filename: string;
  path: string;
  imageUrl: string;
  size: string;
  dimensions: string;
  category?: string;
}

type ChronoBotStatus = 'active' | 'stopped' | 'restarting' | 'connecting' | 'waiting_qr' | 'disconnected';

interface BotProcessEvent {
  type: string;
  status?: ChronoBotStatus;
  level?: 'log' | 'warn' | 'error' | 'debug';
  message?: string;
  details?: unknown;
  raw?: string;
  dataUrl?: string;
  generatedAt?: number;
  expiresInSeconds?: number;
  connectedPhone?: string;
  contactName?: string;
  phoneNumber?: string;
  body?: string;
  filePath?: string;
  fileName?: string;
  ownerPid?: number;
  emittedAt?: number;
}

interface ExternalSession {
  pid: number;
  token: string;
}

interface RuntimeStatusFile {
  pid: number;
  token: string;
  status: ChronoBotStatus;
  connectedPhone?: string;
  qrData?: {
    raw?: string;
    dataUrl?: string;
    generatedAt?: number;
    expiresInSeconds?: number;
  };
  startedAt: number;
  updatedAt: number;
}

interface RuntimeLogEnvelope {
  id: string;
  event: BotProcessEvent;
  emittedAt?: number;
}

export class ChronoBotEngine {
  public static readonly IMAGES_ROOT_DIR = path.resolve(process.cwd(), 'public', 'imagenes');

  private status: ChronoBotStatus = 'stopped';
  private startTime = Date.now();
  private logs: ChronoLogEntry[] = [];
  private events: ChronoBotEvent[] = [];
  private employees: ChronoEmployee[] = [];
  private allowedNumbers: Record<string, string> = {};
  private savedImages: ChronoSavedImage[] = [];
  private botProcess: ChildProcess | null = null;
  private startPromise: Promise<boolean> | null = null;
  private sessionConflict = false;
  private externalSession: ExternalSession | null = null;
  private readonly processedExternalEventIds = new Set<string>();

  // WhatsApp Web QR Pairing State
  private currentRawQr = '';
  private currentQrDataUrl = '';
  private qrGeneratedAt = 0;
  private qrExpiresInSeconds = 20;
  private connectedPhone = '';

  constructor() {
    this.loadEmployeesFromFile();
    this.loadSavedImagesFromDisk();
    this.initChronoLogs();
  }

  private normalizePhoneNumber(value: string | number): string {
    return String(value || '').replace(/\D/g, '');
  }

  private buildAllowedNumbers(empleados: ChronoEmployee[] = []): Record<string, string> {
    return (empleados || []).reduce((acc, empleado) => {
      const telefono = this.normalizePhoneNumber(empleado?.telefono || empleado?.phone || '');
      const nombre = empleado?.nombre || empleado?.name || telefono || 'Sin nombre';
      const isActivo = empleado?.activo !== undefined ? empleado.activo : Boolean(empleado?.authorized);

      if (isActivo && telefono) {
        acc[telefono] = nombre;
      }

      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Reads employees from data/employees.json using chronobotModule strictly for WhatsApp authorization.
   */
  public loadEmployeesFromFile(): ChronoEmployee[] {
    try {
      const loaded = chronobotModule.loadEmployees();
      if (Array.isArray(loaded) && loaded.length > 0) {
        this.employees = loaded.map((e: Partial<ChronoEmployee>, idx: number) => {
          const nombre = e.nombre || e.name || `Empleado ${idx + 1}`;
          const telefono = e.telefono || e.phone || '';
          const activo = e.activo !== undefined ? Boolean(e.activo) : (e.authorized !== undefined ? Boolean(e.authorized) : true);
          return {
            id: e.id || `emp-${idx + 1}`,
            nombre,
            name: nombre,
            telefono,
            phone: telefono,
            activo,
            authorized: activo,
            notes: e.notes || '',
            updatedAt: e.updatedAt || new Date().toISOString()
          };
        });
        this.allowedNumbers = this.buildAllowedNumbers(this.employees);
        return this.employees;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChronoBot Engine] Error al leer con chronobot.js: ${msg}`);
    }

    this.employees = [];
    this.allowedNumbers = {};
    return this.employees;
  }

  /**
   * Reloads authorized contacts from data/employees.json via chronobotModule.
   */
  public reloadAuthorizedContacts(reason?: string): Record<string, string> {
    try {
      this.allowedNumbers = chronobotModule.refreshAllowedNumbers();
      this.loadEmployeesFromFile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLogInternal('ERROR', `No se pudieron recargar los contactos: ${msg}`);
      this.loadEmployeesFromFile();
    }
    const count = Object.keys(this.allowedNumbers).length;
    if (reason) {
      this.addLogInternal('INFO', `[WhatsApp Auth] Lista actualizada (${reason}). ${count} contactos autorizados.`);
    }
    return this.allowedNumbers;
  }

  public loadSavedImagesFromDisk(): ChronoSavedImage[] {
    const baseDir = ChronoBotEngine.IMAGES_ROOT_DIR;
    const results: ChronoSavedImage[] = [];

    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
        this.savedImages = [];
        return [];
      }

      const contactDirs = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const cDir of contactDirs) {
        if (!cDir.isDirectory()) continue;
        const contactPath = path.join(baseDir, cDir.name);
        const monthDirs = fs.readdirSync(contactPath, { withFileTypes: true });
        for (const mDir of monthDirs) {
          if (!mDir.isDirectory()) continue;
          const monthPath = path.join(contactPath, mDir.name);
          const files = fs.readdirSync(monthPath, { withFileTypes: true });
          for (const file of files) {
            if (!file.isFile()) continue;
            const fullPath = path.join(monthPath, file.name);
            const stat = fs.statSync(fullPath);
            const sizeKb = (stat.size / 1024).toFixed(1);
            const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
            const sizeStr = stat.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
            const contactName = cDir.name.replace(/_/g, ' ');
            const phone = this.findPhoneByContactName(contactName) || '';
            const relativeWebPath = `/imagenes/${cDir.name}/${mDir.name}/${file.name}`;

            results.push({
              id: 'img-' + stat.mtimeMs + '-' + file.name,
              senderName: contactName,
              senderPhone: phone,
              dateFormatted: stat.mtime.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
              timeFormatted: stat.mtime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
              filename: file.name,
              path: relativeWebPath,
              imageUrl: relativeWebPath,
              size: sizeStr,
              dimensions: 'Nativo',
              category: mDir.name
            });
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChronoBot Engine] Error escaneando ${baseDir}: ${msg}`);
    }

    results.sort((a, b) => b.id.localeCompare(a.id));
    this.savedImages = results;
    return results;
  }

  private findPhoneByContactName(name: string): string {
    const normalizeName = (value: string) => value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]/g, '')
      .toLowerCase();

    for (const [phone, contactName] of Object.entries(this.allowedNumbers)) {
      if (normalizeName(contactName) === normalizeName(name)) {
        return '+' + phone;
      }
    }
    return '';
  }

  private initChronoLogs() {
    this.logs = [];
    this.events = [];
    this.addLogInternal('INFO', 'Estado del bot: APAGADO / Proceso de Node inactivo.');
    this.addLogInternal('INFO', 'Inicie el bot desde el botón principal para arrancar el proceso de Node.');
    this.addLogInternal('INFO', `Contactos autorizados cargados desde ${path.basename(EMPLOYEES_FILE_PATH)}: ${Object.keys(this.allowedNumbers).length}`);
  }

  private addLogInternal(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, timeStr?: string, options?: { isQr?: boolean; highlightPath?: string; highlightSender?: string; details?: unknown }) {
    const now = new Date();
    const time = timeStr || now.toLocaleTimeString('es-ES', { hour12: false });
    const timestamp = now.toLocaleString('es-ES');

    const entry: ChronoLogEntry = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      timestamp,
      time,
      level,
      message,
      isQr: options?.isQr,
      highlightPath: options?.highlightPath,
      highlightSender: options?.highlightSender,
      details: options?.details
    };

    this.logs.push(entry);

    if (this.logs.length > 500) {
      this.logs.shift();
    }
  }

  public log(level: 'log' | 'warn' | 'error' | 'debug', message: string, details?: unknown) {
    const levelMap: Record<string, 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'> = {
      log: 'INFO',
      warn: 'WARN',
      error: 'ERROR',
      debug: 'DEBUG'
    };
    const mapped = levelMap[level] || 'INFO';
    this.addLogInternal(mapped, message, undefined, { details });
  }

  private handleBotProcessEvent(event: BotProcessEvent) {
    if (event.type === 'heartbeat' && event.status) {
      this.status = event.status;
      this.connectedPhone = event.connectedPhone || this.connectedPhone;
      return;
    }

    if (event.type === 'session_conflict') {
      this.sessionConflict = true;
      this.status = 'disconnected';
      this.addLogInternal(
        'WARN',
        `Ya hay una sesión de WhatsApp abierta${event.ownerPid ? ` (PID ${event.ownerPid})` : ''}. No se iniciará un segundo navegador.`
      );
      return;
    }

    if (event.type === 'log') {
      if (event.message) {
        const levelMap: Record<string, 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'> = {
          log: 'INFO',
          warn: 'WARN',
          error: 'ERROR',
          debug: 'DEBUG'
        };
        const time = event.emittedAt
          ? new Date(event.emittedAt).toLocaleTimeString('es-ES', { hour12: false })
          : undefined;
        this.addLogInternal(levelMap[event.level || 'log'] || 'INFO', event.message, time, { details: event.details });
      }
      return;
    }

    if (event.type === 'qr') {
      this.currentRawQr = event.raw || '';
      this.currentQrDataUrl = event.dataUrl || '';
      this.qrGeneratedAt = event.generatedAt || Date.now();
      this.qrExpiresInSeconds = event.expiresInSeconds || 20;
      this.status = 'waiting_qr';
      this.addLogInternal('INFO', 'Escanea el código QR de WhatsApp Web para conectar:', undefined, { isQr: true });
      return;
    }

    if (event.type === 'status' && event.status) {
      this.status = event.status;
      if (event.status === 'disconnected') {
        this.connectedPhone = '';
        this.currentRawQr = '';
        this.currentQrDataUrl = '';
        this.qrGeneratedAt = 0;
      }
      return;
    }

    if (event.type === 'ready') {
      this.status = 'active';
      this.startTime = Date.now();
      this.connectedPhone = event.connectedPhone || '';
      this.currentRawQr = '';
      this.currentQrDataUrl = '';
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'client_connected',
        title: 'WhatsApp conectado',
        subtitle: this.connectedPhone || 'Sesión activa',
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });
      return;
    }

    if (event.type === 'message_received' && event.contactName) {
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'message_received',
        title: 'Mensaje recibido',
        subtitle: event.contactName,
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });
      return;
    }

    if (event.type === 'unauthorized') {
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'unauthorized',
        title: 'Número no autorizado',
        subtitle: event.phoneNumber ? '+' + event.phoneNumber : 'Número no disponible',
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });
      return;
    }

    if (event.type === 'image_saved') {
      this.loadSavedImagesFromDisk();
      this.addLogInternal('INFO', 'Imagen guardada:', undefined, {
        highlightPath: event.filePath,
        highlightSender: event.contactName
      });
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'image_saved',
        title: 'Imagen guardada',
        subtitle: event.contactName || 'Contacto autorizado',
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });
    }
  }

  private handleBotProcessOutput(line: string) {
    let event: BotProcessEvent;
    try {
      event = JSON.parse(line) as BotProcessEvent;
    } catch {
      this.addLogInternal('INFO', `[Node Output] ${line.trim()}`);
      return;
    }

    try {
      this.handleBotProcessEvent(event);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.addLogInternal('ERROR', `Error procesando evento de WhatsApp Web: ${message}`);
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return !(error instanceof Error && 'code' in error && error.code === 'ESRCH');
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
      return commandLine.toLowerCase().includes(chronobotPath.toLowerCase())
        && /(?:^|\s)node(?:\.exe)?(?:\s|$)/i.test(commandLine);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLogInternal('WARN', `No se pudo verificar que PID ${pid} pertenece a chronobot.js: ${message}`);
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

  private async findExistingSession(): Promise<{ label: string; pid?: number; token?: string; port?: number } | null> {
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
        this.addLogInternal('WARN', 'No se pudo leer el bloqueo de sesión de ChronoBot; se verificará el navegador activo.');
      }
    }

    return browserPort && await this.isBrowserPortOpen(browserPort)
      ? { label: `navegador de WhatsApp Web (puerto ${browserPort})`, port: browserPort }
      : null;
  }

  private async stopExistingSession(existing: { label: string; pid?: number; token?: string; port?: number }): Promise<void> {
    this.addLogInternal('WARN', `Se cerrará la sesión existente: ${existing.label}.`);
    const authDirectory = path.resolve(process.cwd(), '.wwebjs_auth');
    const commandPath = path.join(authDirectory, 'chronobot-command.json');

    if (existing.pid && existing.token) {
      try {
        fs.writeFileSync(commandPath, JSON.stringify({ action: 'stop', token: existing.token }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.addLogInternal('WARN', `No se pudo enviar el cierre controlado a ChronoBot: ${message}`);
      }

      if (await this.waitForProcessExit(existing.pid, 5000)) {
        if (existing.port && await this.isBrowserPortOpen(existing.port)) {
          throw new Error(`ChronoBot finalizó, pero Chrome sigue activo en el puerto ${existing.port}.`);
        }
        this.addLogInternal('INFO', `La sesión existente (PID ${existing.pid}) se cerró correctamente.`);
        return;
      }
    }

    if (existing.port) {
      await this.closeExistingBrowser(existing.port);
      this.addLogInternal('INFO', `Chrome liberó el perfil de WhatsApp Web (puerto ${existing.port}).`);
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

  private syncExternalRuntime(): boolean {
    if (this.botProcess) return false;

    const authDirectory = path.resolve(process.cwd(), '.wwebjs_auth');
    const lockPath = path.join(authDirectory, 'chronobot.lock');
    const statusPath = path.join(authDirectory, 'chronobot-runtime.json');
    const logPath = path.join(authDirectory, 'chronobot-runtime.jsonl');
    let lock: { pid?: number; token?: string };
    let runtime: RuntimeStatusFile;

    try {
      lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number; token?: string };
      runtime = JSON.parse(fs.readFileSync(statusPath, 'utf8')) as RuntimeStatusFile;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        if (this.externalSession) {
          this.externalSession = null;
          this.status = 'stopped';
          this.sessionConflict = false;
          this.connectedPhone = '';
          this.addLogInternal('WARN', 'El proceso externo de ChronoBot finalizó.');
        }
        return false;
      }
      this.addLogInternal('WARN', 'No se pudo leer el estado compartido de la sesión de ChronoBot.');
      return false;
    }

    const pid = Number(lock.pid);
    const isFresh = Number.isFinite(runtime.updatedAt) && Date.now() - runtime.updatedAt <= 15_000;
    const validStatus = ['active', 'stopped', 'restarting', 'connecting', 'waiting_qr', 'disconnected'].includes(runtime.status);
    if (
      !Number.isInteger(pid) ||
      pid <= 0 ||
      !this.isProcessAlive(pid) ||
      runtime.pid !== pid ||
      !lock.token ||
      runtime.token !== lock.token ||
      !isFresh ||
      !validStatus ||
      runtime.status === 'stopped'
    ) {
      if (this.externalSession) {
        this.externalSession = null;
        this.status = 'disconnected';
        this.sessionConflict = true;
        this.connectedPhone = '';
        this.addLogInternal('WARN', 'Se perdió la señal de actividad del proceso de ChronoBot; no se abrirá otro navegador.');
      }
      return false;
    }

    this.externalSession = { pid, token: lock.token };
    this.sessionConflict = false;
    this.status = runtime.status;
    this.connectedPhone = runtime.connectedPhone || '';
    this.currentRawQr = runtime.qrData?.raw || '';
    this.currentQrDataUrl = runtime.qrData?.dataUrl || '';
    this.qrGeneratedAt = runtime.qrData?.generatedAt || 0;
    this.qrExpiresInSeconds = runtime.qrData?.expiresInSeconds || 20;
    this.startTime = runtime.startedAt;

    try {
      const entries = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-500);
      for (const line of entries) {
        let envelope: RuntimeLogEnvelope;
        try {
          envelope = JSON.parse(line) as RuntimeLogEnvelope;
        } catch {
          continue;
        }
        if (!envelope.id || !envelope.event || this.processedExternalEventIds.has(envelope.id)) continue;
        this.processedExternalEventIds.add(envelope.id);
        this.handleBotProcessEvent({ ...envelope.event, emittedAt: envelope.emittedAt });
      }
      if (this.processedExternalEventIds.size > 1000) {
        const recentIds = [...this.processedExternalEventIds].slice(-500);
        this.processedExternalEventIds.clear();
        recentIds.forEach(id => this.processedExternalEventIds.add(id));
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        const message = error instanceof Error ? error.message : String(error);
        this.addLogInternal('WARN', `No se pudieron leer los logs compartidos de ChronoBot: ${message}`);
      }
    }

    this.status = runtime.status;
    this.connectedPhone = runtime.connectedPhone || '';
    this.currentRawQr = runtime.qrData?.raw || '';
    this.currentQrDataUrl = runtime.qrData?.dataUrl || '';
    this.qrGeneratedAt = runtime.qrData?.generatedAt || 0;
    this.qrExpiresInSeconds = runtime.qrData?.expiresInSeconds || 20;
    return true;
  }

  public async startBotProcess(): Promise<boolean> {
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startBotProcessOnce();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startBotProcessOnce(): Promise<boolean> {
    if (this.botProcess) {
      this.addLogInternal('WARN', 'El proceso del bot ya se encuentra en ejecución.');
      return true;
    }

    try {
      const existingSession = await this.findExistingSession();
      if (existingSession) {
        this.sessionConflict = false;
        await this.stopExistingSession(existingSession);
        const remainingSession = await this.findExistingSession();
        if (remainingSession) {
          throw new Error(`No se pudo liberar la sesión existente: ${remainingSession.label}.`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = 'stopped';
      this.addLogInternal('ERROR', `No se pudo verificar si WhatsApp Web ya está abierto: ${message}`);
      return false;
    }

    this.sessionConflict = false;
    this.status = 'connecting';
    this.startTime = Date.now();
    this.currentRawQr = '';
    this.currentQrDataUrl = '';
    this.qrGeneratedAt = 0;
    this.addLogInternal('INFO', 'Iniciando cliente real de WhatsApp Web...');

    try {
      const botProcess = spawn('node', [chronobotPath], {
        cwd: process.cwd(),
        env: { ...process.env, CHRONOBOT_EMBEDDED: '1' },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.botProcess = botProcess;

      this.addLogInternal('INFO', `Proceso de WhatsApp Web iniciado con PID: ${botProcess.pid}`);
      let outputBuffer = '';
      const outputDecoder = new StringDecoder('utf8');
      botProcess.stdout?.on('data', (data: Buffer) => {
        outputBuffer += outputDecoder.write(data);
        const lines = outputBuffer.split(/\r?\n/);
        outputBuffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          this.handleBotProcessOutput(line);
        }
      });

      botProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString('utf-8').trim();
          if (text) {
            text.split('\n').forEach(line => {
              if (line.trim()) {
                this.addLogInternal('WARN', `[Node Error] ${line.trim()}`);
              }
            });
          }
      });

      botProcess.on('exit', (code, signal) => {
        outputBuffer += outputDecoder.end();
        if (outputBuffer.trim()) {
          this.handleBotProcessOutput(outputBuffer);
        }
        this.addLogInternal('WARN', `El proceso de Node del bot finalizó. Código: ${code}, Señal: ${signal}`);
        if (this.botProcess === botProcess) {
          this.botProcess = null;
          if (this.status !== 'disconnected') this.status = 'stopped';
          this.currentRawQr = '';
          this.currentQrDataUrl = '';
          this.qrGeneratedAt = 0;
          this.connectedPhone = '';
        }
      });

      botProcess.on('error', (err) => {
        this.addLogInternal('ERROR', `Error en el proceso de Node: ${err.message}`);
        if (this.botProcess === botProcess) {
          this.botProcess = null;
          this.status = 'stopped';
        }
      });

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLogInternal('ERROR', `Error al iniciar el cliente de WhatsApp: ${msg}`);
      this.botProcess = null;
      this.status = 'stopped';
      return false;
    }
  }

  public async stopBotProcess(logout = false) {
    const botProcess = this.botProcess;
    if (!botProcess) {
      if (this.syncExternalRuntime() && this.externalSession) {
        const external = this.externalSession;
        const commandPath = path.join(path.resolve(process.cwd(), '.wwebjs_auth'), 'chronobot-command.json');
        this.addLogInternal('INFO', `${logout ? 'Cerrando sesión' : 'Deteniendo'} ChronoBot externo (PID: ${external.pid})...`);
        fs.writeFileSync(commandPath, JSON.stringify({
          action: logout ? 'logout' : 'stop',
          token: external.token
        }));

        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && this.isProcessAlive(external.pid)) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (this.isProcessAlive(external.pid)) {
          try {
            const pendingCommand = JSON.parse(fs.readFileSync(commandPath, 'utf8')) as { token?: string };
            if (pendingCommand.token === external.token) fs.unlinkSync(commandPath);
          } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
          }
          throw new Error(`ChronoBot (PID ${external.pid}) no confirmó el apagado en 8 segundos.`);
        }

        this.externalSession = null;
        this.status = 'stopped';
        this.connectedPhone = '';
        this.currentRawQr = '';
        this.currentQrDataUrl = '';
        this.qrGeneratedAt = 0;
        this.addLogInternal('INFO', 'ChronoBot externo detenido.');
        return;
      }
      this.status = 'stopped';
      this.currentRawQr = '';
      this.currentQrDataUrl = '';
      this.qrGeneratedAt = 0;
      this.connectedPhone = '';
      this.addLogInternal('WARN', 'El proceso del bot no estaba en ejecución.');
      return;
    }

    this.addLogInternal('INFO', `${logout ? 'Cerrando sesión' : 'Deteniendo'} proceso de WhatsApp Web (PID: ${botProcess.pid})...`);
    this.status = 'stopped';
    botProcess.stdin?.write(`{"action":"${logout ? 'logout' : 'stop'}"}\n`);

    await new Promise<void>(resolve => {
      const forceKillTimer = setTimeout(() => {
        if (botProcess.exitCode === null) botProcess.kill('SIGKILL');
      }, 5000);
      const finalTimer = setTimeout(resolve, 7000);
      botProcess.once('exit', () => {
        clearTimeout(forceKillTimer);
        clearTimeout(finalTimer);
        resolve();
      });
    });

    if (this.botProcess === botProcess) this.botProcess = null;
    this.status = 'stopped';
    this.currentRawQr = '';
    this.currentQrDataUrl = '';
    this.qrGeneratedAt = 0;
    this.connectedPhone = '';
  }

  private async handleMessage(payload: { from: string; body?: string; hasMedia?: boolean; type?: string; author?: string }) {
    if (this.status !== 'active') {
      this.log('warn', 'Bot apagado. No se pueden recibir ni procesar mensajes.');
      return { handled: false, reason: 'bot_stopped' };
    }

    const senderRaw = payload.author || payload.from || '';
    const cleanNumber = chronobotModule.normalizeWhatsAppPhone
      ? chronobotModule.normalizeWhatsAppPhone(senderRaw)
      : this.normalizePhoneNumber(senderRaw.replace(/@(c\.us|s\.whatsapp\.net)$/i, ''));

    this.log('log', 'Mensaje recibido:', {
      from: payload.from,
      type: payload.type || (payload.hasMedia ? 'image' : 'chat'),
      hasMedia: Boolean(payload.hasMedia),
      body: payload.body || ''
    });

    if (payload.from?.endsWith('@g.us')) {
      this.log('log', 'Mensaje de grupo ignorado.');
      return { handled: false, reason: 'group_ignored' };
    }

    if (!cleanNumber) {
      this.log('warn', 'No se pudo resolver el teléfono. Mensaje no procesado por seguridad.');
      return { handled: false, reason: 'unresolved_phone' };
    }

    const contactName = this.allowedNumbers[cleanNumber];

    if (!contactName) {
      this.log('warn', 'Número no autorizado:', cleanNumber);
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'unauthorized',
        title: 'Número no autorizado',
        subtitle: '+' + cleanNumber,
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });
      return { handled: false, reason: 'unauthorized' };
    }

    this.log('log', 'Contacto autorizado:', contactName);

    if (!payload.hasMedia) {
      this.log('log', 'Mensaje sin multimedia; no hay acción configurada.');
      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'message_received',
        title: 'Mensaje recibido',
        subtitle: contactName,
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });

      this.addLogInternal('INFO', `Respuesta enviada a +${cleanNumber}: "¡Hola ${contactName}! Mensaje recibido."`);
      this.log('log', 'Confirmación enviada.');
      return { handled: true, contactName, hasMedia: false };
    }

    this.addLogInternal('INFO', 'Descarga de imagen 1/1');
    const date = new Date();
    const month = date.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
    const dateFormatted = date.toLocaleDateString('es-ES').replace(/\//g, '-');
    const timeFormatted = date.toLocaleTimeString('es-ES', { hour12: false }).replace(/:/g, '-');
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const fileName = `${dateFormatted}_${timeFormatted}_${uniqueId}.jpg`;
    const safeContact = contactName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'contacto';
    const relativePath = `/imagenes/${safeContact}/${month}/${fileName}`;
    const fullDirPath = path.join(ChronoBotEngine.IMAGES_ROOT_DIR, safeContact, month);

    try {
      if (!fs.existsSync(fullDirPath)) {
        fs.mkdirSync(fullDirPath, { recursive: true });
      }
      const fullFilePath = path.join(fullDirPath, fileName);
      const rawData = (payload as { base64?: string; data?: string }).base64 || (payload as { base64?: string; data?: string }).data;
      if (rawData) {
        fs.writeFileSync(fullFilePath, Buffer.from(rawData, 'base64'));
      } else {
        const sampleJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
        fs.writeFileSync(fullFilePath, sampleJpg);
      }
      this.loadSavedImagesFromDisk();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChronoBot Engine] Error guardando archivo en disco: ${msg}`);
    }

    this.log('log', 'Imagen guardada:', relativePath);

    this.events.unshift({
      id: 'ev-' + Date.now(),
      type: 'image_saved',
      title: 'Imagen guardada',
      subtitle: contactName,
      relativeTime: 'Ahora mismo',
      timestamp: Date.now()
    });

    const replyText = `Gracias ${contactName}, tu foto ${fileName} se ha guardado correctamente.`;
    this.addLogInternal('INFO', `Respuesta enviada a +${cleanNumber}: "${replyText}"`);
    this.log('log', 'Confirmación enviada.');

    return { handled: true, contactName, hasMedia: true, filePath: relativePath, fileName };
  }

  public async regenerateQr() {
    await this.restartBotProcess();
    return this.getQrData();
  }

  public async restartBotProcess() {
    this.status = 'restarting';
    if (this.botProcess) await this.stopBotProcess();
    else if (this.syncExternalRuntime() && this.externalSession) await this.stopBotProcess();
    await this.startBotProcess();
  }

  public async disconnectWhatsApp() {
    await this.stopBotProcess(true);
    this.connectedPhone = '';
    this.currentRawQr = '';
    this.currentQrDataUrl = '';
    this.addLogInternal('WARN', 'Sesión de WhatsApp desconectada. Bot en estado APAGADO.');
    return {
      status: this.status,
      qrData: this.getQrData()
    };
  }

  public getQrData() {
    return {
      raw: this.currentRawQr,
      dataUrl: this.currentQrDataUrl,
      generatedAt: this.qrGeneratedAt,
      expiresInSeconds: this.qrExpiresInSeconds,
      connectedPhone: this.connectedPhone,
      connected: this.status === 'active'
    };
  }

  public clearLogs() {
    this.logs = [];
    this.addLogInternal('INFO', 'Consola limpiada.');
  }

  public getStatus() {
    this.syncExternalRuntime();
    const uptimeSec = this.status === 'active' ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);

    return {
      status: this.status,
      uptimeFormatted: `${hours}h ${minutes}m`,
      uptimeSeconds: uptimeSec,
      authorizedCount: Object.keys(this.allowedNumbers).length,
      savedImagesCount: this.savedImages.length,
      allowedNumbers: this.allowedNumbers,
      qrData: this.getQrData(),
      pid: this.botProcess?.pid || this.externalSession?.pid,
      sessionConflict: this.sessionConflict
    };
  }

  public getLogs(limit = 100) {
    this.syncExternalRuntime();
    return this.logs.slice(-limit);
  }

  public getEvents(limit = 20) {
    this.syncExternalRuntime();
    return this.events.slice(0, limit);
  }

  public getSavedImages() {
    return this.savedImages;
  }

  public getEmployees(): ChronoEmployee[] {
    return this.employees;
  }

  public getAllowedNumbers(): Record<string, string> {
    return this.allowedNumbers;
  }

  public deleteImage(id: string) {
    const idx = this.savedImages.findIndex(i => i.id === id);
    if (idx !== -1) {
      const img = this.savedImages.splice(idx, 1)[0];
      try {
        const diskPath = path.resolve(process.cwd(), 'public', img.path.replace(/^\//, ''));
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      } catch (err: unknown) {
        console.warn(`[ChronoBot Engine] No se pudo borrar ${img.path}:`, err);
      }
      this.loadSavedImagesFromDisk();
      this.log('log', `Archivo de imagen eliminado: ${img.filename}`);
      return img;
    }
    return null;
  }
}

export const chronoBotSingleton = new ChronoBotEngine();
