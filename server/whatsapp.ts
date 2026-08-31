import makeWASocketImport, { DisconnectReason, useMultiFileAuthState, WASocket } from '@whiskeysockets/baileys';
import * as qrcodeModule from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

// Handle default or named export for baileys and qrcode across ESM / CJS bundling
const makeWASocket = (makeWASocketImport as any)?.default || makeWASocketImport;
const qrcode = (qrcodeModule as any)?.default || qrcodeModule;

export class WhatsappService {
  private sock: WASocket | null = null;
  private qrCodeData: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  constructor() {
    this.connectToWhatsApp().catch((err) => {
      console.warn('Initial WhatsApp connection attempt notice:', err?.message || err);
    });
  }

  public async connectToWhatsApp() {
    if (this.connectionStatus === 'connected') return;

    this.connectionStatus = 'connecting';
    const authPath = path.join(process.cwd(), 'auth_info_baileys');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }) as any,
      });

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeData = await qrcode.toDataURL(qr);
          } catch (e) {
            console.error('Error generating QR code data URL', e);
          }
          this.connectionStatus = 'disconnected';
        }

        if (connection === 'close') {
          this.qrCodeData = null;
          this.connectionStatus = 'disconnected';
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) {
            this.connectToWhatsApp().catch(() => {});
          }
        } else if (connection === 'open') {
          this.qrCodeData = null;
          this.connectionStatus = 'connected';
          console.log('WhatsApp conectado com sucesso!');
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
    } catch (err: any) {
      console.error('Error in connectToWhatsApp:', err?.message || err);
      this.connectionStatus = 'disconnected';
      this.qrCodeData = null;
    }
  }

  public async disconnectWhatsApp() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end(undefined);
      }
    } catch (e) {
      // Ignore errors if already disconnected
    }

    this.sock = null;
    this.qrCodeData = null;
    this.connectionStatus = 'disconnected';

    // Remove saved session folder
    const authPath = path.join(process.cwd(), 'auth_info_baileys');
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
      } catch (e) {
        console.warn('Could not remove auth directory:', e);
      }
    }

    return { success: true, message: 'Desconectado e sessão limpa com sucesso.' };
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qrCode: this.qrCodeData,
    };
  }

  public async sendMessage(phone: string, message: string) {
    if (!this.sock || this.connectionStatus !== 'connected') {
      throw new Error('WhatsApp não está conectado. Escaneie o QR Code.');
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    const jid = cleanedPhone.includes('@s.whatsapp.net')
      ? cleanedPhone
      : `${cleanedPhone}@s.whatsapp.net`;

    const result = await this.sock.sendMessage(jid, { text: message });

    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      result,
    };
  }
}
