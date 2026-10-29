import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Contact } from '../../../models/bot.model';

@Component({
  selector: 'app-contact-delete-modal',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-delete-modal.html'
})
export class ContactDeleteModal {
  readonly contact = input<Contact | null>(null);

  readonly cancel = output<void>();
  readonly confirm = output<Contact>();
}
