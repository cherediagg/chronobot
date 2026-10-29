import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { LogEntry } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private readonly http = inject(HttpClient);

  readonly logs = signal<LogEntry[]>([]);
  readonly autoScroll = signal<boolean>(true);

  constructor() {
    this.fetchLogs();
    setInterval(() => {
      this.fetchLogs();
    }, 2000);
  }

  fetchLogs() {
    this.http.get<LogEntry[]>('/api/bot/logs').subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.logs.set(res);
        } else if (res && Array.isArray(res.logs)) {
          this.logs.set(res.logs);
        } else {
          this.logs.set([]);
        }
      },
      error: () => {}
    });
  }

  addLog(log: LogEntry) {
    this.logs.update(list => [...list, log]);
  }

  setAutoScroll(enabled: boolean) {
    this.autoScroll.set(enabled);
  }

  clearLogs() {
    this.logs.set([]);
  }

  exportLogs() {
    const text = JSON.stringify(this.logs(), null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronobot-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
