import { Injectable, signal, computed, inject } from '@angular/core';
import { SavedImage } from '../models/bot.model';
import { LogsService } from './logs.service';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly logsService = inject(LogsService);

  readonly savedImages = signal<SavedImage[]>([]);

  readonly savedImagesCount = computed(() => {
    return this.savedImages().length;
  });

  readonly totalImagesVolumeFormatted = computed(() => {
    let totalBytes = 0;
    for (const img of this.savedImages()) {
      if (img.size.includes('MB')) {
        totalBytes += parseFloat(img.size) * 1024 * 1024;
      } else if (img.size.includes('KB')) {
        totalBytes += parseFloat(img.size) * 1024;
      }
    }
    if (totalBytes >= 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(totalBytes / 1024).toFixed(1)} KB`;
  });

  readonly firstFiveImages = computed(() => {
    return this.savedImages().slice(0, 5);
  });

  async deleteImage(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/bot/images/${id}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logsService.addLog('ERROR', `Error al eliminar archivo de imagen del servidor: ${msg}`);
      return false;
    }
  }
}
