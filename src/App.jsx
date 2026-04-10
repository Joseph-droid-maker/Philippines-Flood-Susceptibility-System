import { useState, useEffect, useRef } from "react";
import floodData from "./floodData.json";

// Build lookup map: normalized name -> data entry
const DATA_MAP = {};
floodData.forEach(entry => {
  const key = entry.municipality.toLowerCase().trim();
  DATA_MAP[key] = entry;
  // Also index cleaned names (strip "City of", "(Capital)", etc.)
  const cleaned = key
    .replace(/^city of\s+/i, "")
    .replace(/\s+city\s*\(capital\)$/i, "")
    .replace(/\s+city$/i, "")
    .replace(/\s+\(capital\)$/i, "")
    .trim();
  if (cleaned !== key) DATA_MAP[cleaned] = entry;
});

function getSuggestions(input) {
  if (!input || input.length < 2) return [];
  const lower = input.toLowerCase().trim();
  const seen = new Set();
  const results = [];
  for (const entry of floodData) {
    const name = entry.municipality.toLowerCase();
    if (name.includes(lower)) {
      const id = entry.municipality + "|" + entry.province;
      if (!seen.has(id)) {
        seen.add(id);
        results.push(entry);
        if (results.length >= 7) break;
      }
    }
  }
  return results;
}

function findEntry(input) {
  const lower = input.toLowerCase().trim();
  if (DATA_MAP[lower]) return DATA_MAP[lower];
  for (const entry of floodData) {
    if (entry.municipality.toLowerCase().includes(lower)) return entry;
  }
  return null;
}

const LABEL_CONFIG = {
  "CRITICAL":   { color: "#FF1744", bar: "#FF1744", emoji: "🔴", desc: "Extremely high flood risk. Immediate mitigation required." },
  "VERY HIGH":  { color: "#FF6D00", bar: "#FF6D00", emoji: "🟠", desc: "Very high flood risk. Strong protective measures needed." },
  "HIGH":       { color: "#FFD600", bar: "#FFD600", emoji: "🟡", desc: "High flood risk. Preparedness plans should be in place." },
  "MODERATE":   { color: "#00BCD4", bar: "#00BCD4", emoji: "🔵", desc: "Moderate flood risk. Regular monitoring recommended." },
  "LOW":        { color: "#00E676", bar: "#00E676", emoji: "🟢", desc: "Low flood risk. Standard precautions apply." },
};

const NOAH_COLOR = { "HIGH": "#FF1744", "MEDIUM": "#FF6D00", "LOW": "#00E676", "NONE": "#445566" };

function AnimatedBar({ value, color, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 100 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ background: "#ffffff10", borderRadius: 99, height: 8, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99, background: color,
        width: `${width}%`, transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 12px ${color}80`
      }} />
    </div>
  );
}

function ScoreRing({ score, color }) {
  const [displayed, setDisplayed] = useState(0);
  const r = 54, circ = 2 * Math.PI * r;
  useEffect(() => {
    setDisplayed(0);
    let frame, cur = 0;
    const step = () => {
      cur = Math.min(cur + 2, score);
      setDisplayed(cur);
      if (cur < score) frame = requestAnimationFrame(step);
    };
    const t = setTimeout(() => { frame = requestAnimationFrame(step); }, 300);
    return () => { clearTimeout(t); cancelAnimationFrame(frame); };
  }, [score]);
  const offset = circ - (displayed / 100) * circ;
  return (
    <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="#ffffff10" strokeWidth="10" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.05s linear", filter: `drop-shadow(0 0 8px ${color})` }} />
      <text x="65" y="72" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold"
        fontFamily="'DM Mono', monospace" style={{ transform: "rotate(90deg) translate(0px, -130px)" }}>
        {displayed}
      </text>
    </svg>
  );
}

function ProbBar({ label, value, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 400);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#8899AA", letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ background: "#ffffff08", borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99, background: color,
          width: `${width}%`, transition: "width 1s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 8px ${color}60`
        }} />
      </div>
    </div>
  );
}

