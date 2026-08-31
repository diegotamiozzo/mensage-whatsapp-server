import { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Trash2,
  Copy,
  Check,
  Loader2,
  Code2,
} from 'lucide-react';
import { SystemConfig } from '../types';
import { api } from '../services/api';

interface ConfigModalProps {
  onClose: () => void;
}

export function ConfigModal({ onClose }: ConfigModalProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedNodeRed, setCopiedNodeRed] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleRunCleanup = async () => {
    if (!confirm('Deseja executar a limpeza de registros antigos agora?')) return;
    setCleaning(true);
    setCleanFeedback(null);
    try {
      const res = await api.runCleanup();
      setCleanFeedback(res.message);
    } catch (e: any) {
      alert(e.message || 'Erro ao executar limpeza.');
    } finally {
      setCleaning(false);
    }
  };

  const sqlSchemaScript = `-- ============================================================================
-- TABELA ÚNICA DE FALHAS INDUSTRIAIS (MySQL / MariaDB)
-- ============================================================================
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

-- Exemplo de inserção pelo CLP / Node-RED:
INSERT INTO falhas (equipamento_id, setor, user, status, creat_at)
VALUES ('EQ-001', 'Estamparia', '5548999998888', 0, NOW());`;

  const nodeRedFunctionCode = `// Node-RED Function Node
// Dispara quando o CLP detecta falha
msg.topic = "INSERT INTO falhas (equipamento_id, setor, user, status, creat_at) VALUES (?, ?, ?, 0, NOW());";
msg.payload = [
    msg.payload.equipamento || "EQ-001",
    msg.payload.setor || "Estamparia",
    msg.payload.telefone || "5548999998888"
];
return msg;`;

  const copyToClipboard = (text: string, type: 'sql' | 'nodered') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedNodeRed(true);
      setTimeout(() => setCopiedNodeRed(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#12161A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181F26] border border-[#5A656C]/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#5A656C]/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#285995]/20 text-[#285995] border border-[#285995]/30">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Configurações & Script SQL (Tabela Única)</h3>
              <p className="text-xs text-[#D3D6D9]/70">Parâmetros do Worker, banco de dados e exemplos de integração</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#D3D6D9] hover:text-white text-xs px-2.5 py-1 bg-[#1F2730] border border-[#5A656C]/30 rounded-lg cursor-pointer"
          >
            ✕ Fechar
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs custom-scrollbar">
          {/* Status Geral */}
          {loading ? (
            <div className="py-8 flex justify-center text-[#285995]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : config ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#12161A] border border-[#5A656C]/30 rounded-xl">
                <span className="text-[#5A656C] block">Polling Interval:</span>
                <span className="text-[#D3D6D9] font-bold font-mono">{config.pollingInterval} ms</span>
              </div>
              <div className="p-3 bg-[#12161A] border border-[#5A656C]/30 rounded-xl">
                <span className="text-[#5A656C] block">Tentativas Máximas:</span>
                <span className="text-[#D3D6D9] font-bold font-mono">{config.maxRetryAttempts} tentativas</span>
              </div>
              <div className="p-3 bg-[#12161A] border border-[#5A656C]/30 rounded-xl">
                <span className="text-[#5A656C] block">Retenção de Dados:</span>
                <span className="text-[#D3D6D9] font-bold font-mono">{config.dataRetentionDays} dias</span>
              </div>
              <div className="p-3 bg-[#12161A] border border-[#5A656C]/30 rounded-xl">
                <span className="text-[#5A656C] block">Janela Anti-Flood:</span>
                <span className="text-[#D3D6D9] font-bold font-mono">{config.throttleWindowMinutes} min</span>
              </div>
              <div className="p-3 bg-[#12161A] border border-[#5A656C]/30 rounded-xl col-span-2">
                <span className="text-[#5A656C] block">Banco de Dados:</span>
                <span className="text-[#285995] font-bold font-mono">
                  {config.databaseMode === 'mysql' ? `MySQL (${config.databaseHost})` : 'Motor Local Integrado'}
                </span>
              </div>
            </div>
          ) : null}

          {/* Script SQL Oficial */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Database size={14} className="text-[#285995]" />
                <span>Script SQL Oficial (Tabela Única `falhas`)</span>
              </div>
              <button
                onClick={() => copyToClipboard(sqlSchemaScript, 'sql')}
                className="px-2.5 py-1 bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 rounded-lg flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedSql ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#0E1215] border border-[#5A656C]/30 rounded-xl font-mono text-[11px] text-[#D3D6D9] overflow-x-auto">
              {sqlSchemaScript}
            </pre>
          </div>

          {/* Exemplo Node-RED */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Code2 size={14} className="text-emerald-400" />
                <span>Exemplo Node-RED (Inserção pelo CLP)</span>
              </div>
              <button
                onClick={() => copyToClipboard(nodeRedFunctionCode, 'nodered')}
                className="px-2.5 py-1 bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 rounded-lg flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedNodeRed ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedNodeRed ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#0E1215] border border-[#5A656C]/30 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto">
              {nodeRedFunctionCode}
            </pre>
          </div>

          {/* Limpeza Manual de Registros */}
          <div className="p-4 bg-[#12161A] border border-[#5A656C]/30 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Limpeza de Histórico Antigo</span>
              <p className="text-[#5A656C] text-[11px]">
                Remove registros com mais de {config?.dataRetentionDays || 30} dias para otimizar espaço
              </p>
              {cleanFeedback && <p className="text-emerald-400 text-[11px] mt-1">{cleanFeedback}</p>}
            </div>
            <button
              onClick={handleRunCleanup}
              disabled={cleaning}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"
            >
              {cleaning ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>Executar Limpeza</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#5A656C]/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] rounded-xl cursor-pointer text-xs border border-[#5A656C]/30"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
