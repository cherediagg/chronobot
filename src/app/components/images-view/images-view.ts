import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { SavedImage } from '../../models/bot.model';

@Component({
  selector: 'app-images-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './images-view.html'
})
export class ImagesView {
  readonly botService = inject(BotService);

  readonly selectedSender = signal<string>('Todos');
  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchQuery = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });
  readonly modalImage = signal<SavedImage | null>(null);

  readonly uniqueSenders = computed(() => {
    const list = this.botService.savedImages();
    const senders = new Set(list.map(i => i.senderName));
    return ['Todos', ...Array.from(senders)];
  });

  readonly filteredImages = computed(() => {
    const imgs = this.botService.savedImages();
    const sender = this.selectedSender();
    const query = this.searchQuery().toLowerCase().trim();

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
