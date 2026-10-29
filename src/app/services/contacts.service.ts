import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Contact } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private readonly http = inject(HttpClient);

  readonly contacts = signal<Contact[]>([]);

  constructor() {
    this.fetchContacts();
  }

  fetchContacts() {
    this.http.get<Contact[]>('/api/bot/contacts').subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.contacts.set(res);
        } else if (res && Array.isArray((res as any).contacts)) {
          this.contacts.set((res as any).contacts);
        } else {
          this.contacts.set([]);
        }
      },
      error: (err) => console.error('Error fetching contacts:', err)
    });
  }

  addContact(contact: Omit<Contact, 'id' | 'messagesReceived' | 'imagesReceived' | 'lastActive'>) {
    this.http.post<Contact>('/api/bot/contacts', contact).subscribe({
      next: () => this.fetchContacts(),
      error: (err) => console.error('Error adding contact:', err)
    });
  }

  updateContact(id: string, patch: Partial<Contact>) {
    this.http.put<Contact>(`/api/bot/contacts/${id}`, patch).subscribe({
      next: () => this.fetchContacts(),
      error: (err) => console.error('Error updating contact:', err)
    });
  }

  deleteContact(id: string) {
    this.http.delete(`/api/bot/contacts/${id}`).subscribe({
      next: () => this.fetchContacts(),
      error: (err) => console.error('Error deleting contact:', err)
    });
  }
}
