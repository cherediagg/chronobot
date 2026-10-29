import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-raw-json-modal',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './raw-json-modal.html'
})
export class RawJsonModal {
  readonly jsonContent = input<string>('[]');
  readonly closeModal = output<void>();
}
