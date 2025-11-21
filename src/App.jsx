import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Settings,
  BarChart3,
  Image as ImageIcon,
} from 'lucide-react';

import MarketDashboard from './components/MarketDashboard.jsx';
import PortfolioAnalysis from './components/PortfolioAnalysis.jsx';

function App() {
  // 先讀 ENV（這裡只是普通常數）
  const ENV_PPLX = import.meta.env.VITE_PERPLEXITY_API_KEY || '';
  // 🔥 這裡加 fallback：如果 ENV 沒讀到，就用你貼給我的那串 Gemini Key
  const ENV_GEMINI = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyB_lnbExLcrcfp9EblMJrdOszFckdiZWjI';

  // 深色模式
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  // 分頁：market = TradingView 那個 Dashboard, portfolio = 圖片持倉分析
  const [activeTab, setActiveTab] = useState('market');

  // 語系（只是現在記住狀態，你之後要用可以再擴充）
  const [lang, setLang] = useState('ZH');

  // API Keys：預設用 ENV / fallback
  const [apiKey, setApiKey] = useState(ENV_PPLX);
  const [googleApiKey, setGoogleApiKey] = useState(ENV_GEMINI);

  // 設定視窗
  const [showSettings, setShowSettings] = useState(false);

  // DEBUG：看現在到底拿到什麼
  useEffect(() => {
    console.log('Perplexity from ENV:', ENV_PPLX);
    console.log('Gemini from ENV (with fallback):', ENV_GEMINI);
    console.log('state googleApiKey:', googleApiKey);
  }, [ENV_PPLX, ENV_GEMINI, googleApiKey]);

  // 載入時帶 localStorage 的 key（如果有就覆蓋掉 ENV）
  useEffect(() => {
    try {
      const savedPplx = localStorage.getItem('pplx_api_key');
      const savedGemini = localStorage.getItem('gemini_api_key');

      if (savedPplx) setApiKey(savedPplx);
      if (savedGemini) setGoogleApiKey(savedGemini);
    } catch (e) {
      console.warn('Cannot read API keys from localStorage', e);
    }
  }, []);

  // 深色模式切換掛到 <html> 上
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  const handleSaveKeys = () => {
    try {
      if (apiKey) localStorage.setItem('pplx_api_key', apiKey);
      if (googleApiKey) localStorage.setItem('gemini_api_key', googleApiKey);
    } catch (e) {
      console.warn('Cannot save API keys to localStorage', e);
    }
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* ===== Top Navbar ===== */}
        <header className="flex items-center justify-between">
          {/* 左側：Logo + 標題 + 浮水印 */}
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            <div className="flex flex-col">
              <span className="font-semibold text-lg tracking-tight">
                Antigravity Stock Dashboard
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Made by Donald Su
              </span>
            </div>
          </div>

          {/* 右側：語系切換 + Analysis 按鈕 + 深色模式 + 設定 */}
          <div className="flex items-center gap-3">
            {/* 語系切換 EN / 中 */}
            <div className="flex border border-slate-300 dark:border-slate-700 rounded-full overflow-hidden text-xs">
              <button
                onClick={() => setLang('EN')}
                className={
                  'px-3 py-1 transition-colors ' +
                  (lang === 'EN'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-transparent text-slate-600 dark:text-slate-300')
                }
              >
                EN
              </button>
              <button
                onClick={() => setLang('ZH')}
                className={
                  'px-3 py-1 transition-colors ' +
                  (lang === 'ZH'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-transparent text-slate-600 dark:text-slate-300')
                }
              >
                中
              </button>
            </div>

            {/* Dashboard / Analysis Tabs */}
            <div className="flex border border-slate-300 dark:border-slate-700 rounded-full overflow-hidden text-xs">
              <button
                onClick={() => setActiveTab('market')}
                className={
                  'px-3 py-1 flex items-center gap-1 transition-colors ' +
                  (activeTab === 'market'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-transparent text-slate-600 dark:text-slate-300')
                }
              >
                <BarChart3 className="w-3 h-3" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('portfolio')}
                className={
                  'px-3 py-1 flex items-center gap-1 transition-colors ' +
                  (activeTab === 'portfolio'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-transparent text-slate-600 dark:text-slate-300')
                }
              >
                <ImageIcon className="w-3 h-3" />
                Analysis
              </button>
            </div>

            {/* 深色模式切換 */}
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* 設定按鈕（填 API Key 用） */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ===== Main Content：依據 activeTab 切換畫面 ===== */}
        <main className="pt-2 pb-10 space-y-0">
          {/* Dashboard Tab */}
          <section
            className={activeTab === 'market' ? 'block' : 'hidden'}
            aria-hidden={activeTab !== 'market'}
          >
            <MarketDashboard apiKey={apiKey} darkMode={darkMode} language={lang === 'ZH' ? 'zh' : 'en'} />
          </section>

          {/* Analysis Tab */}
          <section
            className={activeTab === 'portfolio' ? 'block' : 'hidden'}
            aria-hidden={activeTab !== 'portfolio'}
          >
            <PortfolioAnalysis
              googleApiKey={googleApiKey}
              perplexityApiKey={apiKey}
            />
          </section>
        </main>

      </div>

      {/* ===== 設定 Modal：輸入 API Keys ===== */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">
                API Key 設定
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block mb-1 font-medium">
                  Perplexity API Key（市場看板用）
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  placeholder="pplx-..."
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Google Gemini API Key（持倉截圖分析用）
                </label>
                <input
                  type="password"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  placeholder="AIza..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveKeys}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
