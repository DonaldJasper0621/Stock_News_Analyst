// src/MarketDashboard.jsx
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import TradingViewWidget from './Trading_View_Widget_Component.jsx';

export default function MarketDashboard({ apiKey, darkMode, language = 'zh' }) {
    const DEFAULT_TICKERS = ['NVDA', 'TSLA', 'PLTR', 'AMD', 'ORCL', 'AVGO', 'PYPL', 'SPY'];

    const [tickers, setTickers] = useState(() => {
        try {
            const saved = localStorage.getItem('pplx_watchlist');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load watchlist from localStorage', e);
        }
        return DEFAULT_TICKERS;
    });

    const [selectedTickers, setSelectedTickers] = useState(new Set(['NVDA']));
    const [newTicker, setNewTicker] = useState('');
    const [loading, setLoading] = useState(false);
    const [stockData, setStockData] = useState({});
    const [error, setError] = useState('');

    const toggleTicker = (t) => {
        const next = new Set(selectedTickers);
        if (next.has(t)) next.delete(t);
        else next.add(t);
        setSelectedTickers(next);
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
        if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
            setTickers([...tickers, newTicker.toUpperCase()]);
            setNewTicker('');
        }
    };

    const generateBriefing = async () => {
        if (!apiKey) {
            setError('請先在上方設定中輸入 Perplexity API Key（pplx-...）');
            return;
        }

        if (selectedTickers.size === 0) {
            setError('請至少選擇一支股票');
            return;
        }

        setLoading(true);
        setError('');
        setStockData({});

        const isChinese = language === 'zh';

        // 1. 獲取當前美東時間 (Wall Street Time)
        const now = new Date();
        const options = {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const currentDateStr = now.toLocaleString('en-US', options) + " EST";

        // 2. 融合指令：時效性 + 深度要求
        const recencyInstruction = isChinese
            ? `CRITICAL: Analysis MUST be based on LATEST data (last 24 hours) relative to ${currentDateStr}. Include pre-market/after-hours data.`
            : `CRITICAL: Analysis MUST be based on LATEST data (last 24 hours) relative to ${currentDateStr}. Include pre-market/after-hours data.`;

        // 3. 強化 Prompt：要求詳細段落 (Detailed Paragraphs)
        const systemPrompt = isChinese
            ? `
You are a professional Wall Street senior analyst creating a **real-time, deep-dive briefing** for sophisticated investors.

**TIME CONTEXT**:
Current Wall Street Time: **${currentDateStr}**.

**STRICT INSTRUCTIONS**:
1. ${recencyInstruction}
2. LANGUAGE: All text content MUST be in Traditional Chinese (繁體中文).
3. STYLE: Professional, analytical, **detailed, and insightful**. Avoid generic summaries. Use financial terminology (e.g., "獲利回吐", "估值壓力", "震盪整理").
4. **DEPTH**: Do not be brief. Provide distinct reasons and logic for every section.
5. FORMAT: Return ONLY a valid JSON object. No markdown.

Expected JSON Structure:
{
  "symbol": "STRING (Ticker)",
  "sentiment_score": NUMBER (1-10),
  "support_level_short": "STRING (Current levels based on latest price)",
  "resistance_level_short": "STRING",
  "major_news": "STRING (Bullet points. The most critical news from the last 24 hours in 繁體中文)",
  "market_factors": "STRING (Detailed paragraph in 繁體中文. Explain WHY the stock is moving NOW. Discuss valuation, sentiment, and specific catalysts. Do not summarize; analyze.)",
  "technical_analysis_detailed": "STRING (Detailed paragraph in 繁體中文. Provide short-term support/resistance, moving averages status, volume structure, and specific candlestick patterns from today.)",
  "tomorrow_forecast": "STRING (Detailed paragraph in 繁體中文. Predict the immediate next session's scenario with specific price ranges and drivers.)",
  "week_ahead_forecast": "STRING (Detailed paragraph in 繁體中文. Outlook for the coming week, potential catalysts, and risk scenarios.)",
  "future_outlook": "STRING (Detailed paragraph in 繁體中文. Mid-to-long term (3-12 mo) view, growth drivers, and structural changes.)",
  "conclusion": "STRING (Actionable summary: 偏多續抱／逢回佈局／保守觀望／逢高減碼)"
}`
            : `
You are a professional Wall Street senior analyst creating a **real-time, deep-dive briefing** for sophisticated investors.

**TIME CONTEXT**:
Current Wall Street Time: **${currentDateStr}**.

**STRICT INSTRUCTIONS**:
1. ${recencyInstruction}
2. LANGUAGE: All text content MUST be in English.
3. STYLE: Professional, analytical, **detailed, and insightful**. Avoid generic summaries.
4. **DEPTH**: Do not be brief. Provide distinct reasons and logic for every section.
5. FORMAT: Return ONLY a valid JSON object. No markdown.

Expected JSON Structure:
{
  "symbol": "STRING (Ticker)",
  "sentiment_score": NUMBER (1-10),
  "support_level_short": "STRING (Current levels based on latest price)",
  "resistance_level_short": "STRING",
  "major_news": "STRING (Bullet points. The most critical news from the last 24 hours)",
  "market_factors": "STRING (Detailed paragraph. Explain WHY the stock is moving NOW. Discuss valuation, sentiment, and specific catalysts. Do not summarize; analyze.)",
  "technical_analysis_detailed": "STRING (Detailed paragraph. Provide short-term support/resistance, moving averages status, volume structure, and specific candlestick patterns from today.)",
  "tomorrow_forecast": "STRING (Detailed paragraph. Predict the immediate next session's scenario with specific price ranges and drivers.)",
  "week_ahead_forecast": "STRING (Detailed paragraph. Outlook for the coming week, potential catalysts, and risk scenarios.)",
  "future_outlook": "STRING (Detailed paragraph. Mid-to-long term (3-12 mo) view, growth drivers, and structural changes.)",
  "conclusion": "STRING (Actionable summary)"
}`;

        const promises = Array.from(selectedTickers).map(async (symbol) => {
            // User Prompt: 結合舊版的「深度分析」請求與新版的「時間基準」
            const userPrompt = isChinese
                ? `深度分析代號：${symbol}。基準時間：${currentDateStr}。
                   請結合「最新即時數據（過去24小時）」與「深度邏輯推演」。
                   請勿簡略，需詳細說明市場情緒、技術型態、盤前/盤後動態對明日走勢的影響。
                   忽略過時新聞，專注於當下發生的事件。`
                : `Deep Dive Analysis for Symbol: ${symbol}. Reference Time: ${currentDateStr}.
                   Combine "LATEST Real-time Data (Last 24h)" with "Comprehensive Reasoning".
                   Do NOT be brief. Explain market sentiment, technical patterns, and pre-market/after-hours impact on tomorrow's trend.
                   Ignore outdated news. Focus on what is happening NOW.`;

            try {
                const response = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'sonar-pro',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        // 稍微提高 temperature (從 0.2 升到 0.3) 讓它敢多寫一點，但仍保持準確
                        temperature: 0.3
                    }),
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);

                const data = await response.json();
                let content = data.choices[0].message.content || '';
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();

                return JSON.parse(content);
            } catch (err) {
                console.error(`Error fetching ${symbol}:`, err);
                return {
                    symbol,
                    error: '無法取得分析資料，請檢查 API Key 或稍後再試。',
                };
            }
        });
        const results = await Promise.all(promises);
        const newStockData = {};
        results.forEach((item) => {
            if (item && item.symbol) newStockData[item.symbol] = item;
        });

        setStockData(newStockData);
        setLoading(false);
    };

    useEffect(() => {
        try {
            localStorage.setItem('pplx_watchlist', JSON.stringify(tickers));
        } catch (e) {
            console.warn('Failed to save watchlist to localStorage', e);
        }
    }, [tickers]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
            {/* 左側 Watchlist */}
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
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${loading
                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 border-indigo-500 text-white shadow-sm hover:bg-indigo-500'
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
                                    className={`flex items-center border rounded-md ${active
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600'
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
                            onKeyDown={(e) => e.key === 'Enter' && addTicker()}
                            placeholder="ADD SYMBOL"
                            className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600"
                        />
                        <button
                            onClick={addTicker}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 rounded-md"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 右側 報告卡片 */}
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
                                {/* ★★ 重點：上下排，圖固定高度 ★★ */}
                                <div className="flex flex-col">
                                    {/* 上：股價圖，固定高度避免被壓扁 */}
                                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 h-[320px] md:h-[360px]">
                                        <TradingViewWidget symbol={symbol} theme="dark" chartType="area" />
                                    </div>

                                    {/* 下：AI 報告 */}
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
                                                            {language === 'zh' ? '支撐位: ' : 'Support: '}
                                                            {data.support_level_short}
                                                        </span>
                                                        <span>
                                                            {language === 'zh' ? '壓力位: ' : 'Resistance: '}
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
                                                {/* 今日新聞 */}
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                                    <h4 className="font-bold mb-2 flex items-center">
                                                        <Newspaper className="w-4 h-4 mr-2" />
                                                        {language === 'zh' ? '今日重大新聞' : 'Major News Today'}
                                                    </h4>
                                                    <p className="whitespace-pre-line">{data.major_news}</p>
                                                </div>

                                                {/* 市場多空因素與情緒 */}
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                    <h4 className="font-bold mb-1">
                                                        {language === 'zh'
                                                            ? '市場多空因素與情緒'
                                                            : 'Market Factors & Sentiment'}
                                                    </h4>
                                                    <p className="whitespace-pre-line text-xs leading-relaxed">
                                                        {data.market_factors}
                                                    </p>
                                                </div>

                                                {/* 技術面分析 */}
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                    <h4 className="font-bold mb-1">
                                                        {language === 'zh'
                                                            ? '技術面分析（支撐 / 壓力）'
                                                            : 'Technical Analysis (Support / Resistance)'}
                                                    </h4>
                                                    <p className="whitespace-pre-line text-xs leading-relaxed">
                                                        {data.technical_analysis_detailed}
                                                    </p>
                                                </div>

                                                {/* 明日 / 未來一週 預測 */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                        <h4 className="font-bold flex items-center mb-1">
                                                            <DollarSign className="w-4 h-4 mr-1" />
                                                            {language === 'zh' ? '明日預測' : 'Tomorrow Forecast'}
                                                        </h4>
                                                        <p className="whitespace-pre-line text-xs leading-relaxed">
                                                            {data.tomorrow_forecast}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                        <h4 className="font-bold flex items-center mb-1">
                                                            <TrendingDown className="w-4 h-4 mr-1" />
                                                            {language === 'zh' ? '未來一週' : 'Week Ahead'}
                                                        </h4>
                                                        <p className="whitespace-pre-line text-xs leading-relaxed">
                                                            {data.week_ahead_forecast}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* 中期展望 */}
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                    <h4 className="font-bold mb-1">
                                                        {language === 'zh'
                                                            ? '未來展望（1–3 個月）'
                                                            : 'Future Outlook (1–3M)'}
                                                    </h4>
                                                    <p className="whitespace-pre-line text-xs leading-relaxed">
                                                        {data.future_outlook}
                                                    </p>
                                                </div>

                                                {/* 操作總結 */}
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                    <h4 className="font-bold flex items-center mb-1">
                                                        <BookOpen className="w-4 h-4 mr-1" />
                                                        {language === 'zh' ? '總結' : 'Conclusion'}
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