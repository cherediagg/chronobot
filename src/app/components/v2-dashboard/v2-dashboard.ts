import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../models/bot.model';
import { BotService } from '../../services/bot.service';
import { ImageLightboxModal } from '../image-lightbox-modal/image-lightbox-modal';
import { TerminalConsole } from '../terminal-console/terminal-console';
import { DashboardMetrics } from './dashboard-metrics/dashboard-metrics';
import { MediaRibbon } from './media-ribbon/media-ribbon';

@Component({
  selector: 'app-v2-dashboard',
  imports: [
    MatIconModule,
    DashboardMetrics,
    TerminalConsole,
    MediaRibbon,
    ImageLightboxModal
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './v2-dashboard.html',
  styleUrl: './v2-dashboard.css'
})
export class V2Dashboard {
  private readonly botService = inject(BotService);

  readonly botStatus = this.botService.botStatus;
  readonly contactsCount = this.botService.contactsCount;
  readonly savedImagesCount = this.botService.savedImagesCount;
  readonly uptime = this.botService.uptimeFormatted;
  readonly logs = this.botService.logs;
  readonly autoScrollLogs = this.botService.autoScrollLogs;
  readonly qrData = this.botService.qrData;
  readonly savedImages = this.botService.savedImages;

  readonly selectedImage = signal<SavedImage | null>(null);

  startBot() {
    this.botService.startBot();
  }

  stopBot() {
    this.botService.stopBot();
  }

  restartBot() {
    this.botService.restartBot();
  }

  toggleAutoScroll(value: boolean) {
    this.botService.setAutoScroll(value);
  }

  clearLogs() {
    this.botService.clearLogs();
  }

  openImageDetails(img: SavedImage) {
    this.selectedImage.set(img);
  }

  closeImageDetails() {
    this.selectedImage.set(null);
  }

  navigateToLogs() {
    this.botService.setActiveScreen('logs');
  }

  navigateToQr() {
    this.botService.openQrModal();
  }

  navigateToImages() {
    this.botService.setActiveScreen('imagenes');
  }
}
