import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Contact } from '../../models/bot.model';
import { ContactsService } from '../../services/contacts.service';
import { ContactDeleteModal } from './contact-delete-modal/contact-delete-modal';
import { ContactFormModal } from './contact-form-modal/contact-form-modal';
import { RawJsonModal } from './raw-json-modal/raw-json-modal';

@Component({
  selector: 'app-contacts-view',
  imports: [
    CommonModule,
    MatIconModule,
    ContactFormModal,
    ContactDeleteModal,
    RawJsonModal
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contacts-view.html'
})
export class ContactsView {
  private readonly contactsService = inject(ContactsService);

  readonly contacts = this.contactsService.contacts;

  readonly searchQuery = signal<string>('');
  readonly showModal = signal<boolean>(false);
  readonly editingContact = signal<Contact | null>(null);
  readonly deletingContact = signal<Contact | null>(null);
  readonly showRawJsonModal = signal<boolean>(false);

  readonly filteredContacts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.contacts();
    return this.contacts().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.notes && c.notes.toLowerCase().includes(q)) ||
      c.role.toLowerCase().includes(q)
    );
  });

  readonly formattedJson = computed(() => {
    return JSON.stringify(this.contacts(), null, 2);
  });

  onSearchChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  openNewContactModal() {
    this.editingContact.set(null);
    this.showModal.set(true);
  }

  openEditContactModal(contact: Contact) {
    this.editingContact.set(contact);
    this.showModal.set(true);
  }

  closeFormModal() {
    this.showModal.set(false);
    this.editingContact.set(null);
  }

  saveContact(payload: {
    id?: string;
    name: string;
    phone: string;
    role: 'Admin' | 'Contacto Autorizado' | 'Usuario Estándar';
    notes: string;
    authorized: boolean;
  }) {
    if (payload.id) {
      this.contactsService.updateContact(payload.id, {
        name: payload.name,
        phone: payload.phone,
        role: payload.role,
        notes: payload.notes,
        authorized: payload.authorized
      });
    } else {
      this.contactsService.addContact({
        name: payload.name,
        phone: payload.phone,
        role: payload.role,
        notes: payload.notes,
        authorized: payload.authorized
      });
    }

    this.closeFormModal();
  }

  toggleAuthorization(contact: Contact) {
    this.contactsService.updateContact(contact.id, {
      authorized: !contact.authorized
    });
  }

  confirmDeleteContact(contact: Contact) {
    this.deletingContact.set(contact);
  }

  closeDeleteModal() {
    this.deletingContact.set(null);
  }

  deleteContact(contact: Contact) {
    this.contactsService.deleteContact(contact.id);
    this.closeDeleteModal();
  }

  openRawJsonModal() {
    this.showRawJsonModal.set(true);
  }

  closeRawJsonModal() {
    this.showRawJsonModal.set(false);
  }
}
