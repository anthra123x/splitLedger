import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CommandMenuModal from './components/CommandMenuModal';
import GoogleIntegrationsModal from './components/GoogleIntegrationsModal';
import UploadView from './views/UploadView';
import DetailView from './views/DetailView';
import HistoryView from './views/HistoryView';
import AuthView from './views/AuthView';
import { fetchInvoices, fetchInvoiceById, fetchMetrics, getExportCsvUrl } from './services/api';
import { Invoice, SystemMetrics } from './types';

import FloatingAiChat from './components/FloatingAiChat';
import InteractiveDotGrid from './components/InteractiveDotGrid';

export default function App() {
  const [currentView, setCurrentView] = useState<'upload' | 'detail' | 'history' | 'auth'>('upload');
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

  // Load initial data
  const loadData = async () => {
    try {
      const invRes = await fetchInvoices();
      if (invRes.data?.invoices) {
        setInvoices(invRes.data.invoices);
        // By default select first invoice if none selected
        if (!selectedInvoice && invRes.data.invoices.length > 0) {
          fetchInvoiceById(invRes.data.invoices[0].id).then((r) => {
            if (r.data) setSelectedInvoice(r.data);
          });
        }
      }
      const metRes = await fetchMetrics();
      if (metRes.data) {
        setMetrics(metRes.data);
      }
    } catch (err) {
      console.error('Error cargando datos de SplitLedger:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      <AuthView
        onBack={() => setCurrentView(previousView)}
        onAuthSuccess={(user) => {
          setNotifications((prev) => [
            { title: `Sesión iniciada: ${user.name}`, detail: `Autenticado como ${user.role} (${user.email})` },
            ...prev
          ]);
          loadData();
        }}
      />
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
      </div>

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
    </div>
  );
}

