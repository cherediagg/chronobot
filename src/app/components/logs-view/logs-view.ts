import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-logs-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-view.html'
})
export class LogsView {
  readonly botService = inject(BotService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('terminalBox') private terminalBox?: ElementRef<HTMLDivElement>;

  readonly selectedLevel = signal<string>('ALL');
  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchQuery = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });

  readonly autoRefreshEnabled = signal<boolean>(true);
  readonly refreshIntervalSeconds = signal<number>(5);
  readonly secondsUntilNext = signal<number>(5);
  readonly isRefreshing = signal<boolean>(false);
  readonly lastRefreshedTime = signal<string>(this.botService.getCurrentTimeString());

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private cycleCounter = 0;

  readonly filteredLogs = computed(() => {
    const logs = this.botService.logs();
    const lvl = this.selectedLevel();
    const query = this.searchQuery().toLowerCase().trim();

    return logs.filter(log => {
      const matchLevel = lvl === 'ALL' || log.level === lvl;
      const matchQuery = !query || log.text.toLowerCase().includes(query) || (log.highlightSender && log.highlightSender.toLowerCase().includes(query)) || (log.highlightPath && log.highlightPath.toLowerCase().includes(query));
      return matchLevel && matchQuery;
    });
  });

  constructor() {
    this.startAutoRefreshCycle();

    effect(() => {
      this.botService.logs();
      const autoScroll = this.botService.autoScroll();
      if (autoScroll && this.terminalBox?.nativeElement) {
        setTimeout(() => {
          if (this.terminalBox?.nativeElement) {
            this.terminalBox.nativeElement.scrollTop = this.terminalBox.nativeElement.scrollHeight;
          }
        }, 30);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.stopAutoRefreshCycle();
    });
  }

  private startAutoRefreshCycle() {
    this.stopAutoRefreshCycle();
    this.secondsUntilNext.set(this.refreshIntervalSeconds());

    if (typeof window !== 'undefined') {
      this.refreshTimer = setInterval(() => {
        if (!this.autoRefreshEnabled()) return;

        const current = this.secondsUntilNext();
        if (current <= 1) {
          this.executePeriodicRefresh();
          this.secondsUntilNext.set(this.refreshIntervalSeconds());
        } else {
          this.secondsUntilNext.set(current - 1);
        }
      }, 1000);
    }
  }

  private stopAutoRefreshCycle() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async executePeriodicRefresh(manual = false) {
    this.isRefreshing.set(true);
    this.lastRefreshedTime.set(this.botService.getCurrentTimeString());
    this.cycleCounter++;

    try {
      if (manual || (this.cycleCounter % 3 === 0 && this.botService.status() === 'active')) {
        await this.botService.pollTelemetry();
      }

      if (this.botService.autoScroll() && this.terminalBox?.nativeElement) {
        this.terminalBox.nativeElement.scrollTop = this.terminalBox.nativeElement.scrollHeight;
      }
    } finally {
      this.isRefreshing.set(false);
    }
  }

  toggleAutoRefresh() {
    const nextVal = !this.autoRefreshEnabled();
    this.autoRefreshEnabled.set(nextVal);
    if (nextVal) {
      this.secondsUntilNext.set(this.refreshIntervalSeconds());
    }
  }

  setIntervalSeconds(seconds: number) {
    this.refreshIntervalSeconds.set(seconds);
    this.secondsUntilNext.set(seconds);
  }

  triggerManualRefresh() {
    this.executePeriodicRefresh(true);
    this.secondsUntilNext.set(this.refreshIntervalSeconds());
  }

  downloadLogs() {
    const content = this.botService.exportLogs();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fernet-bot-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

}
