import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotStatus } from '../../../models/bot.model';

@Component({
  selector: 'app-dashboard-metrics',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-metrics.html'
})
export class DashboardMetrics {
  readonly status = input.required<BotStatus>();
  readonly authorizedContactsCount = input.required<number>();
  readonly savedImagesCount = input.required<number>();
  readonly formattedUptime = input.required<string>();

  readonly toggleBot = output<void>();
  readonly openContacts = output<void>();
  readonly openImages = output<void>();
}
