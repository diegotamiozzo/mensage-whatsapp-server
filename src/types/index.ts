export type WhatsAppState = 'disconnected' | 'connecting' | 'connected' | 'waiting_qr';

export interface FalhaEvent {
  id: number;
  equipamento_id: string; // identificador do equipamento
  setor: string; // setor, local da instalação do equipamento
  user: string; // destinatário do envio da mensagem (telefone WhatsApp)
  status: 0 | 1 | 2 | 3; // 0=Pendente, 1=Enviado, 2=Processando, 3=Erro
  attempts?: number;
  error_message?: string | null;
  creat_at: string; // momento da falha
  update_at?: string | null; // momento do envio da mensagem
}

export interface DashboardStats {
  totalHoje: number;
  enviados: number;
  pendentes: number;
  erros: number;
  processando: number;
  dbMode?: 'mysql';
  whatsappStatus?: WhatsAppState;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  meta?: any;
}

export interface SystemConfig {
  pollingInterval: number;
  maxRetryAttempts: number;
  dataRetentionDays: number;
  databaseMode: string;
  databaseHost: string;
}
