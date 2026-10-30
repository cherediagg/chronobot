import { Injectable } from '@angular/core';
import { BotEvent, BotStatus, Contact, LogLevel, QrData, SavedImage, SystemStats } from '../models/bot.model';

export interface BotStatusResponse {
  status: BotStatus;
  uptimeSeconds: number;
  qrData: QrData;
  sessionConflict?: boolean;
}

export interface EmployeesResponse {
  employees: {
    id: string;
    nombre?: string;
    name?: string;
    telefono?: string;
    phone?: string;
    activo?: boolean;
    authorized?: boolean;
    notes?: string;
  }[];
}

export interface ApiLogEntry {
  id?: string;
  time?: string;
  level?: LogLevel;
  message?: string;
  text?: string;
  details?: unknown;
  isQr?: boolean;
  highlightPath?: string;
  highlightSender?: string;
}

export interface LogsResponse {
  logs: ApiLogEntry[];
}

export interface EventsResponse {
  events: BotEvent[];
}

export interface ImagesResponse {
  images: SavedImage[];
}

export type SystemStatsResponse = SystemStats;

export type BotAction = 'start' | 'stop' | 'restart' | 'disconnect' | 'clear_logs' | 'regenerate_qr';

@Injectable({ providedIn: 'root' })
export class BotApiClient {
  getStatus() {
    return this.request<BotStatusResponse>('/api/bot/status');
  }

  getLogs() {
    return this.request<LogsResponse>('/api/bot/logs');
  }

  getEvents() {
    return this.request<EventsResponse>('/api/bot/events');
  }

  getImages() {
    return this.request<ImagesResponse>('/api/bot/images');
  }

  getContacts() {
    return this.request<EmployeesResponse>('/api/bot/contacts');
  }

  getSystemStats() {
    return this.request<SystemStatsResponse>('/api/bot/system-stats');
  }

  startBot() {
    return this.request<{ status: BotStatusResponse }>('/api/bot/start', { method: 'POST' });
  }

  control(action: BotAction) {
    return this.request<{ status: BotStatusResponse }>('/api/bot/control', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  addContact(contact: Omit<Contact, 'id'>) {
    return this.request('/api/bot/contacts', {
      method: 'POST',
      body: JSON.stringify({
        nombre: contact.name,
        telefono: contact.phone,
        activo: contact.authorized
      })
    });
  }

  updateContact(contact: Contact) {
    return this.request(`/api/bot/contacts/${encodeURIComponent(contact.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: contact.name,
        telefono: contact.phone,
        activo: contact.authorized,
        notes: contact.notes
      })
    });
  }

  toggleContactAuthorization(id: string) {
    return this.request(`/api/bot/contacts/${encodeURIComponent(id)}/toggle`, { method: 'PUT' });
  }

  deleteContact(id: string) {
    return this.request(`/api/bot/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  deleteImage(id: string) {
    return this.request(`/api/bot/images/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  private async request<T = void>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(url, { ...init, headers });
    const payload: unknown = await response.json();

    if (!response.ok) {
      const message = this.errorMessage(payload) || `El servidor respondió ${response.status}.`;
      throw new Error(message);
    }

    return payload as T;
  }

  private errorMessage(payload: unknown): string | undefined {
    if (typeof payload !== 'object' || payload === null || !('message' in payload)) return undefined;
    return typeof payload.message === 'string' ? payload.message : undefined;
  }
}
