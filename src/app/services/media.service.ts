import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { SavedImage } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly http = inject(HttpClient);

  readonly savedImages = signal<SavedImage[]>([]);

  constructor() {
    this.fetchImages();
    setInterval(() => {
      this.fetchImages();
    }, 5000);
  }

  fetchImages() {
    this.http.get<SavedImage[]>('/api/bot/images').subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.savedImages.set(res);
        } else if (res && Array.isArray(res.images)) {
          this.savedImages.set(res.images);
        } else {
          this.savedImages.set([]);
        }
      },
      error: () => {}
    });
  }

  readonly savedImagesCount = computed(() => this.savedImages().length);

  deleteImage(id: string) {
    this.http.delete(`/api/bot/images/${id}`).subscribe({
      next: () => this.fetchImages(),
      error: (err: any) => console.error('Error deleting image:', err)
    });
  }
}
