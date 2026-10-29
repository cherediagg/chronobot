import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-settings-view',
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
            <span class="text-emerald-400 font-medium">Configuración</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Ajustes del Motor y Red
          </h1>
          <p class="text-sm text-slate-400">
            Control de sesión WhatsApp Baileys, directivas de persistencia en disco y automatización de respuestas.
          </p>
        </div>

        @if (savedToast()) {
          <div class="px-5 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
            <mat-icon class="text-base">check_circle</mat-icon>
            <span>Configuración persistida con éxito</span>
          </div>
        }
      </div>

      <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()" class="space-y-8">
        <!-- 1. General & Session Configuration (Fluid Glass Zone) -->
        <section class="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-6">
          <div class="flex items-center gap-3 text-slate-200 pb-4 border-b border-white/5">
            <div class="w-9 h-9 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <mat-icon class="text-lg">tune</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-tight">Instancia del Bot y Sesión</h2>
              <p class="text-xs text-slate-400">Parámetros de autenticación del socket</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label for="cfg-bot-name" class="block text-xs font-semibold text-slate-300 mb-1.5">Nombre del bot</label>
              <input
                id="cfg-bot-name"
                type="text"
                formControlName="botName"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 font-sans"
              />
            </div>

            <div>
              <label for="cfg-session-name" class="block text-xs font-semibold text-slate-300 mb-1.5">ID de Sesión (Baileys Auth Storage)</label>
              <input
                id="cfg-session-name"
                type="text"
                formControlName="sessionName"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label for="cfg-prefix" class="block text-xs font-semibold text-slate-300 mb-1.5">Prefijo de comandos</label>
              <input
                id="cfg-prefix"
                type="text"
                formControlName="prefix"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label for="cfg-max-size" class="block text-xs font-semibold text-slate-300 mb-1.5">Límite de tamaño por archivo (MB)</label>
              <input
                id="cfg-max-size"
                type="number"
                formControlName="maxImageSizeMb"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </section>

        <!-- 2. Storage Directory Configuration (Fluid Glass Zone) -->
        <section class="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-6">
          <div class="flex items-center gap-3 text-slate-200 pb-4 border-b border-white/5">
            <div class="w-9 h-9 rounded-2xl bg-teal-500/15 flex items-center justify-center text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.25)]">
              <mat-icon class="text-lg">folder_open</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-tight">Directorio de Almacenamiento</h2>
              <p class="text-xs text-slate-400">Rutas de guardado físico en el servidor</p>
            </div>
          </div>

          <div>
            <label for="cfg-save-dir" class="block text-xs font-semibold text-slate-300 mb-1.5">Ruta base de imágenes en el servidor</label>
            <input
              id="cfg-save-dir"
              type="text"
              formControlName="saveDirectory"
              class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-teal-300 font-mono focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
            />
            <p class="text-[11px] text-slate-400 mt-2 font-mono">
              Estructura destino: <span class="text-teal-300">/imagenes/[Nombre de Contacto]/[Mes]/[Fecha]_[Hash].jpg</span>
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <label class="flex items-center gap-3.5 p-4 rounded-2xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <input
                type="checkbox"
                formControlName="groupFolderByContact"
                class="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-black/40"
              />
              <span class="text-xs text-slate-200 font-medium select-none">Crear subcarpeta automática por contacto</span>
            </label>

            <label class="flex items-center gap-3.5 p-4 rounded-2xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <input
                type="checkbox"
                formControlName="groupFolderByMonth"
                class="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-black/40"
              />
              <span class="text-xs text-slate-200 font-medium select-none">Crear subcarpeta mensual (ej. /abril/)</span>
            </label>
          </div>
        </section>

        <!-- 3. Automated Messages & Security (Fluid Glass Zone) -->
        <section class="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-6">
          <div class="flex items-center gap-3 text-slate-200 pb-4 border-b border-white/5">
            <div class="w-9 h-9 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
              <mat-icon class="text-lg">forum</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-tight">Respuestas Automáticas y Seguridad</h2>
              <p class="text-xs text-slate-400">Notificaciones directas y control de acceso</p>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 rounded-2xl bg-black/30 border border-white/5">
            <div>
              <h3 class="text-xs font-bold text-white">Activar respuestas automáticas por WhatsApp</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Enviar confirmación de recepción cuando una imagen es descargada con éxito.</p>
            </div>
            <button
              type="button"
              role="switch"
              [attr.aria-checked]="settingsForm.get('autoReplyEnabled')?.value"
              (click)="toggleAutoReply()"
              class="w-12 h-6 rounded-full transition-colors relative inline-block align-middle focus:outline-none shrink-0"
              [class]="settingsForm.get('autoReplyEnabled')?.value ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-white/10'"
            >
              <span
                class="block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md"
                [class]="settingsForm.get('autoReplyEnabled')?.value ? 'translate-x-6' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label for="cfg-welcome-msg" class="block text-xs font-semibold text-slate-300 mb-1.5">Mensaje de confirmación de imagen guardada</label>
              <textarea
                id="cfg-welcome-msg"
                rows="2"
                formControlName="welcomeMessage"
                class="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 font-sans"
              ></textarea>
            </div>

            <div>
              <label for="cfg-unauth-msg" class="block text-xs font-semibold text-slate-300 mb-1.5">Mensaje para números no autorizados</label>
              <textarea
                id="cfg-unauth-msg"
                rows="2"
                formControlName="unauthorizedMessage"
                class="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 font-sans"
              ></textarea>
            </div>
          </div>
        </section>

        <!-- Save Button Deck -->
        <div class="flex justify-end pt-2">
          <button
            type="submit"
            class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center gap-2"
          >
            <mat-icon class="text-base">save</mat-icon>
            <span>Guardar cambios</span>
          </button>
        </div>
      </form>
    </div>
  `
})
export class SettingsView {
  readonly botService = inject(BotService);
  readonly savedToast = signal<boolean>(false);

  readonly currentConfig = this.botService.config();

  readonly settingsForm = new FormGroup({
    botName: new FormControl(this.currentConfig.botName, { nonNullable: true }),
    sessionName: new FormControl(this.currentConfig.sessionName, { nonNullable: true }),
    prefix: new FormControl(this.currentConfig.prefix, { nonNullable: true }),
    saveDirectory: new FormControl(this.currentConfig.saveDirectory, { nonNullable: true }),
    groupFolderByContact: new FormControl(this.currentConfig.groupFolderByContact, { nonNullable: true }),
    groupFolderByMonth: new FormControl(this.currentConfig.groupFolderByMonth, { nonNullable: true }),
    maxImageSizeMb: new FormControl(this.currentConfig.maxImageSizeMb, { nonNullable: true }),
    autoReplyEnabled: new FormControl(this.currentConfig.autoReplyEnabled, { nonNullable: true }),
    welcomeMessage: new FormControl(this.currentConfig.welcomeMessage, { nonNullable: true }),
    unauthorizedMessage: new FormControl(this.currentConfig.unauthorizedMessage, { nonNullable: true })
  });

  toggleAutoReply() {
    const cur = this.settingsForm.get('autoReplyEnabled')?.value ?? false;
    this.settingsForm.get('autoReplyEnabled')?.setValue(!cur);
  }

  saveSettings() {
    const val = this.settingsForm.getRawValue();
    this.botService.updateConfig(val);
    this.savedToast.set(true);
    setTimeout(() => {
      this.savedToast.set(false);
    }, 3000);
  }
}
