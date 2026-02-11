import React, { useEffect, useMemo, useState } from "react";

/**
 * TWChart
 * - Uses Vite proxy: /yahoo -> https://query1.finance.yahoo.com
 * - Fetches Yahoo Finance chart JSON and renders a lightweight SVG line chart.
 */
export default function TWChart({
  symbol, // e.g., "2330.TW"
  darkMode = true,
  range = "5d",
  interval = "5m",
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [series, setSeries] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");
      setSeries(null);

      try {
        // Yahoo endpoint (proxied)
        const url =
          `/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}` +
          `?range=${encodeURIComponent(range)}` +
          `&interval=${encodeURIComponent(interval)}` +
          `&includePrePost=false&events=div%7Csplit`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Yahoo API ${resp.status}`);

        const json = await resp.json();
        const result = json?.chart?.result?.[0];
        const error = json?.chart?.error;

        if (error) throw new Error(error?.description || "Yahoo chart error");
        if (!result) throw new Error("No data returned");

        const ts = result?.timestamp || [];
        const closes = result?.indicators?.quote?.[0]?.close || [];

        // Build points, drop nulls
        const pts = [];
        for (let i = 0; i < ts.length; i++) {
          const v = closes[i];
          if (v == null || Number.isNaN(v)) continue;
          pts.push({ t: ts[i], v });
        }
        if (pts.length < 2) throw new Error("Not enough data points");

        if (!cancelled) setSeries(pts);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load chart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, interval]);

  const svg = useMemo(() => {
    if (!series || series.length < 2) return null;

    // SVG coordinate system
    const W = 900;
    const H = 420;
    const PAD_L = 48;
    const PAD_R = 14;
    const PAD_T = 14;
    const PAD_B = 28;

    const xs = series.map((p) => p.t);
    const ys = series.map((p) => p.v);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const xSpan = maxX - minX || 1;
    const ySpan = (maxY - minY) || 1;

    const xToPx = (x) =>
      PAD_L + ((x - minX) / xSpan) * (W - PAD_L - PAD_R);

    const yToPx = (y) =>
      PAD_T + (1 - (y - minY) / ySpan) * (H - PAD_T - PAD_B);

    // Line path
    const d = series
      .map((p, i) => {
        const x = xToPx(p.t);
        const y = yToPx(p.v);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    // Last point marker + labels
    const last = series[series.length - 1];
    const lastX = xToPx(last.t);
    const lastY = yToPx(last.v);

    const bg = darkMode ? "#0b1220" : "#ffffff";
    const grid = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const line = darkMode ? "#7aa2ff" : "#245bff";
    const text = darkMode ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.70)";
    const textStrong = darkMode ? "#ffffff" : "#111827";

    // simple grid (3 horizontal lines)
    const yGrid = [0.25, 0.5, 0.75].map((k) => PAD_T + k * (H - PAD_T - PAD_B));

    const fmt = (n) => {
      // keep it readable (台股價格通常大)
      if (Math.abs(n) >= 1000) return n.toFixed(0);
      if (Math.abs(n) >= 100) return n.toFixed(1);
      return n.toFixed(2);
    };

    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        role="img"
        aria-label={`${symbol} chart`}
      >
        <rect x="0" y="0" width={W} height={H} fill={bg} />

        {/* grid */}
        {yGrid.map((yy, idx) => (
          <line
            key={idx}
            x1={PAD_L}
            y1={yy}
            x2={W - PAD_R}
            y2={yy}
            stroke={grid}
            strokeWidth="1"
          />
        ))}

        {/* y labels */}
        <text x={10} y={PAD_T + 10} fill={text} fontSize="12">
          {fmt(maxY)}
        </text>
        <text x={10} y={H - PAD_B} fill={text} fontSize="12">
          {fmt(minY)}
        </text>

        {/* line */}
        <path d={d} fill="none" stroke={line} strokeWidth="2" />

        {/* last point */}
        <circle cx={lastX} cy={lastY} r="3.5" fill={line} />

        {/* last value label */}
        <rect
          x={Math.min(lastX + 8, W - 120)}
          y={Math.max(lastY - 18, 6)}
          width="112"
          height="22"
          rx="6"
          fill={darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"}
          stroke={grid}
        />
        <text
          x={Math.min(lastX + 16, W - 112)}
          y={Math.max(lastY - 3, 20)}
          fill={textStrong}
          fontSize="12"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        >
          {fmt(last.v)}
        </text>
      </svg>
    );
  }, [series, darkMode, symbol]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        Loading TW chart...
      </div>
    );
  }

  if (err) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-red-400 gap-2 px-3 text-center">
        <div>TW chart failed</div>
        <div className="opacity-80">{err}</div>
        <div className="opacity-80">symbol: {symbol}</div>
      </div>
    );
  }

  return <div className="w-full h-full">{svg}</div>;
}