import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { TerminalConsole } from '../terminal-console/terminal-console';

@Component({
  selector: 'app-logs-view',
  imports: [MatIconModule, TerminalConsole],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-view.html'
})
export class LogsView {
  private readonly botService = inject(BotService);

  readonly logs = this.botService.logs;
  readonly autoScrollLogs = this.botService.autoScroll;
  readonly botStatus = this.botService.status;

  toggleAutoScroll(value: boolean) {
    this.botService.setAutoScroll(value);
  }

  clearLogs() {
    this.botService.clearLogs();
  }
}
