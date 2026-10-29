import { Injectable, signal, computed, inject } from '@angular/core';
import { Contact } from '../models/bot.model';
import { LogsService } from './logs.service';

export interface EmployeesFileMeta {
  relativePath: string;
  absolutePath?: string;
  exists: boolean;
  sizeBytes: number;
  modifiedAt: string;
  employeesCount: number;
  allowedCount: number;
  rawJson?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private readonly logsService = inject(LogsService);

  readonly contacts = signal<Contact[]>([]);
  readonly employeesFileMeta = signal<EmployeesFileMeta>({
    relativePath: 'data/employees.json',
    exists: true,
    sizeBytes: 0,
    modifiedAt: new Date().toISOString(),
    employeesCount: 0,
    allowedCount: 0,
    rawJson: ''
  });

  readonly authorizedContactsCount = computed(() => {
    return this.contacts().filter(c => c.authorized).length;
  });

  applyBackendEmployees(employees: { id: string; nombre?: string; name?: string; telefono?: string; phone?: string; rol?: string; role?: string; activo?: boolean; authorized?: boolean; avatarUrl?: string; notes?: string; messagesReceived?: number; imagesReceived?: number; lastActive?: string }[]) {
    const mapped: Contact[] = employees.map(emp => ({
      id: emp.id,
      name: emp.nombre || emp.name || 'Sin nombre',
      phone: emp.telefono || emp.phone || '',
      role: (emp.rol || emp.role || 'Contacto Autorizado') as Contact['role'],
      authorized: emp.activo !== undefined ? Boolean(emp.activo) : (emp.authorized !== undefined ? Boolean(emp.authorized) : true),
      avatarUrl: emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      messagesReceived: typeof emp.messagesReceived === 'number' ? emp.messagesReceived : 0,
      imagesReceived: typeof emp.imagesReceived === 'number' ? emp.imagesReceived : 0,
      lastActive: emp.lastActive || 'Reciente',
      notes: emp.notes !== undefined ? emp.notes : 'Sincronizado desde data/employees.json'
    }));

    this.contacts.set(mapped);
  }

  async addContact(contact: Omit<Contact, 'id' | 'messagesReceived' | 'imagesReceived' | 'lastActive'>): Promise<boolean> {
    try {
      const res = await fetch('/api/bot/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: contact.name,
          telefono: contact.phone,
          rol: contact.role,
          activo: contact.authorized,
          avatarUrl: contact.avatarUrl
        })
      });
      return res.ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logsService.addLog('ERROR', `Error al registrar contacto en el servidor: ${msg}`);
      return false;
    }
  }

  async updateContact(contact: Contact): Promise<boolean> {
    try {
      const res = await fetch(`/api/bot/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: contact.name,
          name: contact.name,
          telefono: contact.phone,
          phone: contact.phone,
          rol: contact.role,
          role: contact.role,
          activo: contact.authorized,
          authorized: contact.authorized,
          notes: contact.notes
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        return true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logsService.addLog('ERROR', `Error al actualizar contacto en el servidor: ${msg}`);
    }
    return false;
  }

  async reloadEmployeesFromFile(): Promise<boolean> {
    try {
      const res = await fetch('/api/bot/contacts');
      const data = await res.json();
      if (data.file) {
        this.employeesFileMeta.set(data.file);
      }
      if (Array.isArray(data.employees)) {
        this.applyBackendEmployees(data.employees);
      }
      this.logsService.addLog('INFO', `Fichero data/employees.json recargado (${data.employees?.length || 0} registros)`);
      return true;
    } catch {
      return false;
    }
  }

  async saveRawEmployeesJson(rawJson: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/bot/contacts/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJson })
      });
      const data = await res.json();
      if (data.success) {
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        if (Array.isArray(data.employees)) {
          this.applyBackendEmployees(data.employees);
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Error al guardar el archivo' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async toggleContactAuthorization(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/bot/contacts/${id}/toggle`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        return true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logsService.addLog('ERROR', `Error al modificar permiso: ${msg}`);
    }
    return false;
  }

  async deleteContact(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/bot/contacts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file) {
          this.employeesFileMeta.set(data.file);
        }
        return true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logsService.addLog('ERROR', `Error al eliminar contacto del servidor: ${msg}`);
    }
    return false;
  }
}
