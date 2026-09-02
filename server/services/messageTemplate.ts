import { FalhaEvent, toBrasilIsoString } from '../db/database.js';

export function formatEventDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return `${formatter.format(d).replace(',', ' às')}`;
  } catch {
    return isoString;
  }
}

/**
 * Função geradora de templates padronizados para alertas industriais.
 */
export function generateFailureMessage(event: FalhaEvent): string {
  const formattedTime = formatEventDateTime(event.creat_at);

  return `*🚨 ALERTA DE FALHA*

*Equipamento:* ${event.equipamento_id}
*Local:* ${event.setor || 'Não especificado'}
*Horário da Ocorrência:* ${formattedTime}
*Identificador:* Falha #${event.id}

⚠️ *Atenção:* O equipamento registrou uma falha no sistema. Por favor, verifique a operação imediatamente.`;
}

/**
 * Template de teste manual do sistema
 */
export function generateTestMessage(phoneNumber: string): string {
  const now = formatEventDateTime(toBrasilIsoString());
  return `✅ *TESTE DE COMUNICAÇÃO*

Sistema de notificações conectado com sucesso!
*Horário do Teste:* ${now}
*Destinatário:* ${phoneNumber}

Tudo pronto para enviar alertas automáticos de falhas de equipamentos.`;
}
