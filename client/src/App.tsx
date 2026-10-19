import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import Navbar from './components/Navbar';
import InteractiveDotGrid from './components/InteractiveDotGrid';
import { fetchInvoices, fetchInvoiceById, fetchMetrics, getExportCsvUrl, getStoredAuth } from './services/api';
import { Invoice, SystemMetrics } from './types';

// Code-split dynamic views and modals for optimal bundle size and responsive navigation
const UploadView = lazy(() => import('./views/UploadView'));
const DetailView = lazy(() => import('./views/DetailView'));
const HistoryView = lazy(() => import('./views/HistoryView'));
const AuthView = lazy(() => import('./views/AuthView'));
const CommandMenuModal = lazy(() => import('./components/CommandMenuModal'));
const GoogleIntegrationsModal = lazy(() => import('./components/GoogleIntegrationsModal'));
const FloatingAiChat = lazy(() => import('./components/FloatingAiChat'));

function ViewFallback() {
  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-[50vh]">
      <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#1c1b1d]/80 border border-dashed border-[#444748]/50 text-xs font-mono text-[#c4c7c8] shadow-sm">
        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span>Cargando interfaz...</span>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SplitLedger UI Error Caught]:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="p-6 rounded-2xl bg-[#1c1b1d] border border-dashed border-[#444748] max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Error al mostrar el desglose</h3>
            <p className="text-xs text-[#c4c7c8] font-mono mb-4 break-words">
              {this.state.error?.message || 'Se produjo un error al procesar las partidas de la factura.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false });
                  if (this.props.onReset) this.props.onReset();
                }}
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-medium hover:bg-zinc-200 transition-all cursor-pointer"
              >
                Volver a Bandeja General
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<'upload' | 'detail' | 'history' | 'auth'>(() => {
    const auth = getStoredAuth();
    return auth?.user ? 'upload' : 'auth';
  });
  const [previousView, setPreviousView] = useState<'upload' | 'history' | 'detail'>('upload');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics>({});
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState<boolean>(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Array<{ title: string; detail: string }>>([
    { title: 'Motor OCR v2.4 Activo', detail: 'Conexión con OpenRouter y aceleración local establecida' },
    { title: 'Asientos iniciales cargados', detail: 'Partidas de AWS, Telefónica y GCP listas para auditoría' }
  ]);

  // Parallelized initial data loading with auth protection
  const loadData = useCallback(async () => {
    try {
      const [invRes, metRes] = await Promise.all([
        fetchInvoices().catch((err) => {
          console.warn('[Data] Invoices fetch deferred:', err);
          return null;
        }),
        fetchMetrics().catch((err) => {
          console.warn('[Data] Metrics fetch deferred:', err);
          return null;
        })
      ]);

      if (invRes?.data?.invoices) {
        setInvoices(invRes.data.invoices);
        if (!selectedInvoice && invRes.data.invoices.length > 0) {
          fetchInvoiceById(invRes.data.invoices[0].id).then((r) => {
            if (r?.data) setSelectedInvoice(r.data);
          });
        }
      }
      if (metRes?.data) {
        setMetrics(metRes.data);
      }
    } catch (err) {
      console.error('Error cargando datos de SplitLedger:', err);
    }
  }, [selectedInvoice]);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user && currentView !== 'auth') {
      loadData();
    }
  }, [currentView, loadData]);

  // View navigation helper
  const handleSelectInvoice = async (inv: Invoice, fromView?: 'upload' | 'history') => {
    if (fromView) {
      setPreviousView(fromView);
    } else if (currentView !== 'detail') {
      setPreviousView(currentView as 'upload' | 'history');
    }
    try {
      const full = await fetchInvoiceById(inv.id);
      setSelectedInvoice(full.data || inv);
      setCurrentView('detail');
    } catch {
      setSelectedInvoice(inv);
      setCurrentView('detail');
    }
  };

  const handleInvoiceUploaded = (newInvoice: Invoice) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    setSelectedInvoice(newInvoice);
    setPreviousView('upload');
    setCurrentView('detail');
    setNotifications((prev) => [
      { title: `Factura ${newInvoice.invoice_number} analizada`, detail: `${newInvoice.supplier_name} desglosada con éxito` },
      ...prev
    ]);
    fetchMetrics().then((r) => r.data && setMetrics(r.data));
  };

  const handleInvoiceUpdated = (updated: Invoice) => {
    setSelectedInvoice(updated);
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setNotifications((prev) => [
      { title: `Asiento ${updated.invoice_number} conciliado`, detail: 'Partidas registradas bajo partida doble' },
      ...prev
    ]);
    fetchMetrics().then((r) => r.data && setMetrics(r.data));
  };

  const handleInvoiceDeleted = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(invoices.find((i) => i.id !== id) || null);
    }
    fetchMetrics().then((r) => r.data && setMetrics(r.data));
  };

  const handleCommandAction = (action: string) => {
    if (action === 'open:chat') setIsChatOpen(true);
    if (action === 'view:upload') setCurrentView('upload');
    if (action === 'view:detail') setCurrentView('detail');
    if (action === 'view:history') setCurrentView('history');
    if (action === 'view:auth') {
      setPreviousView(currentView === 'auth' ? 'upload' : currentView);
      setCurrentView('auth');
    }
    if (action === 'export:csv') {
      window.location.href = getExportCsvUrl();
    }
    if (action === 'open:google-integrations') {
      setIsGoogleModalOpen(true);
    }
    if (action.startsWith('invoice:')) {
      const id = action.replace('invoice:', '');
      const found = invoices.find((i) => i.id === id);
      if (found) handleSelectInvoice(found);
    }
  };

  if (currentView === 'auth') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <AuthView
          onAuthSuccess={(user) => {
            setNotifications((prev) => [
              { title: `Sesión iniciada: ${user.name}`, detail: `Autenticado como ${user.role} (${user.email})` },
              ...prev
            ]);
            setCurrentView(previousView || 'upload');
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#131315] text-[#e5e1e4] flex flex-col selection:bg-white/20 selection:text-white">
      {/* Interactive Blueprint Dot Grid Background */}
      <InteractiveDotGrid />

      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenCommandMenu={() => setIsCommandMenuOpen(true)}
        onOpenAuth={() => {
          setPreviousView(currentView);
          setCurrentView('auth');
        }}
        onOpenGoogleIntegrations={() => setIsGoogleModalOpen(true)}
        notifications={notifications}
      />

      <div className="relative z-10 flex-1 w-full flex flex-col">
        <ErrorBoundary onReset={() => setCurrentView('upload')}>
          <Suspense fallback={<ViewFallback />}>
            {currentView === 'upload' && (
              <div key="view-upload" className="animate-page-enter w-full">
                <UploadView
                  invoices={invoices}
                  onSelectInvoice={(inv) => handleSelectInvoice(inv, 'upload')}
                  onInvoiceUploaded={handleInvoiceUploaded}
                  onGoToHistory={() => setCurrentView('history')}
                />
              </div>
            )}

            {currentView === 'detail' && (
              <div key={`view-detail-${selectedInvoice?.id || 'empty'}`} className="animate-page-enter w-full">
                <DetailView
                  invoice={selectedInvoice}
                  onInvoiceUpdated={handleInvoiceUpdated}
                  onBack={() => setCurrentView(previousView)}
                  backLabel={previousView === 'history' ? 'Volver al Historial' : 'Volver a Carga'}
                />
              </div>
            )}

            {currentView === 'history' && (
              <div key="view-history" className="animate-page-enter w-full">
                <HistoryView
                  invoices={invoices}
                  metrics={metrics}
                  onSelectInvoice={(inv) => handleSelectInvoice(inv, 'history')}
                  onInvoiceDeleted={handleInvoiceDeleted}
                  onInvoicesUpdated={loadData}
                />
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
      </div>

      <Suspense fallback={null}>
        {/* Floating AI Copilot Chat */}
        <FloatingAiChat
          isOpen={isChatOpen}
          setIsOpen={setIsChatOpen}
          onNavigate={(view) => setCurrentView(view)}
          onSelectInvoiceById={(id) => {
            const inv = invoices.find((i) => i.id === id);
            if (inv) {
              handleSelectInvoice(inv);
            } else {
              fetchInvoiceById(id).then((r) => {
                if (r.data) handleSelectInvoice(r.data);
              });
            }
          }}
        />

        <CommandMenuModal
          isOpen={isCommandMenuOpen}
          onClose={setIsCommandMenuOpen}
          onSelectAction={handleCommandAction}
          invoices={invoices}
        />

        {/* Google Cloud & Workspace Integrations Modal */}
        <GoogleIntegrationsModal
          isOpen={isGoogleModalOpen}
          onClose={() => setIsGoogleModalOpen(false)}
          onSuccessMessage={(msg) => {
            setNotifications((prev) => [
              { title: 'Google Workspace', detail: msg },
              ...prev
            ]);
            loadData();
          }}
        />
      </Suspense>
    </div>
  );
}

