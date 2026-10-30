export interface ChronoLogEntry {
  id: string;
  timestamp: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  details?: unknown;
  isQr?: boolean;
  highlightPath?: string;
  highlightSender?: string;
}

export interface ChronoBotEvent {
  id: string;
  type: 'image_saved' | 'message_received' | 'unauthorized' | 'client_connected' | 'system';
  title: string;
  subtitle: string;
  relativeTime: string;
  timestamp: number;
}

export class BotActivityLog {
  private readonly logs: ChronoLogEntry[] = [];
  private readonly events: ChronoBotEvent[] = [];

  addLog(
    level: ChronoLogEntry['level'],
    message: string,
    timeStr?: string,
    options?: Pick<ChronoLogEntry, 'isQr' | 'highlightPath' | 'highlightSender' | 'details'>
  ) {
    const now = new Date();
    this.logs.push({
      id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: now.toLocaleString('es-ES'),
      time: timeStr || now.toLocaleTimeString('es-ES', { hour12: false }),
      level,
      message,
      ...options
    });

    if (this.logs.length > 500) this.logs.shift();
  }

  addEvent(event: ChronoBotEvent) {
    this.events.unshift(event);
    if (this.events.length > 500) this.events.pop();
  }

  clearLogs() {
    this.logs.length = 0;
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  getEvents(limit = 20) {
    return this.events.slice(0, limit);
  }
}
