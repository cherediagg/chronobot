import { Injectable, signal } from '@angular/core';
import { LogEntry, LogLevel } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  readonly logs = signal<LogEntry[]>([]);
  readonly autoScroll = signal<boolean>(true);
  readonly activeScreen = signal<'inicio' | 'logs' | 'imagenes' | 'contactos' | 'configuracion'>('inicio');

  getCurrentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private formatLogDetails(details: unknown): string | undefined {
    if (details === undefined || details === null || details === '') return undefined;
    if (details instanceof Error) return details.stack || details.message;
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details, null, 2) ?? String(details);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `[No se pudieron mostrar los detalles del log: ${message}]`;
    }
  }

  applyBackendLogs(rawLogs: { id?: string; time?: string; level?: LogLevel; message?: string; text?: string; details?: unknown; isQr?: boolean; highlightPath?: string; highlightSender?: string }[]) {
    const formatted: LogEntry[] = rawLogs.map(item => ({
      id: item.id || 'log-' + Math.random(),
      time: item.time || this.getCurrentTimeString(),
      level: item.level || 'INFO',
      text: item.message || item.text || '',
      details: this.formatLogDetails(item.details),
      isQr: item.isQr,
      highlightPath: item.highlightPath,
      highlightSender: item.highlightSender
    }));

    this.logs.set(formatted);
  }

  addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', text: string, options?: { isQr?: boolean; highlightPath?: string; highlightSender?: string }) {
    const newEntry: LogEntry = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      time: this.getCurrentTimeString(),
      level,
      text,
      isQr: options?.isQr,
      highlightPath: options?.highlightPath,
      highlightSender: options?.highlightSender
    };
    this.logs.update(list => [...list, newEntry]);
  }

  async clearLogs() {
    try {
      await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_logs' })
      });
    } catch {
      this.logs.set([]);
    }
  }

  exportLogs(): string {
    const lines = this.logs().map(l => `${l.time} [${l.level}] ${l.text}`);
    return lines.join('\n');
  }

  toggleAutoScroll() {
    this.autoScroll.update(val => !val);
  }
}
