import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "crowd-signal-markets-v3";
const DELETE_CONFIRM_TEXT = "delete";

function getUserId() {
  if (typeof window === "undefined") return "user_server";
  let id = localStorage.getItem("prediction-user-id");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("prediction-user-id", id);
  }
  return id;
}

function loadMarkets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return null;
}

function saveMarkets(markets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markets));
  } catch {}
}

const DEFAULT_MARKETS = [
  {
    id: "m1",
    question: "Do you think Jack Sharpe is doing a good job in his presentation?",
    category: "Live",
    createdAt: Date.now(),
    expiresAt: null,
    resolved: null,
    votes: {},
  },
];

function getYesPercent(votes) {
  const entries = Object.values(votes || {});
  if (entries.length === 0) return 50;
  return Math.round((entries.filter((v) => v === "yes").length / entries.length) * 100);
}

function getTotalVotes(votes) {
  return Object.keys(votes || {}).length;
}

function formatTimeLeft(expiresAt) {
  if (!expiresAt) return null;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function isExpired(market) {
  return market.expiresAt && Date.now() >= market.expiresAt;
}

function isLocked(market) {
  return market.resolved !== null && market.resolved !== undefined || isExpired(market);
}

function AnimatedPercent({ value }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const step = value > display ? 1 : -1;
    const timer = setTimeout(() => setDisplay((d) => d + step), 15);
    return () => clearTimeout(timer);
  }, [value, display]);
  return <span>{display}</span>;
}

function MarketCard({ market, userId, onVote, onDelete, onResolve }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(market.expiresAt));

  const percent = getYesPercent(market.votes);
  const total = getTotalVotes(market.votes);
  const yesCount = Object.values(market.votes || {}).filter((v) => v === "yes").length;
  const noCount = total - yesCount;
  const userVote = market.votes?.[userId] || null;
  const locked = isLocked(market);
  const expired = isExpired(market);
  const resolved = market.resolved;

  const accentColor = resolved === "yes" ? "#22c55e" : resolved === "no" ? "#ef4444" : percent >= 60 ? "#22c55e" : percent >= 40 ? "#eab308" : "#ef4444";

  // Update countdown timer
  useEffect(() => {
    if (!market.expiresAt) return;
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(market.expiresAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [market.expiresAt]);

  const handleDelete = () => {
    if (password.trim().toLowerCase() === DELETE_CONFIRM_TEXT) {
      onDelete(market.id);
      setShowDeleteConfirm(false);
      setPassword("");
      setError("");
    } else {
      setError('Type "delete" to confirm');
      setTimeout(() => setError(""), 2000);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f0f23 0%, #161632 100%)",
        border: resolved ? `1px solid ${accentColor}30` : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: "28px 28px 24px",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        opacity: expired && !resolved ? 0.7 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}15`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Resolved banner */}
      {resolved && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: resolved === "yes" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          padding: "6px 16px",
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          color: resolved === "yes" ? "#22c55e" : "#ef4444",
          textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center",
        }}>
          Resolved {resolved.toUpperCase()}
        </div>
      )}

      {/* Top row: category + timer + delete */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: resolved ? 24 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {market.category}
          </div>
          {timeLeft && (
            <div style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              background: expired ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
              color: expired ? "rgba(239,68,68,0.7)" : "rgba(165,180,252,0.7)",
            }}>
              {timeLeft}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", fontSize: 16, cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.target.style.color = "rgba(239,68,68,0.6)")}
          onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.15)")}
          title="Delete prediction"
        >
          X
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
            Type &quot;delete&quot; to confirm
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDelete()}
              placeholder='Type "delete"'
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.3)", color: "#e8e8f0", fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace", outline: "none",
              }}
              autoFocus
            />
            <button
              onClick={handleDelete}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
              Delete
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); setPassword(""); setError(""); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {/* Question */}
      <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, lineHeight: 1.45, color: "#e8e8f0", fontFamily: "'DM Sans', sans-serif" }}>
        {market.question}
      </h3>

      {/* Big percent */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 48, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: accentColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
          <AnimatedPercent value={percent} />
        </span>
        <span style={{ fontSize: 18, color: accentColor, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>%</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", marginLeft: 8 }}>YES</span>
      </div>

      {/* Bar */}
      <div style={{ width: "100%", height: 6, borderRadius: 3, background: "#1a1a2e", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`, transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </div>

      {/* Vote split */}
      <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0 20px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)", padding: "0 2px" }}>
        <span style={{ color: "rgba(34,197,94,0.6)" }}>{yesCount} yes</span>
        <span>{total} prediction{total !== 1 ? "s" : ""}</span>
        <span style={{ color: "rgba(239,68,68,0.6)" }}>{noCount} no</span>
      </div>

      {/* Vote buttons */}
      {!locked ? (
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Yes", value: "yes", color: "#22c55e" },
            { label: "No", value: "no", color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <button
              key={value}
              onClick={() => onVote(market.id, value)}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                border: userVote === value ? `2px solid ${color}` : `1px solid ${color}40`,
                background: userVote === value ? `${color}20` : `${color}08`,
                color: userVote === value ? color : `${color}aa`,
                fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer", transition: "all 0.2s ease", letterSpacing: "0.02em",
              }}
              onMouseEnter={(e) => { if (userVote !== value) { e.target.style.background = `${color}15`; e.target.style.borderColor = `${color}80`; } }}
              onMouseLeave={(e) => { if (userVote !== value) { e.target.style.background = `${color}08`; e.target.style.borderColor = `${color}40`; } }}
            >
              {userVote === value ? "[x] " : ""}{label}
            </button>
          ))}
        </div>
      ) : !resolved ? (
        /* Expired but not resolved — show resolve buttons */
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10, textAlign: "center" }}>
            Voting closed — resolve this market:
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => onResolve(market.id, "yes")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
              Resolve YES
            </button>
            <button
              onClick={() => onResolve(market.id, "no")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
              Resolve NO
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
          This market has been resolved
        </div>
      )}

      {!locked && userVote && (
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
          tap again to undo
        </div>
      )}

      {/* Resolve buttons for non-expired, non-resolved markets */}
      {!resolved && !expired && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
          <button
            onClick={() => onResolve(market.id, "yes")}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)", background: "transparent", color: "rgba(34,197,94,0.4)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.target.style.background = "rgba(34,197,94,0.08)"; e.target.style.color = "rgba(34,197,94,0.7)"; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = "rgba(34,197,94,0.4)"; }}
          >
            Resolve Yes
          </button>
          <button
            onClick={() => onResolve(market.id, "no")}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.4)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.target.style.background = "rgba(239,68,68,0.08)"; e.target.style.color = "rgba(239,68,68,0.7)"; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = "rgba(239,68,68,0.4)"; }}
          >
            Resolve No
          </button>
        </div>
      )}
    </div>
  );
}

function CreateMarketModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [expiryDays, setExpiryDays] = useState("");

  const handleCreate = () => {
    if (!question.trim()) return;
    const days = parseInt(expiryDays);
    onCreate({
      id: "m_" + Date.now() + Math.random().toString(36).slice(2, 6),
      question: question.trim(),
      category: category.trim() || "General",
      createdAt: Date.now(),
      expiresAt: days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null,
      resolved: null,
      votes: {},
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 36, width: "100%", maxWidth: 480 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#e8e8f0", fontFamily: "'DM Sans', sans-serif" }}>New Prediction</h2>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>Create a yes/no question for the crowd</p>

        <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Question</label>
        <input
          type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will something happen by some date?"
          maxLength={200} autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#e8e8f0", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 20, transition: "border-color 0.2s" }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />

        <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Category</label>
        <input
          type="text" value={category} onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Tech, Sports, Politics..."
          maxLength={30}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#e8e8f0", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 20, transition: "border-color 0.2s" }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />

        <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Expires in (days) — optional</label>
        <input
          type="number" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}
          placeholder="e.g. 7 (leave empty for no expiry)"
          min={1} max={365}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#e8e8f0", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 28, transition: "border-color 0.2s" }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Cancel</button>
          <button
            onClick={handleCreate} disabled={!question.trim()}
            style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: question.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: question.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: question.trim() ? "pointer" : "default", transition: "all 0.2s" }}
          >
            Create Market
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PredictionMarket() {
  const [markets, setMarkets] = useState(() => loadMarkets() || DEFAULT_MARKETS);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("All");
  const userId = getUserId();

  // Save to localStorage whenever markets change
  useEffect(() => {
    saveMarkets(markets);
  }, [markets]);

  const handleVote = useCallback((marketId, vote) => {
    setMarkets(prev =>
      prev.map((m) => {
        if (m.id !== marketId) return m;
        if (isLocked(m)) return m;
        const newVotes = { ...m.votes };
        if (newVotes[userId] === vote) delete newVotes[userId];
        else newVotes[userId] = vote;
        return { ...m, votes: newVotes };
      })
    );
  }, [userId]);

  const handleCreate = useCallback((newMarket) => {
    setMarkets(prev => [newMarket, ...prev]);
  }, []);

  const handleDelete = useCallback((marketId) => {
    setMarkets(prev => prev.filter((m) => m.id !== marketId));
  }, []);

  const handleResolve = useCallback((marketId, outcome) => {
    setMarkets(prev =>
      prev.map((m) => m.id === marketId ? { ...m, resolved: outcome } : m)
    );
  }, []);

  const categories = ["All", ...new Set(markets.map((m) => m.category))];
  const filtered = filter === "All" ? markets : markets.filter((m) => m.category === filter);
  const totalVotes = markets.reduce((sum, m) => sum + getTotalVotes(m.votes), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#08081a", color: "#e8e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.5)", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.12em" }}>Live Predictions</span>
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>
              <span style={{ background: "linear-gradient(135deg, #e8e8f0 0%, rgba(255,255,255,0.6) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Andrew&apos;s Prediction Market</span>
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}
            onMouseEnter={(e) => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 28px rgba(99,102,241,0.4)"; }}
            onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3)"; }}
          >
            + New Prediction
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 24, marginBottom: 36, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)" }}>
          <span>{markets.length} market{markets.length !== 1 ? "s" : ""}</span>
          <span>{totalVotes} total prediction{totalVotes !== 1 ? "s" : ""}</span>
        </div>

        {/* Category filters */}
        {categories.length > 2 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat} onClick={() => setFilter(cat)}
                style={{ padding: "7px 16px", borderRadius: 20, border: filter === cat ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)", background: filter === cat ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)", color: filter === cat ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", transition: "all 0.2s" }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Markets */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
          {filtered.map((market) => (
            <MarketCard key={market.id} market={market} userId={userId} onVote={handleVote} onDelete={handleDelete} onResolve={handleResolve} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
            No markets yet. Create one!
          </div>
        )}
      </div>

      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
