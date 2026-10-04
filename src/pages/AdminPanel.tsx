import React, { useEffect, useState } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch,
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import SessionsManager from '../components/admin/SessionsManager';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Plus, 
  Trash2, 
  Sparkles, 
  Sliders, 
  Users, 
  TrendingUp, 
  Newspaper, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Radio, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  DollarSign,
  Award,
  RefreshCw
} from 'lucide-react';
import { 
  TECH_TITANS, 
  FINANCIAL_TITANS,
  HEALTHCARE_DEFENSIVE,
  MARKET_ETFS, 
  seedStockPreset, 
  seedDefaultStocks, 
  seedDefaultNews, 
  resetSimulationState,
  deduplicateAndCleanStocks,
  purgeAllCrypto,
  syncLiveMarketPrices
} from '../lib/stockData';

export default function AdminPanel() {
  const [config, setConfig] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [allHoldings, setAllHoldings] = useState<any[]>([]);

  // Simulation Duration setup
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [startingCashAmount, setStartingCashAmount] = useState<number>(100000);

  // New Stock Form
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [volatility, setVolatility] = useState('0.02');
  const [sector, setSector] = useState('Technology');

  // News Bulletin Form
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsTicker, setNewsTicker] = useState('ALL');
  const [newsSentiment, setNewsSentiment] = useState<'BULLISH' | 'BEARISH'>('BULLISH');
  const [newsImpact, setNewsImpact] = useState('0.03');
  const [targetSession, setTargetSession] = useState<{ id: string; code: string } | null>(null);

  // Edit stock modal
  const [editingStock, setEditingStock] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Expand user details
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSyncingMarket, setIsSyncingMarket] = useState(false);
  const [marketStatusInfo, setMarketStatusInfo] = useState<any>(null);

  useEffect(() => {
    fetch('/api/market/status')
      .then(r => r.json())
      .then(d => setMarketStatusInfo(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsubSim = onSnapshot(doc(db, 'simulation', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        setConfig({ status: 'NOT_STARTED', priceUpdateIntervalSeconds: 3, marketRegime: 'NORMAL' });
      }
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.portfolioValue || 0) - (a.portfolioValue || 0));
      setUsers(list);
    });

    const unsubStocks = onSnapshot(collection(db, 'stocks'), (snap) => {
      setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubNews = onSnapshot(collection(db, 'news'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setNews(list);
    });

    const unsubHoldings = onSnapshot(collection(db, 'holdings'), (snap) => {
      setAllHoldings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { 
      unsubSim(); 
      unsubUsers(); 
      unsubStocks(); 
      unsubNews();
      unsubHoldings();
    };
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Start Simulation with Countdown Timer
  const handleStartSimulation = async () => {
    try {
      setActionLoading(true);
      const now = Date.now();
      const endMs = durationMinutes > 0 ? now + durationMinutes * 60 * 1000 : null;

      await setDoc(doc(db, 'simulation', 'config'), {
        status: 'RUNNING',
        startTime: serverTimestamp(),
        endTime: endMs ? Timestamp.fromMillis(endMs) : null,
        durationMinutes,
        startingBalanceAmount: config.startingBalanceAmount || startingCashAmount,
        priceUpdateIntervalSeconds: config.priceUpdateIntervalSeconds || 3,
        marketRegime: config.marketRegime || 'NORMAL',
      }, { merge: true });

      showNotification('success', `Simulation started! Duration: ${durationMinutes > 0 ? `${durationMinutes} mins` : 'Unlimited'}`);
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to start simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSimulation = async () => {
    try {
      setActionLoading(true);
      await setDoc(doc(db, 'simulation', 'config'), {
        status: 'PAUSED',
        pausedTime: serverTimestamp(),
      }, { merge: true });
      showNotification('success', 'Trading temporarily paused.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSimulation = async () => {
    if (!window.confirm('End the simulation now? This will immediately lock trading and finalize standings.')) {
      return;
    }
    try {
      setActionLoading(true);
      await setDoc(doc(db, 'simulation', 'config'), {
        status: 'COMPLETED',
        completedAt: serverTimestamp(),
      }, { merge: true });
      showNotification('success', 'Simulation finalized! Trading is closed and winner podium unlocked.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetSimulation = async () => {
    if (!window.confirm(`Reset entire simulation? All user cash will be set to $${startingCashAmount.toLocaleString()}, holdings cleared, and trading stopped.`)) {
      return;
    }
    try {
      setActionLoading(true);
      await resetSimulationState(startingCashAmount);
      showNotification('success', `Simulation reset: All trader balances initialized to $${startingCashAmount.toLocaleString()}.`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualSyncRealMarket = async () => {
    try {
      setIsSyncingMarket(true);
      const res = await syncLiveMarketPrices();
      showNotification('success', `Synchronized ${res.updatedCount} assets with real-time NYSE/NASDAQ exchange quotes!`);
    } catch (e: any) {
      showNotification('error', `Real market sync failed: ${e.message}`);
    } finally {
      setIsSyncingMarket(false);
    }
  };

  const handleUpdateInterval = async (sec: number) => {
    try {
      await setDoc(doc(db, 'simulation', 'config'), { priceUpdateIntervalSeconds: sec }, { merge: true });
      showNotification('success', `Exchange polling cadence set to ${sec}s`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Seed Presets
  const handleSeedPreset = async (presetList: any[], label: string) => {
    try {
      setActionLoading(true);
      const added = await seedStockPreset(presetList);
      showNotification('success', added > 0 ? `Added ${added} ${label} stocks!` : `${label} stocks already exist.`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeCrypto = async () => {
    if (!window.confirm('Purge all cryptocurrency assets from the market? Any user holdings will be liquidated into cash at the current price.')) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await purgeAllCrypto();
      showNotification('success', res.purgedCount > 0 ? `Successfully removed ${res.purgedCount} crypto assets and refunded holdings.` : 'No cryptocurrency assets detected on the trading floor.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Broadcast News Bulletin
  const handleBroadcastNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsHeadline.trim()) return;
    if (!targetSession) { showNotification('error', 'Select a session above before publishing news.'); return; }
    setLoading(true);
    try {
      const imp = parseFloat(newsImpact) || 0.03;
      await addDoc(collection(db, 'news'), {
        sessionId: targetSession.id,
        headline: newsHeadline.trim(),
        summary: newsSummary.trim() || newsHeadline.trim(),
        ticker: newsTicker,
        sentiment: newsSentiment,
        impact: newsSentiment === 'BULLISH' ? Math.abs(imp) : -Math.abs(imp),
        timestamp: serverTimestamp(),
      });

      setNewsHeadline('');
      setNewsSummary('');
      showNotification('success', `Breaking news catalyst broadcasted for ${newsTicker}!`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Catalysts
  const handleQuickCatalyst = async (preset: { headline: string; summary: string; ticker: string; sentiment: string; impact: number }) => {
    if (!targetSession) { showNotification('error', 'Select a session above before publishing news.'); return; }
    try {
      await addDoc(collection(db, 'news'), {
        ...preset,
        sessionId: targetSession.id,
        timestamp: serverTimestamp(),
      });
      showNotification('success', `Catalyst deployed: "${preset.headline.slice(0, 30)}..."`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Add Custom Stock
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker || !name || !price) return;

    // Prevent duplicates
    const alreadyExists = stocks.some(s => (s.ticker || '').trim().toUpperCase() === cleanTicker);
    if (alreadyExists) {
      showNotification('error', `Asset "${cleanTicker}" already exists! Remove or edit the existing asset.`);
      return;
    }

    setLoading(true);
    try {
      const p = parseFloat(price);
      const v = parseFloat(volatility) || 0.02;
      const newRef = await addDoc(collection(db, 'stocks'), {
        ticker: cleanTicker,
        name: name.trim(),
        sector,
        currentPrice: p,
        dayOpenPrice: p,
        dayHigh: p,
        dayLow: p,
        change: 0,
        changePercent: 0,
        volatility: v,
        trend: 0,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      // Generate history points
      await addDoc(collection(db, 'price_history'), {
        stockId: newRef.id,
        price: p,
        timestamp: serverTimestamp(),
      });

      setTicker('');
      setName('');
      setPrice('');
      showNotification('success', `Listed ${cleanTicker} on the market!`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Clean duplicate stocks from Firestore
  const handleCleanDuplicates = async () => {
    try {
      setActionLoading(true);
      const removed = await deduplicateAndCleanStocks();
      showNotification('success', removed > 0 ? `Purged ${removed} duplicate stock records from the database!` : 'No duplicate stock records found.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Edit stock price directly
  const handleSaveStockPrice = async (stockId: string) => {
    const p = parseFloat(editPrice);
    if (!p || p <= 0) return;
    try {
      await updateDoc(doc(db, 'stocks', stockId), {
        currentPrice: p,
        lastUpdated: serverTimestamp(),
      });
      await addDoc(collection(db, 'price_history'), {
        stockId,
        price: p,
        timestamp: serverTimestamp(),
      });
      setEditingStock(null);
      showNotification('success', 'Stock price updated directly.');
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleToggleStock = async (stock: any) => {
    try {
      await updateDoc(doc(db, 'stocks', stock.id), { isActive: !stock.isActive });
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleDeleteStock = async (stockId: string, tickerSymbol: string) => {
    if (!window.confirm(`Delete ${tickerSymbol} from the market?`)) return;
    try {
      await deleteDoc(doc(db, 'stocks', stockId));
      showNotification('success', `Removed ${tickerSymbol}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Adjust User Cash (+ / -)
  const handleAdjustUserCash = async (userId: string, currentCash: number, delta: number) => {
    try {
      const newCash = Math.max(0, currentCash + delta);
      await updateDoc(doc(db, 'users', userId), { currentCash: newCash });
      showNotification('success', `Adjusted cash balance by ${delta >= 0 ? '+' : ''}$${delta.toLocaleString()}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'participant' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      showNotification('success', `User role set to ${newRole}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Export Full CSV
  const handleExportCSV = () => {
    let csv = 'Rank,Trader Name,Email,Role,Starting Balance,Cash Balance,Portfolio Net Worth,Total Return ($),Return (%)\n';
    users.forEach((u, i) => {
      const start = Number(u.startingBalance || 100000);
      const portVal = Number(u.portfolioValue ?? u.currentCash ?? 100000);
      const pnl = portVal - start;
      const returnPct = start > 0 ? (pnl / start) * 100 : 0;

      csv += `${i + 1},"${u.name || ''}","${u.email || ''}","${u.role || 'participant'}",${start},${(u.currentCash || 0).toFixed(2)},${portVal.toFixed(2)},${pnl.toFixed(2)},${returnPct.toFixed(2)}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stotra-simulation-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const status = config.status || 'NOT_STARTED';
  const isRunning = status === 'RUNNING';
  const isCompleted = status === 'COMPLETED';
  const regime = config.marketRegime || 'NORMAL';
  const intervalSec = config.priceUpdateIntervalSeconds || 3;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {msg && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-md ${
          msg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      <SessionsManager
        selectedId={targetSession?.id ?? null}
        onSelect={(id, code) => setTargetSession(id ? { id, code: code || '' } : null)}
        notify={showNotification}
      />

      {/* Primary Market Controller Banner */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center pb-5 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Market Administrator Suite</h1>
              <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 border ${
                isRunning ? 'bg-green-50 text-green-700 border-green-200' :
                isCompleted ? 'bg-amber-50 text-amber-800 border-amber-200' :
                'bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}>
                {isRunning && <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
                {status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Direct real-time exchange quotes from NYSE & NASDAQ, live market synchronization, starting capital limits, and participant portfolios.
            </p>
          </div>

          {/* Core Simulation State Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!isRunning ? (
              <button
                onClick={handleStartSimulation}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Simulation
              </button>
            ) : (
              <button
                onClick={handlePauseSimulation}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}

            {isRunning && (
              <button
                onClick={handleEndSimulation}
                disabled={actionLoading}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Award className="w-4 h-4" />
                End & Finalize
              </button>
            )}

            <button
              onClick={handleResetSimulation}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 text-zinc-700 border border-zinc-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Standings CSV
            </button>
          </div>
        </div>

        {/* Configuration Row: Duration, Starting Balance, Market Regime, Speed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Duration Selector */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Simulation Timer
            </label>
            <div className="flex flex-wrap gap-1">
              {[
                { label: '5m', val: 5 },
                { label: '10m', val: 10 },
                { label: '15m', val: 15 },
                { label: '30m', val: 30 },
                { label: '∞', val: 0 },
              ].map(d => (
                <button
                  key={d.label}
                  onClick={() => setDurationMinutes(d.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    durationMinutes === d.val
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 block">Auto-locks trading when expired</span>
          </div>

          {/* Configurable Starting Cash */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Starting Capital
            </label>
            <div className="flex flex-wrap gap-1">
              {[10000, 50000, 100000, 250000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setStartingCashAmount(amt)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    startingCashAmount === amt
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  ${amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 block">Applies to resets and new traders</span>
          </div>

          {/* Real-Time Market Exchange Feed & Sync */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live Exchange Feed
              </span>
              <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100/80 px-1.5 py-0.5 rounded">
                NYSE / NASDAQ
              </span>
            </label>
            <div className="bg-white p-2.5 rounded-xl border border-zinc-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Session Status:</span>
                <span className="font-bold text-zinc-900">
                  {marketStatusInfo?.isOpen ? '🟢 Regular Trading' : '🕒 ' + (marketStatusInfo?.session || 'Exchange Connected')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Quotes Source:</span>
                <span className="font-semibold text-emerald-600">Direct Market Data</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleManualSyncRealMarket}
              disabled={isSyncingMarket || actionLoading}
              className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMarket ? 'animate-spin' : ''}`} />
              <span>{isSyncingMarket ? 'Fetching Exchange Quotes...' : 'Sync Market Prices Now'}</span>
            </button>
          </div>

          {/* Exchange Polling Cadence */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              Live Polling Cadence
            </label>
            <div className="flex gap-1.5">
              {[5, 10, 15, 30, 60].map(s => (
                <button
                  key={s}
                  onClick={() => handleUpdateInterval(s)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    intervalSec === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 block">Auto-fetches real quotes from live exchange feed</span>
          </div>
        </div>
      </div>

      {/* Secondary Layout: News Dispatcher & Stocks Administration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: News Dispatcher & Catalyst Presets */}
        <div className="space-y-6">
          {/* Breaking News Dispatcher */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Newspaper className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Publish Market Catalyst</h3>
                <p className="text-[11px] text-zinc-500">
                  {targetSession ? <>Publishes to session <span className="font-mono font-bold text-zinc-800">{targetSession.code}</span></> : 'Select a session above to publish news'}
                </p>
              </div>
            </div>

            <form onSubmit={handleBroadcastNews} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Datacenter Demand Surpasses Forecasts"
                  value={newsHeadline}
                  onChange={e => setNewsHeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Target Asset</label>
                  <select
                    value={newsTicker}
                    onChange={e => setNewsTicker(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-zinc-200 rounded-xl outline-none bg-white font-semibold"
                  >
                    <option value="ALL">ALL (Market-Wide)</option>
                    {stocks.map(s => (
                      <option key={s.id} value={s.ticker}>{s.ticker}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Sentiment</label>
                  <select
                    value={newsSentiment}
                    onChange={e => setNewsSentiment(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs border border-zinc-200 rounded-xl outline-none bg-white font-semibold"
                  >
                    <option value="BULLISH">+ Bullish Surge</option>
                    <option value="BEARISH">- Bearish Drop</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Brief Description</label>
                <textarea
                  rows={2}
                  placeholder="Quarterly metrics exceeded Wall Street expectations..."
                  value={newsSummary}
                  onChange={e => setNewsSummary(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                {loading ? 'Broadcasting...' : 'Broadcast Catalyst to Floor'}
              </button>
            </form>

            {/* 1-Click Preset Catalysts */}
            <div className="pt-2 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                1-Click Preset Shocks
              </span>
              <div className="space-y-1.5">
                {[
                  {
                    headline: 'Fed Announces Emergency 50bps Rate Cut to Stimulate Liquidity',
                    summary: 'Policy makers voted unanimously to reduce benchmark borrowing costs.',
                    ticker: 'ALL',
                    sentiment: 'BULLISH',
                    impact: 0.04
                  },
                  {
                    headline: 'Chip Supply Bottleneck Halts Server Production Across Asia',
                    summary: 'Severe component shortages disrupt enterprise hardware delivery cycles.',
                    ticker: 'NVDA',
                    sentiment: 'BEARISH',
                    impact: -0.05
                  },
                  {
                    headline: 'Record Smartphone Upgrade Cycle Drives Massive Services Revenue',
                    summary: 'Subscriber additions topped all analyst consensus targets.',
                    ticker: 'AAPL',
                    sentiment: 'BULLISH',
                    impact: 0.04
                  }
                ].map(c => (
                  <button
                    key={c.headline}
                    onClick={() => handleQuickCatalyst(c)}
                    className="w-full text-left p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/60 text-[11px] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate pr-2 font-medium text-zinc-800">{c.headline}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm shrink-0 ${
                      c.sentiment === 'BULLISH' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.ticker}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Seed Stock Presets Card */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-3">
            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Stock Preset Seed Bundles
            </h3>
            <p className="text-[11px] text-zinc-500">Quickly add authentic equity sectors to the trading floor</p>
            <div className="space-y-2">
              <button
                onClick={() => handleSeedPreset(TECH_TITANS, 'Tech Titans')}
                disabled={actionLoading}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏛️ US Tech Titans (AAPL, MSFT, NVDA, GOOGL...)</span>
                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded">6 stocks</span>
              </button>
              <button
                onClick={() => handleSeedPreset(FINANCIAL_TITANS, 'Financials')}
                disabled={actionLoading}
                className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏦 Financial Titans (JPM, GS, V, BRK.B)</span>
                <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded">4 stocks</span>
              </button>
              <button
                onClick={() => handleSeedPreset(HEALTHCARE_DEFENSIVE, 'Healthcare & Staples')}
                disabled={actionLoading}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏥 Healthcare & Staples (JNJ, LLY, UNH, COST)</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">5 stocks</span>
              </button>
              <button
                onClick={() => handleSeedPreset(MARKET_ETFS, 'Index ETFs')}
                disabled={actionLoading}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>📊 Benchmark Index ETFs (SPY, QQQ, DIA)</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">3 ETFs</span>
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-100">
              <button
                onClick={handlePurgeCrypto}
                disabled={actionLoading}
                className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Remove any cryptocurrency assets and refund user balances"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge All Crypto from Market</span>
              </button>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Stock Management & Participant Inspector (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Custom Stock Creator & Active Stock Listings */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Stock Listings & Pricing ({stocks.length})</h3>
                  <p className="text-[11px] text-zinc-500">Live prices, volatilities, and individual asset controls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePurgeCrypto}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200/80 inline-flex items-center gap-1.5"
                  title="Purge all crypto assets from floor"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Purge Crypto</span>
                </button>
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-zinc-300/80 inline-flex items-center gap-1.5"
                  title="Detect and remove duplicate asset records with matching tickers"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Clean Duplicates</span>
                </button>
              </div>
            </div>

            {/* Quick Add Custom Stock Inline */}
            <form onSubmit={handleAddStock} className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Ticker</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AMD"
                  maxLength={6}
                  value={ticker}
                  onChange={e => setTicker(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs uppercase font-bold border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Company</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AMD Inc"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Sector</label>
                <input
                  type="text"
                  placeholder="Technology"
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="145.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  {loading ? 'Adding...' : '+ Add Stock'}
                </button>
              </div>
            </form>

            {/* Stocks Table */}
            <div className="overflow-x-auto max-h-[320px]">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase font-semibold text-zinc-500 bg-zinc-50/70 border-b border-zinc-100 sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2">Asset</th>
                    <th className="px-3.5 py-2">Sector</th>
                    <th className="px-3.5 py-2 text-right">Price</th>
                    <th className="px-3.5 py-2 text-right">Volatility</th>
                    <th className="px-3.5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {stocks.map(s => {
                    const isEditing = editingStock?.id === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-900 text-xs">{s.ticker}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              s.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-200 text-zinc-600'
                            }`}>
                              {s.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{s.name}</div>
                        </td>
                        <td className="px-3.5 py-2 text-xs text-zinc-600 font-medium">
                          {s.sector || 'Stock'}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-zinc-900 text-xs">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="w-16 px-1.5 py-0.5 text-xs border border-blue-500 rounded bg-white"
                              />
                              <button
                                onClick={() => handleSaveStockPrice(s.id)}
                                className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <span>${Number(s.currentPrice || 0).toFixed(2)}</span>
                              <button
                                onClick={() => { setEditingStock(s); setEditPrice(String(s.currentPrice || '')); }}
                                className="text-zinc-400 hover:text-zinc-700"
                                title="Edit Price"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right text-xs font-semibold text-blue-600">
                          {((s.volatility || 0.02) * 100).toFixed(1)}%
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleStock(s)}
                              className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                                s.isActive ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                              }`}
                            >
                              {s.isActive ? 'Halt' : 'Resume'}
                            </button>
                            <button
                              onClick={() => handleDeleteStock(s.id, s.ticker)}
                              className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {stocks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">
                        No stocks currently listed. Use the seed bundles or form above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Participant Portfolio Inspector */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden space-y-2">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Participant Portfolio Inspector ({users.length})</h3>
                  <p className="text-[11px] text-zinc-500">Live positions, balances, and manual account adjustments</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase font-semibold text-zinc-500 bg-zinc-50/50 border-b border-zinc-100">
                  <tr>
                    <th className="px-4 py-2.5">Trader</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5 text-right">Cash Balance</th>
                    <th className="px-4 py-2.5 text-right">Portfolio Value</th>
                    <th className="px-4 py-2.5 text-right">Return P&L</th>
                    <th className="px-4 py-2.5 text-right">Adjust Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {users.map(u => {
                    const start = Number(u.startingBalance || 100000);
                    const portVal = Number(u.portfolioValue ?? u.currentCash ?? 100000);
                    const pnl = portVal - start;
                    const isPositive = pnl >= 0;
                    const isExpanded = expandedUserId === u.id;

                    const userHoldings = allHoldings.filter(h => h.userId === u.id);

                    return (
                      <React.Fragment key={u.id}>
                        <tr className="hover:bg-zinc-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                                className="text-zinc-400 hover:text-zinc-700"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <div className="font-bold text-zinc-900 text-xs">{u.name || 'Anonymous'}</div>
                                <div className="text-[11px] text-zinc-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleUserRole(u.id, u.role)}
                              className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                              }`}
                            >
                              {u.role === 'admin' ? 'Admin' : 'Participant'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-700 font-semibold text-xs">
                            ${Number(u.currentCash ?? 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-zinc-900 text-xs">
                            ${Number(portVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}${pnl.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleAdjustUserCash(u.id, Number(u.currentCash || 0), 10000)}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[11px] font-bold transition-colors"
                                title="Add $10,000 cash"
                              >
                                +$10k
                              </button>
                              <button
                                onClick={() => handleAdjustUserCash(u.id, Number(u.currentCash || 0), -10000)}
                                className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-bold transition-colors"
                                title="Deduct $10,000 cash"
                              >
                                -$10k
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Holdings View for this User */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/90">
                            <td colSpan={6} className="px-6 py-3 text-xs">
                              <div className="space-y-1.5">
                                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px]">
                                  Current Open Positions ({userHoldings.length}):
                                </span>
                                {userHoldings.length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {userHoldings.map(h => (
                                      <div key={h.id} className="p-2 bg-white rounded-lg border border-zinc-200 text-xs">
                                        <div className="font-bold text-zinc-900">{h.ticker || h.stockId}</div>
                                        <div className="text-zinc-500 text-[11px]">
                                          {h.quantity} shares @ avg ${Number(h.averageBuyPrice || 0).toFixed(2)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-zinc-400 italic text-[11px]">No active stock positions held (100% Cash).</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
