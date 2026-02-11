import React, { useMemo, useState, useEffect } from "react";
import {
  Target,
  Plus,
  X,
  Search,
  RefreshCw,
  Newspaper,
  TrendingDown,
  DollarSign,
  BookOpen,
} from "lucide-react";

import TradingViewWidget from "./Trading_View_Widget_Component.jsx";
import TWChart from "./TWChart.jsx";
import TWChartLC from "./TWChartLC.jsx";

export default function MarketDashboard({ apiKey, darkMode, language = "zh" }) {
  const DEFAULT_TICKERS_US = [
    "NVDA",
    "TSLA",
    "PLTR",
    "AMD",
    "ORCL",
    "AVGO",
    "PYPL",
    "SPY",
  ];
  const DEFAULT_TICKERS_TW = ["2330", "2317", "2454", "2308", "2881", "2882"];

  const [market, setMarket] = useState("US");
  const [tickers, setTickers] = useState(() => {
    try {
      const saved = localStorage.getItem("pplx_watchlist_us");
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn("Failed to load watchlist from localStorage", e);
    }
    return DEFAULT_TICKERS_US;
  });

  const [selectedTickers, setSelectedTickers] = useState(
    () => new Set(["NVDA"]),
  );
  const [newTicker, setNewTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState({});
  const [error, setError] = useState("");

  // ✅ 舊版相容：props apiKey 沒有就用 localStorage 的 pplx_api_key
  const resolvedApiKey = useMemo(() => {
    if (apiKey && String(apiKey).trim()) return String(apiKey).trim();
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem("pplx_api_key");
    return saved ? saved.trim() : "";
  }, [apiKey]);

  const normalizeTicker = (value, targetMarket = market) => {
    if (!value) return "";
    const cleaned = String(value).trim().toUpperCase();
    if (targetMarket === "TW") {
      return cleaned.replace(/^TWSE:/, "").replace(/\.TW$/, "");
    }
    return cleaned.replace(/^TWSE:/, "").replace(/\.TW$/, "");
  };

  const getTradingViewSymbol = (value) => {
    const normalized = normalizeTicker(value);
    if (!normalized) return "";
    return market === "TW" ? `TWSE:${normalized}` : normalized;
  };

  const toggleTicker = (t) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const removeTicker = (t) => {
    setTickers((prev) => prev.filter((x) => x !== t));
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      next.delete(t);
      return next;
    });
  };

  const addTicker = () => {
    const normalized = normalizeTicker(newTicker);
    if (!normalized) return;
    setTickers((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized],
    );
    setNewTicker("");
  };

  const generateBriefing = async () => {
    const key = resolvedApiKey;

    if (!key) {
      setError("請先在上方設定中輸入 Perplexity API Key（pplx-...）");
      return;
    }
    if (selectedTickers.size === 0) {
      setError("請至少選擇一支股票");
      return;
    }

    setLoading(true);
    setError("");
    setStockData({});

    try {
      const isChinese = language === "zh";

      const now = new Date();
      const options = {
        timeZone: market === "TW" ? "Asia/Taipei" : "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };
      const currentDateStr =
        now.toLocaleString("en-US", options) +
        (market === "TW" ? " TST" : " EST");

      const recencyInstruction =
        market === "TW"
          ? `CRITICAL: Analysis MUST be based on LATEST data (last 24 hours) relative to ${currentDateStr}. Focus on Taiwan market session and after-hours market updates.`
          : `CRITICAL: Analysis MUST be based on LATEST data (last 24 hours) relative to ${currentDateStr}. Include pre-market/after-hours data.`;

      const systemPrompt = isChinese
        ? `
You are a professional ${market === "TW" ? "Taiwan market" : "Wall Street"} senior analyst creating a real-time, deep-dive briefing for sophisticated investors.

TIME CONTEXT:
Current ${market === "TW" ? "Taiwan Market" : "Wall Street"} Time: ${currentDateStr}.

STRICT INSTRUCTIONS:
1) ${recencyInstruction}
2) LANGUAGE: All text content MUST be in Traditional Chinese (繁體中文).
3) STYLE: Professional, analytical, detailed, and insightful. Avoid generic summaries.
4) DEPTH: Do not be brief. Provide distinct reasons and logic for every section.
5) FORMAT: Return ONLY a valid JSON object. No markdown. No extra commentary.
6) MARKET SCOPE: Analyze ${market === "TW" ? "Taiwan listed stocks" : "U.S. listed stocks"} only.

Expected JSON:
{
  "symbol": "STRING",
  "sentiment_score": NUMBER,
  "support_level_short": "STRING",
  "resistance_level_short": "STRING",
  "major_news": "STRING",
  "market_factors": "STRING",
  "technical_analysis_detailed": "STRING",
  "tomorrow_forecast": "STRING",
  "week_ahead_forecast": "STRING",
  "future_outlook": "STRING",
  "conclusion": "STRING"
}
`
        : `
You are a professional ${market === "TW" ? "Taiwan market" : "Wall Street"} senior analyst creating a real-time, deep-dive briefing for sophisticated investors.

TIME CONTEXT:
Current ${market === "TW" ? "Taiwan Market" : "Wall Street"} Time: ${currentDateStr}.

STRICT INSTRUCTIONS:
1) ${recencyInstruction}
2) LANGUAGE: All text content MUST be in English.
3) STYLE: Professional, analytical, detailed, and insightful. Avoid generic summaries.
4) DEPTH: Do not be brief. Provide distinct reasons and logic for every section.
5) FORMAT: Return ONLY a valid JSON object. No markdown. No extra commentary.
6) MARKET SCOPE: Analyze ${market === "TW" ? "Taiwan listed stocks" : "U.S. listed stocks"} only.

Expected JSON:
{
  "symbol": "STRING",
  "sentiment_score": NUMBER,
  "support_level_short": "STRING",
  "resistance_level_short": "STRING",
  "major_news": "STRING",
  "market_factors": "STRING",
  "technical_analysis_detailed": "STRING",
  "tomorrow_forecast": "STRING",
  "week_ahead_forecast": "STRING",
  "future_outlook": "STRING",
  "conclusion": "STRING"
}
`;

      const symbols = Array.from(selectedTickers);

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          const userPrompt = isChinese
            ? `深度分析代號：${symbol}（市場：${market === "TW" ? "台股" : "美股"}）。基準時間：${currentDateStr}。
請結合「最新即時數據（過去24小時）」與「深度邏輯推演」。
請勿簡略，需詳細說明市場情緒、技術型態、盤前/盤後動態對明日走勢的影響。
忽略過時新聞，專注於當下發生的事件。`
            : `Deep Dive Analysis for Symbol: ${symbol} (Market: ${market === "TW" ? "Taiwan" : "US"}). Reference Time: ${currentDateStr}.
Combine "LATEST Real-time Data (Last 24h)" with "Comprehensive Reasoning".
Do NOT be brief. Explain market sentiment, technical patterns, and pre-market/after-hours impact on tomorrow's trend.
Ignore outdated news. Focus on what is happening NOW.`;

          try {
            const response = await fetch(
              "https://api.perplexity.ai/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "sonar-pro",
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  temperature: 0.3,
                }),
              },
            );

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            let content = data?.choices?.[0]?.message?.content ?? "";
            content = String(content)
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();

            const first = content.indexOf("{");
            const last = content.lastIndexOf("}");
            if (first !== -1 && last !== -1 && last > first) {
              content = content.slice(first, last + 1);
            }

            return JSON.parse(content);
          } catch (err) {
            console.error(`Error fetching ${symbol}:`, err);
            return {
              symbol,
              error: isChinese
                ? "無法取得分析資料，請檢查 API Key 或稍後再試。"
                : "Failed to fetch analysis. Please verify API key or try again later.",
            };
          }
        }),
      );

      const next = {};
      results.forEach((item) => {
        if (item && item.symbol) next[item.symbol] = item;
      });

      setStockData(next);
    } catch (e) {
      console.error(e);
      setError("分析失敗：請稍後再試或檢查 API Key / 回傳格式");
    } finally {
      setLoading(false);
    }
  };

  // Persist watchlist per market
  useEffect(() => {
    const storageKey =
      market === "TW" ? "pplx_watchlist_tw" : "pplx_watchlist_us";
    try {
      localStorage.setItem(storageKey, JSON.stringify(tickers));
    } catch (e) {
      console.warn("Failed to save watchlist to localStorage", e);
    }
  }, [tickers, market]);

  // Switch market: load correct list, reset selection
  useEffect(() => {
    const storageKey =
      market === "TW" ? "pplx_watchlist_tw" : "pplx_watchlist_us";
    const fallback = market === "TW" ? DEFAULT_TICKERS_TW : DEFAULT_TICKERS_US;

    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      const nextTickers =
        Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;

      setTickers(nextTickers);
      setSelectedTickers(
        new Set(nextTickers.length > 0 ? [nextTickers[0]] : []),
      );
      setStockData({});
      setError("");
    } catch (e) {
      console.warn("Failed to switch watchlist from localStorage", e);
      setTickers(fallback);
      setSelectedTickers(new Set([fallback[0]]));
      setStockData({});
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const tvTheme = darkMode ? "dark" : "light";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
      {/* Left Watchlist */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Watchlist
              </h2>
            </div>

            <button
              onClick={generateBriefing}
              disabled={loading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                loading
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 border-indigo-500 text-white shadow-sm hover:bg-indigo-500"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Search className="w-3 h-3" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>

          {/* Market Toggle */}
          <div className="mb-3 flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
            <button
              onClick={() => setMarket("US")}
              className={`flex-1 py-1.5 font-semibold transition-colors ${
                market === "US"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              美股 US
            </button>
            <button
              onClick={() => setMarket("TW")}
              className={`flex-1 py-1.5 font-semibold transition-colors ${
                market === "TW"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              台股 TW
            </button>
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {tickers.map((t) => {
              const active = selectedTickers.has(t);
              return (
                <div
                  key={t}
                  className={`flex items-center border rounded-md ${
                    active
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600"
                  }`}
                >
                  <button
                    onClick={() => toggleTicker(t)}
                    className="px-3 py-1.5 text-xs font-semibold"
                  >
                    {t}
                  </button>
                  <button
                    onClick={() => removeTicker(t)}
                    className="px-2 border-l border-slate-300 dark:border-slate-600 hover:bg-red-500/20"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addTicker()}
              placeholder={
                market === "TW" ? "ADD TW CODE (e.g. 2330)" : "ADD SYMBOL"
              }
              className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600"
            />
            <button
              onClick={addTicker}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 rounded-md"
              title="Add"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Report Cards */}
      <div className="space-y-4">
        {Array.from(selectedTickers).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/30">
            <Target className="w-12 h-12 mb-4 opacity-50" />
            <p>Select stocks to begin analysis</p>
          </div>
        ) : (
          Array.from(selectedTickers).map((symbol) => {
            const data = stockData[symbol];

            return (
              <div
                key={symbol}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-md dark:shadow-slate-900/50"
              >
                <div className="flex flex-col">
                  {/* ===== 股價圖區 ===== */}
                  <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 h-[320px] md:h-[360px]">
                    {market === "TW" ? (
                      <TWChartLC
                        code={symbol} // 2330
                        darkMode={darkMode}
                        range="1mo"
                        interval="30m"
                      />
                    ) : (
                      <TradingViewWidget
                        symbol={getTradingViewSymbol(symbol)}
                        theme={darkMode ? "dark" : "light"}
                        chartType="area"
                      />
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex justify-between mb-4">
                      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                        {symbol}
                      </h2>

                      {data && !data.error && (
                        <div className="text-right space-y-1">
                          <div className="text-sm font-mono bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full inline-block">
                            Score: {data.sentiment_score}/10
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <span className="mr-3">
                              {language === "zh" ? "支撐位: " : "Support: "}
                              {data.support_level_short}
                            </span>
                            <span>
                              {language === "zh" ? "壓力位: " : "Resistance: "}
                              {data.resistance_level_short}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {loading && !data && (
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                      </div>
                    )}

                    {data && !data.error && (
                      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                          <h4 className="font-bold mb-2 flex items-center">
                            <Newspaper className="w-4 h-4 mr-2" />
                            {language === "zh"
                              ? "今日重大新聞"
                              : "Major News Today"}
                          </h4>
                          <p className="whitespace-pre-line">
                            {data.major_news}
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                          <h4 className="font-bold mb-1">
                            {language === "zh"
                              ? "市場多空因素與情緒"
                              : "Market Factors & Sentiment"}
                          </h4>
                          <p className="whitespace-pre-line text-xs leading-relaxed">
                            {data.market_factors}
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                          <h4 className="font-bold mb-1">
                            {language === "zh"
                              ? "技術面分析（支撐 / 壓力）"
                              : "Technical Analysis (Support / Resistance)"}
                          </h4>
                          <p className="whitespace-pre-line text-xs leading-relaxed">
                            {data.technical_analysis_detailed}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                            <h4 className="font-bold flex items-center mb-1">
                              <DollarSign className="w-4 h-4 mr-1" />
                              {language === "zh"
                                ? "明日預測"
                                : "Tomorrow Forecast"}
                            </h4>
                            <p className="whitespace-pre-line text-xs leading-relaxed">
                              {data.tomorrow_forecast}
                            </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                            <h4 className="font-bold flex items-center mb-1">
                              <TrendingDown className="w-4 h-4 mr-1" />
                              {language === "zh" ? "未來一週" : "Week Ahead"}
                            </h4>
                            <p className="whitespace-pre-line text-xs leading-relaxed">
                              {data.week_ahead_forecast}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                          <h4 className="font-bold mb-1">
                            {language === "zh"
                              ? "未來展望（1–3 個月）"
                              : "Future Outlook (1–3M)"}
                          </h4>
                          <p className="whitespace-pre-line text-xs leading-relaxed">
                            {data.future_outlook}
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                          <h4 className="font-bold flex items-center mb-1">
                            <BookOpen className="w-4 h-4 mr-1" />
                            {language === "zh" ? "總結" : "Conclusion"}
                          </h4>
                          <p className="whitespace-pre-line text-xs leading-relaxed">
                            {data.conclusion}
                          </p>
                        </div>
                      </div>
                    )}

                    {data && data.error && (
                      <div className="text-sm text-red-500">{data.error}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
