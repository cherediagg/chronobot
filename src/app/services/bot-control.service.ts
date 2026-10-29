import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { BotConfig, BotStatus, QrData } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class BotControlService {
  private readonly http = inject(HttpClient);

  readonly status = signal<BotStatus>('stopped');
  readonly qrData = signal<QrData | null>(null);
  readonly uptimeSeconds = signal<number>(0);

  readonly config = signal<BotConfig>({
    botName: 'ChronoBot Core',
    sessionName: 'default-session',
    prefix: '!',
    saveDirectory: 'public/saved_images/',
    groupFolderByContact: false,
    groupFolderByMonth: true,
    autoScrollLogs: true,
    notifyUnauthorized: true,
    autoReplyEnabled: true,
    welcomeMessage: 'Hola, tu imagen ha sido guardada.',
    unauthorizedMessage: 'No estás autorizado para enviar contenido.',
    maxImageSizeMb: 10
  });

  constructor() {
    this.fetchStatus();
    this.fetchQr();
    setInterval(() => {
      this.fetchStatus();
    }, 3000);
  }

  fetchStatus() {
    this.http.get<{ status: BotStatus; uptimeSeconds?: number }>('/api/bot/status').subscribe({
      next: (res) => {
        if (res.status) this.status.set(res.status);
        if (res.uptimeSeconds !== undefined) this.uptimeSeconds.set(res.uptimeSeconds);
      },
      error: () => {}
    });
  }

  fetchQr() {
    this.http.get<QrData>('/api/bot/qr').subscribe({
      next: (res) => this.qrData.set(res),
      error: () => {}
    });
  }

  startBot() {
    this.controlBot('start');
  }

  stopBot() {
    this.controlBot('stop');
  }

  restartBot() {
    this.controlBot('restart');
  }

  regenerateQr() {
    this.controlBot('regenerate_qr');
  }

  private controlBot(action: 'start' | 'stop' | 'restart' | 'regenerate_qr') {
    this.http.post<{ success: boolean; status?: BotStatus }>('/api/bot/control', { action }).subscribe({
      next: (res) => {
        if (res.status) this.status.set(res.status);
        this.fetchStatus();
        this.fetchQr();
      },
      error: (err) => console.error('Error controlling bot:', err)
    });
  }

  updateConfig(patch: Partial<BotConfig>) {
    this.config.update(c => ({ ...c, ...patch }));
  }
}
