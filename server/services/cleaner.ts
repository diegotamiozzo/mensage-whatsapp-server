import { db } from '../db/database.js';
import { config } from '../config.js';
import { logger } from './logger.js';

class CleanerService {
  private timer: NodeJS.Timeout | null = null;

  public start() {
    // Run cleanup once on startup (after a slight delay)
    setTimeout(() => {
      this.runCleanup();
    }, 5000);

    // Schedule once every 24 hours (86400000 ms)
    this.timer = setInterval(() => {
      this.runCleanup();
    }, 24 * 60 * 60 * 1000);
  }

  public async runCleanup(): Promise<number> {
    try {
      logger.info(`Executando rotina de limpeza de registros antigos (> ${config.dataRetentionDays} dias)...`);
      const count = await db.cleanOldRecords(config.dataRetentionDays);
      if (count > 0) {
        logger.success(`Limpeza concluída: ${count} registros antigos (status 1 e 3) removidos.`);
      } else {
        logger.info('Limpeza concluída: Nenhum registro antigo expirado.');
      }
      return count;
    } catch (e: any) {
      logger.error(`Erro ao executar rotina de limpeza: ${e?.message || e}`);
      return 0;
    }
  }
}

export const cleanerService = new CleanerService();
