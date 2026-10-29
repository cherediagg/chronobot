import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../../services/bot.service';
import { SavedImage } from '../../../models/bot.model';

@Component({
  selector: 'app-media-ribbon',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4" aria-label="Galería fluida de imágenes capturadas">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            <mat-icon class="text-base">photo_library</mat-icon>
          </div>
          <div>
            <h2 class="text-lg font-bold text-white tracking-tight">Stream de Medios Guardados</h2>
            <p class="text-xs text-slate-400">Capturas organizadas por remitente y almacenadas automáticamente en /imagenes</p>
          </div>
        </div>

        <button
          type="button"
          (click)="navigateToImages()"
          class="text-xs font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver todas ({{ botService.savedImagesCount() }})</span>
          <mat-icon class="text-sm">arrow_forward</mat-icon>
        </button>
      </div>

      <!-- Horizontal Flowing Photo Ribbon -->
      @if (botService.firstFiveImages().length === 0) {
        <div class="p-8 rounded-3xl bg-white/[0.02] border border-white/5 text-center text-slate-400 space-y-1.5">
          <mat-icon class="text-3xl text-slate-600 mb-1">photo_library</mat-icon>
          <p class="text-sm font-semibold text-slate-300">No hay imágenes almacenadas aún</p>
          <p class="text-xs text-slate-500">Las fotos enviadas por contactos autorizados en WhatsApp se guardarán automáticamente en disco.</p>
        </div>
      } @else {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          @for (img of botService.firstFiveImages(); track img.id) {
            <button
              type="button"
              (click)="selectImage.emit(img)"
              class="group relative rounded-3xl overflow-hidden aspect-[4/5] bg-slate-900 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(168,85,247,0.25)] text-left cursor-pointer focus:outline-none"
            >
              <img
                [src]="img.imageUrl"
                [alt]="img.filename"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />

              <!-- Gradient Scrim overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4 transition-all">
                <span class="text-[10px] text-purple-300 font-mono tracking-wider uppercase mb-1">{{ img.category || 'WhatsApp Media' }}</span>
                <h3 class="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                  {{ img.senderName }}
                </h3>
                <p class="text-[11px] text-slate-300 font-mono mt-0.5 opacity-80">
                  {{ img.timeFormatted }} · {{ img.size }}
                </p>
              </div>
            </button>
          }
        </div>
      }
    </section>
  `
})
export class MediaRibbon {
  readonly botService = inject(BotService);
  readonly selectImage = output<SavedImage>();

  navigateToImages() {
    this.botService.activeScreen.set('imagenes');
  }
}
