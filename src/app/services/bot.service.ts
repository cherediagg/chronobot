import { Injectable, inject, signal } from '@angular/core';
import { BotControlService } from './bot-control.service';
import { LogsService } from './logs.service';
import { ContactsService } from './contacts.service';
import { MediaService } from './media.service';
import { BotEvent, Contact, BotConfig } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  readonly botControl = inject(BotControlService);
  readonly logsService = inject(LogsService);
  readonly contactsService = inject(ContactsService);
  readonly mediaService = inject(MediaService);

  // Operational & Bot State
  readonly status = this.botControl.status;
  readonly uptimeSeconds = this.botControl.uptimeSeconds;
  readonly qrData = this.botControl.qrData;
  readonly showQrModal = this.botControl.showQrModal;
  readonly isWhatsAppConnected = this.botControl.isWhatsAppConnected;
  readonly systemStats = this.botControl.systemStats;
  readonly config = this.botControl.config;
  readonly formattedUptime = this.botControl.formattedUptime;

  // Logs & Navigation State
  readonly logs = this.logsService.logs;
  readonly autoScroll = this.logsService.autoScroll;
  readonly activeScreen = this.logsService.activeScreen;

  // Contacts State
  readonly contacts = this.contactsService.contacts;
  readonly employeesFileMeta = this.contactsService.employeesFileMeta;
  readonly authorizedContactsCount = this.contactsService.authorizedContactsCount;

  // Media State
  readonly savedImages = this.mediaService.savedImages;
  readonly savedImagesCount = this.mediaService.savedImagesCount;
  readonly totalImagesVolumeFormatted = this.mediaService.totalImagesVolumeFormatted;
  readonly firstFiveImages = this.mediaService.firstFiveImages;

  // Events
  readonly events = signal<BotEvent[]>([]);

  private backendPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initBackendSync();
  }

  private initBackendSync() {
    if (typeof window !== 'undefined') {
      void this.initializeBackend();

      this.backendPollInterval = setInterval(() => {
        this.pollChronoBotState();
      }, 3000);
    }
  }

  private async initializeBackend() {
    try {
      const response = await fetch('/api/bot/start', { method: 'POST' });
      const data = await response.json();
      if (data.status?.status) this.status.set(data.status.status);
      if (!response.ok) {
        throw new Error(data.message || `El servidor respondió ${response.status}.`);
      }
      await this.syncAllFromBackend();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.status() !== 'disconnected') this.status.set('stopped');
      this.addLog('ERROR', `No se pudo iniciar ChronoBot desde la API: ${message}`);
    }
  }

  async syncAllFromBackend() {
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
        this.logsService.applyBackendLogs(logsRes.value.logs);
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
          this.contactsService.applyBackendEmployees(contactsRes.value.employees);
        }
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.ramTotalMb) {
        this.systemStats.set(statsRes.value);
      }
    } catch {
      // Ignore network errors on initial sync
    }
  }

  async pollChronoBotState() {
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
        this.logsService.applyBackendLogs(logsRes.value.logs);
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
      // Ignore network errors
    }
  }

  getCurrentTimeString(): string {
    return this.logsService.getCurrentTimeString();
  }

  // Delegated Bot Control Actions
  async startBot() {
    await this.botControl.startBot();
    await this.pollChronoBotState();
  }

  async stopBot() {
    await this.botControl.stopBot();
    await this.pollChronoBotState();
  }

  async restartBot() {
    await this.botControl.restartBot();
    setTimeout(() => {
      this.pollChronoBotState();
    }, 1100);
  }

  async regenerateQr() {
    await this.botControl.regenerateQr();
    await this.pollChronoBotState();
  }

  async disconnectWhatsApp() {
    await this.botControl.disconnectWhatsApp();
    await this.pollChronoBotState();
  }

  openQrModal() {
    this.botControl.openQrModal();
  }

  closeQrModal() {
    this.botControl.closeQrModal();
  }

  // Delegated Logs Actions
  addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', text: string, options?: { isQr?: boolean; highlightPath?: string; highlightSender?: string }) {
    this.logsService.addLog(level, text, options);
  }

  async pollTelemetry() {
    try {
      const response = await fetch('/api/bot/status');
      if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
      await this.pollChronoBotState();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLog('ERROR', `No se pudo consultar el estado de WhatsApp: ${message}`);
    }
  }

  async clearLogs() {
    await this.logsService.clearLogs();
    await this.pollChronoBotState();
  }

  exportLogs(): string {
    return this.logsService.exportLogs();
  }

  toggleAutoScroll() {
    this.logsService.toggleAutoScroll();
  }

  // Delegated Contact Actions
  async addContact(contact: Omit<Contact, 'id' | 'messagesReceived' | 'imagesReceived' | 'lastActive'>) {
    const success = await this.contactsService.addContact(contact);
    if (success) {
      await this.syncAllFromBackend();
    }
  }

  async updateContact(contact: Contact) {
    const success = await this.contactsService.updateContact(contact);
    if (success) {
      await this.syncAllFromBackend();
      return true;
    }
    return false;
  }

  async reloadEmployeesFromFile() {
    return this.contactsService.reloadEmployeesFromFile();
  }

  async saveRawEmployeesJson(rawJson: string) {
    const res = await this.contactsService.saveRawEmployeesJson(rawJson);
    if (res.success) {
      await this.syncAllFromBackend();
    }
    return res;
  }

  async toggleContactAuthorization(id: string) {
    const success = await this.contactsService.toggleContactAuthorization(id);
    if (success) {
      await this.syncAllFromBackend();
    }
  }

  async deleteContact(id: string) {
    const success = await this.contactsService.deleteContact(id);
    if (success) {
      await this.syncAllFromBackend();
    }
  }

  // Delegated Config
  updateConfig(newConfig: Partial<BotConfig>) {
    this.botControl.updateConfig(newConfig);
  }

  // Delegated Image Actions
  async deleteImage(id: string) {
    const success = await this.mediaService.deleteImage(id);
    if (success) {
      await this.syncAllFromBackend();
    }
  }
}
