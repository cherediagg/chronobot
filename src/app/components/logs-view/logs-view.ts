import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-logs-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 sm:p-10 space-y-8 max-w-[1600px] mx-auto select-none font-sans">
      <!-- Header with Gradient Title -->
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

        <!-- Action Controls -->
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
            (click)="botService.clearLogs()"
            class="px-4 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <mat-icon class="text-base">delete_sweep</mat-icon>
            <span>Limpiar consola</span>
          </button>

          <button
            type="button"
            (click)="downloadLogs()"
            class="px-4 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <mat-icon class="text-base">download</mat-icon>
            <span>Exportar .txt</span>
          </button>

          <button
            type="button"
            (click)="triggerSimulatedEvent('photo')"
            class="px-4 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <mat-icon class="text-base">add_photo_alternate</mat-icon>
            <span>Simular imagen entrante</span>
          </button>
        </div>
      </div>

      <!-- Auto-Refresh Fluid Control Pod -->
      <section class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col lg:flex-row items-center justify-between gap-5" aria-label="Control de actualización automática">
        <!-- Left: Auto-Refresh Status & Cadence -->
        <div class="flex items-center gap-4 w-full lg:w-auto flex-wrap">
          <button
            type="button"
            role="switch"
            [attr.aria-checked]="autoRefreshEnabled()"
            (click)="toggleAutoRefresh()"
            class="px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all shadow-sm"
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

          <!-- Cadence Interval Selector -->
          <div class="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            <span class="text-[11px] text-slate-400 px-2 font-medium">Cadencia:</span>
            @for (interval of [2, 5, 10, 30]; track interval) {
              <button
                type="button"
                (click)="setIntervalSeconds(interval)"
                class="px-3 py-1 rounded-xl text-xs font-mono font-semibold transition-all"
                [class]="refreshIntervalSeconds() === interval 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'"
              >
                {{ interval }}s
              </button>
            }
          </div>

          <!-- Countdown Badge -->
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

        <!-- Right: Manual Refresh & Timestamp -->
        <div class="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
          <span class="text-xs text-slate-400 font-mono">
            Sincronizado: <span class="text-slate-200 font-semibold">{{ lastRefreshedTime() }}</span>
          </span>

          <button
            type="button"
            (click)="triggerManualRefresh()"
            [disabled]="isRefreshing()"
            title="Refrescar logs ahora"
            class="px-4 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <mat-icon class="text-base" [class.animate-spin]="isRefreshing()">refresh</mat-icon>
            <span>{{ isRefreshing() ? 'Sincronizando...' : 'Refrescar ahora' }}</span>
          </button>
        </div>
      </section>

      <!-- Filters & Search Toolbar (Fluid Glass Bar) -->
      <div class="p-4 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- Level Filters -->
        <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            (click)="selectedLevel.set('ALL')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            [class]="selectedLevel() === 'ALL'
              ? 'bg-white/20 text-white shadow-sm'
              : 'bg-white/[0.02] text-slate-400 hover:text-white'"
          >
            Todos ({{ botService.logs().length }})
          </button>
          <button
            type="button"
            (click)="selectedLevel.set('INFO')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            [class]="selectedLevel() === 'INFO'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-white/[0.02] text-slate-400 hover:text-white'"
          >
            INFO
          </button>
          <button
            type="button"
            (click)="selectedLevel.set('WARN')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            [class]="selectedLevel() === 'WARN'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-white/[0.02] text-slate-400 hover:text-white'"
          >
            WARN
          </button>
          <button
            type="button"
            (click)="selectedLevel.set('ERROR')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            [class]="selectedLevel() === 'ERROR'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
              : 'bg-white/[0.02] text-slate-400 hover:text-white'"
          >
            ERROR
          </button>
        </div>

        <!-- Search input & Auto-scroll switch -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <div class="relative w-full md:w-72">
            <mat-icon class="text-slate-500 text-base absolute left-3.5 top-2.5 pointer-events-none">search</mat-icon>
            <input
              type="text"
              [formControl]="searchControl"
              placeholder="Filtrar por contenido o remitente..."
              class="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
            />
          </div>

          <!-- Auto-scroll switch -->
          <button
            type="button"
            (click)="botService.toggleAutoScroll()"
            class="px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 shrink-0 transition-all shadow-sm"
            [class]="botService.autoScroll() 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
              : 'bg-white/5 border-white/5 text-slate-400'"
          >
            <span class="w-2 h-2 rounded-full" [class]="botService.autoScroll() ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"></span>
            <span>Auto-scroll</span>
          </button>
        </div>
      </div>

      <!-- Holographic Projected Terminal Console -->
      <div
        #terminalBox
        class="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.03] to-black/60 backdrop-blur-3xl border border-white/5 font-mono text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-[620px] shadow-[0_30px_70px_rgba(0,0,0,0.6)] select-text transition-all duration-300 space-y-1.5"
        [class.shadow-[0_0_35px_rgba(16,185,129,0.2)]]="isRefreshing()"
      >
        @if (filteredLogs().length === 0) {
          <div class="py-16 text-center text-slate-500 space-y-2">
            <mat-icon class="text-4xl text-slate-600 mb-1">terminal</mat-icon>
            <p class="font-sans text-sm">No se encontraron registros coincidentes con los filtros aplicados.</p>
          </div>
        } @else {
          @for (log of filteredLogs(); track log.id) {
            <div class="py-1.5 px-3 rounded-2xl flex flex-wrap items-baseline gap-x-3 transition-colors hover:bg-white/[0.04]">
              <span class="text-slate-500 shrink-0 tabular-nums text-[11px]">{{ log.time }}</span>
              <span
                class="font-bold text-[11px] shrink-0 px-2.5 py-0.5 rounded-md"
                [class]="log.level === 'INFO' ? 'bg-emerald-500/15 text-emerald-300' : (log.level === 'WARN' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300')"
              >[{{ log.level }}]</span>

              @if (log.isQr) {
                <div class="w-full my-3 p-4 sm:p-5 rounded-3xl bg-black/70 border border-emerald-500/30 shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                  <div class="flex flex-col sm:flex-row items-center gap-6">
                    <!-- High-Resolution Graphical QR -->
                    <div class="relative shrink-0 p-3 rounded-2xl bg-white shadow-xl flex items-center justify-center">
                      @if (botService.qrData().dataUrl) {
                        <img [src]="botService.qrData().dataUrl" alt="Código QR en vivo" class="w-40 h-40 sm:w-44 sm:h-44 object-contain select-none" />
                      } @else {
                        <div class="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center bg-slate-900 text-emerald-400">
                          <mat-icon class="text-3xl animate-spin">sync</mat-icon>
                        </div>
                      }
                      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div class="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md border-2 border-white">
                          <mat-icon class="text-base">chat</mat-icon>
                        </div>
                      </div>
                    </div>

                    <!-- Terminal Info + Actions -->
                    <div class="space-y-3 flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-3 flex-wrap">
                        <span class="text-xs font-bold text-emerald-300 font-sans flex items-center gap-1.5">
                          <mat-icon class="text-sm">qr_code_scanner</mat-icon>
                          Código QR de WhatsApp Web (whatsapp-web.js)
                        </span>
                        <span class="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                          Expira en {{ botService.qrSecondsLeft() }}s
                        </span>
                      </div>

                      <p class="text-[11px] text-slate-400 font-sans leading-relaxed">
                        Escanea este código con tu teléfono móvil desde <strong class="text-slate-200">WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo</strong> para conectar la instancia.
                      </p>

                      <div class="flex items-center gap-2.5 flex-wrap pt-1 font-sans">
                        <button
                          type="button"
                          (click)="botService.simulateQrScan()"
                          class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <mat-icon class="text-sm">phonelink_setup</mat-icon>
                          <span>Simular escaneo exitoso</span>
                        </button>

                        <button
                          type="button"
                          (click)="botService.regenerateQr()"
                          class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <mat-icon class="text-sm">refresh</mat-icon>
                          <span>Regenerar QR</span>
                        </button>

                        <button
                          type="button"
                          (click)="botService.openQrModal()"
                          class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-medium flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <mat-icon class="text-sm">open_in_full</mat-icon>
                          <span>Ver en grande</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              } @else {
                <span class="text-slate-200 flex-1">
                  @if (log.highlightPath) {
                    Archivo procesado &rarr; <span class="text-teal-300 font-semibold underline">{{ log.highlightPath }}</span>
                  } @else if (log.highlightSender) {
                    Mensaje de: <span class="text-cyan-300 font-medium">{{ log.highlightSender }}</span>
                  } @else {
                    {{ log.text }}
                  }
                </span>
              }
            </div>
          }
        }
      </div>

      <!-- Quick Interactive Simulation Pod -->
      <div class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <span class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Terminal enlazada a la instancia de Node.js v22.14.0 (Cadencia de muestreo: {{ refreshIntervalSeconds() }}s)
        </span>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="triggerSimulatedEvent('unauthorized')"
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium transition-all"
          >
            Simular no autorizado
          </button>
          <span>·</span>
          <button
            type="button"
            (click)="triggerSimulatedEvent('message')"
            class="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-medium transition-all"
          >
            Simular texto entrante
          </button>
        </div>
      </div>
    </div>
  `
})
export class LogsView {
  readonly botService = inject(BotService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('terminalBox') private terminalBox?: ElementRef<HTMLDivElement>;

  readonly selectedLevel = signal<string>('ALL');
  readonly searchControl = new FormControl('', { nonNullable: true });

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
    const query = this.searchControl.value.toLowerCase().trim();

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

  executePeriodicRefresh(manual = false) {
    this.isRefreshing.set(true);
    this.lastRefreshedTime.set(this.botService.getCurrentTimeString());
    this.cycleCounter++;

    if (manual || (this.cycleCounter % 3 === 0 && this.botService.status() === 'active')) {
      this.botService.pollTelemetry();
    }

    if (this.botService.autoScroll() && this.terminalBox?.nativeElement) {
      setTimeout(() => {
        if (this.terminalBox?.nativeElement) {
          this.terminalBox.nativeElement.scrollTop = this.terminalBox.nativeElement.scrollHeight;
        }
      }, 50);
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

  triggerSimulatedEvent(type: 'photo' | 'message' | 'unauthorized') {
    if (type === 'photo') {
      this.botService.sendTestMessage('Por favor guarda esta foto del viaje');
    } else if (type === 'message') {
      this.botService.sendTestMessage('Hola bot, ¿qué comandos están disponibles?');
    } else if (type === 'unauthorized') {
      this.botService.sendTestMessage('Hola, soy un número desconocido', '+5215599008877');
    }
  }
}
