import React, { useState } from 'react';
// 1. Importe os ícones Eye e EyeOff do lucide-react
import { ShieldAlert, KeyRound, ArrowRight, Loader2, Cpu, Eye, EyeOff } from 'lucide-react';
import { api, setAuthToken } from '../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2. Crie o estado para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(accessCode);
      if (res.success && res.token) {
        setAuthToken(res.token);
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Código de acesso incorreto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#12161A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#285995]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5A656C]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-[#181F26] border border-[#5A656C]/40 rounded-3xl p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#285995] border border-[#285995]/60 flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">SISTEMA DE NOTIFICAÇÃO</h1>
          <p className="text-xs text-[#D3D6D9]/80 mt-1.5 font-medium">
            Monitoramento de Falhas & Notificações via WhatsApp
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#D3D6D9] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Código de Acesso</span>
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A656C]" />
              
              {/* 3. O type agora é dinâmico com base no estado showPassword */}
              <input
                type={showPassword ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Digite o código de acesso"
                required
                autoFocus
                className="w-full pl-10 pr-11 py-3 bg-[#12161A] border border-[#5A656C]/40 rounded-xl text-sm text-white placeholder-[#5A656C] font-mono focus:outline-none focus:ring-2 focus:ring-[#285995]"
              />

              {/* 4. Botão de alternância posicionado no canto direito do input */}
              <button
                type="button" // IMPORTANTE: type="button" para não disparar o submit do form
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A656C] hover:text-[#D3D6D9] transition-colors focus:outline-none"
                tabIndex={-1} // Evita que o tab pare no ícone antes do botão de entrar
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !accessCode}
            className="w-full py-3 px-4 bg-[#285995] hover:bg-[#346fb8] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-[#285995]"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Entrar</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* System Architecture info */}
        <div className="mt-8 pt-6 border-t border-[#5A656C]/30 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-[#5A656C]">
            <span>{new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}