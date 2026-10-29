import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { SavedImage } from '../../models/bot.model';
import { WhatsappQr } from '../whatsapp-qr/whatsapp-qr';

@Component({
  selector: 'app-v2-dashboard',
  imports: [MatIconModule, ReactiveFormsModule, WhatsappQr],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './v2-dashboard.html',
  styleUrl: './v2-dashboard.css'
})
export class V2Dashboard {
  readonly botService = inject(BotService);

  @ViewChild('terminalContainer') private terminalContainer?: ElementRef<HTMLDivElement>;

  readonly messageInput = new FormControl('', { nonNullable: true });
  readonly selectedImageForModal = signal<SavedImage | null>(null);

  // Aurora intensity & interactive aura controls
  readonly activeAuroraFilter = signal<'all' | 'logs' | 'media' | 'controls'>('all');

  // Memory calculation percentage
  readonly ramPercentage = computed(() => {
    const stats = this.botService.systemStats();
    return Math.round((stats.ramUsedMb / stats.ramTotalMb) * 100);
  });

  readonly diskPercentage = computed(() => {
    const stats = this.botService.systemStats();
    return Math.round((stats.diskUsedGb / stats.diskTotalGb) * 100);
  });

  constructor() {
    effect(() => {
      this.botService.logs();
      const autoScroll = this.botService.autoScroll();
      if (autoScroll && this.terminalContainer?.nativeElement) {
        setTimeout(() => {
          if (this.terminalContainer?.nativeElement) {
            this.terminalContainer.nativeElement.scrollTop = this.terminalContainer.nativeElement.scrollHeight;
          }
        }, 50);
      }
    });
  }

  handleSendMessage() {
    const val = this.messageInput.value.trim();
    if (!val) return;
    this.botService.sendTestMessage(val);
    this.messageInput.setValue('');
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.handleSendMessage();
    }
  }

  openImageDetails(img: SavedImage) {
    this.selectedImageForModal.set(img);
  }

  closeImageModal() {
    this.selectedImageForModal.set(null);
  }

  navigateToImages() {
    this.botService.activeScreen.set('imagenes');
  }

  navigateToContacts() {
    this.botService.activeScreen.set('contactos');
  }

  navigateToLogs() {
    this.botService.activeScreen.set('logs');
  }
}
