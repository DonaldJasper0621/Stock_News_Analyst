import React, { useState, useEffect, useRef } from 'react';
import { LineChart, RefreshCw, Settings, Plus, X, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Target, Activity, Search, BookOpen, BarChart2, Newspaper, Sun, Moon } from 'lucide-react';

// --- TradingView Widget Component ---
const TradingViewWidget = ({ symbol, theme }) => {
  const containerRef = useRef();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbols": [
        [
          symbol,
          symbol + "|1D"
        ]
      ],
      "chartOnly": false,
      "width": "100%",
      "height": "300",
      "locale": "en",
      "colorTheme": theme, // Dynamic Theme
      "autosize": false,
      "showVolume": true,
      "showMA": false,
      "hideDateRanges": false,
      "hideMarketStatus": false,
      "hideSymbolLogo": false,
      "scalePosition": "right",
      "scaleMode": "Normal",
      "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
      "fontSize": "10",
      "noTimeScale": false,
      "valuesTracking": "1",
      "changeMode": "price-and-percent",
      "chartType": "candlesticks",
      "maLineColor": "#2962FF",
      "maLineWidth": 1,
      "maLength": 9,
      "lineWidth": 2,
      "lineType": 0,
      "dateRanges": [
        "1d|1",
        "1m|30",
        "3m|60",
        "12m|1D",
        "60m|1W",
        "all|1M"
      ]
    });

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }
  }, [symbol, theme]);

  return (
    <div className="tradingview-widget-container w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" ref={containerRef}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  // --- MODIFICATION HERE: Load API Key from .env file ---
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_PERPLEXITY_API_KEY || '');

  const [showSettings, setShowSettings] = useState(false);
  const [tickers, setTickers] = useState(['NVDA', 'TSLA', 'AAPL', 'AMD', 'ORCL']);
  const [selectedTickers, setSelectedTickers] = useState(new Set(['NVDA']));
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState({});
  const [error, setError] = useState('');

  // Theme State
  const [darkMode, setDarkMode] = useState(true);

  // We keep the localStorage logic as a fallback or override
  useEffect(() => {
    const savedKey = localStorage.getItem('pplx_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveKey = (val) => {
    setApiKey(val);
    localStorage.setItem('pplx_api_key', val);
  };

  const toggleTicker = (t) => {
    const newSet = new Set(selectedTickers);
    if (newSet.has(t)) newSet.delete(t);
    else newSet.add(t);
    setSelectedTickers(newSet);
  };

  const addTicker = () => {
    if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
      setTickers([...tickers, newTicker.toUpperCase()]);
      setNewTicker('');
    }
  };

  const generateBriefing = async () => {
    if (!apiKey) {
      setError("請先在 .env.local 中設定 API Key 或在設定選單輸入");
      setShowSettings(true);
      return;
    }

    if (selectedTickers.size === 0) {
      setError("請至少選擇一支股票");
      return;
    }

    setLoading(true);
    setError('');
    setStockData({});

    const promises = Array.from(selectedTickers).map(async (symbol) => {
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: `You are a professional Wall Street senior analyst creating a pre-market briefing for sophisticated investors. 
                Analyze the stock symbol provided.
                
                **IMPORTANT INSTRUCTION**:
                1.  **LANGUAGE**: All text content MUST be in **Traditional Chinese (繁體中文)**.
                2.  **STYLE**: Professional, analytical, detailed, and insightful. Avoid generic summaries. Use financial terminology (e.g., "獲利回吐", "估值壓力", "震盪整理").
                3.  **FORMAT**: Return ONLY a valid JSON object.
                
                Expected JSON Structure:
                {
                  "symbol": "STRING (Ticker)",
                  "sentiment_score": NUMBER (1-10),
                  "support_level_short": "STRING (e.g. '215 / 200 USD')",
                  "resistance_level_short": "STRING (e.g. '235 USD')",
                  "major_news": "STRING (Bullet points. The most critical news headlines for today. e.g., '• CEO announced new AI chip partnership\\n• Q3 earnings beat expectations')",
                  "market_factors": "STRING (Detailed paragraph. Discuss main bull/bear factors, valuation pressure, investor sentiment, etc.)",
                  "technical_analysis_detailed": "STRING (Detailed paragraph. Discuss floor price, support zones, technical patterns, moving averages status. Similar to: '下方主力支撐分別在...若再失守則...')",
                  "future_outlook": "STRING (Detailed paragraph. Discuss long-term view, 2025/2026 expectations, revenue growth drivers)",
                  "conclusion": "STRING (A concise, actionable verdict or summary of the current stance)"
                }`
              },
              {
                role: "user",
                content: `Deep analysis for ${symbol}. Focus on market sentiment, technical levels, and future outlook. Make sure to include the most recent major news.`
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Clean markdown
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(content);
      } catch (err) {
        console.error(`Error fetching ${symbol}:`, err);
        return {
          symbol: symbol,
          error: "無法取得分析資料，請檢查 API Key 或稍後再試。"
        };
      }
    });

    const results = await Promise.all(promises);
    const newStockData = {};
    results.forEach(item => {
      if (item) newStockData[item.symbol] = item;
    });

    setStockData(newStockData);
    setLoading(false);
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                <LineChart className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent hidden sm:block">
                Pre-Market Pro
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                title="Toggle Theme"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors ${!apiKey ? 'bg-red-500/10 text-red-500 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Dropdown */}
          {showSettings && (
            <div className="absolute top-16 right-0 w-full sm:w-96 bg-white dark:bg-slate-900 border-b border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in slide-in-from-top-2 z-50">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Perplexity API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => handleSaveKey(e.target.value)}
                    placeholder="pplx-xxxxxxxx..."
                    className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 transition-colors"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">
                    Using environment key or local storage.
                  </p>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">

          {/* Left Sidebar: Controls */}
          <aside className="w-full lg:w-1/4 space-y-6">
            {/* Action Panel */}
            <div className="bg-white/80 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 backdrop-blur-sm shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase flex items-center tracking-wider">
                <Target className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" /> Watchlist
              </h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {tickers.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTicker(t)}
                    className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all border ${selectedTickers.has(t)
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && addTicker()}
                  placeholder="ADD SYMBOL"
                  className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600"
                />
                <button
                  onClick={addTicker}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={generateBriefing}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center space-x-2 transition-all border ${loading
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95'
                  }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded text-xs text-red-600 dark:text-red-400 flex items-start">
                  <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </aside>

          {/* Right Content: Analysis Cards */}
          <div className="flex-1 space-y-8">
            {Array.from(selectedTickers).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/30">
                <Target className="w-12 h-12 mb-4 opacity-50" />
                <p>Select stocks to begin analysis</p>
              </div>
            ) : (
              Array.from(selectedTickers).map((symbol) => {
                const data = stockData[symbol];
                const hasData = !!data && !data.error;

                return (
                  <div key={symbol} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-black/50 transition-all hover:border-slate-300 dark:hover:border-slate-700 group">
                    <div className="flex flex-col xl:flex-row">

                      {/* Chart Column */}
                      <div className="w-full xl:w-5/12 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 relative min-h-[350px]">
                        <div className="absolute inset-0 z-0">
                          <TradingViewWidget symbol={symbol} theme={darkMode ? "dark" : "light"} />
                        </div>
                      </div>

                      {/* AI Analysis Column */}
                      <div className="w-full xl:w-7/12 p-6 flex flex-col relative bg-white dark:bg-slate-900">

                        {/* Header Row with Ticker & Sentiment */}
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                          <div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                              {symbol}
                            </h2>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-medium">
                              Pre-Market Deep Dive
                            </div>
                          </div>
                          {hasData && (
                            <div className="flex flex-col items-end">
                              <div className={`px-4 py-1.5 rounded-full text-sm font-bold border mb-2 ${data.sentiment_score >= 7 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                                  data.sentiment_score <= 4 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                                    'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'
                                }`}>
                                Sentiment Score: {data.sentiment_score}/10
                              </div>

                              {/* Quick Key Levels */}
                              <div className="flex gap-3 text-xs font-mono">
                                <span className="text-emerald-600 dark:text-emerald-400">Sup: {data.support_level_short}</span>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-red-600 dark:text-red-400">Res: {data.resistance_level_short}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Loading State */}
                        {loading && !data && (
                          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12 animate-pulse">
                            <div className="h-2 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                            <div className="h-2 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
                            <div className="h-2 w-2/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2 font-mono">AI Analyst is writing report...</p>
                          </div>
                        )}

                        {/* Error State */}
                        {data && data.error && (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-900/30">
                            {data.error}
                          </div>
                        )}

                        {/* Content Body */}
                        {hasData && (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 text-slate-600 dark:text-slate-300 leading-relaxed">

                            {/* 0. NEW: Major News Section */}
                            <div className="bg-indigo-50 dark:bg-indigo-600/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-500/30">
                              <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center">
                                <Newspaper className="w-4 h-4 mr-2" /> 今日重大新聞
                              </h4>
                              <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200 leading-relaxed">
                                {data.major_news}
                              </p>
                            </div>

                            {/* 1. Market Factors */}
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <Activity className="w-4 h-4 mr-2" /> 市場多空因素與情緒
                              </h4>
                              <p className="text-sm whitespace-pre-line text-slate-600 dark:text-slate-400">
                                {data.market_factors}
                              </p>
                            </div>

                            {/* 2. Detailed Technicals */}
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                              <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center">
                                <BarChart2 className="w-4 h-4 mr-2" /> 短線地板與支撐位詳解
                              </h4>
                              <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-300">
                                {data.technical_analysis_detailed}
                              </p>
                            </div>

                            {/* 3. Outlook & Conclusion */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2 flex items-center">
                                  <TrendingUp className="w-3 h-3 mr-2" /> 未來走勢分析
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                                  {data.future_outlook}
                                </p>
                              </div>
                              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                                <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-2 flex items-center">
                                  <BookOpen className="w-3 h-3 mr-2" /> 總結
                                </h4>
                                <p className="text-xs text-indigo-800 dark:text-indigo-200 whitespace-pre-line leading-relaxed">
                                  {data.conclusion}
                                </p>
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}