"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LogItem {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  source: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface StatsData {
  health: {
    databaseConnected: boolean;
    geminiConfigured: boolean;
    authSecretConfigured: boolean;
  };
  aiMetrics: {
    totalRequests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  logMetrics: {
    total: number;
    info: number;
    warn: number;
    error: number;
  };
  appMetrics: {
    users: number;
    scripts: number;
    reviews: number;
    rateLimitBuckets: number;
  };
}

interface QuotaData {
  globalUnlimited: boolean;
  rateLimitBuckets: Array<{
    id: string;
    scope: string;
    subjectHash: string;
    count: number;
    updatedAt: string;
  }>;
  totalBuckets: number;
  users: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    hasUnlimitedQuota: boolean;
    createdAt: string;
  }>;
}

interface Setup2FAResponse {
  qrCodeUrl: string;
  secretBase32: string;
  recoveryCodes: string[];
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [is2FAEnrolled, setIs2FAEnrolled] = useState<boolean>(false);
  const [pending2FA, setPending2FA] = useState<boolean>(false);

  // Login form state
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [totpCodeInput, setTotpCodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "quota" | "logs" | "sandbox" | "security">("overview");

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Quota state
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [, setLoadingQuota] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logFilter, setLogFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [, setLoadingLogs] = useState(false);
  const [selectedLogMeta, setSelectedLogMeta] = useState<LogItem | null>(null);

  // Sandbox state
  const [sandboxText, setSandboxText] = useState("สวัสดีครับทุกคน วันนี้พามาดูวิธีแต่งภาพในคลิปสั้นแบบมือโปร รับรองว่ามมอดังแน่นอนครับ");
  const [sandboxNiche, setSandboxNiche] = useState<"review" | "lifestyle" | "education" | "tiktok_shop">("lifestyle");
  const [sandboxDuration, setSandboxDuration] = useState<15 | 30 | 60>(30);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<{ durationMs?: number; review?: Record<string, unknown> } | null>(null);
  const [sandboxError, setSandboxError] = useState("");

  // 2FA Security setup state
  const [setup2FAData, setSetup2FAData] = useState<Setup2FAResponse | null>(null);
  const [confirmTotpCode, setConfirmTotpCode] = useState("");
  const [disableTotpCode, setDisableTotpCode] = useState("");
  const [securityMsg, setSecurityMsg] = useState("");
  const [securityErr, setSecurityErr] = useState("");
  const [loading2FASetup, setLoading2FASetup] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();
        if (isMounted) {
          setAuthorized(Boolean(data.authorized));
          setIs2FAEnrolled(Boolean(data.is2FAEnrolled));
        }
      } catch {
        if (isMounted) setAuthorized(false);
      }
    }
    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStep1Login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKeyInput }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.pending2FA) {
          setPending2FA(true);
          setAuthError("");
        } else if (data.authorized) {
          setAuthorized(true);
          setAdminKeyInput("");
        }
      } else {
        setAuthError(data.message || "Invalid Admin Secret Key");
      }
    } catch {
      setAuthError("Failed to connect to authentication endpoint");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleStep2Verify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: totpCodeInput }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        setAuthorized(true);
        setPending2FA(false);
        setTotpCodeInput("");
        setAdminKeyInput("");
      } else {
        setAuthError(data.message || "Invalid 6-digit TOTP code or recovery code");
      }
    } catch {
      setAuthError("Failed to verify 2FA code");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthorized(false);
    setPending2FA(false);
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchQuota = async () => {
    setLoadingQuota(true);
    try {
      const res = await fetch("/api/admin/quota");
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQuota(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (logFilter !== "ALL") params.append("level", logFilter);
      if (logSearch) params.append("search", logSearch);
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    if (activeTab === "overview") {
      fetch("/api/admin/stats").then((res) => res.ok ? res.json() : null).then((data) => {
        if (active && data) setStats(data);
      }).catch(() => {});
    } else if (activeTab === "quota") {
      fetch("/api/admin/quota").then((res) => res.ok ? res.json() : null).then((data) => {
        if (active && data) setQuota(data);
      }).catch(() => {});
    } else if (activeTab === "logs") {
      const params = new URLSearchParams();
      if (logFilter !== "ALL") params.append("level", logFilter);
      if (logSearch) params.append("search", logSearch);
      fetch(`/api/admin/logs?${params.toString()}`).then((res) => res.ok ? res.json() : null).then((data) => {
        if (active && data) setLogs(data.logs || []);
      }).catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [authorized, activeTab, logFilter, logSearch]);

  const handleToggleGlobalQuota = async (enabled: boolean) => {
    setTogglingGlobal(true);
    try {
      const res = await fetch("/api/admin/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_global_unlimited", enabled }),
      });
      if (res.ok) {
        await fetchQuota();
      }
    } finally {
      setTogglingGlobal(false);
    }
  };



  const handleResetRateLimits = async () => {
    if (!confirm("Are you sure you want to reset ALL active IP and device rate limit buckets?")) return;
    try {
      const res = await fetch("/api/admin/quota", { method: "DELETE" });
      if (res.ok) {
        await fetchQuota();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all stored system logs?")) return;
    try {
      const res = await fetch("/api/admin/logs", { method: "DELETE" });
      if (res.ok) {
        await fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setSandboxError("");
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const res = await fetch("/api/admin/test-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptText: sandboxText,
          niche: sandboxNiche,
          targetDurationSeconds: sandboxDuration,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSandboxResult(data);
      } else {
        setSandboxError(data.message || "Failed to execute AI review test");
      }
    } catch {
      setSandboxError("Error connecting to test route");
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleStart2FASetup = async () => {
    setLoading2FASetup(true);
    setSecurityMsg("");
    setSecurityErr("");
    try {
      const res = await fetch("/api/admin/auth/2fa/setup");
      const data = await res.json();
      if (res.ok) {
        setSetup2FAData(data);
      } else {
        setSecurityErr(data.message || "Failed to initiate 2FA setup");
      }
    } catch {
      setSecurityErr("Error connecting to 2FA setup endpoint");
    } finally {
      setLoading2FASetup(false);
    }
  };

  const handleConfirm2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg("");
    setSecurityErr("");
    try {
      const res = await fetch("/api/admin/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: confirmTotpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIs2FAEnrolled(true);
        setSetup2FAData(null);
        setConfirmTotpCode("");
        setSecurityMsg("🎉 Google Authenticator 2FA enrolled and enabled successfully!");
      } else {
        setSecurityErr(data.message || "Invalid TOTP code");
      }
    } catch {
      setSecurityErr("Error confirming 2FA setup");
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to disable 2FA?")) return;
    setSecurityMsg("");
    setSecurityErr("");
    try {
      const res = await fetch("/api/admin/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: disableTotpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIs2FAEnrolled(false);
        setDisableTotpCode("");
        setSecurityMsg("2FA disabled successfully.");
      } else {
        setSecurityErr(data.message || "Failed to disable 2FA");
      }
    } catch {
      setSecurityErr("Error disabling 2FA");
    }
  };

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-200">
        <div className="text-sm font-bold animate-pulse text-emerald-400">
          Loading Hookdee Admin System...
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 font-sans text-stone-200">
        <div className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-900 p-8 shadow-2xl">
          <div className="text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-extrabold text-white shadow-lg">
              h
            </span>
            <h1 className="mt-4 text-2xl font-extrabold text-white">Hookdee Admin Portal</h1>
            <p className="mt-1 text-xs text-stone-400">
              {pending2FA
                ? "Step 2: Enter Google Authenticator 6-digit TOTP code"
                : "Step 1: Enter your Admin Secret Key to proceed"}
            </p>
          </div>

          {!pending2FA ? (
            /* STEP 1: ADMIN SECRET KEY FORM */
            <form onSubmit={handleStep1Login} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
                  Admin Secret Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter ADMIN_SECRET or AUTH_SECRET"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  className="w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-100 placeholder-stone-600 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {authError && (
                <p className="rounded-xl bg-red-950/80 border border-red-800 px-4 py-2.5 text-xs font-semibold text-red-300">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loggingIn || !adminKeyInput.trim()}
                className="w-full rounded-full bg-emerald-700 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {loggingIn ? "Authenticating Step 1..." : "Continue to Admin Portal ➔"}
              </button>
            </form>
          ) : (
            /* STEP 2: TOTP / RECOVERY CODE FORM */
            <form onSubmit={handleStep2Verify2FA} className="mt-6 space-y-4">
              <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-3 text-xs text-emerald-300 text-center">
                ✓ Step 1 Secret Verified. Please complete 2FA authentication.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="000000 or Recovery Code"
                  value={totpCodeInput}
                  onChange={(e) => setTotpCodeInput(e.target.value)}
                  className="w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-center text-lg font-mono tracking-widest text-emerald-400 placeholder-stone-600 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {authError && (
                <p className="rounded-xl bg-red-950/80 border border-red-800 px-4 py-2.5 text-xs font-semibold text-red-300">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loggingIn || !totpCodeInput.trim()}
                className="w-full rounded-full bg-emerald-700 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {loggingIn ? "Verifying 2FA Code..." : "Verify 2FA & Access Dashboard 🔐"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPending2FA(false);
                  setAuthError("");
                }}
                className="w-full text-center text-xs text-stone-400 hover:text-stone-200 mt-2"
              >
                ← Back to Step 1 (Re-enter Secret)
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs font-semibold text-stone-500 hover:text-stone-300">
              ← Return to Hookdee Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // AUTHORIZED ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-stone-950 font-sans text-stone-200">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-700 font-extrabold text-white text-sm">
              h
            </span>
            <h1 className="text-lg font-extrabold text-white tracking-tight">
              Hookdee Control Panel
            </h1>
            <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              ADMIN ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-semibold text-stone-400 hover:text-white transition">
              Main Site ↗
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-stone-800 bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/40 hover:border-red-800 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="mx-auto max-w-7xl px-6 flex gap-2 border-t border-stone-800/60 pt-2 pb-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "overview"
                ? "bg-emerald-800 text-white shadow"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
            }`}
          >
            📊 System Overview
          </button>
          <button
            onClick={() => setActiveTab("quota")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "quota"
                ? "bg-emerald-800 text-white shadow"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
            }`}
          >
            ⚡ Quota & Master Switch
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "logs"
                ? "bg-emerald-800 text-white shadow"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
            }`}
          >
            📋 Console Logs
          </button>
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "sandbox"
                ? "bg-emerald-800 text-white shadow"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
            }`}
          >
            🧪 AI Script Sandbox
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "security"
                ? "bg-emerald-800 text-white shadow"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
            }`}
          >
            🔐 Security & 2FA
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-100">System Diagnostics & Health</h2>
                <p className="text-xs text-stone-400 mt-1">Real-time infrastructure and database connection status.</p>
              </div>
              <button
                onClick={fetchStats}
                className="rounded-xl border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800"
              >
                {loadingStats ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <span className="text-xs font-bold text-stone-400 uppercase">Database Status</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`size-3 rounded-full ${stats.health.databaseConnected ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-extrabold text-lg text-white">
                      {stats.health.databaseConnected ? "Connected (Supabase Postgres)" : "Disconnected"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <span className="text-xs font-bold text-stone-400 uppercase">Gemini AI Provider</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`size-3 rounded-full ${stats.health.geminiConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-extrabold text-lg text-white">
                      {stats.health.geminiConfigured ? "Configured & Active" : "Key Missing"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <span className="text-xs font-bold text-stone-400 uppercase">Auth Secret Setup</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`size-3 rounded-full ${stats.health.authSecretConfigured ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-extrabold text-lg text-white">
                      {stats.health.authSecretConfigured ? "Secure" : "Fallback Key Used"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <p className="text-xs font-semibold text-stone-400">Total AI Requests</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">{stats.aiMetrics.totalRequests.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <p className="text-xs font-semibold text-stone-400">Total AI Tokens Used</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{stats.aiMetrics.totalTokens.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <p className="text-xs font-semibold text-stone-400">Estimated Cost (USD)</p>
                  <p className="text-2xl font-extrabold text-white mt-1">${stats.aiMetrics.estimatedCostUsd.toFixed(6)}</p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                  <p className="text-xs font-semibold text-stone-400">Active Rate Limit Buckets</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{stats.appMetrics.rateLimitBuckets.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUOTA & MASTER SWITCH */}
        {activeTab === "quota" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-amber-200">Global Unlimited Quota Master Switch</h3>
                <p className="text-xs text-amber-400/80 mt-1">
                  When enabled, all anonymous demo visitors and logged-in users bypass demo rate limits and receive unlimited script reviews.
                </p>
              </div>
              <button
                disabled={togglingGlobal}
                onClick={() => handleToggleGlobalQuota(!quota?.globalUnlimited)}
                className={`rounded-2xl px-6 py-3 text-xs font-extrabold uppercase tracking-wide transition shrink-0 ${
                  quota?.globalUnlimited
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                }`}
              >
                {togglingGlobal
                  ? "Updating..."
                  : quota?.globalUnlimited
                  ? "⚡ UNLIMITED QUOTA ACTIVE (CLICK TO DISABLE)"
                  : "🔒 ENFORCE RATE LIMITS (CLICK TO ENABLE UNLIMITED)"}
              </button>
            </div>

            <div className="flex justify-between items-center pt-4">
              <h3 className="text-sm font-bold text-stone-200">Active Rate Limit IP & Device Buckets</h3>
              <button
                onClick={handleResetRateLimits}
                className="rounded-xl border border-red-900 bg-red-950/60 px-3.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900"
              >
                Reset All Buckets
              </button>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-stone-900 overflow-hidden">
              <div className="p-4 bg-stone-900/80 border-b border-stone-800 font-bold text-xs text-stone-400 grid grid-cols-4">
                <span>Scope</span>
                <span>Subject Hash</span>
                <span>Count</span>
                <span>Last Updated</span>
              </div>
              {quota?.rateLimitBuckets.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">No active rate limit buckets found.</div>
              ) : (
                quota?.rateLimitBuckets.map((bucket) => (
                  <div key={bucket.id} className="p-4 border-b border-stone-800/50 font-mono text-xs grid grid-cols-4 text-stone-300">
                    <span className="text-emerald-400 font-bold">{bucket.scope}</span>
                    <span className="truncate">{bucket.subjectHash}</span>
                    <span>{bucket.count} attempts</span>
                    <span className="text-stone-500">{new Date(bucket.updatedAt).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONSOLE LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stone-100">System & Error Logs</h2>
                <p className="text-xs text-stone-400 mt-1">Real-time system events, API errors, and audit logs.</p>
              </div>
              <button
                onClick={handleClearLogs}
                className="rounded-xl border border-red-900 bg-red-950/60 px-3.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900"
              >
                Clear All Logs
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-900 p-3">
              <div className="flex gap-2">
                {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      logFilter === lvl ? "bg-emerald-800 text-white" : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="rounded-lg border border-stone-800 bg-stone-950 px-3 py-1.5 text-xs text-stone-200 outline-none"
                />
                <button
                  onClick={fetchLogs}
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-bold text-stone-200 hover:bg-stone-700"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900 overflow-hidden divide-y divide-stone-800/60 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs">No logs match the current filter.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          log.level === "ERROR"
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : log.level === "WARN"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-blue-950 text-blue-300 border border-blue-800"
                        }`}
                      >
                        {log.level}
                      </span>
                      <div>
                        <p className="text-stone-200 break-all">{log.message}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5 font-sans">
                          Source: <span className="text-stone-400">{log.source || "system"}</span> | Time: {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {log.meta && Object.keys(log.meta).length > 0 && (
                      <button
                        onClick={() => setSelectedLogMeta(log)}
                        className="rounded bg-stone-950 border border-stone-800 px-2.5 py-1 text-[11px] text-stone-400 hover:text-stone-200 shrink-0 font-sans"
                      >
                        🔍 Inspect JSON
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Meta Modal */}
            {selectedLogMeta && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <h3 className="font-bold text-stone-200 text-sm">Inspect Log Details [{selectedLogMeta.level}]</h3>
                    <button onClick={() => setSelectedLogMeta(null)} className="text-stone-400 hover:text-stone-100 text-sm font-bold">
                      ✕ Close
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="text-stone-300 font-semibold">{selectedLogMeta.message}</p>
                    <pre className="overflow-x-auto text-[11px] text-emerald-400 font-mono bg-stone-900 p-4 rounded-xl border border-stone-800 mt-2">
                      {JSON.stringify(selectedLogMeta.meta, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SANDBOX TESTER */}
        {activeTab === "sandbox" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-100">AI Script Review Sandbox</h2>
              <p className="text-xs text-stone-400 mt-1">Directly test Script Coach AI review generation without consuming rate limits.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form onSubmit={handleRunSandbox} className="rounded-2xl border border-stone-800 bg-stone-900 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Script Text (ข้อความสคริปต์):</label>
                  <textarea
                    rows={6}
                    required
                    value={sandboxText}
                    onChange={(e) => setSandboxText(e.target.value)}
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 p-3 text-xs text-stone-100 font-sans outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Niche:</label>
                    <select
                      value={sandboxNiche}
                      onChange={(e) => setSandboxNiche(e.target.value as typeof sandboxNiche)}
                      className="w-full rounded-xl border border-stone-800 bg-stone-950 p-2.5 text-xs text-stone-100"
                    >
                      <option value="review">Review (รีวิว)</option>
                      <option value="lifestyle">Lifestyle (ไลฟ์สไตล์)</option>
                      <option value="education">Education (ให้ความรู้)</option>
                      <option value="tiktok_shop">TikTok Shop (ขายของ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Target Duration:</label>
                    <select
                      value={sandboxDuration}
                      onChange={(e) => setSandboxDuration(Number(e.target.value) as 15 | 30 | 60)}
                      className="w-full rounded-xl border border-stone-800 bg-stone-950 p-2.5 text-xs text-stone-100"
                    >
                      <option value={15}>15 Seconds</option>
                      <option value={30}>30 Seconds</option>
                      <option value={60}>60 Seconds</option>
                    </select>
                  </div>
                </div>

                {sandboxError && (
                  <div className="rounded-xl border border-red-900 bg-red-950/60 p-3 text-xs text-red-300">
                    {sandboxError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sandboxLoading}
                  className="w-full rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {sandboxLoading ? "Processing AI Review..." : "🚀 Run Sandbox Test (Unlimited Quota)"}
                </button>
              </form>

              <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
                <h3 className="text-sm font-bold text-stone-200 mb-3">AI Response Result</h3>
                {!sandboxResult && !sandboxLoading && (
                  <p className="text-xs text-stone-500 py-12 text-center">Run a test script review to inspect output scores and latency.</p>
                )}

                {sandboxLoading && (
                  <div className="py-12 text-center text-xs text-emerald-400 animate-pulse">
                    Calling Gemini API & validating Thai script review output...
                  </div>
                )}

                {sandboxResult && (
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl bg-stone-950 border border-stone-800 p-3 flex justify-between items-center text-stone-300">
                      <span>Latency: <strong className="text-emerald-400">{sandboxResult.durationMs ?? 0} ms</strong></span>
                      <span className="text-emerald-400 font-bold">SUCCESS 200 OK</span>
                    </div>

                    <pre className="overflow-x-auto text-[11px] text-emerald-300 font-mono bg-stone-950 p-4 rounded-xl border border-stone-800 max-h-96">
                      {JSON.stringify(sandboxResult.review, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY & 2FA */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-100">Google Authenticator Two-Factor Authentication (2FA)</h2>
              <p className="text-xs text-stone-400 mt-1">
                Protect Admin Portal logins with mandatory 6-digit TOTP verification.
              </p>
            </div>

            {securityMsg && (
              <div className="rounded-2xl border border-emerald-800 bg-emerald-950/60 p-4 text-xs text-emerald-200">
                {securityMsg}
              </div>
            )}

            {securityErr && (
              <div className="rounded-2xl border border-red-800 bg-red-950/60 p-4 text-xs text-red-200">
                {securityErr}
              </div>
            )}

            {/* Current Status Card */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase">2FA Protection Status</span>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`size-3.5 rounded-full ${is2FAEnrolled ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="font-extrabold text-lg text-white">
                    {is2FAEnrolled ? "Google Authenticator 2FA Enrolled & Active" : "Not Enrolled (Password Only)"}
                  </span>
                </div>
              </div>

              {!is2FAEnrolled && !setup2FAData && (
                <button
                  onClick={handleStart2FASetup}
                  disabled={loading2FASetup}
                  className="rounded-2xl bg-emerald-700 px-6 py-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {loading2FASetup ? "Generating Setup..." : "🔐 Enroll Google Authenticator 2FA"}
                </button>
              )}
            </div>

            {/* 2FA SETUP MODAL / CARD */}
            {setup2FAData && !is2FAEnrolled && (
              <div className="rounded-2xl border border-emerald-800 bg-stone-900 p-6 space-y-6">
                <div className="border-b border-stone-800 pb-4">
                  <h3 className="text-base font-extrabold text-emerald-400">Step 1: Scan QR Code with Google Authenticator</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Open Google Authenticator (or any TOTP app) on your phone, scan this QR code or enter the secret key manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="flex flex-col items-center p-4 bg-white rounded-2xl border border-stone-200 w-fit mx-auto md:mx-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={setup2FAData.qrCodeUrl} alt="2FA QR Code" className="size-48" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 mb-1">Manual Secret Key:</label>
                      <code className="block p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-emerald-400 text-xs font-bold select-all">
                        {setup2FAData.secretBase32}
                      </code>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-400 mb-1">Single-Use Recovery Codes (Save These!):</label>
                      <div className="grid grid-cols-2 gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800 font-mono text-[11px] text-stone-300">
                        {setup2FAData.recoveryCodes.map((code, idx) => (
                          <div key={idx} className="select-all">{code}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleConfirm2FASetup} className="border-t border-stone-800 pt-6 space-y-4">
                  <h4 className="text-sm font-bold text-stone-200">Step 2: Enter 6-digit TOTP code to confirm activation</h4>
                  <div className="flex gap-4 max-w-md">
                    <input
                      type="text"
                      required
                      placeholder="000000"
                      maxLength={6}
                      value={confirmTotpCode}
                      onChange={(e) => setConfirmTotpCode(e.target.value)}
                      className="flex-1 rounded-xl border border-stone-800 bg-stone-950 px-4 py-2.5 text-center font-mono text-sm tracking-widest text-emerald-400 outline-none focus:border-emerald-600"
                    />
                    <button
                      type="submit"
                      disabled={!confirmTotpCode.trim()}
                      className="rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Confirm & Enable 2FA
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* DISABLE 2FA FORM */}
            {is2FAEnrolled && (
              <form onSubmit={handleDisable2FA} className="rounded-2xl border border-stone-800 bg-stone-900 p-6 space-y-4">
                <h3 className="text-sm font-bold text-stone-200">Disable 2FA Protection</h3>
                <p className="text-xs text-stone-400">
                  Enter your current Google Authenticator 6-digit code to turn off two-factor authentication.
                </p>
                <div className="flex gap-4 max-w-md">
                  <input
                    type="text"
                    required
                    placeholder="Current TOTP Code"
                    maxLength={6}
                    value={disableTotpCode}
                    onChange={(e) => setDisableTotpCode(e.target.value)}
                    className="flex-1 rounded-xl border border-stone-800 bg-stone-950 px-4 py-2.5 text-center font-mono text-sm tracking-widest text-stone-200 outline-none focus:border-red-600"
                  />
                  <button
                    type="submit"
                    disabled={!disableTotpCode.trim()}
                    className="rounded-xl border border-red-900 bg-red-950/80 px-6 py-2.5 text-xs font-bold text-red-300 hover:bg-red-900 disabled:opacity-50"
                  >
                    Disable 2FA
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
