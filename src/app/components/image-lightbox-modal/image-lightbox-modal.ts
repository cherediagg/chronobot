import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../models/bot.model';

@Component({
  selector: 'app-image-lightbox-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-lightbox-modal.html'
})
export class ImageLightboxModal {
  readonly image = input<SavedImage | null>(null);
  readonly closeModal = output<void>();
}
