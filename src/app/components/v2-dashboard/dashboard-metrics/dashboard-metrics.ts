import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../../services/bot.service';

@Component({
  selector: 'app-dashboard-metrics',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-10" aria-label="Métricas del sistema">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/5 relative overflow-hidden">
        <!-- Glow ambient overlay -->
        <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-transparent pointer-events-none"></div>

        <!-- Item 1: Estado del Bot -->
        <div class="relative z-10 flex items-center gap-4">
          <div class="relative flex items-center justify-center shrink-0">
            <button
              type="button"
              (click)="toggleBot()"
              [disabled]="botService.status() === 'connecting'"
              [attr.aria-label]="botService.status() === 'active' ? 'Apagar bot' : 'Iniciar bot'"
              [attr.title]="botService.status() === 'active' ? 'Apagar bot' : (botService.status() === 'connecting' ? 'Conectando...' : 'Iniciar bot')"
              class="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 enabled:cursor-pointer enabled:hover:scale-105 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-4 enabled:focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-70"
              [class]="botService.status() === 'active' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)]' : (botService.status() === 'connecting' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-400')"
            >
              <mat-icon class="text-2xl" [class.animate-pulse]="botService.status() === 'active'" aria-hidden="true">wifi_tethering</mat-icon>
            </button>
            <span
              class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#090d16]"
              [class]="botService.status() === 'active' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]' : (botService.status() === 'connecting' ? 'bg-amber-400 animate-ping' : 'bg-rose-500')"
            ></span>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Estado del bot</span>
            <h2 class="text-2xl font-black tracking-tight" [class]="botService.status() === 'active' ? 'text-emerald-400' : 'text-slate-100'">
              @if (botService.status() === 'active') { Activo }
              @else if (botService.status() === 'connecting') { Conectando }
              @else { Inactivo }
            </h2>
            <span class="text-xs text-slate-400 font-medium">WhatsApp Socket</span>
          </div>
        </div>

        <!-- Item 2: Contactos Autorizados -->
        <button
          type="button"
          (click)="navigateToContacts()"
          class="relative z-10 flex items-center gap-4 text-left group cursor-pointer focus:outline-none"
        >
          <div class="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
            <mat-icon class="text-2xl">group_work</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block group-hover:text-blue-300 transition-colors">Lista Blanca</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.authorizedContactsCount() }}
              <span class="text-xs font-normal text-slate-400 font-sans">contactos</span>
            </h2>
            <span class="text-xs text-blue-400/80 group-hover:underline">Gestionar acceso &rarr;</span>
          </div>
        </button>

        <!-- Item 3: Galería Ingerida -->
        <button
          type="button"
          (click)="navigateToImages()"
          class="relative z-10 flex items-center gap-4 text-left group cursor-pointer focus:outline-none"
        >
          <div class="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
            <mat-icon class="text-2xl">burst_mode</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block group-hover:text-purple-300 transition-colors">Imágenes Guardadas</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.savedImagesCount() }}
              <span class="text-xs font-normal text-slate-400 font-sans">archivos</span>
            </h2>
            <span class="text-xs text-purple-400/80 group-hover:underline">Abrir galería &rarr;</span>
          </div>
        </button>

        <!-- Item 4: Uptime Continuo -->
        <div class="relative z-10 flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(6,182,212,0.3)]">
            <mat-icon class="text-2xl">hourglass_top</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Tiempo en Línea</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.formattedUptime() }}
            </h2>
            <span class="text-xs text-slate-400">Ciclo activo</span>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DashboardMetrics {
  readonly botService = inject(BotService);

  toggleBot() {
    if (this.botService.status() === 'active') {
      void this.botService.stopBot();
    } else if (this.botService.status() !== 'connecting') {
      void this.botService.startBot();
    }
  }

  navigateToImages() {
    this.botService.activeScreen.set('imagenes');
  }

  navigateToContacts() {
    this.botService.activeScreen.set('contactos');
  }
}
