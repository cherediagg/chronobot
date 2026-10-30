import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { BotConfig, Contact } from '../models/bot.model';
import { BotAction } from './bot-api.client';
import { BotControlService } from './bot-control.service';
import { ContactsService } from './contacts.service';
import { LogsService } from './logs.service';
import { MediaService } from './media.service';

export type ScreenType = 'inicio' | 'logs' | 'imagenes' | 'contactos' | 'configuracion';

@Injectable({ providedIn: 'root' })
export class BotService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly control = inject(BotControlService);
  private readonly contactsDomain = inject(ContactsService);
  private readonly logsDomain = inject(LogsService);
  private readonly mediaDomain = inject(MediaService);

  readonly status = this.control.status;
  readonly uptimeSeconds = this.control.uptimeSeconds;
  readonly qrData = this.control.qrData;
  readonly isWhatsAppConnected = this.control.isWhatsAppConnected;
  readonly systemStats = this.control.systemStats;
  readonly config = this.control.config;
  readonly formattedUptime = this.control.formattedUptime;

  readonly logs = this.logsDomain.logs;
  readonly events = this.logsDomain.events;
  readonly autoScroll = this.logsDomain.autoScroll;
  readonly autoScrollLogs = this.logsDomain.autoScroll;
  readonly contacts = this.contactsDomain.contacts;
  readonly authorizedContactsCount = this.contactsDomain.authorizedContactsCount;
  readonly savedImages = this.mediaDomain.savedImages;
  readonly savedImagesCount = this.mediaDomain.savedImagesCount;
  readonly totalImagesVolumeFormatted = this.mediaDomain.totalImagesVolumeFormatted;
  readonly firstFiveImages = this.mediaDomain.firstFiveImages;

  readonly activeScreen = signal<ScreenType>('inicio');

  private syncInProgress = false;
  private lastSyncError: string | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    void this.initializeBackend();
    const pollTimer = setInterval(() => void this.syncFromBackend(), 3000);
    const uptimeTimer = setInterval(() => {
      if (this.status() === 'active') this.uptimeSeconds.update(seconds => seconds + 1);
    }, 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(pollTimer);
      clearInterval(uptimeTimer);
    });
  }

  async startBot() {
    if (this.status() === 'active') return;
    await this.runAction('start', 'No se pudo iniciar WhatsApp Web');
  }

  async stopBot() {
    if (this.status() === 'stopped') return;
    await this.runAction('stop', 'No se pudo detener WhatsApp Web');
  }

  async restartBot() {
    await this.runAction('restart', 'No se pudo reiniciar WhatsApp Web');
  }

  async regenerateQr() {
    await this.runAction('regenerate_qr', 'No se pudo regenerar el código QR');
  }

  async disconnectWhatsApp() {
    await this.runAction('disconnect', 'No se pudo cerrar la sesión de WhatsApp');
  }

  async pollTelemetry() {
    await this.syncFromBackend();
  }

  async clearLogs() {
    try {
      await this.logsDomain.clear();
    } catch (error: unknown) {
      this.logsDomain.addLog('ERROR', `No se pudieron limpiar los registros: ${this.errorMessage(error)}`);
    }
  }

  exportLogs() {
    return this.logsDomain.exportText();
  }

  getCurrentTimeString() {
    return this.logsDomain.getCurrentTimeString();
  }

  toggleAutoScroll() {
    this.logsDomain.toggleAutoScroll();
  }

  async addContact(contact: Omit<Contact, 'id'>) {
    await this.runOperation(() => this.contactsDomain.add(contact), 'Error al registrar empleado');
  }

  async updateContact(contact: Contact) {
    await this.runOperation(() => this.contactsDomain.update(contact), 'Error al actualizar empleado');
  }

  async toggleContactAuthorization(id: string) {
    await this.runOperation(() => this.contactsDomain.toggleAuthorization(id), 'Error al modificar el permiso del empleado');
  }

  async deleteContact(id: string) {
    await this.runOperation(() => this.contactsDomain.delete(id), 'Error al eliminar empleado');
  }

  updateConfig(newConfig: Partial<BotConfig>) {
    this.control.updateConfig(newConfig);
    this.logsDomain.addLog('INFO', 'Configuración del sistema actualizada correctamente.');
  }

  async deleteImage(id: string) {
    await this.runOperation(() => this.mediaDomain.delete(id), 'Error al eliminar la imagen');
  }

  private async initializeBackend() {
    try {
      await this.control.start();
      await this.syncFromBackend();
    } catch (error: unknown) {
      if (this.status() !== 'disconnected') this.status.set('stopped');
      this.logsDomain.addLog('ERROR', `No se pudo iniciar ChronoBot desde la API: ${this.errorMessage(error)}`);
    }
  }

  private async runAction(action: BotAction, errorPrefix: string) {
    await this.runOperation(async () => {
      await this.control.control(action);
      await this.syncFromBackend();
    }, errorPrefix);
  }

  private async runOperation(operation: () => Promise<void>, errorPrefix: string) {
    try {
      await operation();
    } catch (error: unknown) {
      this.logsDomain.addLog('ERROR', `${errorPrefix}: ${this.errorMessage(error)}`);
    }
  }

  private async syncFromBackend() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const results = await Promise.allSettled([
        this.control.refresh(),
        this.logsDomain.refresh(),
        this.contactsDomain.refresh(),
        this.mediaDomain.refresh()
      ]);
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

      if (failures.length > 0) {
        const message = failures.map(result => this.errorMessage(result.reason)).join('; ');
        if (message !== this.lastSyncError) {
          this.logsDomain.addLog('ERROR', `No se pudo sincronizar todo el estado del bot: ${message}`);
          this.lastSyncError = message;
        }
      } else {
        this.lastSyncError = null;
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
