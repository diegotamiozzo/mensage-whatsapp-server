import { ShieldAlert, Settings, LogOut, RefreshCw, QrCode } from 'lucide-react';
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
}: NavbarProps) {
  const getStatusBadge = () => {
    switch (whatsappStatus) {
      case 'connected':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 transition-all cursor-pointer"
            title="Gerenciar sessão do WhatsApp"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            WhatsApp Conectado
          </button>
        );
      case 'waiting_qr':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 transition-all cursor-pointer"
            title="Escanear o QR Code"
          >
            <QrCode size={14} className="text-[#285995]" />
            Escanear QR Code
          </button>
        );
      case 'connecting':
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 cursor-pointer"
          >
            <RefreshCw size={14} className="animate-spin text-[#285995]" />
            Conectando...
          </button>
        );
      default:
        return (
          <button
            onClick={onWhatsAppClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 transition-all cursor-pointer"
            title="Conectar o WhatsApp"
          >
            <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
            WhatsApp Desconectado
          </button>
        );
    }
  };

  return (
    <header className="bg-[#181F26] border-b border-[#5A656C]/20 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F2730] border border-[#5A656C]/30 flex items-center justify-center text-[#D3D6D9]">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide text-white block">SISTEMA DE NOTIFICAÇÃO</span>
            <p className="text-[11px] text-[#5A656C] font-mono hidden sm:block">tabela: falhas</p>
          </div>
        </div>

        {/* Action Controls & WhatsApp Status juntos à direita */}
        <div className="flex items-center gap-2">
          {/* Status do WhatsApp reposicionado aqui */}
          <div className="flex items-center mr-1">
            {getStatusBadge()}
          </div>

          <button
            onClick={onConfigClick}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F2730] hover:bg-[#28323E] text-[#D3D6D9] border border-[#5A656C]/30 transition-colors flex items-center gap-2 cursor-pointer"
            title="Configurações & Script SQL da Tabela"
          >
            <Settings size={14} className="text-[#5A656C]" />
            <span className="hidden sm:inline">Config & SQL</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-[#D3D6D9] hover:text-white bg-[#1F2730] hover:bg-[#28323E] border border-[#5A656C]/30 transition-colors cursor-pointer"
            title="Atualizar tabela manualmente"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#5A656C]' : ''} />
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-[#D3D6D9] hover:text-white bg-[#1F2730] hover:bg-[#28323E] border border-[#5A656C]/30 transition-colors ml-1 cursor-pointer"
            title="Sair do painel"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}