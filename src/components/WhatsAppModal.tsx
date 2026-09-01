import React, { useState } from 'react';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unlink,
  Radio,
  Loader2,
  X,
} from 'lucide-react';
import { WhatsAppState } from '../types';
import { api } from '../services/api';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WhatsAppState;
  qrCode: string | null;
  onRefresh: () => void;
}

export function WhatsAppModal({
  isOpen,
  onClose,
  status,
  qrCode,
  onRefresh,
}: WhatsAppModalProps) {
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      await api.connectWhatsApp();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao inicializar conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar a sessão do WhatsApp?')) return;
    setLoading(true);
    try {
      await api.disconnectWhatsApp();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      alert('Digite um número de celular válido.');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      await api.sendTestMessage(testPhone.trim());
      setTestResult({ success: true, message: `Mensagem de teste unitário enviada com sucesso para ${testPhone}!` });
      setTestPhone('');
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Erro ao enviar mensagem de teste.' });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#12161A]/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-[#181F26] border border-[#5A656C]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#5A656C]/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#285995]/20 text-[#285995] border border-[#285995]/30">
              <Radio size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Conexão WhatsApp</h3>
              <p className="text-xs text-[#D3D6D9]/70">Envio automático de alertas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5A656C] hover:text-white hover:bg-[#1F2730] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Box */}
        <div className="space-y-4">
          {status === 'connected' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-400 block">Sessão Ativa & Conectada</span>
                  <span className="text-[11px] text-[#D3D6D9]/80">Pronto para disparar mensagens</span>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                Desconectar
              </button>
            </div>
          )}

          {status === 'waiting_qr' && qrCode && (
            <div className="p-4 rounded-xl bg-[#12161A] border border-[#5A656C]/40 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-bold">
                <QrCode size={16} />
                <span>Escaneie o QR Code com seu WhatsApp</span>
              </div>
              <div className="bg-white p-3 rounded-xl inline-block shadow-lg mx-auto">
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[11px] text-[#D3D6D9]/70">
                Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar um Aparelho
              </p>
            </div>
          )}

          {(status === 'disconnected' || (status === 'waiting_qr' && !qrCode)) && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-400 block">WhatsApp Desconectado</span>
                  <span className="text-[11px] text-[#D3D6D9]/80">Inicie a sessão para gerar o QR Code</span>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#285995] hover:bg-[#346fb8] text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Conectar
              </button>
            </div>
          )}

          {status === 'connecting' && (
            <div className="p-4 rounded-xl bg-[#285995]/10 border border-[#285995]/30 flex items-center gap-3 text-xs text-[#D3D6D9]">
              <Loader2 size={18} className="animate-spin text-[#285995]" />
              <span>Inicializando socket Baileys e gerando QR Code...</span>
            </div>
          )}
        </div>

        {/* Test Message Form */}
        <div className="pt-3 border-t border-[#5A656C]/30 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Teste Unitário de Envio</h4>
          <form onSubmit={handleSendTest} className="space-y-2">
            <div>
              <label className="text-[11px] text-[#D3D6D9]/70 block mb-1">
                Número do Celular
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5548999998888"
                  className="flex-1 bg-[#12161A] border border-[#5A656C]/40 rounded-xl px-3 py-2 text-xs text-white placeholder-[#5A656C] focus:outline-none focus:border-[#285995]"
                />
                <button
                  type="submit"
                  disabled={testSending || status !== 'connected'}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {testSending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Enviar Teste
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                }`}
              >
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] text-xs font-medium rounded-xl border border-[#5A656C]/30 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
