import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  ColorType,
  // v5 會用到 AreaSeries；v4 沒這個也沒關係（只是 undefined）
  AreaSeries,
} from "lightweight-charts";

function toTWSymbol(code) {
  const cleaned = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/^TWSE:/, "");
  if (cleaned.endsWith(".TW") || cleaned.endsWith(".TWO")) return cleaned;
  return `${cleaned}.TW`;
}

export default function TWChartLC({
  code,
  darkMode = true,
  range = "1mo",
  interval = "30m",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const symbol = useMemo(() => toTWSymbol(code), [code]);

  useEffect(() => {
    if (!containerRef.current) return;

    // clean old
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: darkMode ? "#0b1220" : "#ffffff",
        },
        textColor: darkMode ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.70)",
        fontSize: 12,
      },
      grid: {
        vertLines: {
          color: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        },
        horzLines: {
          color: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        },
      },
      rightPriceScale: {
        borderColor: darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
      },
      timeScale: {
        borderColor: darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: true,
      handleScale: true,
    });

    // ✅ 兼容 v4 / v5 的 Area series 建立方式
    const areaOptions = {
      lineWidth: 2,
      lineColor: darkMode ? "#7aa2ff" : "#245bff",
      topColor: darkMode ? "rgba(122,162,255,0.22)" : "rgba(36,91,255,0.18)",
      bottomColor: darkMode ? "rgba(122,162,255,0.02)" : "rgba(36,91,255,0.02)",
    };

    let areaSeries = null;

    // v4
    if (typeof chart.addAreaSeries === "function") {
      areaSeries = chart.addAreaSeries(areaOptions);
    }
    // v5+
    else if (typeof chart.addSeries === "function") {
      // AreaSeries 在 v5 才有；如果你這裡是 undefined 代表裝到的版本不是 v5 build
      areaSeries = chart.addSeries(AreaSeries, areaOptions);
    }

    if (!areaSeries) {
      chart.remove();
      throw new Error(
        "lightweight-charts API mismatch: cannot create Area series. Check installed version.",
      );
    }

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      chart.timeScale().fitContent();
    });
    ro.observe(containerRef.current);

    // initial size
    chart.applyOptions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const url =
          `/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}` +
          `?range=${encodeURIComponent(range)}` +
          `&interval=${encodeURIComponent(interval)}` +
          `&includePrePost=false&events=div%7Csplit`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Yahoo API ${resp.status}`);

        const json = await resp.json();
        const result = json?.chart?.result?.[0];
        const apiErr = json?.chart?.error;

        if (apiErr) throw new Error(apiErr?.description || "Yahoo chart error");
        if (!result) throw new Error("No data from Yahoo");

        const ts = result.timestamp || [];
        const close = result?.indicators?.quote?.[0]?.close || [];

        const data = [];
        for (let i = 0; i < ts.length; i++) {
          const v = close[i];
          if (v == null || Number.isNaN(v)) continue;
          data.push({ time: ts[i], value: v });
        }

        if (data.length < 2) throw new Error("Not enough points");

        if (!cancelled && seriesRef.current && chartRef.current) {
          seriesRef.current.setData(data);
          chartRef.current.timeScale().fitContent();
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, interval]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-2 left-2 text-[11px] px-2 py-1 rounded-md border border-white/10 bg-black/20 text-white/80">
        {symbol} · {range}/{interval}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70 bg-black/20">
          Loading...
        </div>
      )}

      {err && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-red-300 bg-black/30 gap-2 px-4 text-center">
          <div>TW chart failed</div>
          <div className="opacity-90">{err}</div>
          <div className="opacity-80">symbol: {symbol}</div>
        </div>
      )}
    </div>
  );
}
