import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-sidebar',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="w-64 bg-[#060911]/60 backdrop-blur-3xl border-r border-white/5 flex flex-col justify-between shrink-0 select-none h-full min-h-screen">
      <!-- Top Brand Section -->
      <div>
        <div class="p-6 flex items-center gap-3.5 border-b border-white/5">
          <!-- WhatsApp Bot Icon with Radiant Aurora Aura -->
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/25 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] shrink-0">
            <mat-icon class="text-xl">chat</mat-icon>
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-bold text-white tracking-tight truncate leading-tight">Fernet WhatsApp</h1>
            <p class="text-[11px] text-emerald-400/80 font-medium truncate mt-0.5">Control Inteligente</p>
          </div>
        </div>

        <!-- Navigation Menu with Fluid Glass Pills -->
        <nav class="p-4 space-y-2" aria-label="Navegación principal">
          <button
            type="button"
            (click)="botService.activeScreen.set('inicio')"
            [class]="botService.activeScreen() === 'inicio' 
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all text-left shadow-[0_0_25px_rgba(16,185,129,0.25)]'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium text-xs transition-all text-left'"
          >
            <mat-icon class="text-lg">space_dashboard</mat-icon>
            <span>Inicio</span>
          </button>

          <button
            type="button"
            (click)="botService.activeScreen.set('logs')"
            [class]="botService.activeScreen() === 'logs' 
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all text-left shadow-[0_0_25px_rgba(16,185,129,0.25)]'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium text-xs transition-all text-left'"
          >
            <mat-icon class="text-lg">terminal</mat-icon>
            <span>Logs en vivo</span>
          </button>

          <button
            type="button"
            (click)="botService.activeScreen.set('imagenes')"
            [class]="botService.activeScreen() === 'imagenes' 
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30 text-purple-300 font-semibold text-xs transition-all text-left shadow-[0_0_25px_rgba(168,85,247,0.25)]'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium text-xs transition-all text-left'"
          >
            <mat-icon class="text-lg">burst_mode</mat-icon>
            <span>Imágenes</span>
            <span class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono">
              {{ botService.savedImagesCount() }}
            </span>
          </button>

          <button
            type="button"
            (click)="botService.activeScreen.set('contactos')"
            [class]="botService.activeScreen() === 'contactos' 
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-blue-300 font-semibold text-xs transition-all text-left shadow-[0_0_25px_rgba(59,130,246,0.25)]'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium text-xs transition-all text-left'"
          >
            <mat-icon class="text-lg">group_work</mat-icon>
            <span>Contactos</span>
            <span class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono">
              {{ botService.authorizedContactsCount() }}
            </span>
          </button>

          <button
            type="button"
            (click)="botService.activeScreen.set('configuracion')"
            [class]="botService.activeScreen() === 'configuracion' 
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all text-left shadow-[0_0_25px_rgba(16,185,129,0.25)]'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium text-xs transition-all text-left'"
          >
            <mat-icon class="text-lg">tune</mat-icon>
            <span>Configuración</span>
          </button>
        </nav>

        <!-- QR Quick Action Button -->
        <div class="px-4 pt-2">
          <button
            type="button"
            (click)="botService.openQrModal()"
            class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            [class]="botService.status() === 'active' 
              ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 text-slate-300' 
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse'"
          >
            <div class="flex items-center gap-2.5">
              <mat-icon class="text-base">qr_code_scanner</mat-icon>
              <span>{{ botService.status() === 'active' ? 'Código QR' : 'Vincular WhatsApp' }}</span>
            </div>
            @if (botService.status() !== 'active') {
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            }
          </button>
        </div>
      </div>

      <!-- Bottom Status & Version with Soft Light -->
      <div class="p-6 border-t border-white/5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span 
              class="w-2.5 h-2.5 rounded-full shrink-0"
              [class]="botService.status() === 'active' ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]' : (botService.status() === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500')"
            ></span>
            <span class="text-xs font-semibold text-slate-300">
              @if (botService.status() === 'active') { Sistema en línea }
              @else if (botService.status() === 'connecting') { Conectando... }
              @else { Bot inactivo }
            </span>
          </div>
          <span class="text-[11px] text-slate-500 font-mono">v2.0</span>
        </div>
      </div>
    </aside>
  `
})
export class Sidebar {
  readonly botService = inject(BotService);
}
