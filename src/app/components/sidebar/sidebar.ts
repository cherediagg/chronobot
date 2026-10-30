import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-sidebar',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html'
})
export class Sidebar {
  readonly botService = inject(BotService);
}
