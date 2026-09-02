import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { logger } from '../services/logger.js';

export function toBrasilIsoString(dateInput?: Date | string | null): string {
  const baseDate = dateInput ? new Date(dateInput) : new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  const year = values.year;
  const month = values.month;
  const day = values.day;
  const hours = values.hour;
  const minutes = values.minute;
  const seconds = values.second;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getBraziliaDate(dateInput?: Date | string | null): Date {
  const brazilIso = toBrasilIsoString(dateInput);
  return new Date(brazilIso);
}

function toMysqlDatetime(dateInput?: Date | string | null): string {
  const brazilDate = getBraziliaDate(dateInput);
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  const hours = String(brazilDate.getHours()).padStart(2, '0');
  const minutes = String(brazilDate.getMinutes()).padStart(2, '0');
  const seconds = String(brazilDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function toLocalIsoString(dateInput?: Date | string | null): string {
  return toBrasilIsoString(dateInput);
}

function getStartOfDayInSaoPaulo(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-03:00`);
}

export interface FalhaEvent {
  id: number;
  equipamento_id: string; // Identificador do equipamento
  setor: string; // Setor, local da instalação do equipamento
  user: string; // Destinatário do envio da mensagem (telefone WhatsApp)
  status: 0 | 1 | 2 | 3; // 0=Pendente, 1=Enviado, 2=Processando, 3=Erro
  attempts: number;
  error_message?: string | null;
  creat_at: string; // Momento da falha
  update_at?: string | null; // Momento do envio da mensagem
}

export interface DashboardStats {
  totalHoje: number;
  enviados: number;
  pendentes: number;
  erros: number;
  processando: number;
}

class DatabaseService {
  private pool: mysql.Pool | null = null;
  private isMysqlActive = false;

  constructor() {
    // MySQL is the only supported persistence layer in this project.
  }

  public async init(): Promise<void> {
    await this.tryInitMysql();
  }

  private async tryInitMysql() {
    if (!config.db.host && !config.db.url) {
      const message = 'MySQL não configurado. Defina DATABASE_HOST ou DATABASE_URL no .env antes de iniciar o sistema.';
      logger.error(message);
      throw new Error(message);
    }

    try {
      this.pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.name,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: '-03:00',
        dateStrings: true,
      });

      const connection = await this.pool.getConnection();
      logger.success(`Conexão com MySQL estabelecida com sucesso no host ${config.db.host}!`);
      
      // Sincroniza fuso horário da sessão MySQL para Horário de Brasília)
      try {
        await connection.query("SET time_zone = 'America/Sao_Paulo'");
      } catch (tzErr) {
        try {
          await connection.query("SET time_zone = '-03:00'");
        } catch {
          // Se o timezone nomeado não estiver disponível, mantém o offset absoluto.
        }
      }

      // Auto-create single table if not exists in MySQL
      await connection.query(`
        CREATE TABLE IF NOT EXISTS falhas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          equipamento_id VARCHAR(50) NOT NULL,
          setor VARCHAR(100) NOT NULL,
          user VARCHAR(30) NOT NULL,
          status TINYINT NOT NULL DEFAULT 0,
          attempts INT NOT NULL DEFAULT 0,
          error_message TEXT NULL,
          creat_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          update_at DATETIME NULL,
          INDEX idx_falhas_status (status),
          INDEX idx_falhas_equipamento (equipamento_id),
          INDEX idx_falhas_creat_at (creat_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      connection.release();
      this.isMysqlActive = true;
    } catch (err: any) {
      logger.error(`MySQL indisponível: ${err.message}`);
      this.isMysqlActive = false;
      this.pool = null;
      throw err;
    }
  }

  public getMode(): 'mysql' {
    return 'mysql';
  }

  // --- INSERÇÃO DE FALHA (Única Tabela Conforme Imagem) ---
  public async insertFalha(data: {
    equipamento_id: string;
    setor: string;
    user: string;
    creat_at?: string;
  }): Promise<FalhaEvent> {
    const equipId = data.equipamento_id.trim().toUpperCase();
    const rawDate = data.creat_at || new Date();
    const formattedCreatAt = toMysqlDatetime(rawDate);
    const localIsoCreatAt = toLocalIsoString(rawDate);

    if (this.isMysqlActive && this.pool) {
      try {
        const [existingRows]: any = await this.pool.query(
          `SELECT * FROM falhas WHERE equipamento_id = ? AND creat_at = ? LIMIT 1`,
          [equipId, formattedCreatAt]
        );
        if (existingRows && existingRows.length > 0) {
          logger.info(`Falha duplicada ignorada no MySQL para ${equipId} em ${formattedCreatAt}.`);
          return {
            id: existingRows[0].id,
            equipamento_id: existingRows[0].equipamento_id,
            setor: existingRows[0].setor,
            user: existingRows[0].user,
            status: existingRows[0].status,
            attempts: existingRows[0].attempts || 0,
            error_message: existingRows[0].error_message || null,
            creat_at: existingRows[0].creat_at,
            update_at: existingRows[0].update_at,
          };
        }
      } catch (e) {
        logger.warn(`Falha na verificação de duplicidade para ${equipId}: ${String(e)}`);
      }
    }

    const newFalha: FalhaEvent = {
      id: 0,
      equipamento_id: equipId,
      setor: data.setor.trim() || 'Geral',
      user: data.user.replace(/\D/g, ''),
      status: 0,
      attempts: 0,
      error_message: null,
      creat_at: localIsoCreatAt,
      update_at: null,
    };

    if (this.isMysqlActive && this.pool) {
      try {
        const [res]: any = await this.pool.query(
          `INSERT INTO falhas (equipamento_id, setor, user, status, attempts, creat_at)
           VALUES (?, ?, ?, 0, 0, ?)`,
          [newFalha.equipamento_id, newFalha.setor, newFalha.user, formattedCreatAt]
        );
        newFalha.id = res.insertId;
      } catch (e) {
        logger.error('Erro ao inserir falha no MySQL', e);
        throw e;
      }
    }

    return newFalha;
  }

  /**
   * Busca e bloqueia atômico de registros com status = 0 (Pendente) ou status = 3 para retry
   */
  public async fetchAndLockPendingFalhas(limit = 20): Promise<FalhaEvent[]> {
    if (this.isMysqlActive && this.pool) {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();

        const [rows]: any = await connection.query(
          `SELECT * FROM falhas 
           WHERE (status = 0 OR (status = 3 AND attempts < ?))
           ORDER BY creat_at ASC 
           LIMIT ? 
           FOR UPDATE`,
          [config.maxRetryAttempts, limit]
        );

        const lockedEvents: FalhaEvent[] = rows.map((r: any) => ({
          id: r.id,
          equipamento_id: r.equipamento_id,
          setor: r.setor,
          user: r.user,
          status: r.status,
          attempts: r.attempts || 0,
          error_message: r.error_message || null,
          creat_at: r.creat_at,
          update_at: r.update_at,
        }));

        if (lockedEvents.length > 0) {
          const ids = lockedEvents.map((e) => e.id);
          await connection.query(
            `UPDATE falhas SET status = 2 WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
          );
        }

        await connection.commit();
        return lockedEvents;
      } catch (err) {
        await connection.rollback();
        logger.error('Erro no lock de falhas no MySQL', err);
        return [];
      } finally {
        connection.release();
      }
    }

    throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
  }

public async updateFalhaSuccess(id: number, updateAtIso?: string | Date): Promise<void> {
    if (!this.isMysqlActive || !this.pool) {
      throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
    }

    try {
      // Usa a mesma função de conversão para garantir o horário correto de Brasília (-03:00)
      const mysqlFormattedDate = toMysqlDatetime(updateAtIso || new Date());
      await this.pool.query(
        'UPDATE falhas SET status = 1, update_at = ? WHERE id = ?',
        [mysqlFormattedDate, id]
      );
    } catch (e) {
      logger.error(`Erro ao atualizar sucesso da falha #${id} no MySQL`, e);
      throw e;
    }
  }

  public async updateFalhaError(
    id: number,
    errorMessage: string,
    attempts: number
  ): Promise<void> {
    if (!this.isMysqlActive || !this.pool) {
      throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
    }

    try {
      await this.pool.query(
        `UPDATE falhas 
         SET status = 3, attempts = ?, error_message = ? 
         WHERE id = ?`,
        [attempts, errorMessage, id]
      );
    } catch (e) {
      logger.error(`Erro ao atualizar erro da falha #${id} no MySQL`, e);
      throw e;
    }
  }

  public async manualRetryFalha(id: number): Promise<boolean> {
    if (!this.isMysqlActive || !this.pool) {
      throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
    }

    try {
      await this.pool.query(
        'UPDATE falhas SET status = 0, error_message = NULL WHERE id = ?',
        [id]
      );
      return true;
    } catch (e) {
      logger.error(`Erro no retry manual da falha #${id}`, e);
      return false;
    }
  }

  public async getFalhas(limit = 100): Promise<FalhaEvent[]> {
    if (!this.isMysqlActive || !this.pool) {
      throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
    }

    try {
      const [rows] = await this.pool.query<any[]>(
        'SELECT * FROM falhas ORDER BY creat_at DESC LIMIT ?',
        [limit]
      );
      return rows.map((r: any) => ({
        id: r.id,
        equipamento_id: r.equipamento_id,
        setor: r.setor,
        user: r.user,
        status: r.status,
        attempts: r.attempts || 0,
        error_message: r.error_message || null,
        creat_at: r.creat_at,
        update_at: r.update_at,
      })) as FalhaEvent[];
    } catch (e) {
      logger.error('Erro ao listar falhas do MySQL', e);
      throw e;
    }
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    const startOfDay = getStartOfDayInSaoPaulo();

    const all = await this.getFalhas(1000);
    const todayEvents = all.filter((f) => new Date(f.creat_at) >= startOfDay);

    return {
      totalHoje: todayEvents.length,
      enviados: all.filter((f) => f.status === 1).length,
      pendentes: all.filter((f) => f.status === 0).length,
      erros: all.filter((f) => f.status === 3).length,
      processando: all.filter((f) => f.status === 2).length,
    };
  }

  public async cleanOldRecords(retentionDays: number): Promise<number> {
    if (!this.isMysqlActive || !this.pool) {
      throw new Error('MySQL não está disponível. Configure DATABASE_HOST/DATABASE_URL antes de iniciar o sistema.');
    }

    try {
      const [res]: any = await this.pool.query(
        'DELETE FROM falhas WHERE status IN (1, 3) AND creat_at < (NOW() - INTERVAL ? DAY)',
        [retentionDays]
      );
      return res.affectedRows || 0;
    } catch (e) {
      logger.error('Erro ao executar limpeza no MySQL', e);
      throw e;
    }
  }
}

export const db = new DatabaseService();
