import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuthToken, clearAuthToken, api } from './services/api';
import { getSocket } from './services/socket';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { AlertTable } from './components/AlertTable';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ConfigModal } from './components/ConfigModal';
import { FalhaEvent, DashboardStats, WhatsAppState } from './types';

interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getAuthToken());
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [falhas, setFalhas] = useState<FalhaEvent[]>([]);
  const [dbMode, setDbMode] = useState<string>('embedded');
  const [stats, setStats] = useState<DashboardStats>({
    totalHoje: 0,
    enviados: 0,
    pendentes: 0,
    erros: 0,
    processando: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 0 | 1 | 2 | 3>('all');

  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppState>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((kind: ToastMessage['kind'], title: string, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthenticated(false);
      setCheckingAuth(false);
      return;
    }

    api
      .verifyAuth()
      .then((res) => {
        setIsAuthenticated(res.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
        clearAuthToken();
      })
      .finally(() => {
        setCheckingAuth(false);
      });

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const fetchTableData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsRefreshing(true);
    try {
      const [statsRes, falhasRes, wsRes] = await Promise.allSettled([
        api.getStats(),
        api.getFalhas(200),
        api.getWhatsAppStatus(),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
        setDbMode(statsRes.value.dbMode || 'embedded');
      }
      if (falhasRes.status === 'fulfilled') {
        setFalhas(falhasRes.value);
      }
      if (wsRes.status === 'fulfilled') {
        setWhatsappStatus(wsRes.value.status as WhatsAppState);
        setQrCode(wsRes.value.qrCode);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da tabela:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTableData();
    }
  }, [isAuthenticated, fetchTableData]);

  useEffect(() => {
    const socket = getSocket();

    const handleWhatsAppStatus = (data: { status: WhatsAppState; qrCode: string | null }) => {
      setWhatsappStatus(data.status);
      setQrCode(data.qrCode);
      if (data.status === 'waiting_qr' && data.qrCode) {
        setShowWhatsAppModal(true);
      }
    };

    const handleFalhaUpdated = (updatedFalha: FalhaEvent) => {
      setFalhas((prev) => {
        const exists = prev.some((f) => f.id === updatedFalha.id);
        if (exists) {
          return prev.map((f) => (f.id === updatedFalha.id ? updatedFalha : f));
        }
        return [updatedFalha, ...prev];
      });
    };

    const handleFalhaStatus = ({ id, status }: { id: number; status: number }) => {
      setFalhas((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: status as 0 | 1 | 2 | 3 } : f))
      );
    };

    socket.on('whatsapp:status', handleWhatsAppStatus);
    socket.on('falha:updated', handleFalhaUpdated);
    socket.on('falha:status', handleFalhaStatus);

    return () => {
      socket.off('whatsapp:status', handleWhatsAppStatus);
      socket.off('falha:updated', handleFalhaUpdated);
      socket.off('falha:status', handleFalhaStatus);
    };
  }, []);

  const filteredFalhas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return falhas.filter((falha) => {
      const matchesStatus = statusFilter === 'all' || falha.status === statusFilter;
      const matchesQuery =
        !query ||
        falha.equipamento_id.toLowerCase().includes(query) ||
        falha.setor.toLowerCase().includes(query) ||
        falha.user.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [falhas, searchTerm, statusFilter]);

  const handleRetry = useCallback(
    async (id: number) => {
      try {
        await api.retryFalha(id);
        pushToast('success', 'Falha reenfileirada', 'O evento foi enviado para processamento novamente.');
        await fetchTableData();
      } catch (error: any) {
        pushToast('error', 'Erro ao reprocessar', error.message || 'Não foi possível reenfileirar a falha.');
      }
    },
    [fetchTableData, pushToast]
  );

  const summaryCards = useMemo(
    () => [
      { label: 'Pendentes', value: stats.pendentes || 0, accent: 'text-[#6ba4e8]', bg: 'bg-[#285995]/10 border-[#285995]/30' },
      { label: 'Enviados hoje', value: stats.enviados || 0, accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
      { label: 'Erros', value: stats.erros || 0, accent: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
      { label: 'Processando', value: stats.processando || 0, accent: 'text-indigo-300', bg: 'bg-indigo-500/10 border-indigo-500/30' },
    ],
    [stats]
  );

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#12161A] flex items-center justify-center text-[#D3D6D9]">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-[#285995] animate-ping"></div>
          <span className="text-sm font-semibold tracking-wider uppercase">Iniciando Painel...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#12161A] text-[#D3D6D9] flex flex-col selection:bg-[#285995] selection:text-white">
      <Navbar
        onConfigClick={() => setShowConfigModal(true)}
        onWhatsAppClick={() => setShowWhatsAppModal(true)}
        onRefresh={fetchTableData}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
        whatsappStatus={whatsappStatus}
        dbMode={dbMode}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#D3D6D9]/70">{card.label}</span>
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${card.accent.replace('text-', 'bg-')}`} />
              </div>
              <div className={`mt-4 text-3xl font-black ${card.accent}`}>{card.value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#5A656C]/35 bg-[#181F26] p-4 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#5A656C]">Monitoramento operacional</p>
              <h2 className="mt-1 text-lg font-bold text-white">Fila de falhas</h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[220px]">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por equipamento, setor ou telefone"
                  className="w-full rounded-xl border border-[#5A656C]/40 bg-[#12161A] px-3 py-2.5 pr-10 text-sm text-white placeholder-[#5A656C] focus:border-[#285995] focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 0 | 1 | 2 | 3)}
                className="rounded-xl border border-[#5A656C]/40 bg-[#12161A] px-3 py-2.5 text-sm text-white focus:border-[#285995] focus:outline-none"
              >
                <option value="all">Todos os status</option>
                <option value={0}>Pendentes</option>
                <option value={1}>Enviados</option>
                <option value={2}>Processando</option>
                <option value={3}>Erro</option>
              </select>

              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="rounded-xl border border-[#5A656C]/40 bg-[#1F2730] px-3 py-2.5 text-sm font-medium text-[#D3D6D9] hover:bg-[#28323E]"
              >
                Limpar
              </button>
            </div>
          </div>
        </section>

        <AlertTable falhas={filteredFalhas} onRetry={handleRetry} />
      </main>

      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        status={whatsappStatus}
        qrCode={qrCode}
        onRefresh={fetchTableData}
      />

      {showConfigModal && <ConfigModal onClose={() => setShowConfigModal(false)} />}

      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur-sm ${
              toast.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : toast.kind === 'error'
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : 'border-[#285995]/30 bg-[#1F2730]'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-white">{toast.title}</div>
            <div className="mt-1 text-sm text-[#D3D6D9]">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
