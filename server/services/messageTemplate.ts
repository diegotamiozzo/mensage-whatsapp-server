import { FalhaEvent } from '../db/database.js';

export function formatEventDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

/**
 * Função geradora de templates padronizados para alertas industriais.
 */
export function generateFailureMessage(event: FalhaEvent): string {
  const formattedTime = formatEventDateTime(event.creat_at);

  return `*🚨 ALERTA DE FALHA INDUSTRIAL*

*Equipamento:* ${event.equipamento_id}
*Setor:* ${event.setor || 'Não especificado'}
*Horário da Ocorrência:* ${formattedTime}
*Identificador:* Falha #${event.id}

⚠️ *Atenção:* O equipamento registrou uma falha no sistema de supervisão. Por favor, verifique a operação imediatamente.`;
}

/**
 * Template de teste manual do sistema
 */
export function generateTestMessage(phoneNumber: string): string {
  const now = formatEventDateTime(new Date().toISOString());
  return `✅ *TESTE DE COMUNICAÇÃO - ALERTA INDUSTRIAL*

Sistema de monitoramento e notificações conectado com sucesso!
*Horário do Teste:* ${now}
*Destinatário:* ${phoneNumber}

Tudo pronto para receber alertas automáticos de falhas de equipamentos.`;
}
