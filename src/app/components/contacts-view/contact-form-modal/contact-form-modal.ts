import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Contact } from '../../../models/bot.model';

@Component({
  selector: 'app-contact-form-modal',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-form-modal.html'
})
export class ContactFormModal {
  readonly isOpen = input<boolean>(false);
  readonly contactToEdit = input<Contact | null>(null);

  readonly closeModal = output<void>();
  readonly saveContact = output<{
    id?: string;
    name: string;
    phone: string;
    role: 'Admin' | 'Contacto Autorizado' | 'Usuario Estándar';
    notes: string;
    authorized: boolean;
  }>();

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('+52', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    role: new FormControl<'Admin' | 'Contacto Autorizado' | 'Usuario Estándar'>('Contacto Autorizado', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true })
  });

  constructor() {
    effect(() => {
      const contact = this.contactToEdit();
      if (contact) {
        this.form.setValue({
          name: contact.name,
          phone: contact.phone,
          role: contact.role,
          notes: contact.notes || '',
          authorized: contact.authorized
        });
      } else {
        this.form.reset({
          name: '',
          phone: '+52',
          role: 'Contacto Autorizado',
          notes: '',
          authorized: true
        });
      }
    });
  }

  submitForm() {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saveContact.emit({
      id: this.contactToEdit()?.id,
      ...val
    });
  }
}
