import { Injectable, computed, inject, signal } from '@angular/core';
import { BotConfig, Contact, QrData } from '../models/bot.model';
import { BotControlService } from './bot-control.service';
import { ContactsService } from './contacts.service';
import { LogsService } from './logs.service';
import { MediaService } from './media.service';

export type ScreenType = 'inicio' | 'logs' | 'imagenes' | 'contactos' | 'configuracion';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  private readonly botControl = inject(BotControlService);
  private readonly logsService = inject(LogsService);
  private readonly contactsService = inject(ContactsService);
  private readonly mediaService = inject(MediaService);

  readonly activeScreen = signal<ScreenType>('inicio');
  readonly showQrModal = signal<boolean>(false);

  readonly status = this.botControl.status;
  readonly botStatus = this.botControl.status;
  readonly qrData = this.botControl.qrData;
  readonly config = this.botControl.config;
  readonly uptimeSeconds = this.botControl.uptimeSeconds;
  readonly uptimeFormatted = computed(() => {
    const s = this.botControl.uptimeSeconds();
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return `${hrs}h ${mins}m`;
  });

  readonly logs = this.logsService.logs;
  readonly autoScroll = this.logsService.autoScroll;
  readonly autoScrollLogs = this.logsService.autoScroll;

  readonly contacts = this.contactsService.contacts;
  readonly contactsCount = computed(() => this.contactsService.contacts().length);

  readonly savedImages = this.mediaService.savedImages;
  readonly savedImagesCount = this.mediaService.savedImagesCount;

  setActiveScreen(screen: ScreenType) {
    this.activeScreen.set(screen);
  }

  openQrModal() {
    this.showQrModal.set(true);
  }

  closeQrModal() {
    this.showQrModal.set(false);
  }

  startBot() {
    this.botControl.startBot();
  }

  stopBot() {
    this.botControl.stopBot();
  }

  restartBot() {
    this.botControl.restartBot();
  }

  regenerateQr() {
    this.botControl.regenerateQr();
  }

  updateConfig(patch: Partial<BotConfig>) {
    this.botControl.updateConfig(patch);
  }

  setAutoScroll(enabled: boolean) {
    this.logsService.setAutoScroll(enabled);
  }

  clearLogs() {
    this.logsService.clearLogs();
  }

  exportLogs() {
    this.logsService.exportLogs();
  }

  addContact(contact: Omit<Contact, 'id' | 'messagesReceived' | 'imagesReceived' | 'lastActive'>) {
    this.contactsService.addContact(contact);
  }

  updateContact(id: string, patch: Partial<Contact>) {
    this.contactsService.updateContact(id, patch);
  }

  deleteContact(id: string) {
    this.contactsService.deleteContact(id);
  }

  deleteImage(id: string) {
    this.mediaService.deleteImage(id);
  }
}
