import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-whatsapp-qr',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="relative rounded-3xl overflow-hidden transition-all duration-500 backdrop-blur-3xl border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-6 sm:p-8 bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-black/60"
    >
      <!-- Volumetric Ambient Auroras behind QR -->
      <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none"></div>
      <div class="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-teal-500/10 blur-[90px] pointer-events-none"></div>

      <!-- Top Header / Context -->
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/30 to-teal-400/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)] shrink-0">
            <mat-icon class="text-2xl">qr_code_scanner</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-white tracking-tight">Vincular WhatsApp Web</h2>
              <span 
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
                [class]="botService.status() === 'active' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : (botService.status() === 'stopped' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse')"
              >
                {{ botService.status() === 'active' ? 'Conectado' : (botService.status() === 'stopped' ? 'Bot Apagado' : 'Esperando escaneo') }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Protocolo ChronoBot WhatsApp con escaneo de código QR
            </p>
          </div>
        </div>

      </div>

      <!-- Main Body: QR Graphic + Guided Instructions -->
      <div class="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-6">
        
        <!-- LEFT: Holographic QR Container (Span 5) -->
        <div class="md:col-span-5 flex flex-col items-center">
          <div class="relative group p-4 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
            
            <!-- Animated Radial Aura Ring -->
            <div 
              class="absolute -inset-1 rounded-[28px] opacity-75 blur-md transition duration-1000 group-hover:opacity-100"
              [class]="botService.status() === 'active' 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                : 'bg-gradient-to-r from-emerald-500 via-teal-300 to-cyan-500 animate-pulse'"
            ></div>

            <!-- Crisp QR Canvas/Image Box -->
            <div class="relative z-10 w-60 h-60 sm:w-64 sm:h-64 rounded-2xl bg-white p-3.5 flex items-center justify-center shadow-inner overflow-hidden">
              @if (qrImageSrc()) {
                <img 
                  [src]="qrImageSrc()" 
                  alt="Código QR de WhatsApp Web" 
                  class="w-full h-full object-contain select-none"
                />
              } @else {
                <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 text-center">
                  @if (botService.status() === 'stopped' || botService.status() === 'disconnected') {
                    <mat-icon class="text-4xl text-rose-300 mb-2">cloud_off</mat-icon>
                    <span class="text-xs text-slate-300">
                      {{ connectionError() || 'WhatsApp Web no está conectado. El cliente se iniciará automáticamente.' }}
                    </span>
                  } @else {
                    <mat-icon class="text-4xl text-emerald-400 animate-spin mb-2">sync</mat-icon>
                    <span class="text-xs text-slate-300">
                      {{ botService.status() === 'waiting_qr' ? 'Esperando el QR real de WhatsApp Web...' : 'Conectando con WhatsApp Web; el QR aparecerá cuando WhatsApp lo envíe.' }}
                    </span>
                  }
                </div>
              }

              <!-- Connected Overlay if already active -->
              @if (botService.status() === 'active') {
                <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 transition-all">
                  <div class="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                    <mat-icon class="text-3xl">check_circle</mat-icon>
                  </div>
                  <h3 class="text-sm font-bold text-white">Dispositivo Vinculado</h3>
                  <p class="text-xs text-emerald-400 font-mono mt-0.5">{{ botService.qrData().connectedPhone || 'Sesión activa' }}</p>
                  <span class="text-[11px] text-slate-400 mt-1">Sincronizado correctamente</span>
                </div>
              }
            </div>
          </div>

          <!-- Connection status -->
          <div class="w-full max-w-[260px] mt-4 space-y-1.5 text-center">
            @if (botService.status() !== 'active') {
              <span class="text-xs text-slate-400">
                {{ botService.qrData().dataUrl ? 'QR de WhatsApp Web listo para escanear.' : 'Esperando el QR de WhatsApp Web.' }}
              </span>
            } @else {
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                Socket ChronoBot conectado · Listo
              </div>
            }
          </div>
        </div>

        <!-- RIGHT: Step-by-Step Instructions & Interactive Controls (Span 7) -->
        <div class="md:col-span-7 space-y-6">
          <div>
            <h3 class="text-base font-bold text-white mb-1">
              Pasos para conectar tu WhatsApp:
            </h3>
            <p class="text-xs text-slate-400">
              Sigue las instrucciones oficiales de WhatsApp Web para sincronizar tu teléfono con este servidor Node.js:
            </p>
          </div>

          <!-- Step Cards -->
          <ol class="space-y-3" aria-label="Instrucciones de vinculación">
            <li class="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 transition-colors hover:bg-white/[0.05]">
              <span class="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                1
              </span>
              <div class="text-xs text-slate-300 leading-relaxed">
                Abre la aplicación <strong class="text-white font-semibold">WhatsApp</strong> en tu teléfono móvil personal o corporativo.
              </div>
            </li>

            <li class="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 transition-colors hover:bg-white/[0.05]">
              <span class="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                2
              </span>
              <div class="text-xs text-slate-300 leading-relaxed">
                Toca <strong class="text-white font-semibold">Menú ⋮</strong> (Android) o <strong class="text-white font-semibold">Ajustes ⚙</strong> (iPhone) y selecciona <strong class="text-emerald-300 font-semibold">Dispositivos vinculados</strong>.
              </div>
            </li>

            <li class="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 transition-colors hover:bg-white/[0.05]">
              <span class="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                3
              </span>
              <div class="text-xs text-slate-300 leading-relaxed">
                Pulsa en <strong class="text-white font-semibold">Vincular un dispositivo</strong> y apunta la cámara de tu teléfono hacia este código QR.
              </div>
            </li>
          </ol>

          <div class="pt-2 flex flex-wrap items-center gap-3">
            @if (botService.status() !== 'active') {
              <button
                type="button"
                (click)="botService.regenerateQr()"
                class="px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <mat-icon class="text-base">refresh</mat-icon>
                <span>Regenerar QR</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="botService.disconnectWhatsApp()"
                class="px-4 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <mat-icon class="text-base">link_off</mat-icon>
                <span>Desconectar sesión</span>
              </button>
            }
          </div>
        </div>

      </div>

    </div>
  `
})
export class WhatsappQr {
  readonly botService = inject(BotService);

  readonly connectionError = computed(() => this.botService.logs()
    .slice()
    .reverse()
    .find(log => log.level === 'ERROR' || log.text.includes('Ya existe una sesión abierta'))?.text || '');

  readonly qrImageSrc = computed(() => {
    return this.botService.qrData().dataUrl;
  });
}
