import { Injectable, computed, inject, signal } from '@angular/core';
import { Contact } from '../models/bot.model';
import { BotApiClient } from './bot-api.client';

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private readonly api = inject(BotApiClient);

  readonly contacts = signal<Contact[]>([]);
  readonly authorizedContactsCount = computed(() => this.contacts().filter(contact => contact.authorized).length);

  async refresh() {
    const response = await this.api.getContacts();
    this.contacts.set(response.employees.map(employee => ({
      id: employee.id,
      name: employee.nombre || employee.name || 'Sin nombre',
      phone: employee.telefono || employee.phone || '',
      authorized: employee.activo !== undefined
        ? Boolean(employee.activo)
        : employee.authorized !== undefined
          ? Boolean(employee.authorized)
          : true,
      notes: employee.notes || ''
    })));
  }

  async add(contact: Omit<Contact, 'id'>) {
    await this.api.addContact(contact);
    await this.refresh();
  }

  async update(contact: Contact) {
    await this.api.updateContact(contact);
    await this.refresh();
  }

  async toggleAuthorization(id: string) {
    await this.api.toggleContactAuthorization(id);
    await this.refresh();
  }

  async delete(id: string) {
    await this.api.deleteContact(id);
    await this.refresh();
  }
}
