import React, { useState, useEffect, useMemo } from 'react';
import { api } from './api';
import { Lead, SystemStats, KnowledgeBaseItem, SystemSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { MetricsBar } from './components/MetricsBar';
import { KanbanView } from './components/KanbanView';
import { TableView } from './components/TableView';
import { OfferModal } from './components/OfferModal';
import { OutreachModal } from './components/OutreachModal';
import { KnowledgeBaseTab } from './components/KnowledgeBaseTab';
import { SettingsTab } from './components/SettingsTab';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'pipeline' | 'kb' | 'settings'>('pipeline');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [kbItems, setKbItems] = useState<KnowledgeBaseItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // UI & Filter states
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generatingLeadId, setGeneratingLeadId] = useState<number | null>(null);
  const [isScrapingHH, setIsScrapingHH] = useState(false);
  const [isScrapingTG, setIsScrapingTG] = useState(false);
  const [isScrapingFreelance, setIsScrapingFreelance] = useState(false);
  const [isScrapingAvito, setIsScrapingAvito] = useState(false);

  // Load all initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, leadsData, kbData, settingsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getLeads().catch(() => []),
        api.getKnowledgeBase().catch(() => []),
        api.getSettings().catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      setLeads(leadsData);
      setKbItems(kbData);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = lead.title.toLowerCase().includes(q);
        const matchesCompany = lead.company?.toLowerCase().includes(q);
        const matchesDesc = lead.description.toLowerCase().includes(q);
        const matchesTags = lead.tags?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCompany && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      // Source
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) {
        return false;
      }

      // Status
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [leads, searchQuery, sourceFilter, statusFilter]);

  // Lead Actions
  const handleQuickGenerate = async (leadId: number) => {
    setGeneratingLeadId(leadId);
    try {
      const res = await api.generateOffer(leadId);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, generated_offer: res.offer, status: 'offer_generated' } : l))
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, generated_offer: res.offer, status: 'offer_generated' } : null));
      }
      // Update stats
      api.getStats().then((s) => setStats(s)).catch(() => {});
    } catch (err) {
      console.error('Failed to generate offer:', err);
      alert('Ошибка при генерации оффера');
    } finally {
      setGeneratingLeadId(null);
    }
  };

  const handleGenerateInModal = async (leadId: number, model: string, instructions?: string) => {
    setGeneratingLeadId(leadId);
    try {
      const res = await api.generateOffer(leadId, model, instructions);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, generated_offer: res.offer, status: 'offer_generated' } : l))
      );
      setSelectedLead((prev) => (prev ? { ...prev, generated_offer: res.offer, status: 'offer_generated' } : null));
      api.getStats().then((s) => setStats(s)).catch(() => {});
    } catch (err) {
      console.error('Failed to generate offer:', err);
      alert('Ошибка при генерации оффера');
    } finally {
      setGeneratingLeadId(null);
    }
  };

  const handleSendOffer = async (leadId: number, offerText: string) => {
    try {
      await api.sendOffer(leadId, offerText);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: 'sent', generated_offer: offerText, sent_at: new Date().toISOString() } : l))
      );
      api.getStats().then((s) => setStats(s)).catch(() => {});
      setToastMessage('✅ Оффер скопирован в буфер! Открыт контакт заказчика. Статус лида: "Отправлен"');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to send offer:', err);
      alert('Ошибка при отправке оффера');
    }
  };

  const handleDispatchOutreach = async (leadId: number, offerText: string, channel: string) => {
    try {
      await api.dispatchOffer(leadId, {
        offer_text: offerText,
        confirmed_by_human: true,
        channel: channel
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: 'sent', generated_offer: offerText, sent_at: new Date().toISOString() } : l))
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: 'sent', generated_offer: offerText } : null));
      }
      api.getStats().then((s) => setStats(s)).catch(() => {});
      setToastMessage('✅ Оффер скопирован в буфер! Открыт контакт заказчика. Статус лида: "Отправлен"');
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err: any) {
      console.error('Failed to dispatch outreach:', err);
      alert(err.message || 'Ошибка подтверждения отклика');
    }
  };

  const handleGenerateOfferForOutreach = async (leadId: number): Promise<string> => {
    const res = await api.generateOffer(leadId);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, generated_offer: res.offer, status: 'offer_generated' } : l))
    );
    api.getStats().then((s) => setStats(s)).catch(() => {});
    return res.offer;
  };

  const handleUpdateStatus = async (leadId: number, status: Lead['status']) => {
    try {
      await api.updateLead(leadId, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status } : null));
      }
      api.getStats().then((s) => setStats(s)).catch(() => {});
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // KB actions
  const handleAddKbItem = async (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) => {
    const newItem = await api.createKnowledgeBaseItem(item);
    setKbItems((prev) => [newItem, ...prev]);
  };

  const handleDeleteKbItem = async (id: number) => {
    await api.deleteKnowledgeBaseItem(id);
    setKbItems((prev) => prev.filter((k) => k.id !== id));
  };

  // Settings actions
  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>) => {
    await api.updateSettings(newSettings);
    const updated = await api.getSettings();
    setSettings(updated);
  };

  // Trigger HH Scraper
  const handleTriggerHH = async () => {
    setIsScrapingHH(true);
    try {
      await api.triggerHHScraper();
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        await loadData();
        const status = await api.getHHScraperStatus().catch(() => null);
        if (!status?.is_running || count >= 6) {
          clearInterval(interval);
          setIsScrapingHH(false);
          await loadData();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to trigger scraper:', err);
      setIsScrapingHH(false);
      alert('Ошибка запуска сбора с hh.ru');
    }
  };

  // Trigger Telegram Scraper
  const handleTriggerTG = async () => {
    setIsScrapingTG(true);
    try {
      await api.triggerTGScraper();
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        await loadData();
        const status = await api.getTGScraperStatus().catch(() => null);
        if (!status?.is_running || count >= 6) {
          clearInterval(interval);
          setIsScrapingTG(false);
          await loadData();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to trigger TG scraper:', err);
      setIsScrapingTG(false);
      alert('Ошибка запуска сбора с Telegram');
    }
  };

  const handleTriggerFreelance = async () => {
    setIsScrapingFreelance(true);
    try {
      await api.triggerFreelanceScraper();
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        await loadData();
        const status = await api.getFreelanceScraperStatus().catch(() => null);
        if (!status?.is_running || count >= 6) {
          clearInterval(interval);
          setIsScrapingFreelance(false);
          await loadData();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to trigger freelance scraper:', err);
      setIsScrapingFreelance(false);
      alert('Ошибка запуска сбора с Хабр / FL.ru');
    }
  };

  const handleTriggerAvito = async () => {
    setIsScrapingAvito(true);
    try {
      await api.triggerAvitoScraper();
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        await loadData();
        const status = await api.getAvitoScraperStatus().catch(() => null);
        if (!status?.is_running || count >= 6) {
          clearInterval(interval);
          setIsScrapingAvito(false);
          await loadData();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to trigger Avito scraper:', err);
      setIsScrapingAvito(false);
      alert('Ошибка запуска сбора с Авито Работа');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        stats={stats}
        settings={settings}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onTriggerHHScraper={handleTriggerHH}
        isScrapingHH={isScrapingHH}
        onTriggerTGScraper={handleTriggerTG}
        isScrapingTG={isScrapingTG}
        onTriggerFreelanceScraper={handleTriggerFreelance}
        isScrapingFreelance={isScrapingFreelance}
        onTriggerAvitoScraper={handleTriggerAvito}
        isScrapingAvito={isScrapingAvito}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] overflow-y-auto min-h-screen">
        {/* Sticky Top Header with search, filters and view toggle */}
        <TopHeader
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={loadData}
          isLoading={isLoading}
          totalLeadsCount={filteredLeads.length}
        />

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-[1700px] w-full mx-auto">
          {currentTab === 'pipeline' && (
            <>
              {/* Top Metrics Row */}
              <MetricsBar stats={stats} />

              {/* Pipeline Content View */}
              {viewMode === 'kanban' ? (
                <KanbanView
                  leads={filteredLeads}
                  onSelectLead={setSelectedLead}
                  onQuickGenerate={handleQuickGenerate}
                  onOpenOutreach={setOutreachLead}
                  generatingLeadId={generatingLeadId}
                />
              ) : (
                <TableView
                  leads={filteredLeads}
                  onSelectLead={setSelectedLead}
                  onQuickGenerate={handleQuickGenerate}
                  onOpenOutreach={setOutreachLead}
                  generatingLeadId={generatingLeadId}
                />
              )}
            </>
          )}

          {currentTab === 'kb' && (
            <KnowledgeBaseTab
              items={kbItems}
              onAddItem={handleAddKbItem}
              onDeleteItem={handleDeleteKbItem}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      </div>

      {/* 1-Click Outreach Dispatcher Modal (Human-in-the-Loop Dry-Run) */}
      {outreachLead && (
        <OutreachModal
          lead={outreachLead}
          isOpen={!!outreachLead}
          onClose={() => setOutreachLead(null)}
          onDispatch={handleDispatchOutreach}
          onGenerateOffer={handleGenerateOfferForOutreach}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* Full Offer Studio Modal */}
      {selectedLead && (
        <OfferModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onGenerateOffer={handleGenerateInModal}
          onSendOffer={handleSendOffer}
          onUpdateStatus={handleUpdateStatus}
          isGenerating={generatingLeadId === selectedLead.id}
        />
      )}

      {/* Human-in-the-Loop Floating Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center gap-3 text-xs font-semibold backdrop-blur-md">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
