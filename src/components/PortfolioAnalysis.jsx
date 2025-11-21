import React, { useState } from 'react';
import {
    Upload,
    X,
    RefreshCw,
    FileText,
    Briefcase,
    Image as ImageIcon,
    AlertCircle,
    Clock,
    TrendingUp
} from 'lucide-react';

function PortfolioAnalysis({ googleApiKey, perplexityApiKey }) {
    const [images, setImages] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [step, setStep] = useState('');
    const [result, setResult] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // 處理圖片上傳
    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setErrorMsg('');

        const newImages = [];
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newImages.push(reader.result);
                if (newImages.length === files.length) {
                    setImages((prev) => [...prev, ...newImages]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const analyze = async () => {
        if (!googleApiKey || !perplexityApiKey) {
            setErrorMsg('缺少 API Key，請先至設定輸入 Google Gemini 與 Perplexity API Key。');
            return;
        }
        if (images.length === 0) return;

        setAnalyzing(true);
        setResult('');
        setErrorMsg('');

        try {
            // ==========================================
            // STEP 1: Gemini Vision (深度結構化提取)
            // ==========================================
            setStep('🔍 Gemini 正在讀取持倉表格數據 (成本/數量/損益)...');

            const imageParts = images.map((base64Str) => ({
                inlineData: {
                    data: base64Str.split(',')[1],
                    mimeType: 'image/jpeg',
                },
            }));

            const MODEL_NAME = 'gemini-2.0-flash-exp';

            // 🔥 關鍵修改：要求提取完整表格資訊
            const visionPrompt = `
                You are a specialized Financial OCR Robot.
                Your task is to extract portfolio data from the image.
                
                Please extract a list of positions with the following fields:
                1. **symbol**: The stock ticker (e.g., NVDA, AVGO).
                2. **qty**: The Quantity/Shares held (clean number).
                3. **cost**: The "Cost" or "Total Cost" column (clean number, remove currency symbols).
                4. **gain_pct**: The "Total gain/loss %" (keep the +/- sign and %, e.g., "+51.95%").
                
                Output strictly a JSON array of objects. No markdown.
                Example Format:
                [
                  {"symbol": "AVGO", "qty": 12, "cost": 3621.02, "gain_pct": "+15.91%"},
                  {"symbol": "SPY", "qty": 5, "cost": 3065.42, "gain_pct": "+6.79%"}
                ]
                
                If some fields are missing or unreadable, put null.
            `;

            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${googleApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: visionPrompt },
                                ...imageParts
                            ]
                        }]
                    })
                }
            );

            if (!geminiResponse.ok) {
                const err = await geminiResponse.json();
                if (geminiResponse.status === 404) throw new Error(`模型找不到 (404): 請確認 API 狀態`);
                throw new Error(`Gemini Error: ${geminiResponse.status}`);
            }

            const geminiData = await geminiResponse.json();
            let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            let portfolioData = [];
            try {
                // 嘗試解析 JSON
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start !== -1 && end !== -1) {
                    portfolioData = JSON.parse(text.substring(start, end + 1));
                } else {
                    throw new Error('JSON Parse failed');
                }
            } catch (e) {
                console.warn("Parsing failed, fallback to simple ticker extraction");
                // 如果複雜解析失敗，至少抓個代碼出來跑
                const matches = text.match(/\b[A-Z]{2,5}\b/g);
                if (matches) {
                    portfolioData = [...new Set(matches)].map(t => ({ symbol: t, qty: '?', cost: '?', gain_pct: '?' }));
                }
            }

            if (portfolioData.length === 0) {
                throw new Error('Gemini 無法識別圖片中的持倉數據。');
            }

            // ==========================================
            // STEP 2: Perplexity (結合用戶成本進行分析)
            // ==========================================
            // 將用戶數據轉換成可讀字串，並計算平均成本
            const portfolioContext = portfolioData.map(p => {
                let avgCost = 'Unknown';
                if (p.cost && p.qty && !isNaN(p.cost) && !isNaN(p.qty) && p.qty > 0) {
                    // 計算平均成本：總成本 / 數量
                    avgCost = (parseFloat(p.cost.toString().replace(/,/g, '')) / parseFloat(p.qty)).toFixed(2);
                }
                return `- ${p.symbol}: 持有 ${p.qty} 股, 總成本 $${p.cost} (平均成本約 $${avgCost}/股), 目前帳面損益 ${p.gain_pct}`;
            }).join('\n');

            setStep(`🚀 識別出 ${portfolioData.length} 檔持倉 (含成本分析)。正在聯網獲取即時報價...`);

            const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });

            // 🔥 超強 Prompt：結合用戶的成本價進行分析
            const pplxPrompt = `
                Current EST Time: ${now}.
                
                User's Actual Portfolio Positions (OCR Extracted):
                ${portfolioContext}
                
                TASK: You are a Senior Portfolio Manager. Perform a "Real-Time Holdings Audit" for this user.
                
                INSTRUCTIONS:
                1. **Get Live Quotes**: Search for the EXACT price right now for each stock.
                2. **Compare with User's Cost**: 
                   - Compare the LIVE PRICE with the user's **AVERAGE COST** (calculated above).
                   - If Live Price >> Avg Cost: Suggest "Take Profit" levels or "Trailing Stop".
                   - If Live Price approx Avg Cost: Analyze momentum.
                   - If Live Price << Avg Cost: Analyze if it's a "Buy the Dip" or "Stop Loss".
                3. **Validate User's Gain %**: Check if the OCR's "gain_pct" makes sense with current price.

                Output Format (Traditional Chinese):
                
                ## 📊 深度持倉診斷報告 (${now} EST)
                
                ### [代碼] 公司名
                * **即時報價**: **$PRICE** (今日漲跌) 🕒
                * **你的持倉**: 均價 $AVG_COST | 帳面 ${portfolioData[0].gain_pct ? '損益同步中' : '損益未知'}
                * **操作建議**: **[加碼 / 減碼 / 續抱 / 止損]**
                * **策略分析**:
                  (這裡請具體寫：用戶成本在 $XXX，目前現價 $YYY。由於獲利已達 ZZ%，建議... 或者因為跌破成本，建議...)
                * **關鍵點位**: 
                  - 🔴 壓力/止盈: $Price
                  - 🟢 支撐/補倉: $Price
                
                ---
                (Next Stock)
                
                ### 總體建議
                (針對這組持倉的風險集中度給一句話)
            `;

            const pplxResponse = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${perplexityApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: 'You are a hedge fund manager analyzing a client\'s specific entry points.' },
                        { role: 'user', content: pplxPrompt },
                    ],
                    temperature: 0.1
                }),
            });

            if (!pplxResponse.ok) throw new Error(`Perplexity Error: ${pplxResponse.status}`);

            const pplxData = await pplxResponse.json();
            setResult(pplxData.choices[0].message.content);

        } catch (err) {
            console.error(err);
            setErrorMsg(err.message);
        } finally {
            setAnalyzing(false);
            setStep('');
        }
    };

    return (
        <div className="h-full flex flex-col lg:flex-row gap-6">
            {/* 左側：上傳區 */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                        <Upload className="w-5 h-5 mr-2 text-indigo-500" /> 上傳持倉截圖
                    </h3>
                    <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-slate-800/50 group">
                        <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">上傳持倉表格圖片</p>
                        <p className="text-xs text-slate-400 mt-1">支援 Quantity, Cost, Gain% 識別</p>
                    </div>
                    {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-4 max-h-60 overflow-y-auto pr-1">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                    <img src={img} alt="preview" className="w-full h-full object-cover" />
                                    <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {errorMsg && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex border border-red-200"><AlertCircle className="w-4 h-4 mr-2" />{errorMsg}</div>}
                    <button onClick={analyze} disabled={analyzing || images.length === 0} className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center space-x-2 transition-all ${analyzing || images.length === 0 ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'}`}>
                        {analyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                        <span>{analyzing ? step || '處理中...' : '深度分析持倉成本'}</span>
                    </button>
                </div>
            </div>
            {/* 右側：結果區 */}
            <div className="w-full lg:w-2/3">
                <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm h-full min-h-[500px]">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                        <Clock className="w-5 h-5 mr-2 text-emerald-500" /> 診斷報告
                    </h3>
                    {!result && !analyzing ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60">
                            <Briefcase className="w-16 h-16 mb-4" />
                            <p>讀取 成本/股數 + 即時報價分析</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                            {analyzing && !result ? <div className="animate-pulse space-y-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></div> : result}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PortfolioAnalysis;