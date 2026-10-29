import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { TerminalConsole } from '../terminal-console/terminal-console';

@Component({
  selector: 'app-logs-view',
  imports: [MatIconModule, ReactiveFormsModule, TerminalConsole],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 sm:p-10 space-y-8 max-w-[1600px] mx-auto select-none font-sans">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-slate-400 text-xs">
            <button type="button" (click)="botService.activeScreen.set('inicio')" class="hover:text-emerald-300 transition-colors">Inicio</button>
            <span>/</span>
            <span class="text-emerald-400 font-medium">Logs en vivo</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Consola y Stream de Red
          </h1>
          <p class="text-sm text-slate-400">
            Monitoreo en streaming continuo con actualización automática periódica y diagnósticos en vivo.
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            (click)="botService.openQrModal()"
            class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-95 cursor-pointer"
          >
            <mat-icon class="text-base">qr_code_scanner</mat-icon>
            <span>{{ botService.status() === 'active' ? 'Ver Código QR' : 'Escanear QR' }}</span>
          </button>

          <button
            type="button"
            (click)="downloadLogs()"
            class="px-4 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <mat-icon class="text-base">download</mat-icon>
            <span>Exportar .txt</span>
          </button>
        </div>
      </div>

      <!-- Refresh Control Pod -->
      <section class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col lg:flex-row items-center justify-between gap-5" aria-label="Control de actualización automática">
        <div class="flex items-center gap-4 w-full lg:w-auto flex-wrap">
          <button
            type="button"
            role="switch"
            [attr.aria-checked]="autoRefreshEnabled()"
            (click)="toggleAutoRefresh()"
            class="px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
            [class]="autoRefreshEnabled() 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
              : 'bg-white/5 border-white/10 text-slate-400'"
          >
            <span 
              class="w-2.5 h-2.5 rounded-full" 
              [class]="autoRefreshEnabled() ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)] animate-ping' : 'bg-slate-500'"
            ></span>
            <span>Auto-refresh: {{ autoRefreshEnabled() ? 'Activado' : 'Pausado' }}</span>
          </button>

          <div class="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            <span class="text-[11px] text-slate-400 px-2 font-medium">Cadencia:</span>
            @for (interval of [2, 5, 10, 30]; track interval) {
              <button
                type="button"
                (click)="setIntervalSeconds(interval)"
                class="px-3 py-1 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer"
                [class]="refreshIntervalSeconds() === interval 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'"
              >
                {{ interval }}s
              </button>
            }
          </div>

          <div class="text-xs font-mono">
            @if (autoRefreshEnabled()) {
              <span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                Próximo pulso en {{ secondsUntilNext() }}s
              </span>
            } @else {
              <span class="text-slate-500 bg-white/5 px-3 py-1.5 rounded-xl">
                En pausa manual
              </span>
            }
          </div>
        </div>

        <div class="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
          <span class="text-xs text-slate-400 font-mono">
            Sincronizado: <span class="text-slate-200 font-semibold">{{ lastRefreshedTime() }}</span>
          </span>

          <button
            type="button"
            (click)="triggerManualRefresh()"
            [disabled]="isRefreshing()"
            title="Refrescar logs ahora"
            class="px-4 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <mat-icon class="text-base" [class.animate-spin]="isRefreshing()">refresh</mat-icon>
            <span>{{ isRefreshing() ? 'Sincronizando...' : 'Refrescar ahora' }}</span>
          </button>
        </div>
      </section>

      <!-- Reusable Atomic Terminal Console -->
      <app-terminal-console
        title="Consola de Transmisión"
        subtitle="Monitoreo de actividad del Socket de Node.js"
        maxHeight="620px"
      />

      <div class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <span class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full" [class]="botService.status() === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
          Eventos y mensajes recibidos directamente desde WhatsApp Web (actualización cada {{ refreshIntervalSeconds() }}s)
        </span>
        <span class="text-slate-500">Las pruebas requieren enviar un mensaje real al número vinculado.</span>
      </div>
    </div>
  `
})
export class LogsView {
  readonly botService = inject(BotService);
  private readonly destroyRef = inject(DestroyRef);

  readonly autoRefreshEnabled = signal<boolean>(true);
  readonly refreshIntervalSeconds = signal<number>(5);
  readonly secondsUntilNext = signal<number>(5);
  readonly isRefreshing = signal<boolean>(false);
  readonly lastRefreshedTime = signal<string>(this.botService.getCurrentTimeString());

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private cycleCounter = 0;

  constructor() {
    this.startAutoRefreshCycle();

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

  executePeriodicRefresh(manual = false) {
    this.isRefreshing.set(true);
    this.lastRefreshedTime.set(this.botService.getCurrentTimeString());
    this.cycleCounter++;

    if (manual || (this.cycleCounter % 3 === 0 && this.botService.status() === 'active')) {
      this.botService.pollTelemetry();
    }

    setTimeout(() => {
      this.isRefreshing.set(false);
    }, 300);
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
