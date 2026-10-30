import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { SavedImage } from '../../models/bot.model';
import { WhatsappQr } from '../whatsapp-qr/whatsapp-qr';
import { DashboardConsole } from './dashboard-console/dashboard-console';
import { DashboardGallery } from './dashboard-gallery/dashboard-gallery';
import { DashboardMetrics } from './dashboard-metrics/dashboard-metrics';

@Component({
  selector: 'app-v2-dashboard',
  imports: [MatIconModule, WhatsappQr, DashboardConsole, DashboardGallery, DashboardMetrics],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './v2-dashboard-shell.html',
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

  toggleBotFromStatus() {
    if (this.botService.status() === 'active') {
      void this.botService.stopBot();
    } else if (this.botService.status() !== 'connecting') {
      void this.botService.startBot();
    }
  }

  navigateToEmployees() {
    this.botService.activeScreen.set('contactos');
  }

  navigateToImages() {
    this.botService.activeScreen.set('imagenes');
  }
}
