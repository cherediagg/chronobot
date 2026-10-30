import { Injectable, computed, inject, signal } from '@angular/core';
import { BotConfig, BotStatus, QrData, SystemStats } from '../models/bot.model';
import { BotAction, BotApiClient, BotStatusResponse } from './bot-api.client';

@Injectable({ providedIn: 'root' })
export class BotControlService {
  private readonly api = inject(BotApiClient);

  readonly status = signal<BotStatus>('stopped');
  readonly uptimeSeconds = signal(0);
  readonly qrData = signal<QrData>({
    raw: '',
    dataUrl: '',
    generatedAt: Date.now(),
    expiresInSeconds: 20,
    connectedPhone: ''
  });
  readonly systemStats = signal<SystemStats>({
    nodeVersion: 'Node.js',
    os: 'Linux',
    ramUsedMb: 0,
    ramTotalMb: 1024,
    diskUsedGb: 0.1,
    diskTotalGb: 15,
    isHealthy: false,
    healthTitle: 'Bot apagado',
    healthMessage: 'La aplicación de WhatsApp no está funcionando. Escanea el código QR para conectar el bot.'
  });
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

  readonly isWhatsAppConnected = computed(() => this.status() === 'active');
  readonly formattedUptime = computed(() => {
    const seconds = this.uptimeSeconds();
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  });

  async refresh() {
    const [statusResult, statsResult] = await Promise.allSettled([
      this.api.getStatus(),
      this.api.getSystemStats()
    ]);

    if (statusResult.status === 'fulfilled') this.applyStatus(statusResult.value);
    if (statsResult.status === 'fulfilled') this.systemStats.set(statsResult.value);

    const failures = [statusResult, statsResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(failures.map(result => result.reason), 'No se pudo actualizar todo el estado del bot.');
    }
  }

  async start() {
    this.status.set('connecting');
    this.applyStatus((await this.api.startBot()).status);
  }

  async control(action: BotAction) {
    if (action === 'start') this.status.set('connecting');
    if (action === 'restart') this.status.set('restarting');
    this.applyStatus((await this.api.control(action)).status);
  }

  updateConfig(newConfig: Partial<BotConfig>) {
    this.config.update(current => ({ ...current, ...newConfig }));
  }

  private applyStatus(response: BotStatusResponse) {
    this.status.set(response.status);
    this.uptimeSeconds.set(response.uptimeSeconds);
    this.qrData.set(response.qrData);
  }
}
