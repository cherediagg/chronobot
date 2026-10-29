import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, effect, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-terminal-console',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/40 backdrop-blur-3xl shadow-[0_30px_70px_rgba(0,0,0,0.6)] border border-white/5 relative overflow-hidden">
      <!-- Header of Terminal -->
      <div class="flex items-center justify-between pb-4 border-b border-white/5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <mat-icon class="text-base">terminal</mat-icon>
          </div>
          <div>
            <h2 class="text-sm font-bold text-white tracking-tight">{{ title() }}</h2>
            <p class="text-[11px] text-slate-400 font-mono">{{ subtitle() }}</p>
          </div>
        </div>

        <!-- Controls: Auto-scroll & Clear -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="botService.toggleAutoScroll()"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            [class]="botService.autoScroll()
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 text-slate-400 border border-white/5'"
          >
            <span class="w-2 h-2 rounded-full" [class]="botService.autoScroll() ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"></span>
            <span>Auto-scroll</span>
          </button>

          <button
            type="button"
            (click)="botService.clearLogs()"
            title="Limpiar registros"
            class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <mat-icon class="text-base">delete_sweep</mat-icon>
          </button>
        </div>
      </div>

      <!-- Log Body -->
      <div
        #terminalContainer
        class="my-4 font-mono text-xs text-slate-300 leading-relaxed overflow-y-auto pr-2 select-text space-y-1.5 scroll-smooth"
        [style.max-height]="maxHeight()"
      >
        @for (log of botService.logs(); track log.id) {
          <div class="flex flex-wrap items-baseline gap-x-3 py-1 px-2.5 rounded-xl transition-colors hover:bg-white/[0.04]">
            <span class="text-slate-500 shrink-0 tabular-nums text-[11px]">{{ log.time }}</span>
            <span
              class="font-bold text-[11px] shrink-0 px-2 py-0.5 rounded-md"
              [class]="log.level === 'INFO' ? 'bg-emerald-500/15 text-emerald-300' : (log.level === 'WARN' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300')"
            >
              {{ log.level }}
            </span>

            @if (log.isQr) {
              <div class="w-full pl-6 my-2">
                @if (botService.qrData().dataUrl && botService.status() === 'waiting_qr') {
                  <img
                    [src]="botService.qrData().dataUrl"
                    alt="Código QR vigente de WhatsApp Web"
                    class="w-44 h-44 rounded-xl bg-white p-2"
                  />
                } @else {
                  <span class="text-slate-400">
                    {{ botService.status() === 'active' ? 'Sesión de WhatsApp conectada.' : 'Esperando el código QR real de WhatsApp Web...' }}
                  </span>
                }
              </div>
            } @else {
              <span class="text-slate-200">
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
      </div>

      <div class="pt-3 border-t border-white/5 text-xs text-slate-400">
        Los mensajes entrantes y las imágenes adjuntas se procesan desde la sesión real de WhatsApp Web.
      </div>
    </div>
  `
})
export class TerminalConsole {
  readonly botService = inject(BotService);

  readonly title = input<string>('Consola de Ejecución');
  readonly subtitle = input<string>('Registro de actividad del Bot de Node.js');
  readonly maxHeight = input<string>('380px');

  @ViewChild('terminalContainer') private terminalContainer?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      this.botService.logs();
      const autoScroll = this.botService.autoScroll();
      if (autoScroll && this.terminalContainer?.nativeElement) {
        setTimeout(() => {
          if (this.terminalContainer?.nativeElement) {
            this.terminalContainer.nativeElement.scrollTop = this.terminalContainer.nativeElement.scrollHeight;
          }
        }, 50);
      }
    });
  }
}
