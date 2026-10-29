import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LogEntry } from '../../models/bot.model';

@Component({
  selector: 'app-terminal-console',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terminal-console.html'
})
export class TerminalConsole {
  readonly logs = input.required<LogEntry[]>();
  readonly autoScroll = input<boolean>(true);
  readonly heightClass = input<string>('h-[500px]');

  readonly autoScrollChange = output<boolean>();
  readonly clearLogs = output<void>();

  private readonly terminalContainer = viewChild<ElementRef<HTMLDivElement>>('terminalContainer');

  constructor() {
    effect(() => {
      const logs = this.logs();
      const shouldScroll = this.autoScroll();
      if (shouldScroll && logs.length > 0) {
        setTimeout(() => {
          const el = this.terminalContainer()?.nativeElement;
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }, 50);
      }
    });
  }
}
