import { Injectable, signal, computed, inject } from '@angular/core';
import { BotStatus, QrData, SystemStats, BotConfig } from '../models/bot.model';
import { LogsService } from './logs.service';

@Injectable({
  providedIn: 'root'
})
export class BotControlService {
  private readonly logsService = inject(LogsService);

  // Operational State
  readonly status = signal<BotStatus>('stopped');
  readonly uptimeSeconds = signal<number>(0);

  // WhatsApp Web QR Pairing State
  readonly qrData = signal<QrData>({
    raw: '',
    dataUrl: '',
    generatedAt: Date.now(),
    expiresInSeconds: 20,
    connectedPhone: ''
  });
  readonly showQrModal = signal<boolean>(false);
  readonly isWhatsAppConnected = computed(() => this.status() === 'active');

  // System Stats
  readonly systemStats = signal<SystemStats>({
    nodeVersion: 'Node.js',
    os: 'Linux',
    ramUsedMb: 0,
    ramTotalMb: 1024,
    diskUsedGb: 0.1,
    diskTotalGb: 15.0,
    isHealthy: false,
    healthTitle: 'Bot apagado',
    healthMessage: 'La aplicación de WhatsApp no está funcionando. Escanea el código QR para conectar el bot.'
  });

  // Bot Configuration
  readonly config = signal<BotConfig>({
    botName: 'ChronoBot WhatsApp',
    sessionName: 'chronobot_session',
    prefix: '!',
    saveDirectory: '/imagenes',
    groupFolderByContact: true,
    groupFolderByMonth: true,
    autoScrollLogs: true,
    notifyUnauthorized: true,
    autoReplyEnabled: true,
    welcomeMessage: '¡Hola! Tu imagen ha sido recibida y guardada exitosamente.',
    unauthorizedMessage: 'Aviso: Tu número no está autorizado para enviar archivos a este bot.',
    maxImageSizeMb: 16
  });

  readonly formattedUptime = computed(() => {
    const sec = this.uptimeSeconds();
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  });

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startLiveClockAndUptime();
  }

  private startLiveClockAndUptime() {
    if (typeof window !== 'undefined') {
      this.timerInterval = setInterval(() => {
        if (this.status() === 'active') {
          this.uptimeSeconds.update(s => s + 1);
        }
      }, 1000);
    }
  }

  // Bot Actions
  async startBot(): Promise<void> {
    if (this.status() === 'active') return;
    this.status.set('connecting');
    this.logsService.addLog('INFO', 'Iniciando cliente de WhatsApp...');

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
      if (!res.ok) throw new Error(data.message || `El servidor respondió ${res.status}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.status() !== 'disconnected') this.status.set('stopped');
      this.logsService.addLog('ERROR', `No se pudo iniciar WhatsApp Web: ${message}`);
    }
  }

  async stopBot(): Promise<void> {
    if (this.status() === 'stopped') return;

    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logsService.addLog('ERROR', `No se pudo detener WhatsApp Web: ${message}`);
    }
  }

  async restartBot(): Promise<void> {
    this.status.set('restarting');

    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
      }
    } catch (error: unknown) {
      this.uptimeSeconds.set(0);
      this.status.set('stopped');
      const message = error instanceof Error ? error.message : String(error);
      this.logsService.addLog('ERROR', `No se pudo reiniciar WhatsApp Web: ${message}`);
    }
  }

  async regenerateQr(): Promise<void> {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_qr' })
      });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
      const data = await res.json();
      if (data.status?.qrData) {
        this.qrData.set(data.status.qrData);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logsService.addLog('ERROR', `No se pudo reiniciar la conexión de WhatsApp: ${message}`);
    }
  }

  async disconnectWhatsApp(): Promise<void> {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
      const data = await res.json();
      if (data.status) {
        this.status.set(data.status.status);
        if (data.status.qrData) {
          this.qrData.set(data.status.qrData);
        }
      }
    } catch (error: unknown) {
      this.status.set('stopped');
      const message = error instanceof Error ? error.message : String(error);
      this.logsService.addLog('ERROR', `No se pudo cerrar la sesión de WhatsApp: ${message}`);
    }
  }

  openQrModal() {
    this.showQrModal.set(true);
  }

  closeQrModal() {
    this.showQrModal.set(false);
  }

  updateConfig(newConfig: Partial<BotConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
    this.logsService.addLog('INFO', 'Configuración del sistema actualizada correctamente.');
  }
}
