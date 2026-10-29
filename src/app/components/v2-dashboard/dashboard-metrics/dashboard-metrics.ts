import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotStatus } from '../../../models/bot.model';

@Component({
  selector: 'app-dashboard-metrics',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-metrics.html'
})
export class DashboardMetrics {
  readonly botStatus = input.required<BotStatus>();
  readonly contactsCount = input.required<number>();
  readonly savedImagesCount = input.required<number>();
  readonly uptime = input.required<string>();
}
