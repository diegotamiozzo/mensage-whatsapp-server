import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../services/logger.js';

function getBraziliaDate(dateInput?: Date | string | null): Date {
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

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hours = Number(values.hour);
  const minutes = Number(values.minute);
  const seconds = Number(values.second);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function toMysqlDatetime(dateInput?: Date | string | null): string {
  const d = getBraziliaDate(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toLocalIsoString(dateInput?: Date | string | null): string {
  const d = getBraziliaDate(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`;
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
  private localDataPath = path.join(process.cwd(), 'data_storage.json');

  // Single in-memory / local file storage for the unified table
  private localFalhas: FalhaEvent[] = [];
  private nextFalhaId = 1;

  constructor() {
    this.initLocalData();
    this.tryInitMysql();
  }

  private initLocalData() {
    try {
      if (fs.existsSync(this.localDataPath)) {
        const raw = fs.readFileSync(this.localDataPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.falhas)) {
          // Normalize existing data if necessary
          this.localFalhas = parsed.falhas.map((f: any) => ({
            id: Number(f.id),
            equipamento_id: f.equipamento_id || f.codigo_equipamento || 'EQ-001',
            setor: f.setor || 'Geral',
            user: f.user || f.recipient || '',
            status: (f.status !== undefined ? Number(f.status) : 0) as 0 | 1 | 2 | 3,
            attempts: Number(f.attempts || 0),
            error_message: f.error_message || null,
            creat_at: f.creat_at || f.created_at || new Date().toISOString(),
            update_at: f.update_at || f.sent_at || f.updated_at || null,
          }));
        }
        this.nextFalhaId = parsed.nextFalhaId || (this.localFalhas.length + 1);
      }
    } catch (e) {
      console.warn('Resetando armazenamento local integrado.');
    }

    if (this.localFalhas.length === 0) {
      // Seed initial example data for demo
      const now = Date.now();
      this.localFalhas = [
        {
          id: 1,
          equipamento_id: 'PRENSA-01',
          setor: 'Estamparia',
          user: '5548999998888',
          status: 1,
          attempts: 1,
          error_message: null,
          creat_at: new Date(now - 1000 * 60 * 45).toISOString(),
          update_at: new Date(now - 1000 * 60 * 44).toISOString(),
        },
        {
          id: 2,
          equipamento_id: 'TORNO-CNC-02',
          setor: 'Usinagem',
          user: '5548999998888',
          status: 1,
          attempts: 1,
          error_message: null,
          creat_at: new Date(now - 1000 * 60 * 20).toISOString(),
          update_at: new Date(now - 1000 * 60 * 19).toISOString(),
        },
        {
          id: 3,
          equipamento_id: 'COMPRESSOR-A',
          setor: 'Utilidades',
          user: '5548999998888',
          status: 0,
          attempts: 0,
          error_message: null,
          creat_at: new Date(now - 1000 * 60 * 2).toISOString(),
          update_at: null,
        },
      ];
      this.nextFalhaId = 4;
    }

    this.saveLocalData();
  }

  private saveLocalData() {
    try {
      fs.writeFileSync(
        this.localDataPath,
        JSON.stringify(
          {
            falhas: this.localFalhas,
            nextFalhaId: this.nextFalhaId,
          },
          null,
          2
        )
      );
    } catch (e) {
      // Ignore disk write errors in ephemeral environment
    }
  }

  private async tryInitMysql() {
    if (!config.db.host && !config.db.url) {
      logger.info('Modo de Banco: Motor Integrado (MySQL pode ser ativado configurando DATABASE_HOST no .env)');
      return;
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
      
      // Sincroniza fuso horário da sessão MySQL para Horário de Brasília (UTC-3)
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
      logger.warn(`MySQL não disponível (${err.message}). Utilizando banco de dados local integrado.`);
      this.isMysqlActive = false;
      this.pool = null;
    }
  }

  public getMode(): 'mysql' | 'embedded' {
    return this.isMysqlActive ? 'mysql' : 'embedded';
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

    // Evita duplicar o registro se o mesmo equipamento chegar com exatamente o mesmo timestamp (creat_at)
    const existingSameTimestamp = this.localFalhas.find(
      (f) => f.equipamento_id.toUpperCase() === equipId && f.creat_at.startsWith(formattedCreatAt.substring(0, 19))
    );
    if (existingSameTimestamp) {
      logger.info(`Falha duplicada ignorada para o equipamento ${equipId} no mesmo timestamp (${formattedCreatAt}).`);
      return existingSameTimestamp;
    }

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
      } catch (e) {}
    }

    const newId = this.nextFalhaId++;

    const newFalha: FalhaEvent = {
      id: newId,
      equipamento_id: equipId,
      setor: data.setor.trim() || 'Geral',
      user: data.user.replace(/\D/g, ''),
      status: 0, // 0 = Inserido falha no banco (Pendente)
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
      }
    }

    this.localFalhas.unshift(newFalha);
    this.saveLocalData();
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

    // Atomic in-memory processing
    const candidates = this.localFalhas
      .filter((f) => {
        if (f.status === 0) return true;
        if (f.status === 3 && f.attempts < config.maxRetryAttempts) return true;
        return false;
      })
      .sort((a, b) => new Date(a.creat_at).getTime() - new Date(b.creat_at).getTime())
      .slice(0, limit);

    const lockedList: FalhaEvent[] = [];
    for (const c of candidates) {
      c.status = 2; // 2 = Processando
      lockedList.push({ ...c });
    }

    if (lockedList.length > 0) {
      this.saveLocalData();
    }

    return lockedList;
  }

  public async updateFalhaSuccess(id: number, updateAtIso: string): Promise<void> {
    if (this.isMysqlActive && this.pool) {
      try {
        const mysqlFormattedDate = toMysqlDatetime(updateAtIso);
        await this.pool.query(
          'UPDATE falhas SET status = 1, update_at = ? WHERE id = ?',
          [mysqlFormattedDate, id]
        );
      } catch (e) {
        logger.error(`Erro ao atualizar sucesso da falha #${id} no MySQL`, e);
      }
    }

    const item = this.localFalhas.find((f) => f.id === id);
    if (item) {
      item.status = 1; // 1 = Enviado
      item.update_at = updateAtIso; // Momento do envio da mensagem
      this.saveLocalData();
    }
  }

  public async updateFalhaError(
    id: number,
    errorMessage: string,
    attempts: number
  ): Promise<void> {
    if (this.isMysqlActive && this.pool) {
      try {
        await this.pool.query(
          `UPDATE falhas 
           SET status = 3, attempts = ?, error_message = ? 
           WHERE id = ?`,
          [attempts, errorMessage, id]
        );
      } catch (e) {
        logger.error(`Erro ao atualizar erro da falha #${id} no MySQL`, e);
      }
    }

    const item = this.localFalhas.find((f) => f.id === id);
    if (item) {
      item.status = 3; // 3 = Erro
      item.attempts = attempts;
      item.error_message = errorMessage;
      this.saveLocalData();
    }
  }

  public async manualRetryFalha(id: number): Promise<boolean> {
    if (this.isMysqlActive && this.pool) {
      try {
        await this.pool.query(
          'UPDATE falhas SET status = 0, error_message = NULL WHERE id = ?',
          [id]
        );
      } catch (e) {}
    }
    const item = this.localFalhas.find((f) => f.id === id);
    if (item) {
      item.status = 0; // Volta para Pendente
      item.error_message = null;
      this.saveLocalData();
      return true;
    }
    return false;
  }

  public async getFalhas(limit = 100): Promise<FalhaEvent[]> {
    if (this.isMysqlActive && this.pool) {
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
        logger.error('Erro ao listar falhas do MySQL, usando local');
      }
    }
    return [...this.localFalhas]
      .sort((a, b) => new Date(b.creat_at).getTime() - new Date(a.creat_at).getTime())
      .slice(0, limit);
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let deletedCount = 0;

    if (this.isMysqlActive && this.pool) {
      try {
        const [res]: any = await this.pool.query(
          'DELETE FROM falhas WHERE status IN (1, 3) AND creat_at < (NOW() - INTERVAL ? DAY)',
          [retentionDays]
        );
        deletedCount = res.affectedRows || 0;
      } catch (e) {
        logger.error('Erro ao executar limpeza no MySQL', e);
      }
    }

    const initialLen = this.localFalhas.length;
    this.localFalhas = this.localFalhas.filter((f) => {
      if ((f.status === 1 || f.status === 3) && new Date(f.creat_at) < cutoff) {
        return false;
      }
      return true;
    });
    deletedCount += initialLen - this.localFalhas.length;
    this.saveLocalData();

    return deletedCount;
  }
}

export const db = new DatabaseService();
