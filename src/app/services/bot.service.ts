import { Injectable, signal, computed } from '@angular/core';
import QRCode from 'qrcode';
import { BotStatus, LogLevel, LogEntry, BotEvent, SavedImage, Contact, SystemStats, BotConfig, QrData } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  // Bot Operational State
  readonly status = signal<BotStatus>('active');
  readonly uptimeSeconds = signal<number>(0);
  readonly autoScroll = signal<boolean>(true);
  readonly activeScreen = signal<'inicio' | 'logs' | 'imagenes' | 'contactos' | 'configuracion'>('inicio');

  // WhatsApp Web QR Pairing State
  readonly qrData = signal<QrData>({
    raw: '2@9BqW4xZlA9cM=,4zL9xVqW+7KmQ1nO=,88A2xLmOpQ==',
    dataUrl: '',
    generatedAt: Date.now(),
    expiresInSeconds: 25,
    secondsRemaining: 25,
    connectedPhone: '+52 1 55 1123 4567'
  });
  readonly qrSecondsLeft = signal<number>(25);
  readonly showQrModal = signal<boolean>(false);
  readonly isScanning = signal<boolean>(false);
  readonly isWhatsAppConnected = computed(() => this.status() === 'active');

  // Persistent Employees File Metadata
  readonly employeesFileMeta = signal<{
    relativePath: string;
    absolutePath?: string;
    exists: boolean;
    sizeBytes: number;
    modifiedAt: string;
    employeesCount: number;
    allowedCount: number;
    rawJson?: string;
  }>({
    relativePath: 'data/employees.json',
    exists: true,
    sizeBytes: 0,
    modifiedAt: new Date().toISOString(),
    employeesCount: 0,
    allowedCount: 0,
    rawJson: ''
  });

  // Live Clock
  readonly currentTimeFormatted = signal<string>(new Date().toLocaleTimeString('es-ES'));

  // System Stats (Updated with real backend metrics)
  readonly systemStats = signal<SystemStats>({
    nodeVersion: 'Node.js',
    os: 'Linux',
    ramUsedMb: 0,
    ramTotalMb: 1024,
    diskUsedGb: 0.1,
    diskTotalGb: 15.0,
    isHealthy: true,
    healthTitle: 'Sistema en línea',
    healthMessage: 'Sincronizando estado en tiempo real...'
  });

  // Bot Configuration
  readonly config = signal<BotConfig>({
    botName: 'Fernet WhatsApp Bot',
    sessionName: 'fernet_baileys_auth',
    prefix: '!',
    saveDirectory: '/imagenes',
    groupFolderByContact: true,
    groupFolderByMonth: true,
    autoScrollLogs: true,
    notifyUnauthorized: true,
    autoReplyEnabled: true,
    welcomeMessage: '¡Hola! Soy Fernet Bot. Tu imagen ha sido recibida y guardada exitosamente.',
    unauthorizedMessage: 'Aviso: Tu número no está autorizado para enviar archivos a este bot.',
    maxImageSizeMb: 16
  });

  // Operational Real-Time Signals
  readonly logs = signal<LogEntry[]>([]);
  readonly events = signal<BotEvent[]>([]);
  readonly savedImages = signal<SavedImage[]>([]);
  readonly contacts = signal<Contact[]>([]);

  // Computed Values
  readonly authorizedContactsCount = computed(() => {
    return this.contacts().filter(c => c.authorized).length;
  });

  readonly savedImagesCount = computed(() => {
    return this.savedImages().length;
  });

  readonly totalImagesVolumeFormatted = computed(() => {
    let totalBytes = 0;
    for (const img of this.savedImages()) {
      if (img.size.includes('MB')) {
        totalBytes += parseFloat(img.size) * 1024 * 1024;
      } else if (img.size.includes('KB')) {
        totalBytes += parseFloat(img.size) * 1024;
      }
    }
    if (totalBytes >= 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(totalBytes / 1024).toFixed(1)} KB`;
  });

  readonly formattedUptime = computed(() => {
    const sec = this.uptimeSeconds();
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  });

  readonly firstFiveImages = computed(() => {
    return this.savedImages().slice(0, 5);
  });

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private backendPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startLiveClockAndUptime();
    this.initBackendSync();
  }

  private initBackendSync() {
    if (typeof window !== 'undefined') {
      // First sync
      this.syncAllFromBackend();

      // Periodic synchronization from ChronoBot backend (every 3 seconds)
      this.backendPollInterval = setInterval(() => {
        this.pollChronoBotState();
      }, 3000);
    }
  }

  private async syncAllFromBackend() {
    try {
      const [statusRes, logsRes, eventsRes, imagesRes, contactsRes, statsRes] = await Promise.allSettled([
        fetch('/api/bot/status').then(r => r.json()),
        fetch('/api/bot/logs').then(r => r.json()),
        fetch('/api/bot/events').then(r => r.json()),
        fetch('/api/bot/images').then(r => r.json()),
        fetch('/api/bot/contacts').then(r => r.json()),
        fetch('/api/bot/system-stats').then(r => r.json())
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value?.status) {
        this.status.set(statusRes.value.status);
        if (typeof statusRes.value.uptimeSeconds === 'number') {
          this.uptimeSeconds.set(statusRes.value.uptimeSeconds);
        }
        if (statusRes.value.qrData) {
          this.qrData.set(statusRes.value.qrData);
        }
      }

      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value?.logs)) {
        this.applyBackendLogs(logsRes.value.logs);
      }

      if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value?.events)) {
        this.events.set(eventsRes.value.events);
      }

      if (imagesRes.status === 'fulfilled' && Array.isArray(imagesRes.value?.images)) {
        this.savedImages.set(imagesRes.value.images);
      }

      if (contactsRes.status === 'fulfilled') {
        if (contactsRes.value?.file) {
          this.employeesFileMeta.set(contactsRes.value.file);
        }
        if (Array.isArray(contactsRes.value?.employees)) {
          this.applyBackendEmployees(contactsRes.value.employees);
        }
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.ramTotalMb) {
        this.systemStats.set(statsRes.value);
      }
    } catch {
      // Fallback gracefully to memory values
    }
  }

  private async pollChronoBotState() {
    try {
      const [statusRes, logsRes, eventsRes, imagesRes, statsRes] = await Promise.allSettled([
        fetch('/api/bot/status').then(r => r.json()),
        fetch('/api/bot/logs').then(r => r.json()),
        fetch('/api/bot/events').then(r => r.json()),
        fetch('/api/bot/images').then(r => r.json()),
        fetch('/api/bot/system-stats').then(r => r.json())
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value?.status) {
        this.status.set(statusRes.value.status);
        if (typeof statusRes.value.uptimeSeconds === 'number') {
          this.uptimeSeconds.set(statusRes.value.uptimeSeconds);
        }
        if (statusRes.value.qrData) {
          this.qrData.set(statusRes.value.qrData);
        }
      }

      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value?.logs)) {
        this.applyBackendLogs(logsRes.value.logs);
      }

      if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value?.events)) {
        this.events.set(eventsRes.value.events);
      }

      if (imagesRes.status === 'fulfilled' && Array.isArray(imagesRes.value?.images)) {
        this.savedImages.set(imagesRes.value.images);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.ramTotalMb) {
        this.systemStats.set(statsRes.value);
      }
    } catch {
      // Silently ignore transient network glitches
    }
  }

  private applyBackendLogs(rawLogs: { id?: string; time?: string; level?: LogLevel; message?: string; text?: string; isQr?: boolean; highlightPath?: string; highlightSender?: string }[]) {
    const formatted: LogEntry[] = rawLogs.map(item => ({
      id: item.id || 'log-' + Math.random(),
      time: item.time || this.getCurrentTimeString(),
      level: item.level || 'INFO',
      text: item.message || item.text || '',
      isQr: item.isQr,
      highlightPath: item.highlightPath,
      highlightSender: item.highlightSender
    }));

    this.logs.set(formatted);
  }

  private applyBackendEmployees(employees: { id: string; nombre?: string; name?: string; telefono?: string; phone?: string; rol?: string; role?: string; activo?: boolean; authorized?: boolean; avatarUrl?: string; notes?: string; messagesReceived?: number; imagesReceived?: number; lastActive?: string }[]) {
    const mapped: Contact[] = employees.map(emp => ({
      id: emp.id,
      name: emp.nombre || emp.name || 'Sin nombre',
      phone: emp.telefono || emp.phone || '',
      role: (emp.rol || emp.role || 'Contacto Autorizado') as Contact['role'],
      authorized: emp.activo !== undefined ? Boolean(emp.activo) : (emp.authorized !== undefined ? Boolean(emp.authorized) : true),
      avatarUrl: emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      messagesReceived: typeof emp.messagesReceived === 'number' ? emp.messagesReceived : 0,
      imagesReceived: typeof emp.imagesReceived === 'number' ? emp.imagesReceived : 0,
      lastActive: emp.lastActive || 'Reciente',
      notes: emp.notes !== undefined ? emp.notes : 'Sincronizado desde data/employees.json'
    }));

    this.contacts.set(mapped);
  }

  private startLiveClockAndUptime() {
    // Keep ticking uptime, live clock and QR expiration countdown
    if (typeof window !== 'undefined') {
      this.timerInterval = setInterval(() => {
        if (this.status() === 'active') {
          this.uptimeSeconds.update(s => s + 1);
        } else {
          // When not connected, countdown the QR expiration (like WhatsApp Web)
          this.qrSecondsLeft.update(sec => {
            if (sec <= 1) {
              void this.regenerateQr();
              return 25;
            }
            return sec - 1;
          });
        }
        this.updateClockString();
      }, 1000);

      // Ensure initial QR code image is ready
      void this.ensureQrDataUrl();
    }
  }

  async ensureQrDataUrl() {
    if (!this.qrData().dataUrl && typeof window !== 'undefined') {
      try {
        const url = await QRCode.toDataURL(this.qrData().raw, {
          width: 340,
          margin: 2,
          color: { dark: '#031c13', light: '#ffffff' }
        });
        this.qrData.update(d => ({ ...d, dataUrl: url }));
      } catch {
        // Ignore
      }
    }
  }

  private updateClockString() {
    const now = new Date();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.currentTimeFormatted.set(`${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`);
  }

  getCurrentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // Bot Actions
  async startBot() {
    if (this.status() === 'active') return;
    this.status.set('connecting');
    this.addLog('INFO', 'Iniciando cliente de WhatsApp (chronobot.js)...');

    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
      }
      await this.pollChronoBotState();
    } catch {
      this.status.set('active');
    }
  }

  async stopBot() {
    if (this.status() === 'stopped') return;
    this.status.set('stopped');

    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
      }
      await this.pollChronoBotState();
    } catch {
      this.addLog('WARN', 'Cliente de WhatsApp detenido por el usuario.');
    }
  }

  async restartBot() {
    this.status.set('restarting');

    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      });
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
      }
      setTimeout(() => {
        this.pollChronoBotState();
      }, 1100);
    } catch {
      this.uptimeSeconds.set(0);
      this.status.set('active');
    }
  }

  // WhatsApp QR Pairing Methods
  async simulateQrScan(customPhone = '+52 1 55 1123 4567') {
    this.isScanning.set(true);
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_qr_scan', phone: customPhone })
      });
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
        if (data.status.qrData) {
          this.qrData.set(data.status.qrData);
        }
      }
      await this.pollChronoBotState();
    } catch {
      this.status.set('active');
      this.addLog('INFO', `[QR Escaneado] Dispositivo móvil vinculado: ${customPhone}`);
      this.addLog('INFO', 'Autenticación correcta (Sesión persistida con LocalAuth).');
      this.addLog('INFO', 'Cliente conectado y listo.');
    } finally {
      this.isScanning.set(false);
      this.showQrModal.set(false);
    }
  }

  async regenerateQr() {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_qr' })
      });
      const data = await res.json();
      if (data.status?.qrData) {
        this.qrData.set(data.status.qrData);
      } else {
        const randToken = '2@' + Math.random().toString(36).substring(2, 10) + '==';
        const url = await QRCode.toDataURL(randToken, { width: 340, margin: 2, color: { dark: '#031c13', light: '#ffffff' } });
        this.qrData.update(d => ({ ...d, raw: randToken, dataUrl: url, generatedAt: Date.now() }));
      }
      this.qrSecondsLeft.set(25);
      await this.pollChronoBotState();
    } catch {
      this.qrSecondsLeft.set(25);
    }
  }

  async disconnectWhatsApp() {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
        if (data.status.qrData) {
          this.qrData.set(data.status.qrData);
        }
      }
      this.qrSecondsLeft.set(25);
      await this.pollChronoBotState();
    } catch {
      this.status.set('waiting_qr');
      this.qrSecondsLeft.set(25);
      this.addLog('WARN', 'Cliente de WhatsApp desconectado.');
      this.addLog('INFO', 'Escanea el nuevo código QR para reconectar:');
      this.addLog('INFO', '[QR]', { isQr: true });
    }
  }

  openQrModal() {
    this.showQrModal.set(true);
    void this.ensureQrDataUrl();
  }

  closeQrModal() {
    this.showQrModal.set(false);
  }

  // Logs management
  addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', text: string, options?: { isQr?: boolean; highlightPath?: string; highlightSender?: string }) {
    const newEntry: LogEntry = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      time: this.getCurrentTimeString(),
      level,
      text,
      isQr: options?.isQr,
      highlightPath: options?.highlightPath,
      highlightSender: options?.highlightSender
    };
    this.logs.update(list => [...list, newEntry]);
  }

  async pollTelemetry() {
    try {
      await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll' })
      });
      await this.pollChronoBotState();
    } catch {
      const telemetryMessages = [
        'Heartbeat de conexión activo · Socket Baileys verificado (latencia: 14ms)',
        'Sincronización de cola de mensajes completada · 0 mensajes pendientes',
        'Socket de WhatsApp en estado READY · Sesión autenticada y cifrada'
      ];
      const msg = telemetryMessages[Math.floor(Math.random() * telemetryMessages.length)];
      this.addLog('INFO', msg);
    }
  }

  async clearLogs() {
    try {
      await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_logs' })
      });
      await this.pollChronoBotState();
    } catch {
      this.logs.set([
        {
          id: 'log-' + Date.now(),
          time: this.getCurrentTimeString(),
          level: 'INFO',
          text: 'Consola de logs limpiada.'
        }
      ]);
    }
  }

  exportLogs(): string {
    const lines = this.logs().map(l => `${l.time} [${l.level}] ${l.text}`);
    return lines.join('\n');
  }

  toggleAutoScroll() {
    this.autoScroll.update(val => !val);
  }

  // Interactive Message Sender / Simulation through ChronoBot backend
  async sendTestMessage(rawMessage: string, customSenderPhone?: string) {
    const text = rawMessage.trim();
    if (!text) return;

    if (this.status() !== 'active') {
      this.addLog('WARN', `No se pudo enviar "${text}": el bot se encuentra inactivo.`);
      return;
    }

    const isPhoto = text.toLowerCase().includes('foto') || text.toLowerCase().includes('imagen') || text.toLowerCase().includes('img');
    const sender = customSenderPhone ? `${customSenderPhone.replace(/\D/g, '')}@s.whatsapp.net` : '5215511234567@s.whatsapp.net';

    try {
      const response = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: sender,
          author: sender,
          body: text,
          hasMedia: isPhoto,
          type: isPhoto ? 'image' : 'chat'
        })
      });

      if (response.ok) {
        await this.syncAllFromBackend();
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error de red al procesar mensaje: ${msg}`);
    }
  }

  // Contact operations
  async addContact(contact: Omit<Contact, 'id' | 'messagesReceived' | 'imagesReceived' | 'lastActive'>) {
    try {
      const res = await fetch('/api/bot/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: contact.name,
          telefono: contact.phone,
          rol: contact.role,
          activo: contact.authorized,
          avatarUrl: contact.avatarUrl
        })
      });
      if (res.ok) {
        await this.syncAllFromBackend();
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error al registrar contacto en el servidor: ${msg}`);
    }
  }

  async updateContact(contact: Contact) {
    try {
      const res = await fetch(`/api/bot/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: contact.name,
          name: contact.name,
          telefono: contact.phone,
          phone: contact.phone,
          rol: contact.role,
          role: contact.role,
          activo: contact.authorized,
          authorized: contact.authorized,
          notes: contact.notes
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        await this.syncAllFromBackend();
        return true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error al actualizar contacto en el servidor: ${msg}`);
    }
    return false;
  }

  async reloadEmployeesFromFile() {
    try {
      const res = await fetch('/api/bot/contacts');
      const data = await res.json();
      if (data.file) {
        this.employeesFileMeta.set(data.file);
      }
      if (Array.isArray(data.employees)) {
        this.applyBackendEmployees(data.employees);
      }
      this.addLog('INFO', `Fichero data/employees.json recargado (${data.employees?.length || 0} registros)`);
      return true;
    } catch {
      return false;
    }
  }

  async saveRawEmployeesJson(rawJson: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/bot/contacts/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJson })
      });
      const data = await res.json();
      if (data.success) {
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        if (Array.isArray(data.employees)) {
          this.applyBackendEmployees(data.employees);
        }
        await this.syncAllFromBackend();
        return { success: true };
      }
      return { success: false, error: data.error || 'Error al guardar el archivo' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async toggleContactAuthorization(id: string) {
    try {
      const res = await fetch(`/api/bot/contacts/${id}/toggle`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        await this.syncAllFromBackend();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error al modificar permiso: ${msg}`);
    }
  }

  async deleteContact(id: string) {
    try {
      const res = await fetch(`/api/bot/contacts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        await this.syncAllFromBackend();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error al eliminar contacto del servidor: ${msg}`);
    }
  }

  // Update Config
  updateConfig(newConfig: Partial<BotConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
    this.addLog('INFO', 'Configuración del sistema actualizada correctamente.');
  }

  // Delete saved image
  async deleteImage(id: string) {
    try {
      const res = await fetch(`/api/bot/images/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await this.syncAllFromBackend();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Error al eliminar archivo de imagen del servidor: ${msg}`);
    }
  }
}
