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

          <div class="p-5 bg-black/40 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Ruta del archivo:</span>
              <span class="text-teal-400 font-mono text-[11px] select-all break-all">{{ img.path }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Resolución & Peso:</span>
              <span class="text-slate-200 font-mono">{{ img.dimensions }} · {{ img.size }}</span>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ImageLightboxModal {
  readonly image = input<SavedImage | null>(null);
  readonly closeModal = output<void>();
}
