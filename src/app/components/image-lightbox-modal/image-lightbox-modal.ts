import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../models/bot.model';

@Component({
  selector: 'app-image-lightbox-modal',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (image(); as img) {
      <div
        class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6"
        role="button"
        tabindex="0"
        aria-label="Cerrar modal"
        (click)="closeModal.emit()"
        (keydown.escape)="closeModal.emit()"
        (keydown.enter)="closeModal.emit()"
      >
        <div
          class="bg-[#0e1422]/90 border border-white/10 rounded-3xl max-w-3xl w-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
          role="dialog"
          tabindex="0"
          aria-modal="true"
          aria-label="Vista previa de imagen ampliada"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <div class="p-5 border-b border-white/5 flex items-center justify-between">
            <div class="min-w-0 pr-4">
              <h3 class="text-base font-bold text-white truncate">{{ img.filename }}</h3>
              <p class="text-xs text-slate-400">Remitente: {{ img.senderName }} ({{ img.senderPhone }})</p>
            </div>
            <button
              type="button"
              (click)="closeModal.emit()"
              class="w-9 h-9 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>

          <div class="bg-black/90 max-h-[65vh] flex items-center justify-center p-3">
            <img [src]="img.imageUrl" [alt]="img.filename" class="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" />
          </div>

          <div class="p-5 bg-black/40 space-y-3 text-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span class="text-slate-400">Ruta del archivo:</span>
              <span class="text-teal-400 font-mono text-[11px] select-all break-all">{{ img.path }}</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-300 pt-1">
              <div>
                <span class="text-slate-500 text-[11px] block">Recepción</span>
                <span class="font-mono font-semibold">{{ img.dateFormatted }} {{ img.timeFormatted }}</span>
              </div>
              <div>
                <span class="text-slate-500 text-[11px] block">Resolución</span>
                <span class="font-mono font-semibold">{{ img.dimensions }}</span>
              </div>
              <div>
                <span class="text-slate-500 text-[11px] block">Tamaño</span>
                <span class="font-mono font-semibold">{{ img.size }}</span>
              </div>
            </div>

            @if (showActions()) {
              <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  (click)="deleteImage.emit(img.id); closeModal.emit()"
                  class="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <mat-icon class="text-sm">delete</mat-icon>
                  <span>Eliminar foto</span>
                </button>
                <a
                  [href]="img.imageUrl"
                  target="_blank"
                  download
                  class="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all"
                >
                  <mat-icon class="text-sm">download</mat-icon>
                  <span>Descargar</span>
                </a>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class ImageLightboxModal {
  readonly image = input<SavedImage | null>(null);
  readonly showActions = input<boolean>(false);
  readonly closeModal = output<void>();
  readonly deleteImage = output<string>();
}
