# Sistema de Notificação e Alertas Industriais via WhatsApp

Sistema full-stack (**Express** + **React/Vite** + **Socket.IO** + **Baileys**) para recepção de eventos de falhas industriais (CLPs, supervisórios, Node-RED, sensores IoT) e disparo automatizado de notificações via WhatsApp.

---

## 🏗️ Arquitetura

```
├── server/
│   ├── config.ts              # Configurações do sistema via variáveis de ambiente
│   ├── db/
│   │   └── database.ts        # Camada de banco unificada (MySQL + Fallback JSON Local)
│   ├── services/
│   │   ├── auth.ts            # Autenticação por access code, rate limiting e tokens TTL
│   │   ├── cleaner.ts         # Rotina de expurgo de registros antigos
│   │   ├── logger.ts          # Buffer de logs em memória para o painel
│   │   ├── messageTemplate.ts # Formatação dos templates de mensagem de alerta
│   │   ├── whatsapp.ts        # Integração com WhatsApp Web via Baileys
│   │   └── worker.ts          # Fila e processamento assíncrono de disparos
│   └── socket.ts              # WebSocket Socket.IO em tempo real
├── src/                       # Frontend SPA (React + Tailwind CSS + Lucide Icons)
│   ├── components/            # Painel, Dashboard, QR Code, Logs e Modais
│   ├── services/              # Cliente API e WebSocket
│   └── types/                 # Interfaces TypeScript
├── server.ts                  # Ponto de entrada do servidor Node.js + Express
└── vite.config.ts             # Configuração do Vite para desenvolvimento e build
```

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.
- Gerenciador de pacotes `npm`.

### 2. Instalação de Dependências
Na raiz do projeto, instale as dependências:

```bash
npm install
```

### 3. Configuração do `.env`
Crie ou edite o arquivo `.env` baseado no `.env.example`:

```env
PORT=3000
CORS_ORIGIN=*
ACCESS_CODE=admin123

# Opcional: Se não informado, utilizará o motor de banco integrado local (JSON)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=industrial_alerts
DATABASE_USER=root
DATABASE_PASSWORD=sua_senha
```

### 4. Execução em Modo de Desenvolvimento
Inicie o servidor integrado (backend Express + frontend Vite com HMR no mesmo processo):

```bash
npm run dev
```

O dashboard estará disponível em: `http://localhost:3000`

### 5. Build e Execução em Produção

```bash
# Compila o frontend React e o servidor backend
npm run build

# Executa o servidor em modo de produção
npm start
```

---

## 📡 Endpoints da API

### Ingestão de Falhas (IoT / CLP / Supervisório)
- `POST /api/iot/falha`
  - Não requer autenticação de sessão do dashboard.
  - **Body (JSON):**
    ```json
    {
      "equipamento_id": "EQ-001",
      "setor": "Estamparia",
      "user": "5548999998888"
    }
    ```

### Autenticação do Painel
- `POST /api/auth/login` (com Rate Limiting anti-força bruta)
  - **Body:** `{ "accessCode": "admin123" }`
  - **Retorno:** `{ "success": true, "token": "ind_alert_..." }`
- `GET /api/auth/verify`
- `POST /api/auth/logout`

### Saúde e Monitoramento
- `GET /health` (Status operacional, modo de banco, status do WhatsApp e uptime)
- `GET /api/stats` (Estatísticas do dia e totais por status)
- `GET /api/falhas` (Listagem com filtros e paginação)
- `POST /api/falhas/:id/retry` (Reenfileiramento manual de falhas com erro)
- `GET /api/logs` (Últimos logs do sistema)

### WhatsApp
- `GET /whatsapp/status` (Retorna estado da conexão e QR Code em base64 se pendente)
- `POST /whatsapp/connect` (Inicia o emparelhamento)
- `POST /whatsapp/disconnect` (Desconecta e apaga as credenciais salvas)
- `POST /whatsapp/send-test` (Dispara mensagem de teste unitário)

---

## 🗄️ Script SQL (Tabela `falhas`)

```sql
CREATE DATABASE IF NOT EXISTS industrial_alerts;
USE industrial_alerts;

CREATE TABLE IF NOT EXISTS falhas (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'identificador de falhas',
    equipamento_id VARCHAR(50) NOT NULL COMMENT 'identificador do equipamento',
    setor VARCHAR(100) NOT NULL COMMENT 'setor, local da instalação do equipamento',
    user VARCHAR(30) NOT NULL COMMENT 'destinatário do envio da mensagem (WhatsApp)',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0=Pendente, 1=Enviado, 2=Processando, 3=Erro',
    attempts INT NOT NULL DEFAULT 0 COMMENT 'contador de tentativas',
    error_message TEXT NULL COMMENT 'última mensagem de erro',
    creat_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'momento da falha',
    update_at DATETIME NULL COMMENT 'momento do envio da mensagem',
    INDEX idx_falhas_status (status),
    INDEX idx_falhas_equipamento (equipamento_id),
    INDEX idx_falhas_creat_at (creat_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## ⚠️ Aviso Legal
O uso de bibliotecas não oficiais para automação do WhatsApp (como Baileys) deve estar em conformidade com as diretrizes e termos de serviço da plataforma. Utilize números dedicados para notificações operacionais da empresa.
