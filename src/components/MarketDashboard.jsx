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

        const systemPrompt = isChinese
            ? `
You are a professional Wall Street senior analyst creating a **pre-market briefing** for sophisticated investors based on the most recent data **as of today**.
ANALYZE the stock symbol provided.

**IMPORTANT INSTRUCTION**:
1. LANGUAGE: All text content MUST be in Traditional Chinese (繁體中文).
2. STYLE: Professional, analytical, detailed, and insightful. Avoid generic summaries. Use financial terminology (e.g., "獲利回吐", "估值壓力", "震盪整理").
3. FORMAT: Return ONLY a valid JSON object. Do NOT include any markdown, explanation, or extra text.
4. TODAY’S DATE: Be aware today's date is **<INSERT-TODAY-DATE>**. Make sure your analysis and any references to “今日”、“明日”、“未來一週” are appropriate to that date.

Expected JSON Structure:
{
  "symbol": "STRING (Ticker)",
  "sentiment_score": NUMBER (1-10),
  "support_level_short": "STRING (e.g. '215 / 200 USD')",
  "resistance_level_short": "STRING (e.g. '235 USD')",
  "major_news": "STRING (Bullet points. The most critical news headlines up to today, in 繁體中文)",
  "market_factors": "STRING (Detailed paragraph in 繁體中文. Explaining current bull/bear factors, valuation pressure, investor sentiment, recent catalysts)",
  "technical_analysis_detailed": "STRING (Detailed paragraph in 繁體中文. Provide short-term support/resistance, moving averages status, volume structure, key breakout/failure levels)",

  "tomorrow_forecast": "STRING (Detailed paragraph in 繁體中文. Give tomorrow’s expected scenario, price-range if possible, and the key drivers for upside/downside such as upcoming data/events)",
  "week_ahead_forecast": "STRING (Detailed paragraph in 繁體中文. Focus on the coming week’s outlook, potential range, major events/catalysts, risk scenarios and contingency key levels)",

  "future_outlook": "STRING (Detailed paragraph in 繁體中文. Mid-to-long term (3-12 mo) view, growth drivers, structural changes, valuation re-rating possibilities)",
  "conclusion": "STRING (短而有行動性的總結，用繁體中文，例如：「偏多續抱／逢回佈局／保守觀望／逢高減碼」）"
}`
            : `
You are a professional Wall Street senior analyst creating a **pre-market briefing** for sophisticated investors based on the most recent data **as of today**.
ANALYZE the stock symbol provided.

**IMPORTANT INSTRUCTION**:
1. LANGUAGE: All text content MUST be in English.
2. STYLE: Professional, analytical, detailed, and insightful. Avoid generic summaries. Use financial terminology (e.g., "profit taking", "valuation pressure", "range-bound consolidation").
3. FORMAT: Return ONLY a valid JSON object. Do NOT include any markdown, explanation, or extra text.
4. TODAY’S DATE: Be aware today's date is **<INSERT-TODAY-DATE>**. Make sure your analysis and any references to “today”, “tomorrow”, “next week” are appropriate to that date.

Expected JSON Structure:
{
  "symbol": "STRING (Ticker)",
  "sentiment_score": NUMBER (1-10),
  "support_level_short": "STRING (e.g. '215 / 200 USD')",
  "resistance_level_short": "STRING (e.g. '235 USD')",
  "major_news": "STRING (Bullet points. The most critical news headlines up to today, in English)",
  "market_factors": "STRING (Detailed paragraph in English. Explain current bull/bear factors, valuation pressure, investor sentiment, recent catalysts)",
  "technical_analysis_detailed": "STRING (Detailed paragraph in English. Provide short-term support/resistance, moving averages status, volume structure, key breakout/failure levels)",

  "tomorrow_forecast": "STRING (Detailed paragraph in English. Give tomorrow’s expected scenario, price-range if possible, and the key drivers for upside/downside such as upcoming data/events)",
  "week_ahead_forecast": "STRING (Detailed paragraph in English. Focus on the coming week’s outlook, potential range, major events/catalysts, risk scenarios and contingency key levels)",

  "future_outlook": "STRING (Detailed paragraph in English. Mid-to-long term (3-12 mo) view, growth drivers, structural changes, valuation re-rating possibilities)",
  "conclusion": "STRING (Short, actionable conclusion in English, e.g. 'Maintain bullish bias on pullbacks', 'Neutral – wait for better entry', 'Reduce exposure into strength')"
}`;

        const promises = Array.from(selectedTickers).map(async (symbol) => {
            const userPrompt = isChinese
                ? `請用繁體中文，針對 ${symbol} 做深入分析，以「今天的日期 (YYYY/MM/DD)」為基準。重點說明市場情緒、技術價位、明日可能走勢、未來一週區間與潛在事件，以及中長線展望，並納入截至今日為止的最新重大新聞。`
                : `Deep analysis for ${symbol}, using today's date (YYYY/MM/DD). Answer in English. Focus on market sentiment, technical levels, tomorrow’s price action, the coming week, and long-term outlook, and include the latest major news up to today.`;

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
                                                    <p className="whitespace-pre-line text-xs">
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
                                                    <p className="whitespace-pre-line text-xs">
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
                                                        <p className="whitespace-pre-line text-xs">
                                                            {data.tomorrow_forecast}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                        <h4 className="font-bold flex items-center mb-1">
                                                            <TrendingDown className="w-4 h-4 mr-1" />
                                                            {language === 'zh' ? '未來一週' : 'Week Ahead'}
                                                        </h4>
                                                        <p className="whitespace-pre-line text-xs">
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
                                                    <p className="whitespace-pre-line text-xs">
                                                        {data.future_outlook}
                                                    </p>
                                                </div>

                                                {/* 操作總結 */}
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                                    <h4 className="font-bold flex items-center mb-1">
                                                        <BookOpen className="w-4 h-4 mr-1" />
                                                        {language === 'zh' ? '總結' : 'Conclusion'}
                                                    </h4>
                                                    <p className="whitespace-pre-line text-xs">
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
