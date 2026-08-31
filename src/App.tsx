import { useState, useEffect, useCallback } from 'react';
import { getAuthToken, clearAuthToken, api } from './services/api';
import { getSocket } from './services/socket';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { AlertTable } from './components/AlertTable';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ConfigModal } from './components/ConfigModal';
import {
  FalhaEvent,
  WhatsAppState,
} from './types';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getAuthToken());
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Core Data States - Single Table Model
  const [falhas, setFalhas] = useState<FalhaEvent[]>([]);
  const [dbMode, setDbMode] = useState<string>('embedded');

  // WhatsApp State
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppState>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);

  // UI Control States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Verify auth on mount
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

  // Fetch initial table dataset
  const fetchTableData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsRefreshing(true);
    try {
      const [statsRes, falhasRes, wsRes] = await Promise.allSettled([
        api.getStats(),
        api.getFalhas(100),
        api.getWhatsAppStatus(),
      ]);

      if (statsRes.status === 'fulfilled') {
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

  // Real-time WebSocket subscriptions
  useEffect(() => {
    const socket = getSocket();

    const handleWhatsAppStatus = (data: { status: WhatsAppState; qrCode: string | null }) => {
      setWhatsappStatus(data.status);
      setQrCode(data.qrCode);
      // Auto open QR modal if WhatsApp is waiting for QR scan
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
      {/* Top Navigation */}
      <Navbar
        onConfigClick={() => setShowConfigModal(true)}
        onWhatsAppClick={() => setShowWhatsAppModal(true)}
        onRefresh={fetchTableData}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
        whatsappStatus={whatsappStatus}
        dbMode={dbMode}
      />

      {/* Main Container - Single Table View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-4">
        {/* Real-time Failure Events Table (Exact Image Structure) */}
        <AlertTable falhas={falhas} />
      </main>

      {/* WhatsApp Connection Modal (QR Code & Session Management) */}
      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        status={whatsappStatus}
        qrCode={qrCode}
        onRefresh={fetchTableData}
      />

      {/* Configuration & SQL Modal */}
      {showConfigModal && (
        <ConfigModal
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}

export default App;
