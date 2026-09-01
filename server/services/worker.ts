import { db, FalhaEvent } from '../db/database.js';
import { whatsappService } from './whatsapp.js';
import { generateFailureMessage } from './messageTemplate.js';
import { logger } from './logger.js';
import { broadcastEvent } from '../socket.js';
import { config } from '../config.js';

class FailureWorkerService {
  private isRunning = false;
  private isProcessingBatch = false;
  private timer: NodeJS.Timeout | null = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`Worker de processamento de falhas iniciado (Polling: ${config.pollingIntervalMs}ms)`);
    this.scheduleNextTick(100);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('Worker de processamento de falhas pausado.');
  }

  private scheduleNextTick(delayMs: number = config.pollingIntervalMs) {
    if (!this.isRunning) return;
    this.timer = setTimeout(() => {
      this.tick()
        .catch((err) => {
          logger.error(`Erro no loop do worker: ${err?.message || err}`);
        })
        .finally(() => {
          this.scheduleNextTick();
        });
    }, delayMs);
  }

  public async tick(): Promise<void> {
    if (this.isProcessingBatch) return;
    this.isProcessingBatch = true;

    try {
      // 1. Busca e bloqueia com LOCK registros pendentes (status = 0)
      const pendingEvents = await db.fetchAndLockPendingFalhas(20);

      if (pendingEvents.length > 0) {
        logger.info(`${pendingEvents.length} evento(s) pendente(s) obtido(s) para processamento`);
        broadcastEvent('worker:stats_changed', await db.getDashboardStats());
      }

      for (const event of pendingEvents) {
        await this.processSingleEvent(event);
      }
    } catch (err: any) {
      logger.error(`Erro ao consultar fila de eventos: ${err?.message || err}`);
    } finally {
      this.isProcessingBatch = false;
    }
  }

  private async processSingleEvent(event: FalhaEvent): Promise<void> {
    logger.info(`Processando falha #${event.id} - Equipamento: ${event.equipamento_id} (Setor: ${event.setor}) -> User: ${event.user}`);
    broadcastEvent('falha:status', { id: event.id, status: 2 }); // Status 2 = Processando

    // 3. Montagem da Mensagem
    const messageText = generateFailureMessage(event);

    // 4. Verificação de Conexão com WhatsApp
    if (!whatsappService.isConnected()) {
      const newAttempts = (event.attempts || 0) + 1;
      const errMsg = 'WhatsApp desconectado ou aguardando leitura de QR Code no painel';

      logger.warn(`Falha #${event.id} | Tentativa ${newAttempts}/${config.maxRetryAttempts} | ${errMsg}`);

      await db.updateFalhaError(event.id, errMsg, newAttempts);

      broadcastEvent('falha:updated', {
        ...event,
        status: 3,
        attempts: newAttempts,
        error_message: errMsg,
      });
      broadcastEvent('worker:stats_changed', await db.getDashboardStats());
      return;
    }

    // 5. Envio via WhatsApp
    try {
      await whatsappService.sendMessage(event.user, messageText);

      const updateAtIso = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000';
      await db.updateFalhaSuccess(event.id, updateAtIso);

      logger.success(`Mensagem enviada com sucesso para ${event.user} (Equipamento: ${event.equipamento_id})`);
      logger.success(`Falha #${event.id} atualizada para ENVIADO (status = 1, update_at = ${updateAtIso})`);

      broadcastEvent('falha:updated', {
        ...event,
        status: 1,
        update_at: updateAtIso,
      });
      broadcastEvent('worker:stats_changed', await db.getDashboardStats());
    } catch (err: any) {
      const newAttempts = (event.attempts || 0) + 1;
      const errMsg = err?.message || 'Erro inesperado ao enviar mensagem WhatsApp';

      logger.error(`Erro no envio da Falha #${event.id} | Tentativa ${newAttempts}/${config.maxRetryAttempts} | ${errMsg}`);

      await db.updateFalhaError(event.id, errMsg, newAttempts);

      broadcastEvent('falha:updated', {
        ...event,
        status: 3,
        attempts: newAttempts,
        error_message: errMsg,
      });
      broadcastEvent('worker:stats_changed', await db.getDashboardStats());
    }
  }

  public async triggerImmediateRetry(id: number): Promise<void> {
    await db.manualRetryFalha(id);
    this.tick().catch(() => {});
  }
}

export const worker = new FailureWorkerService();
