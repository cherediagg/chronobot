import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../../models/bot.model';

@Component({
  selector: 'app-media-ribbon',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-ribbon.html'
})
export class MediaRibbon {
  readonly images = input.required<SavedImage[]>();
  readonly totalImagesCount = input.required<number>();

  readonly openImage = output<SavedImage>();
  readonly viewAllImages = output<void>();
}