export default function FloodApp() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const handleInput = (val) => {
    setInput(val);
    setNotFound(false);
    setResult(null);
    setSuggestions(getSuggestions(val));
  };

  const handleSearch = (entry) => {
    setSuggestions([]);
    setLoading(true);
    setResult(null);
    setNotFound(false);
    setTimeout(() => {
      const found = entry || findEntry(input);
      setLoading(false);
      if (found) { setInput(found.municipality); setResult(found); }
      else setNotFound(true);
    }, 800);
  };

  const cfg = result ? LABEL_CONFIG[result.label] : null;

  const factors = result ? [
    { label: "Elevation Risk",        value: Math.max(0, Math.min(100, Math.round(100 - (result.factors.elevation / 600) * 100))), unit: `${result.factors.elevation.toFixed(0)}m ASL` },
    { label: "Rainfall Intensity",    value: Math.min(100, Math.round((result.factors.rainfall / 300) * 100)),                     unit: `${result.factors.rainfall.toFixed(0)} mm/mo` },
    { label: "Population Density",    value: Math.min(100, Math.round((result.factors.population_density / 30000) * 100)),         unit: `${result.factors.population_density > 999 ? (result.factors.population_density/1000).toFixed(1)+"k" : result.factors.population_density.toFixed(0)}/km²` },
    { label: "Historical Floods",     value: Math.min(100, Math.round((result.factors.flood_history / 60) * 100)),                 unit: `${result.factors.flood_history} events` },
    { label: "NOAH Flood Hazard",     value: result.factors.noah_hazard === "HIGH" ? 95 : result.factors.noah_hazard === "MEDIUM" ? 60 : result.factors.noah_hazard === "LOW" ? 25 : 5, unit: result.factors.noah_hazard },
  ] : [];

  const probs = result ? [
    { label: "CRITICAL",  value: result.probabilities["CRITICAL"],  color: LABEL_CONFIG["CRITICAL"].color },
    { label: "VERY HIGH", value: result.probabilities["VERY HIGH"], color: LABEL_CONFIG["VERY HIGH"].color },
    { label: "HIGH",      value: result.probabilities["HIGH"],      color: LABEL_CONFIG["HIGH"].color },
    { label: "MODERATE",  value: result.probabilities["MODERATE"],  color: LABEL_CONFIG["MODERATE"].color },
    { label: "LOW",       value: result.probabilities["LOW"],       color: LABEL_CONFIG["LOW"].color },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", background: "#060B14", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "white", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, opacity: 0.04, backgroundImage: "linear-gradient(#4FC3F7 1px, transparent 1px), linear-gradient(90deg, #4FC3F7 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: -200, left: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #0D47A120 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #004D4020 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "all 0.8s ease" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#4FC3F715", border: "1px solid #4FC3F730", borderRadius: 99, padding: "6px 16px", marginBottom: 20, fontSize: 12, color: "#4FC3F7", letterSpacing: 2, textTransform: "uppercase" }}>
            <span>🇵🇭</span> Philippines Flood Risk Analyzer
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.1, letterSpacing: -1 }}>
            Flood Susceptibility<br />
            <span style={{ background: "linear-gradient(90deg, #4FC3F7, #00E5FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Mapping System
            </span>
          </h1>
          <p style={{ color: "#8899AA", fontSize: 15, margin: 0, maxWidth: 460, marginInline: "auto", lineHeight: 1.6 }}>
            Powered by Random Forest ML · 1,606 Philippine municipalities · NOAH + SRTM + PSA datasets
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 8, maxWidth: 860, marginInline: "auto" }}>
          <div style={{ display: "flex", gap: 10, background: "#0D1B2A", border: "1.5px solid #1E3A5F", borderRadius: 16, padding: "6px 6px 6px 20px", boxShadow: "0 0 40px #4FC3F710", alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Marikina, Tacloban, Dagupan, Cagayan de Oro..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "white", fontSize: 16, fontFamily: "inherit" }}
            />
            <button onClick={() => handleSearch()}
              style={{ background: "linear-gradient(135deg, #1565C0, #0288D1)", border: "none", borderRadius: 12, padding: "12px 24px", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.5, boxShadow: "0 4px 20px #0288D140" }}>
              Analyze Risk →
            </button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#0D1B2A", border: "1.5px solid #1E3A5F", borderRadius: 12, overflow: "hidden", zIndex: 100, boxShadow: "0 20px 40px #00000060" }}>
              {suggestions.map((s, i) => {
                const lc = LABEL_CONFIG[s.label] || LABEL_CONFIG["LOW"];
                return (
                  <div key={i} onClick={() => { setInput(s.municipality); handleSearch(s); }}
                    style={{ padding: "11px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1E3A5F20", fontSize: 14, color: "#AAC4DD" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1E3A5F40"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>
                    <span>{lc.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{s.municipality}</span>
                    <span style={{ color: "#445566", fontSize: 12 }}>{s.province}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: lc.color, fontWeight: 700, letterSpacing: 1 }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ color: "#2A3A4A", fontSize: 12, textAlign: "center", marginBottom: 36, letterSpacing: 0.5 }}>
          1,606 municipalities covered · NOAH LiDAR · SRTM Elevation · PSA 2020 Census · EM-DAT Flood History
        </p>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ display: "inline-block", width: 48, height: 48, border: "3px solid #1E3A5F", borderTopColor: "#4FC3F7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#4FC3F7", marginTop: 16, fontSize: 14, letterSpacing: 2 }}>RUNNING RANDOM FOREST MODEL...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Not Found */}
        {notFound && (
          <div style={{ background: "#0D1B2A", border: "1px solid #FF174430", borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 600, marginInline: "auto" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ color: "#FF6B6B", fontWeight: 600, marginBottom: 8 }}>Location not found in database</p>
            <p style={{ color: "#556677", fontSize: 14 }}>Try: Marikina, Tacloban, Dagupan, Navotas, Cagayan de Oro, Iligan, Ormoc...</p>
          </div>
        )}

        {/* Result */}
        {result && cfg && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }`}</style>

            {/* Main card */}
            <div style={{ background: "linear-gradient(135deg, #0D1B2A, #0A1520)", border: `1.5px solid ${cfg.color}40`, borderRadius: 20, padding: 32, marginBottom: 16, boxShadow: `0 0 60px ${cfg.color}15` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 11, color: "#445566", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                    {result.region} · {result.province}
                  </div>
                  <h2 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>{result.municipality}</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${cfg.color}20`, border: `1px solid ${cfg.color}50`, borderRadius: 99, padding: "6px 16px" }}>
                      <span>{cfg.emoji}</span>
                      <span style={{ color: cfg.color, fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>{result.label} RISK</span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ffffff08", border: "1px solid #ffffff15", borderRadius: 99, padding: "6px 14px", fontSize: 12, color: "#8899AA" }}>
                      <span style={{ color: "#4FC3F7", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{result.confidence}%</span>
                      <span>model confidence</span>
                    </div>
                  </div>
                  <p style={{ color: "#8899AA", fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 380 }}>{cfg.desc}</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <ScoreRing score={result.score} color={cfg.color} />
                  <div style={{ fontSize: 11, color: "#445566", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Susceptibility Score</div>
                </div>
              </div>
            </div>

            {/* Two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 16 }}>
              {/* Feature bars */}
              <div style={{ background: "#0D1B2A", border: "1.5px solid #1E3A5F", borderRadius: 20, padding: 28 }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 13, color: "#4FC3F7", letterSpacing: 2, textTransform: "uppercase" }}>📊 Random Forest Feature Analysis</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {factors.map((f, i) => (
                    <div key={f.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: "#AAC4DD", fontWeight: 500 }}>{f.label}</span>
                        <span style={{ fontSize: 12, color: "#556677", fontFamily: "'DM Mono', monospace" }}>{f.unit}</span>
                      </div>
                      <AnimatedBar value={f.value} color={cfg.bar} delay={i * 80} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ background: "#0D1B2A", border: "1.5px solid #1E3A5F", borderRadius: 20, padding: 28 }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 13, color: "#4FC3F7", letterSpacing: 2, textTransform: "uppercase" }}>📍 Location Data</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { icon: "⛰️", label: "Elevation",     value: `${result.factors.elevation.toFixed(0)}m` },
                    { icon: "🌧️", label: "Rainfall",      value: `${result.factors.rainfall.toFixed(0)}mm` },
                    { icon: "👥", label: "Pop/km²",       value: result.factors.population_density > 9999 ? `${(result.factors.population_density/1000).toFixed(1)}k` : result.factors.population_density.toFixed(0) },
                    { icon: "🌊", label: "Flood Events",  value: `${result.factors.flood_history}` },
                    { icon: "🗺️", label: "NOAH Hazard",   value: result.factors.noah_hazard, color: NOAH_COLOR[result.factors.noah_hazard] || "#445566" },
                    { icon: "🎯", label: "RF Confidence", value: `${result.confidence}%` },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#0A1520", border: "1px solid #1E3A5F", borderRadius: 14, padding: "16px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 11, color: "#556677", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: s.color || "#C8D8E8", fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RF Probabilities */}
            <div style={{ background: "#0D1B2A", border: "1.5px solid #1E3A5F", borderRadius: 20, padding: 28, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 13, color: "#4FC3F7", letterSpacing: 2, textTransform: "uppercase" }}>🌲 Random Forest Class Probabilities</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0 40px" }}>
                {probs.map(p => <ProbBar key={p.label} label={p.label} value={p.value} color={p.color} />)}
              </div>
            </div>

            {/* Recommendations */}
            <div style={{ background: "#0D1B2A", border: `1px solid ${cfg.color}30`, borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 13, color: cfg.color, letterSpacing: 2, textTransform: "uppercase" }}>⚡ Recommendations</h3>
              {result.score >= 80 && <>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Establish permanent early warning systems and evacuation routes</p>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Avoid construction in low-lying areas near waterways</p>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Conduct mandatory flood drills at least twice a year</p>
                <p style={{ margin: 0,          fontSize: 13, color: "#AAC4DD" }}>• Invest in river dredging and drainage infrastructure upgrades</p>
              </>}
              {result.score >= 50 && result.score < 80 && <>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Maintain and upgrade stormwater drainage systems regularly</p>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Monitor PAGASA weather bulletins during rainy season (June–November)</p>
                <p style={{ margin: 0,          fontSize: 13, color: "#AAC4DD" }}>• Prepare household emergency kits and community evacuation plans</p>
              </>}
              {result.score < 50 && <>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Maintain standard flood preparedness protocols</p>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#AAC4DD" }}>• Preserve natural drainage and green cover to manage surface runoff</p>
                <p style={{ margin: 0,          fontSize: 13, color: "#AAC4DD" }}>• Stay informed about PAGASA weather advisories during typhoon season</p>
              </>}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", color: "#1E2E3E", fontSize: 11, marginTop: 48, letterSpacing: 1 }}>
          ML MODEL: RANDOM FOREST (95% ACCURACY) · FEATURES: ELEVATION · RAINFALL · POP DENSITY · FLOOD HISTORY · NOAH HAZARD · DATA: NOAH / SRTM / PSA 2020 / EM-DAT
        </p>
      </div>
    </div>
  );
}