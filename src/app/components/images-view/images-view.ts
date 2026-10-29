import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../models/bot.model';
import { BotService } from '../../services/bot.service';
import { ImageLightboxModal } from '../image-lightbox-modal/image-lightbox-modal';

@Component({
  selector: 'app-images-view',
  imports: [CommonModule, MatIconModule, ImageLightboxModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './images-view.html'
})
export class ImagesView {
  private readonly botService = inject(BotService);

  readonly savedImages = this.botService.savedImages;
  readonly searchQuery = signal<string>('');
  readonly selectedImage = signal<SavedImage | null>(null);

  readonly filteredImages = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.savedImages();
    return this.savedImages().filter(img =>
      img.filename.toLowerCase().includes(q) ||
      img.senderName.toLowerCase().includes(q)
    );
  });

  readonly totalStorageSize = computed(() => {
    const totalCount = this.savedImages().length;
    return `${totalCount} imágenes`;
  });

  onSearchChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  openLightbox(img: SavedImage) {
    this.selectedImage.set(img);
  }

  closeLightbox() {
    this.selectedImage.set(null);
  }

  deleteImage(filename: string) {
    this.botService.deleteImage(filename);
  }
}
