import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { SavedImageRepository } from './server/saved-image.repository';
import type { ChronoSavedImage } from './server/saved-image.repository';
import { EMPLOYEES_FILE_PATH } from './server/employee-file.repository';
import type { ChronoEmployee } from './server/employee.model';
import { BotActivityLog } from './server/bot-activity-log';
import { WhatsAppSessionGuard } from './server/whatsapp-session-guard';

const require = createRequire(import.meta.url);
const chronobotPath = path.resolve(process.cwd(), 'chronobot.js');
const chronobotModule = require(chronobotPath);

export { EMPLOYEES_FILE_PATH };

export type { ChronoBotEvent, ChronoLogEntry } from './server/bot-activity-log';

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
  private status: ChronoBotStatus = 'stopped';
  private startTime = Date.now();
  private readonly activity = new BotActivityLog();
  private allowedNumbers: Record<string, string> = {};
  private savedImages: ChronoSavedImage[] = [];
  private readonly imageRepository = new SavedImageRepository();
  private readonly sessionGuard = new WhatsAppSessionGuard(
    chronobotPath,
    (level, message) => this.addLogInternal(level, message)
  );
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

  /**
   * Reads employees from data/employees.json using chronobotModule strictly for WhatsApp authorization.
   */
  public loadEmployeesFromFile(): ChronoEmployee[] {
    try {
      const loaded = chronobotModule.loadEmployees();
      const employees: ChronoEmployee[] = Array.isArray(loaded) ? loaded : [];
      this.allowedNumbers = chronobotModule.buildAllowedNumbers(employees);
      return employees;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChronoBot Engine] Error al leer con chronobot.js: ${msg}`);
    }

    this.allowedNumbers = {};
    return [];
  }

  /**
   * Reloads authorized contacts from data/employees.json via chronobotModule.
   */
  public reloadAuthorizedContacts(reason?: string): Record<string, string> {
    try {
      this.allowedNumbers = chronobotModule.refreshAllowedNumbers();
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
    const results = this.imageRepository.scan(name => this.findPhoneByContactName(name));
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
    this.addLogInternal('INFO', 'Estado del bot: APAGADO / Proceso de Node inactivo.');
    this.addLogInternal('INFO', 'Inicie el bot desde el botón principal para arrancar el proceso de Node.');
    this.addLogInternal('INFO', `Contactos autorizados cargados desde ${path.basename(EMPLOYEES_FILE_PATH)}: ${Object.keys(this.allowedNumbers).length}`);
  }

  private addLogInternal(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, timeStr?: string, options?: { isQr?: boolean; highlightPath?: string; highlightSender?: string; details?: unknown }) {
    this.activity.addLog(level, message, timeStr, options);
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
      this.activity.addEvent({
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
      this.activity.addEvent({
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
      this.activity.addEvent({
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
      this.activity.addEvent({
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
      !this.sessionGuard.isProcessAlive(pid) ||
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
      const existingSession = await this.sessionGuard.findExistingSession();
      if (existingSession) {
        this.sessionConflict = false;
        await this.sessionGuard.stopExistingSession(existingSession);
        const remainingSession = await this.sessionGuard.findExistingSession();
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
        while (Date.now() < deadline && this.sessionGuard.isProcessAlive(external.pid)) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (this.sessionGuard.isProcessAlive(external.pid)) {
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
    this.activity.clearLogs();
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
    return this.activity.getLogs(limit);
  }

  public getEvents(limit = 20) {
    this.syncExternalRuntime();
    return this.activity.getEvents(limit);
  }

  public getSavedImages() {
    return this.savedImages;
  }

  public getEmployees(): ChronoEmployee[] {
    const employees = chronobotModule.getEmployees();
    return Array.isArray(employees) ? employees : [];
  }

  public getAllowedNumbers(): Record<string, string> {
    return this.allowedNumbers;
  }

  public deleteImage(id: string) {
    const idx = this.savedImages.findIndex(i => i.id === id);
    if (idx !== -1) {
      const img = this.savedImages.splice(idx, 1)[0];
      try {
        this.imageRepository.delete(img);
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
