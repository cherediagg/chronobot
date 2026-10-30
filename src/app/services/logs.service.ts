import { Injectable, computed, inject, signal } from '@angular/core';
import { BotEvent, LogEntry, LogLevel } from '../models/bot.model';
import { ApiLogEntry, BotApiClient } from './bot-api.client';

@Injectable({ providedIn: 'root' })
export class LogsService {
  private readonly api = inject(BotApiClient);

  readonly logs = signal<LogEntry[]>([]);
  readonly events = signal<BotEvent[]>([]);
  readonly autoScroll = signal(true);
  readonly autoScrollLogs = this.autoScroll;

  readonly exportText = computed(() => this.logs()
    .map(log => `${log.time} [${log.level}] ${log.text}`)
    .join('\n'));

  async refresh() {
    const [logsResult, eventsResult] = await Promise.allSettled([
      this.api.getLogs(),
      this.api.getEvents()
    ]);

    if (logsResult.status === 'fulfilled') {
      this.logs.set(logsResult.value.logs.map(log => this.normalizeLog(log)));
    }
    if (eventsResult.status === 'fulfilled') this.events.set(eventsResult.value.events);

    const failures = [logsResult, eventsResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(failures.map(result => result.reason), 'No se pudieron actualizar todos los registros.');
    }
  }

  async clear() {
    await this.api.control('clear_logs');
    await this.refresh();
  }

  addLog(level: LogLevel, text: string, options?: Pick<LogEntry, 'isQr' | 'highlightPath' | 'highlightSender'>) {
    this.logs.update(current => [...current, {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: this.getCurrentTimeString(),
      level,
      text,
      ...options
    }]);
  }

  toggleAutoScroll() {
    this.autoScroll.update(enabled => !enabled);
  }

  getCurrentTimeString() {
    return new Date().toLocaleTimeString('es-ES', { hour12: false });
  }

  private normalizeLog(log: ApiLogEntry): LogEntry {
    const details = log.details;
    let formattedDetails: string | undefined;
    if (details instanceof Error) {
      formattedDetails = details.stack || details.message;
    } else if (typeof details === 'string') {
      formattedDetails = details;
    } else if (details !== undefined && details !== null) {
      try {
        formattedDetails = JSON.stringify(details, null, 2) ?? String(details);
      } catch (error: unknown) {
        formattedDetails = `[No se pudieron mostrar los detalles: ${error instanceof Error ? error.message : String(error)}]`;
      }
    }

    return {
      id: log.id || `log-${Date.now()}-${Math.random()}`,
      time: log.time || this.getCurrentTimeString(),
      level: log.level || 'INFO',
      text: log.message || log.text || '',
      details: formattedDetails,
      isQr: log.isQr,
      highlightPath: log.highlightPath,
      highlightSender: log.highlightSender
    };
  }
}
