import makeWASocketImport, { DisconnectReason, useMultiFileAuthState, WASocket } from '@whiskeysockets/baileys';
import * as qrcodeModule from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { broadcastEvent } from '../socket.js';
import { logger } from './logger.js';
import { config } from '../config.js';

const makeWASocket = (makeWASocketImport as any)?.default || makeWASocketImport;
const qrcode = (qrcodeModule as any)?.default || qrcodeModule;

export type WhatsAppConnectionState = 'disconnected' | 'connecting' | 'connected' | 'waiting_qr';

class WhatsappService {
  private sock: WASocket | null = null;
  private qrCodeData: string | null = null;
  private connectionStatus: WhatsAppConnectionState = 'disconnected';
  private isConnecting = false;

  constructor() {
    // Attempt connection on startup
    setTimeout(() => {
      this.connectToWhatsApp().catch((err) => {
        logger.warn(`Tentativa de inicialização WhatsApp: ${err?.message || err}`);
      });
    }, 1500);
  }

  public getStatus(): { status: WhatsAppConnectionState; qrCode: string | null } {
    return {
      status: this.connectionStatus,
      qrCode: this.qrCodeData,
    };
  }

  private broadcastStatus() {
    broadcastEvent('whatsapp:status', this.getStatus());
  }

  public async connectToWhatsApp(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.connectionStatus = 'connecting';
    this.broadcastStatus();
    logger.info('Iniciando conexão com WhatsApp (Baileys)...');

    const authPath = path.resolve(process.cwd(), config.whatsappSessionPath);
    if (!fs.existsSync(authPath)) {
      try {
        fs.mkdirSync(authPath, { recursive: true });
      } catch (e) {}
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }) as any,
        printQRInTerminal: false,
      });

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeData = await qrcode.toDataURL(qr);
            this.connectionStatus = 'waiting_qr';
            this.isConnecting = false;
            logger.info('Novo QR Code gerado pelo WhatsApp. Aguardando leitura no painel...');
            this.broadcastStatus();
          } catch (e: any) {
            logger.error(`Erro ao gerar imagem do QR Code: ${e?.message}`);
          }
        }

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.qrCodeData = null;
          this.connectionStatus = 'disconnected';
          this.broadcastStatus();

          logger.warn(`Conexão do WhatsApp encerrada. Código: ${statusCode || 'N/A'}. Reconectar: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => {
              this.connectToWhatsApp().catch(() => {});
            }, 3000);
          }
        } else if (connection === 'open') {
          this.isConnecting = false;
          this.qrCodeData = null;
          this.connectionStatus = 'connected';
          logger.success('🟢 WhatsApp conectado com sucesso e pronto para envio de alertas!');
          this.broadcastStatus();
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
    } catch (err: any) {
      this.isConnecting = false;
      this.connectionStatus = 'disconnected';
      this.qrCodeData = null;
      logger.error(`Falha ao instanciar WhatsApp socket: ${err?.message || err}`);
      this.broadcastStatus();
    }
  }

  public async disconnectWhatsApp(): Promise<{ success: boolean; message: string }> {
    logger.info('Solicitada desconexão e exclusão de sessão do WhatsApp...');

    try {
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {}
        this.sock.end(undefined);
      }
    } catch (e) {}

    this.sock = null;
    this.qrCodeData = null;
    this.connectionStatus = 'disconnected';
    this.isConnecting = false;

    // Remove saved session folder
    const authPath = path.resolve(process.cwd(), config.whatsappSessionPath);
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        logger.info('Pasta de credenciais da sessão WhatsApp removida com sucesso.');
      } catch (e: any) {
        logger.warn(`Não foi possível remover auth_info: ${e.message}`);
      }
    }

    this.broadcastStatus();
    logger.success('🔴 Sessão WhatsApp encerrada. Pronto para parear novo número.');
    return { success: true, message: 'WhatsApp desconectado e sessão limpa com sucesso.' };
  }

  public isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.sock !== null;
  }

  public async sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConnected() || !this.sock) {
      throw new Error('WhatsApp não está conectado. Escaneie o QR Code no painel.');
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      throw new Error(`Número de telefone inválido: "${phone}". Formato com DDI+DDD necessário.`);
    }

    const jid = cleanedPhone.includes('@s.whatsapp.net')
      ? cleanedPhone
      : `${cleanedPhone}@s.whatsapp.net`;

    const result = await this.sock.sendMessage(jid, { text: message });

    return {
      success: true,
      messageId: result?.key?.id || undefined,
    };
  }

  public async sendTestMessage(phone: string): Promise<{ success: boolean; messageId?: string }> {
    return this.sendMessage(phone, '🧪 *Teste Unitário Industrial* - Sistema de Alertas operando com sucesso!');
  }
}

export const whatsappService = new WhatsappService();
