import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { Contact } from '../../models/bot.model';

@Component({
  selector: 'app-contacts-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contacts-view.html'
})
export class ContactsView {
  readonly botService = inject(BotService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchQuery = toSignal(this.searchControl.valueChanges, { initialValue: this.searchControl.value });
  readonly showAddModal = signal<boolean>(false);
  readonly showEditModal = signal<boolean>(false);
  readonly contactToDelete = signal<Contact | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly contactForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('+34', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    notes: new FormControl('', { nonNullable: true })
  });

  readonly editForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    notes: new FormControl('', { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true })
  });

  readonly filteredContacts = computed(() => {
    const list = this.botService.contacts();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return list;

    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      (c.notes && c.notes.toLowerCase().includes(query))
    );
  });

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }

  openAddModal() {
    this.contactForm.reset({
      name: '',
      phone: '+34',
      notes: ''
    });
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  async submitAddContact() {
    if (this.contactForm.invalid) return;
    const formVal = this.contactForm.getRawValue();

    await this.botService.addContact({
      name: formVal.name,
      phone: formVal.phone,
      authorized: true,
      notes: formVal.notes
    });

    this.closeAddModal();
    this.showToast(`Empleado "${formVal.name}" guardado.`);
  }

  openEditModal(contact: Contact) {
    this.editForm.setValue({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      notes: contact.notes || '',
      authorized: contact.authorized
    });
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
  }

  async submitEditContact() {
    if (this.editForm.invalid) return;
    const formVal = this.editForm.getRawValue();

    const updated: Contact = {
      id: formVal.id,
      name: formVal.name,
      phone: formVal.phone,
      authorized: formVal.authorized,
      notes: formVal.notes,
    };

    await this.botService.updateContact(updated);
    this.closeEditModal();
    this.showToast(`Cambios de "${updated.name}" guardados.`);
  }

  async toggleAuth(id: string) {
    await this.botService.toggleContactAuthorization(id);
    this.showToast('Permiso de WhatsApp actualizado.');
  }

  askDeleteConfirm(contact: Contact) {
    this.contactToDelete.set(contact);
  }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (contact) {
      await this.botService.deleteContact(contact.id);
      this.showToast(`"${contact.name}" eliminado.`);
    }
    this.contactToDelete.set(null);
  }

}
