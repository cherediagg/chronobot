import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { SavedImage } from '../../models/bot.model';

@Component({
  selector: 'app-images-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 sm:p-10 space-y-8 max-w-[1600px] mx-auto select-none font-sans">
      <!-- Header with Gradient Typography -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div class="space-y-1.5">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-200">
            Stream de Imágenes Ingeridas
          </h1>
          <p class="text-sm text-slate-400">
            Fotografías sincronizadas y categorizadas automáticamente en almacenamiento local sin compresión destructiva.
          </p>
        </div>

      </div>

      <!-- Fluid Telemetry Wave (Zero Box Borders) -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" aria-label="Métricas de multimedia">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
            <mat-icon class="text-2xl">burst_mode</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Total Ingeridas</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.savedImagesCount() }}
              <span class="text-xs font-normal text-slate-400 font-sans">fotografías</span>
            </h2>
            <span class="text-xs text-purple-400/80">Archivos sincronizados</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(20,184,166,0.3)]">
            <mat-icon class="text-2xl">folder_special</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Ruta Raíz</span>
            <h3 class="text-sm font-bold text-teal-300 font-mono mt-0.5 truncate max-w-[200px]">
              /imagenes/[Contacto]/[Mes]
            </h3>
            <span class="text-xs text-slate-400">Indexación jerárquica</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
            <mat-icon class="text-2xl">sd_card</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Volumen en Disco</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.totalImagesVolumeFormatted() }}
            </h2>
            <span class="text-xs text-slate-400">Archivos reales en disco</span>
          </div>
        </div>
      </section>

      <!-- Filters & Search Toolbar (Fluid Glass Ribbon) -->
      <div class="p-4 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- Contact sender filter pills -->
        <div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span class="text-xs text-slate-400 shrink-0 font-medium px-1">Remitente:</span>
          @for (contact of uniqueSenders(); track contact) {
            <button
              type="button"
              (click)="selectedSender.set(contact)"
              class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
              [class]="selectedSender() === contact 
                ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/20 text-purple-200 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                : 'bg-white/[0.02] text-slate-400 hover:text-white'"
            >
              {{ contact }}
            </button>
          }
        </div>

        <!-- Search input -->
        <div class="relative w-full md:w-80">
          <mat-icon class="text-slate-500 text-base absolute left-3.5 top-2.5 pointer-events-none">search</mat-icon>
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Buscar por archivo, ruta o remitente..."
            class="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-sans"
          />
        </div>
      </div>

      <!-- Cinematic Borderless Photo Grid -->
      @if (filteredImages().length === 0) {
        <div class="p-16 rounded-3xl bg-white/[0.02] backdrop-blur-2xl border border-white/5 text-center text-slate-400 space-y-2">
          <mat-icon class="text-4xl text-slate-600 mb-1">image_not_supported</mat-icon>
          <h3 class="text-base font-bold text-white">No se encontraron fotografías</h3>
          <p class="text-xs">Prueba seleccionando otro remitente o limpiando los términos de búsqueda.</p>
        </div>
      } @else {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          @for (img of filteredImages(); track img.id) {
            <div
              role="button"
              tabindex="0"
              (click)="openModal(img)"
              (keydown.enter)="openModal(img)"
              class="group relative rounded-3xl overflow-hidden aspect-[4/5] bg-slate-900 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(168,85,247,0.3)] text-left cursor-pointer focus:outline-none"
            >
              <img
                [src]="img.imageUrl"
                [alt]="img.filename"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />

              <!-- Gradient Scrim overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex flex-col justify-end p-4 transition-all">
                <span class="text-[10px] text-purple-300 font-mono tracking-wider uppercase mb-1">
                  {{ img.category || 'WhatsApp Media' }}
                </span>
                <h3 class="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                  {{ img.senderName }}
                </h3>
                <p class="text-[11px] text-slate-300 font-mono mt-0.5 opacity-80">
                  {{ img.dateFormatted }} · {{ img.timeFormatted }}
                </p>

                <!-- Floating Micro-Actions on Hover -->
                <div class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-[10px] font-mono text-purple-300">{{ img.size }}</span>
                  <button
                    type="button"
                    (click)="deleteImage($event, img.id)"
                    title="Eliminar archivo"
                    class="p-1.5 rounded-xl bg-black/60 hover:bg-rose-500/30 text-slate-300 hover:text-rose-300 transition-colors"
                  >
                    <mat-icon class="text-sm">delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Fluid Glass Lightbox Modal -->
    @if (modalImage(); as img) {
      <div 
        class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6"
        role="button"
        tabindex="0"
        aria-label="Cerrar modal"
        (click)="closeModal()"
        (keydown.escape)="closeModal()"
        (keydown.enter)="closeModal()"
      >
        <div 
          class="bg-[#0e1422]/90 border border-white/10 rounded-3xl max-w-3xl w-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
          role="dialog"
          tabindex="0"
          aria-modal="true"
          aria-label="Detalles de imagen"
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
              (click)="closeModal()"
              class="w-9 h-9 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>

          <div class="bg-black/95 max-h-[65vh] flex items-center justify-center p-3">
            <img [src]="img.imageUrl" [alt]="img.filename" class="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" />
          </div>

          <div class="p-5 bg-black/40 space-y-3 text-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span class="text-slate-400">Ruta física en servidor:</span>
              <span class="text-teal-400 font-mono text-[11px] select-all break-all">{{ img.path }}</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-300 pt-1">
              <div>
                <span class="text-slate-500 text-[11px] block">Recepción</span>
                <span class="font-mono font-semibold">{{ img.dateFormatted }} {{ img.timeFormatted }}</span>
              </div>
              <div>
                <span class="text-slate-500 text-[11px] block">Resolución nativa</span>
                <span class="font-mono font-semibold">{{ img.dimensions }}</span>
              </div>
              <div>
                <span class="text-slate-500 text-[11px] block">Tamaño de archivo</span>
                <span class="font-mono font-semibold">{{ img.size }}</span>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                (click)="deleteImage($event, img.id); closeModal()"
                class="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                <span>Descargar archivo</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ImagesView {
  readonly botService = inject(BotService);

  readonly selectedSender = signal<string>('Todos');
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly modalImage = signal<SavedImage | null>(null);

  readonly uniqueSenders = computed(() => {
    const list = this.botService.savedImages();
    const senders = new Set(list.map(i => i.senderName));
    return ['Todos', ...Array.from(senders)];
  });

  readonly filteredImages = computed(() => {
    const imgs = this.botService.savedImages();
    const sender = this.selectedSender();
    const query = this.searchControl.value.toLowerCase().trim();

    return imgs.filter(img => {
      const matchSender = sender === 'Todos' || img.senderName === sender;
      const matchQuery = !query || img.filename.toLowerCase().includes(query) || img.path.toLowerCase().includes(query) || img.senderName.toLowerCase().includes(query);
      return matchSender && matchQuery;
    });
  });

  openModal(img: SavedImage) {
    this.modalImage.set(img);
  }

  closeModal() {
    this.modalImage.set(null);
  }

  deleteImage(event: Event, id: string) {
    event.stopPropagation();
    this.botService.deleteImage(id);
  }

}
