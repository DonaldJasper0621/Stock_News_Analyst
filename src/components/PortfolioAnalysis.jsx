import React, { useState } from 'react';
import {
    Upload,
    X,
    RefreshCw,
    FileText,
    Briefcase,
    Image as ImageIcon,
} from 'lucide-react';

function PortfolioAnalysis({ googleApiKey }) {
    const [images, setImages] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState('');

    // 處理圖片上傳
    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newImages = [];
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newImages.push(reader.result); // Base64 string
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
        if (!googleApiKey) {
            alert('請先在設定中輸入 Google Gemini API Key');
            return;
        }
        if (images.length === 0) return;

        setAnalyzing(true);
        setResult('');

        try {
            // 準備圖片資料
            const imageParts = images.map((base64Str) => ({
                inlineData: {
                    data: base64Str.split(',')[1],
                    mimeType: 'image/jpeg',
                },
            }));

            // Prompt：專注持倉 & Limit Price
            const prompt = `
        你是一位華爾街頂級交易員。用戶上傳了多張持倉截圖。請辨識圖中的每一檔股票，並針對**整體倉位**與**個別股票**進行分析。
        
        請以繁體中文回覆，針對每一檔識別出的股票提供以下結構化分析：
        1. **【股票代碼/名稱】** (例如: NVDA / Nvidia)
           - **目前狀態**: 獲利/虧損狀況簡評。
           - **操作建議**: 明確給出 Buy / Sell / Hold / Add (加碼)。
           - **關鍵點位 (Limit Price)**:
             * 若建議買入/加碼，請給出 **Limit Buy Price** (低接點位)。
             * 若建議賣出/減碼，請給出 **Limit Sell Price** (止盈/止損點位)。
           - **分析理由**: 結合技術面支撐/壓力與估值風險。

        最後請給出一個 **總結建議 (Portfolio Summary)**，評估持倉集中度與風險。
      `;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }, ...imageParts]
                        }]
                    })
                }
            );

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            const text =
                data.candidates?.[0]?.content?.parts?.[0]?.text || '無回應';
            setResult(text);
        } catch (err) {
            setResult(`分析失敗: ${err.message}`);
        } finally {
            setAnalyzing(false);
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
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                            點擊或拖曳圖片至此
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            支援多張截圖一次分析
                        </p>
                    </div>

                    {/* 圖片預覽 */}
                    {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-4 max-h-60 overflow-y-auto pr-1">
                            {images.map((img, idx) => (
                                <div
                                    key={idx}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group"
                                >
                                    <img
                                        src={img}
                                        alt="preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={analyze}
                        disabled={analyzing || images.length === 0}
                        className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center space-x-2 transition-all ${analyzing || images.length === 0
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {analyzing ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <Briefcase className="w-5 h-5" />
                        )}
                        <span>{analyzing ? 'AI 分析中...' : '開始診斷 (Analyze)'}</span>
                    </button>
                </div>
            </div>

            {/* 右側：結果區 */}
            <div className="w-full lg:w-2/3">
                <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm h-full min-h-[500px]">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                        <FileText className="w-5 h-5 mr-2 text-emerald-500" /> 診斷報告
                    </h3>

                    {!result ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60">
                            <Briefcase className="w-16 h-16 mb-4" />
                            <p>請上傳圖片並點擊分析以獲取報告</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                            {result}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ✅ 關鍵：明確 default export
export default PortfolioAnalysis;
