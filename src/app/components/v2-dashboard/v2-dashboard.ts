import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BotService } from '../../services/bot.service';
import { SavedImage } from '../../models/bot.model';
import { WhatsappQr } from '../whatsapp-qr/whatsapp-qr';
import { DashboardMetrics } from './dashboard-metrics/dashboard-metrics';
import { TerminalConsole } from '../terminal-console/terminal-console';
import { MediaRibbon } from './media-ribbon/media-ribbon';
import { ImageLightboxModal } from '../image-lightbox-modal/image-lightbox-modal';

@Component({
  selector: 'app-v2-dashboard',
  imports: [
    WhatsappQr,
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
  readonly botService = inject(BotService);

  readonly selectedImageForModal = signal<SavedImage | null>(null);

  openImageDetails(img: SavedImage) {
    this.selectedImageForModal.set(img);
  }

  closeImageModal() {
    this.selectedImageForModal.set(null);
  }
}
