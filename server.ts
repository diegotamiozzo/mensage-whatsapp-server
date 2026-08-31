import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import { config } from './server/config.js';
import { db } from './server/db/database.js';
import { setSocketIO } from './server/socket.js';
import { logger } from './server/services/logger.js';
import { whatsappService } from './server/services/whatsapp.js';
import { worker } from './server/services/worker.js';
import { cleanerService } from './server/services/cleaner.js';
import { throttlingService } from './server/services/throttling.js';
import { generateTestMessage } from './server/services/messageTemplate.js';
import {
  verifyAccessCode,
  generateSessionToken,
  validateSessionToken,
  revokeSessionToken,
  authMiddleware,
} from './server/services/auth.js';

const __filename = '';
const __dirname = process.cwd();

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  setSocketIO(io);

  io.on('connection', (socket) => {
    socket.emit('whatsapp:status', whatsappService.getStatus());
    db.getDashboardStats().then((stats) => {
      socket.emit('worker:stats_changed', stats);
    });
  });

  app.use(cors());
  app.use(express.json());

  // ---------------------------------------------------------------------------
  // AUTENTICAÇÃO
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { accessCode } = req.body;
    if (!accessCode) {
      return res.status(400).json({ success: false, message: 'Código de acesso obrigatório.' });
    }

    if (verifyAccessCode(accessCode)) {
      const token = generateSessionToken();
      logger.info('Acesso autorizado ao painel industrial.');
      return res.json({ success: true, token });
    }

    logger.warn('Tentativa de acesso com código incorreto.');
    return res.status(401).json({ success: false, message: 'Código de acesso incorreto.' });
  });

  app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const isValid = token ? validateSessionToken(token) : false;
    res.json({ authenticated: isValid });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (token) revokeSessionToken(token);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------
  // ROTA DE INGESTÃO DIRETA (CLP / NODE-RED / SUPERVISÓRIO / IOT)
  // ---------------------------------------------------------------------------
  app.post('/api/iot/falha', async (req, res) => {
    try {
      const {
        equipamento_id,
        codigo_equipamento,
        setor,
        user,
        recipient,
        creat_at,
        created_at,
      } = req.body;

      const finalEquip = (equipamento_id || codigo_equipamento || '').trim();
      const finalUser = (user || recipient || '').trim();
      const finalSetor = (setor || 'Geral').trim();
      const finalDate = creat_at || created_at;

      if (!finalEquip || !finalUser) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetros "equipamento_id" e "user" são obrigatórios.',
        });
      }

      const falha = await db.insertFalha({
        equipamento_id: finalEquip,
        setor: finalSetor,
        user: finalUser,
        creat_at: finalDate,
      });

      logger.info(
        `Novo evento de falha gravado na fila para ${falha.equipamento_id} (#${falha.id}) com status = 0 (Pendente)`
      );

      worker.tick().catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Evento gravado na tabela falhas com status = 0.',
        event: falha,
      });
    } catch (err: any) {
      logger.error(`Erro ao registrar falha via IoT API: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // ROTAS DO DASHBOARD
  // ---------------------------------------------------------------------------
  app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
      const stats = await db.getDashboardStats();
      res.json({
        ...stats,
        dbMode: db.getMode(),
        whatsappStatus: whatsappService.getStatus().status,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/falhas', authMiddleware, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const falhas = await db.getFalhas(limit);
      res.json(falhas);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/falhas/simular', authMiddleware, async (req, res) => {
    try {
      const { equipamento_id, codigo_equipamento, setor, user, recipient } = req.body;
      const finalEquip = (equipamento_id || codigo_equipamento || '').trim();
      const finalUser = (user || recipient || '').trim();
      const finalSetor = (setor || 'Geral').trim();

      if (!finalEquip || !finalUser) {
        return res.status(400).json({
          success: false,
          message: 'Informe o equipamento e o telefone destinatário (user).',
        });
      }

      const falha = await db.insertFalha({
        equipamento_id: finalEquip,
        setor: finalSetor,
        user: finalUser,
      });

      logger.info(`Simulação de falha acionada: ${falha.equipamento_id} (#${falha.id})`);
      worker.tick().catch(() => {});

      res.json({ success: true, event: falha });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/falhas/:id/retry', authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      logger.info(`Solicitado reprocessamento manual da falha #${id}`);
      await worker.triggerImmediateRetry(id);
      res.json({ success: true, message: 'Evento reenviado para a fila de processamento.' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/logs', authMiddleware, (req, res) => {
    res.json(logger.getRecentLogs());
  });

  app.post('/api/cleaner/run', authMiddleware, async (req, res) => {
    try {
      const count = await cleanerService.runCleanup();
      res.json({ success: true, count, message: `${count} registros antigos removidos.` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/throttling/reset', authMiddleware, (req, res) => {
    const { equipamento_id } = req.body;
    if (equipamento_id) {
      throttlingService.resetThrottle(equipamento_id);
      logger.info(`Cooldown anti-flood resetado para ${equipamento_id}.`);
    }
    res.json({ success: true });
  });

  app.get('/api/config', authMiddleware, (req, res) => {
    res.json({
      pollingInterval: config.pollingIntervalMs,
      maxRetryAttempts: config.maxRetryAttempts,
      dataRetentionDays: config.dataRetentionDays,
      throttleWindowMinutes: config.throttleWindowMinutes,
      databaseMode: db.getMode(),
      databaseHost: config.db.host || 'Motor Integrado Local',
    });
  });

  // ---------------------------------------------------------------------------
  // WHATSAPP
  // ---------------------------------------------------------------------------
  app.get('/whatsapp/status', (req, res) => {
    res.json(whatsappService.getStatus());
  });

  app.post('/whatsapp/connect', authMiddleware, async (req, res) => {
    try {
      await whatsappService.connectToWhatsApp();
      res.json({ success: true, message: 'Processo de conexão iniciado' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Erro ao conectar' });
    }
  });

  app.post('/whatsapp/disconnect', authMiddleware, async (req, res) => {
    try {
      const result = await whatsappService.disconnectWhatsApp();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Erro ao desconectar' });
    }
  });

  app.post('/whatsapp/send-test', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Número de telefone é obrigatório.' });
      }
      const testMsg = generateTestMessage(phone);
      const result = await whatsappService.sendMessage(phone, testMsg);
      logger.success(`Mensagem de teste enviada com sucesso para ${phone}`);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Erro ao enviar mensagem de teste' });
    }
  });

  // ---------------------------------------------------------------------------
  // FRONTEND SPA SERVING
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  worker.start();
  cleanerService.start();

  const PORT = config.port;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(` INDUSTRIAL ALERT SYSTEM rodando na porta ${PORT}`);
    console.log(` Modo de Banco: ${db.getMode().toUpperCase()} (Tabela Única 'falhas')`);
    console.log(` Código de Acesso Padrão: ${config.accessCode}`);
    console.log(`========================================================`);
  });
}

startServer();
