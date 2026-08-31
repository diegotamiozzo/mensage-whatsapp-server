import { ShieldAlert, Settings, LogOut, Database, RefreshCw, QrCode } from 'lucide-react';
import { WhatsAppState } from '../types';

interface NavbarProps {
  onConfigClick: () => void;
  onWhatsAppClick: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
  whatsappStatus: WhatsAppState;
  dbMode: string;
}

export function Navbar({
  onConfigClick,
  onWhatsAppClick,
  onRefresh,
  onLogout,
  isRefreshing,
  whatsappStatus,
  dbMode,
}: NavbarProps) {
  const getStatusBadge = () => {
    switch (whatsappStatus) {
      case 'connected':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
            title="Clique para gerenciar sessão do WhatsApp"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            WhatsApp Conectado
          </button>
        );
      case 'waiting_qr':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-all animate-bounce cursor-pointer shadow-md"
            title="Clique para escanear o QR Code"
          >
            <QrCode size={13} />
            Escanear QR Code
          </button>
        );
      case 'connecting':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#285995]/20 text-[#D3D6D9] border border-[#285995]/40 cursor-pointer"
          >
            <RefreshCw size={12} className="animate-spin text-[#285995]" />
            Conectando WhatsApp...
          </button>
        );
      default:
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
            title="Clique para conectar o WhatsApp"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            WhatsApp Desconectado
          </button>
        );
    }
  };

  return (
    <header className="bg-[#181F26] border-b border-[#5A656C]/30 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#285995] border border-[#285995]/50 flex items-center justify-center text-white shadow-inner">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">SISTEMA DE NOTIFICAÇÃO</span>
            </div>
            <p className="text-[11px] text-[#5A656C] font-mono hidden sm:block">tabela: falhas</p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#1F2730] text-[#D3D6D9] border border-[#5A656C]/40">
            <Database size={12} className="text-[#285995]" />
            {dbMode === 'mysql' ? 'MySQL Remoto' : 'Banco Integrado'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onConfigClick}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Configurações & Script SQL da Tabela"
          >
            <Settings size={14} className="text-[#285995]" />
            <span className="font-semibold text-white">Config & SQL</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-[#D3D6D9] hover:text-white bg-[#1F2730] hover:bg-[#28323E] border border-[#5A656C]/40 transition-colors cursor-pointer"
            title="Atualizar tabela manualmente"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#285995]' : ''} />
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors ml-1 cursor-pointer"
            title="Sair do painel"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
