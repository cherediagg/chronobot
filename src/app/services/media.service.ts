import { Injectable, computed, inject, signal } from '@angular/core';
import { SavedImage } from '../models/bot.model';
import { BotApiClient } from './bot-api.client';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly api = inject(BotApiClient);

  readonly savedImages = signal<SavedImage[]>([]);
  readonly savedImagesCount = computed(() => this.savedImages().length);
  readonly firstFiveImages = computed(() => this.savedImages().slice(0, 5));
  readonly totalImagesVolumeFormatted = computed(() => {
    const totalBytes = this.savedImages().reduce((total, image) => {
      const size = Number.parseFloat(image.size);
      if (!Number.isFinite(size)) return total;
      if (image.size.includes('MB')) return total + size * 1024 * 1024;
      if (image.size.includes('KB')) return total + size * 1024;
      return total;
    }, 0);

    return totalBytes >= 1024 * 1024
      ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(totalBytes / 1024).toFixed(1)} KB`;
  });

  async refresh() {
    this.savedImages.set((await this.api.getImages()).images);
  }

  async delete(id: string) {
    await this.api.deleteImage(id);
    await this.refresh();
  }
}
