import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-whatsapp-qr',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-qr.html'
})
export class WhatsappQr {
  readonly botService = inject(BotService);

  readonly connectionError = computed(() => this.botService.logs()
    .slice()
    .reverse()
    .find(log => log.level === 'ERROR' || log.text.includes('Ya existe una sesión abierta'))?.text || '');

  readonly qrImageSrc = computed(() => {
    return this.botService.qrData().dataUrl;
  });
}
