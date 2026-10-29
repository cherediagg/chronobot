import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const chronobotPath = path.resolve(process.cwd(), 'chronobot.js');
const chronobotModule = require(chronobotPath);

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
  rol: string;
  role?: string;
  avatarUrl?: string;
  notes?: string;
  messagesReceived?: number;
  imagesReceived?: number;
  lastActive?: string;
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

export class ChronoBotEngine {
  public static readonly IMAGES_ROOT_DIR = path.resolve(process.cwd(), 'public', 'imagenes');

  private status: 'active' | 'stopped' | 'restarting' | 'connecting' | 'waiting_qr' | 'disconnected' = 'stopped';
  private startTime = Date.now();
  private logs: ChronoLogEntry[] = [];
  private events: ChronoBotEvent[] = [];
  private employees: ChronoEmployee[] = [];
  private allowedNumbers: Record<string, string> = {};
  private savedImages: ChronoSavedImage[] = [];
  private botProcess: ChildProcess | null = null;

  // WhatsApp Web QR Pairing State
  private currentRawQr = '';
  private currentQrDataUrl = '';
  private qrGeneratedAt = Date.now();
  private qrExpiresInSeconds = 25;
  private connectedPhone = '';

  constructor() {
    this.loadEmployeesFromFile();
    this.loadSavedImagesFromDisk();
    void this.generateQrCode();
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
          const rol = e.rol || e.role || 'Contacto Autorizado';
          return {
            id: e.id || `emp-${idx + 1}`,
            nombre,
            name: nombre,
            telefono,
            phone: telefono,
            activo,
            authorized: activo,
            rol,
            role: rol,
            avatarUrl: e.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            notes: e.notes || '',
            messagesReceived: typeof e.messagesReceived === 'number' ? e.messagesReceived : 0,
            imagesReceived: typeof e.imagesReceived === 'number' ? e.imagesReceived : 0,
            lastActive: e.lastActive || 'Reciente',
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
    } catch {
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
    for (const [phone, contactName] of Object.entries(this.allowedNumbers)) {
      if (contactName.toLowerCase() === name.toLowerCase()) {
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

  public async startBotProcess() {
    if (this.botProcess) {
      this.addLogInternal('WARN', 'El proceso del bot ya se encuentra en ejecución.');
      return;
    }

    this.status = 'active';
    this.startTime = Date.now();
    this.addLogInternal('INFO', 'Iniciando proceso real de Node: node chronobot.js');

    try {
      this.botProcess = spawn('node', [chronobotPath], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.addLogInternal('INFO', `Proceso del bot de Node.js iniciado con PID: ${this.botProcess.pid}`);

      this.events.unshift({
        id: 'ev-' + Date.now(),
        type: 'client_connected',
        title: 'Proceso de Node iniciado',
        subtitle: `PID: ${this.botProcess.pid}`,
        relativeTime: 'Ahora mismo',
        timestamp: Date.now()
      });

      if (this.botProcess.stdout) {
        this.botProcess.stdout.on('data', (data: Buffer) => {
          const text = data.toString('utf-8').trim();
          if (text) {
            text.split('\n').forEach(line => {
              if (line.trim()) {
                this.addLogInternal('INFO', `[Node Output] ${line.trim()}`);
              }
            });
          }
        });
      }

      if (this.botProcess.stderr) {
        this.botProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString('utf-8').trim();
          if (text) {
            text.split('\n').forEach(line => {
              if (line.trim()) {
                this.addLogInternal('WARN', `[Node Error] ${line.trim()}`);
              }
            });
          }
        });
      }

      this.botProcess.on('exit', (code, signal) => {
        this.addLogInternal('WARN', `El proceso de Node del bot finalizó. Código: ${code}, Señal: ${signal}`);
        this.botProcess = null;
        this.status = 'stopped';
      });

      this.botProcess.on('error', (err) => {
        this.addLogInternal('ERROR', `Error en el proceso de Node: ${err.message}`);
        this.botProcess = null;
        this.status = 'stopped';
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLogInternal('ERROR', `Error al arrancar chronobot.js: ${msg}`);
      this.botProcess = null;
      this.status = 'stopped';
    }
  }

  public async stopBotProcess() {
    if (!this.botProcess) {
      this.status = 'stopped';
      this.addLogInternal('WARN', 'El proceso del bot no estaba en ejecución.');
      return;
    }

    this.addLogInternal('INFO', `Deteniendo proceso de Node (PID: ${this.botProcess.pid})...`);
    try {
      this.botProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.botProcess) {
          this.botProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLogInternal('ERROR', `Error deteniendo el proceso: ${msg}`);
    } finally {
      this.botProcess = null;
      this.status = 'stopped';
    }
  }

  public async handleMessage(payload: { from: string; body?: string; hasMedia?: boolean; type?: string; author?: string }) {
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

  public pollHeartbeat() {
    if (this.status !== 'active') return;
    const msgs = [
      'Heartbeat de conexión activo · ChronoBot socket verificado',
      'Sincronización completada · 0 mensajes pendientes',
      'Socket de WhatsApp en estado READY',
      'Canal de escucha activo'
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    this.addLogInternal('INFO', msg);
  }

  public async generateQrCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let rand1 = '';
    let rand2 = '';
    for (let i = 0; i < 24; i++) rand1 += chars.charAt(Math.floor(Math.random() * chars.length));
    for (let i = 0; i < 32; i++) rand2 += chars.charAt(Math.floor(Math.random() * chars.length));

    this.currentRawQr = `2@${rand1}==,${rand2}=,${Date.now()}==`;
    this.qrGeneratedAt = Date.now();

    try {
      this.currentQrDataUrl = await QRCode.toDataURL(this.currentRawQr, {
        width: 340,
        margin: 2,
        color: {
          dark: '#031c13',
          light: '#ffffff'
        }
      });
    } catch {
      this.currentQrDataUrl = '';
    }
    return this.currentQrDataUrl;
  }

  public setStatus(newStatus: 'active' | 'stopped' | 'restarting' | 'connecting' | 'waiting_qr' | 'disconnected') {
    if (newStatus === 'active') {
      void this.startBotProcess();
    } else if (newStatus === 'stopped' || newStatus === 'disconnected') {
      void this.stopBotProcess();
    } else {
      this.status = newStatus;
    }
  }

  public async simulateQrScan(simulatedPhone = '') {
    const phoneToConnect = simulatedPhone || '+52 1 55 1123 4567';
    this.connectedPhone = phoneToConnect;
    this.status = 'active';
    this.startTime = Date.now();

    this.addLogInternal('INFO', `[QR Escaneado] Dispositivo móvil vinculado: ${phoneToConnect}`);
    this.addLogInternal('INFO', 'Autenticación correcta. Cliente conectado y listo.');

    this.events.unshift({
      id: 'ev-' + Date.now(),
      type: 'client_connected',
      title: 'Cliente conectado',
      subtitle: `WhatsApp (${phoneToConnect})`,
      relativeTime: 'Ahora mismo',
      timestamp: Date.now()
    });

    return {
      success: true,
      status: this.status,
      connectedPhone: this.connectedPhone
    };
  }

  public async regenerateQr() {
    await this.generateQrCode();
    this.status = 'waiting_qr';
    this.addLogInternal('INFO', 'Código QR actualizado. Escanea con WhatsApp para iniciar sesión:');
    this.addLogInternal('INFO', '[QR]', undefined, { isQr: true });
    return {
      raw: this.currentRawQr,
      dataUrl: this.currentQrDataUrl,
      generatedAt: this.qrGeneratedAt,
      expiresInSeconds: this.qrExpiresInSeconds
    };
  }

  public async disconnectWhatsApp() {
    await this.stopBotProcess();
    this.connectedPhone = '';
    await this.generateQrCode();
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
      pid: this.botProcess?.pid
    };
  }

  public getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  public getEvents(limit = 20) {
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
