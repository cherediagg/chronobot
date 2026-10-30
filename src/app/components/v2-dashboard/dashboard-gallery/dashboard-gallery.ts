import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SavedImage } from '../../../models/bot.model';

@Component({
  selector: 'app-dashboard-gallery',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-gallery.html'
})
export class DashboardGallery {
  readonly images = input.required<SavedImage[]>();
  readonly totalImagesCount = input.required<number>();

  readonly openImage = output<SavedImage>();
  readonly viewAllImages = output<void>();
}
