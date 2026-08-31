import { config } from '../config.js';
import { logger } from './logger.js';

interface EquipmentThrottleRecord {
  lastSentAt: number;
  suppressedCount: number;
}

class ThrottlingService {
  private sentHistory: Map<string, EquipmentThrottleRecord> = new Map();

  /**
   * Verifica se o equipamento está dentro da janela de cooldown/anti-flood
   * @param codigoEquipamento Código do equipamento (ex: EQ-001)
   * @returns true se deve enviar, false se deve ser suprimido/ignorado por flooding
   */
  public shouldSend(codigoEquipamento: string): { allow: boolean; reason?: string; suppressedCount: number } {
    const key = codigoEquipamento.toUpperCase();
    const now = Date.now();
    const windowMs = config.throttleWindowMinutes * 60 * 1000;

    const record = this.sentHistory.get(key);

    if (!record) {
      return { allow: true, suppressedCount: 0 };
    }

    const elapsed = now - record.lastSentAt;

    if (elapsed < windowMs) {
      record.suppressedCount++;
      const remainingMinutes = Math.ceil((windowMs - elapsed) / 60000);
      return {
        allow: false,
        reason: `Alerta para ${key} suprimido (cooldown de ${config.throttleWindowMinutes}min ativo, restam ~${remainingMinutes}min). Ocorrências suprimidas: ${record.suppressedCount}`,
        suppressedCount: record.suppressedCount,
      };
    }

    return { allow: true, suppressedCount: record.suppressedCount };
  }

  /**
   * Registra que o envio foi feito com sucesso
   */
  public recordSent(codigoEquipamento: string) {
    const key = codigoEquipamento.toUpperCase();
    this.sentHistory.set(key, {
      lastSentAt: Date.now(),
      suppressedCount: 0,
    });
  }

  /**
   * Limpa o throttling de um equipamento (para testes manuais ou override)
   */
  public resetThrottle(codigoEquipamento: string) {
    this.sentHistory.delete(codigoEquipamento.toUpperCase());
  }
}

export const throttlingService = new ThrottlingService();
