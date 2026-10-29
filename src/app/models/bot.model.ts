export type BotStatus = 'active' | 'stopped' | 'restarting' | 'connecting' | 'waiting_qr' | 'disconnected';

export interface QrData {
  raw: string;
  dataUrl: string;
  generatedAt: number;
  expiresInSeconds: number;
  pairingCode?: string;
  connectedPhone?: string;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  text: string;
  details?: string;
  isQr?: boolean;
  highlightPath?: string;
  highlightSender?: string;
}

export type EventType = 'image_saved' | 'message_received' | 'unauthorized' | 'client_connected' | 'system';

export interface BotEvent {
  id: string;
  type: EventType;
  title: string;
  subtitle: string;
  relativeTime: string;
  timestamp: number;
}

export interface SavedImage {
  id: string;
  senderName: string;
  senderPhone: string;
  dateFormatted: string;
  timeFormatted: string;
  filename: string;
  path: string;
  imageUrl: string;
  size: string;
  dimensions: string;
  category?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  authorized: boolean;
  notes?: string;
}

export interface SystemStats {
  nodeVersion: string;
  os: string;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  isHealthy: boolean;
  healthTitle: string;
  healthMessage: string;
}

export interface BotConfig {
  botName: string;
  sessionName: string;
  prefix: string;
  saveDirectory: string;
  groupFolderByContact: boolean;
  groupFolderByMonth: boolean;
  autoScrollLogs: boolean;
  notifyUnauthorized: boolean;
  autoReplyEnabled: boolean;
  welcomeMessage: string;
  unauthorizedMessage: string;
  maxImageSizeMb: number;
}
