import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, DownloadCloud, RefreshCcw, Copy, Sparkles, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = "";

function shortNumber(s, maxLen = 30) {
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(10, Math.floor(maxLen / 2))) + "…" + s.slice(-Math.floor(maxLen / 2));
}

function niceLabel(v) {
  try {
    const n = Number(v);
    if (!Number.isFinite(n)) return shortNumber(String(v));
    if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3) return n.toExponential(6);
    return n.toLocaleString(undefined, { maximumFractionDigits: 12 });
  } catch (e) {
    return shortNumber(String(v));
  }
}

export default function App() {
  const [number, setNumber] = useState("2");
  const [prec, setPrec] = useState(200);
  const [iterations, setIterations] = useState(20);
  const [method, setMethod] = useState("heron");
  const [initMode, setInitMode] = useState("auto");
  const [initValue, setInitValue] = useState("");
  const [includeIterations, setIncludeIterations] = useState(true);
  const [saveCsv, setSaveCsv] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [csvUrl, setCsvUrl] = useState(null);

  const clearAll = useCallback(() => {
    setResult(null);
    setError(null);
    setCsvUrl(null);
  }, []);

  const sampleQuick = (val) => {
    setNumber(val);
    clearAll();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCsvUrl(null);

    const payload = {
      number: number,
      prec_digits: Number(prec),
      iterations: Number(iterations),
      method: method,
      init_mode: initMode,
      init_value: initValue,
      include_iterations: includeIterations,
      save_csv: saveCsv,
    };

    try {
      const resp = await fetch(`${API_BASE}/api/sqrt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
      }

      const ct = resp.headers.get("Content-Type") || "";
      if (ct.includes("text/csv")) {
        // CSV blob returned
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setCsvUrl(url);
        setResult({ csv: true, message: "CSV ready to download" });
      } else {
        const data = await resp.json();
        setResult(data);
      }
    } catch (err) {
      console.error(err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const iterationsForChart = useMemo(() => {
    if (!result || !result.iterations) return [];
    // convert abs_err to numeric log10 for chart (safer visualization)
    return result.iterations.map((it) => {
      let parsed = Number(it.abs_err);
      if (!Number.isFinite(parsed) || parsed === 0) {
        // fallback: try to parse scientific notation manually
        parsed = parseFloat(it.abs_err);
      }
      let log = null;
      if (Number.isFinite(parsed) && parsed > 0) {
        log = Math.log10(Math.max(parsed, Number.MIN_VALUE));
      }
      return { i: it.i, abs_err: it.abs_err, log10_abs_err: log };
    });
  }, [result]);

  const copyResult = async () => {
    if (!result) return;
    const text = JSON.stringify(result, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      // tiny confirmation
      setResult((r) => ({ ...r, _copied: (r._copied || 0) + 1 }));
    } catch (e) {
      console.warn("copy failed", e);
    }
  };

  // fun motion variants
  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 18 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50/60 overflow-hidden relative">
      {/* animated decorative blobs */}
      <motion.div
        aria-hidden
        className="absolute -left-40 -top-40 w-96 h-96 bg-gradient-to-tr from-purple-400 via-pink-400 to-yellow-300 rounded-full filter blur-3xl opacity-30"
        animate={{ x: [0, 40, -20, 0], y: [0, -20, 30, 0], rotate: [0, 10, -6, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute right-[-120px] top-20 w-[420px] h-[420px] bg-gradient-to-br from-emerald-300 via-cyan-300 to-blue-400 rounded-full filter blur-2xl opacity-25"
        animate={{ x: [0, -30, 20, 0], y: [0, 10, -20, 0], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900 flex items-center gap-3">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-8 h-8 text-pink-500" />
                  High-Precision Sqrt Studio
                </span>
              </h1>
              <p className="mt-2 text-slate-600">A playful, fast interface to experiment with Newton & reciprocal-square-root methods.</p>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 backdrop-blur border border-slate-200 shadow-sm hover:scale-[1.02] transition"
                onClick={() => {
                  setNumber("3.1415926535897932384626433832795028841971");
                  clearAll();
                }}
                title="Try π"
              >
                Try π
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 backdrop-blur border border-slate-200 shadow-sm hover:scale-[1.02] transition"
                onClick={() => sampleQuick("1e1000")}
                title="Big number"
              >
                Big number
              </button>
            </div>
          </div>
        </motion.header>

        <main className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: big input */}
          <section className="lg:col-span-7">
            <motion.div className="rounded-2xl bg-white/70 p-6 shadow-2xl backdrop-blur border border-slate-100" variants={cardVariants} initial="hidden" animate="visible">
              <label className="block text-sm font-medium text-slate-700">Number to compute √(·)</label>
              <textarea
                aria-label="number-input"
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value);
                  clearAll();
                }}
                placeholder={`Type a decimal number (example: 2, 3.14159, 1e-100). Make it large — this tool loves big numbers.`}
                className="mt-3 w-full min-h-[220px] md:min-h-[300px] text-3xl md:text-5xl font-mono p-6 rounded-3xl border border-slate-200 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-200 resize-none"
              />

              <div className="mt-5 flex flex-wrap gap-3 items-center">
                <button
                  className="inline-flex items-center gap-3 px-5 py-3 rounded-full font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-lg hover:scale-[1.02] transition-transform"
                  onClick={handleSubmit}
                >
                  <Play className="w-5 h-5" />
                  <span>{loading ? "Computing…" : "Compute sqrt"}</span>
                </button>

                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm"
                  onClick={() => {
                    setNumber("");
                    clearAll();
                  }}
                >
                  <RefreshCcw className="w-4 h-4" /> Clear
                </button>

                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm"
                  onClick={() => sampleQuick("2")}
                >
                  Use 2
                </button>

                <div className="ml-auto flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 shadow-sm"
                    onClick={copyResult}
                    title="Copy result JSON to clipboard"
                    disabled={!result}
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  {csvUrl && (
                    <a className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 shadow-sm" href={csvUrl} download="iterations.csv">
                      <DownloadCloud className="w-4 h-4" /> Download CSV
                    </a>
                  )}
                </div>
              </div>
            </motion.div>

            {/* tips / small playground */}
            <motion.div className="mt-6 rounded-2xl p-4 bg-gradient-to-r from-white to-slate-50 border border-slate-100 shadow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="font-semibold text-slate-800">Playground tips</h3>
              <p className="mt-2 text-slate-600">Try:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700" onClick={() => sampleQuick("2")}>2</button>
                <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700" onClick={() => sampleQuick("3.1415926535")}>π (float)</button>
                <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700" onClick={() => sampleQuick("1e200")}>1e200</button>
                <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700" onClick={() => sampleQuick("9.87654321e-300")}>tiny</button>
                <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700" onClick={() => sampleQuick(Array.from({length:200}, (_,i)=> '9').join(''))}>very big int</button>
              </div>
            </motion.div>
          </section>

          {/* Right: controls + results */}
          <aside className="lg:col-span-5 space-y-6">
            <motion.div className="rounded-2xl bg-white/80 p-5 shadow-xl border border-slate-100" variants={cardVariants} initial="hidden" animate="visible">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">Settings</h4>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <label className="text-sm text-slate-600">Precision (decimal digits): <span className="font-medium text-slate-800">{prec}</span></label>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  value={prec}
                  onChange={(e) => { setPrec(Number(e.target.value)); clearAll(); }}
                />

                <label className="text-sm text-slate-600">Iterations: <span className="font-medium text-slate-800">{iterations}</span></label>
                <input type="range" min="0" max="1000" value={iterations} onChange={(e) => { setIterations(Number(e.target.value)); clearAll(); }} />

                <div className="flex gap-2 items-center">
                  <span className="text-sm text-slate-600 w-24">Method</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setMethod("heron"); clearAll(); }} className={`px-3 py-2 rounded-lg ${method === "heron" ? "bg-indigo-600 text-white shadow" : "bg-white border"}`}>Heron</button>
                    <button onClick={() => { setMethod("recip"); clearAll(); }} className={`px-3 py-2 rounded-lg ${method === "recip" ? "bg-indigo-600 text-white shadow" : "bg-white border"}`}>Reciprocal</button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-24">Initial</span>
                  <select value={initMode} onChange={(e) => { setInitMode(e.target.value); clearAll(); }} className="px-3 py-2 rounded-lg border">
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                {initMode === "manual" && (
                  <div>
                    <input value={initValue} onChange={(e) => { setInitValue(e.target.value); clearAll(); }} placeholder="Initial guess (decimal)" className="w-full mt-2 px-3 py-2 rounded-lg border" />
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={includeIterations} onChange={(e) => { setIncludeIterations(e.target.checked); clearAll(); }} /> Include per-iteration</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={saveCsv} onChange={(e) => { setSaveCsv(e.target.checked); clearAll(); }} /> Download CSV</label>
                </div>
              </div>
            </motion.div>

            <motion.div className="rounded-2xl bg-white/90 p-5 shadow-2xl border border-slate-100" variants={cardVariants} initial="hidden" animate="visible">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">Result</h4>

              <div className="mt-4">
                {loading && (
                  <div className="flex items-center gap-3 text-slate-700">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-indigo-600" />
                    </motion.div>
                    <div>Running iterations — hang tight! (this runs on the server)</div>
                  </div>
                )}

                {!loading && error && (
                  <div className="rounded-md bg-red-50 border border-red-100 p-3 text-red-700 flex items-start gap-3">
                    <AlertIcon />
                    <div>
                      <strong className="font-medium">Error</strong>
                      <div className="mt-1 text-sm">{String(error)}</div>
                    </div>
                  </div>
                )}

                {!loading && result && (
                  <div className="mt-3 space-y-3">
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-gradient-to-r from-white to-slate-50 rounded-xl border">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm text-slate-500">Approx (final)</div>
                          <div className="mt-1 font-mono text-lg md:text-2xl text-slate-900 break-words">{shortNumber(result.approx, 120)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-500">Time</div>
                          <div className="font-medium">{result.time_ns ? `${result.time_ns} ns` : "—"}</div>
                          <div className="text-xs text-slate-400">Precision: {result.prec_digits}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="p-2 rounded-md bg-white/80 border">Ref: <div className="font-mono text-xs mt-1">{shortNumber(result.reference, 120)}</div></div>
                        <div className="p-2 rounded-md bg-white/80 border">Builtin: <div className="font-mono text-xs mt-1">{shortNumber(result.builtin_sqrt, 120)}</div></div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button onClick={copyResult} className="px-3 py-1 rounded-full bg-indigo-600 text-white flex items-center gap-2">
                          <Copy className="w-4 h-4" /> Copy JSON
                        </button>
                        {csvUrl && (
                          <a href={csvUrl} download="iterations.csv" className="px-3 py-1 rounded-full bg-white border"> <DownloadCloud className="w-4 h-4" /> Download CSV</a>
                        )}
                      </div>
                    </motion.div>

                    {/* chart */}
                    {iterationsForChart.length > 0 && (
                      <div className="p-3 bg-white rounded-xl border">
                        <div className="text-sm text-slate-500">Convergence (log10 absolute error)</div>
                        <div className="h-40 mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={iterationsForChart}>
                              <XAxis dataKey="i" hide />
                              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v)=>v.toFixed(1)}/>
                              <Tooltip formatter={(value) => (value === null ? "—" : value.toFixed(6))} />
                              <Line type="monotone" dataKey="log10_abs_err" strokeWidth={2} dot={false} strokeOpacity={0.9} stroke="#6366F1" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* per-iteration list (collapsible) */}
                    {includeIterations && result.iterations && (
                      <div className="p-3 bg-white rounded-xl border">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-600">Iterations ({result.iterations.length})</div>
                        </div>

                        <div className="mt-3 space-y-2 max-h-60 overflow-auto pr-2">
                          <AnimatePresence>
                            {result.iterations.slice(0, 500).map((it) => (
                              <motion.div key={it.i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="p-2 rounded-lg bg-slate-50 border">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="text-xs text-slate-500">#{it.i}</div>
                                  <div className="flex-1 font-mono text-sm break-words">{shortNumber(it.value, 60)}</div>
                                  <div className="text-right text-xs text-slate-600">
                                    <div>abs: {shortNumber(it.abs_err, 20)}</div>
                                    <div>rel: {shortNumber(it.rel_err, 20)}</div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                        {result.iterations.length > 500 && <div className="text-xs text-slate-400 mt-2">Showing first 500 iterations for performance.</div>}
                      </div>
                    )}
                  </div>
                )}

                {!loading && !result && !error && (
                  <div className="text-sm text-slate-500">No result yet — enter a number and press <strong>Compute sqrt</strong>.</div>
                )}
              </div>
            </motion.div>

            <motion.div className="rounded-2xl p-5 bg-white/80 border shadow" variants={cardVariants} initial="hidden" animate="visible">
              <h4 className="font-semibold text-slate-800">About</h4>
              <p className="mt-2 text-sm text-slate-600">This UI calls your server's <code>/api/sqrt</code> endpoint and visualizes the high-precision iterations. It is designed to be playful yet informative — great for demos and teaching.</p>
            </motion.div>
          </aside>
        </main>

        <footer className="mt-10 text-center text-xs text-slate-500">Made with ❤️ — backend unchanged. Host frontend with create-react-app / Vite and point it to your Flask app.</footer>
      </div>
    </div>
  );
}

// tiny inline icon used above (keeps lucide import free for error glyph)
function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l5.504 9.79c.75 1.335-.213 2.985-1.742 2.985H4.495c-1.53 0-2.492-1.65-1.742-2.985l5.504-9.79zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-.993.883L9 6v4a1 1 0 001.993.117L11 10V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

