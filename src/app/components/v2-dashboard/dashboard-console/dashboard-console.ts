import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotStatus, LogEntry, QrData } from '../../../models/bot.model';

@Component({
  selector: 'app-dashboard-console',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-console.html'
})
export class DashboardConsole {
  readonly logs = input.required<LogEntry[]>();
  readonly status = input.required<BotStatus>();
  readonly qrData = input.required<QrData>();
  readonly autoScroll = input.required<boolean>();

  readonly toggleAutoScroll = output<void>();
  readonly clearLogs = output<void>();

  private readonly terminalContainer = viewChild<ElementRef<HTMLDivElement>>('terminalContainer');

  constructor() {
    effect(onCleanup => {
      this.logs();
      if (!this.autoScroll()) return;

      const container = this.terminalContainer()?.nativeElement;
      if (!container) return;

      const timeout = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
      onCleanup(() => clearTimeout(timeout));
    });
  }
}
