import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-whatsapp-qr',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-qr.html'
})
export class WhatsappQr {
  private readonly botService = inject(BotService);

  readonly mode = input<'modal' | 'page'>('page');
  readonly canClose = input<boolean>(false);
  readonly dismiss = output<void>();

  readonly qrData = this.botService.qrData;

  regenerateQr() {
    this.botService.regenerateQr();
  }
}
