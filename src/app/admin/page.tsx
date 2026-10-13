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

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "quota" | "logs" | "sandbox">("overview");

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Quota state
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logFilter, setLogFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogMeta, setSelectedLogMeta] = useState<LogItem | null>(null);

  // Sandbox state
  const [sandboxText, setSandboxText] = useState("สวัสดีครับทุกคน วันนี้พามาดูวิธีแต่งภาพในคลิปสั้นแบบมือโปร รับรองว่ามมอดังแน่นอนครับ");
  const [sandboxNiche, setSandboxNiche] = useState<"review" | "lifestyle" | "education" | "tiktok_shop">("lifestyle");
  const [sandboxDuration, setSandboxDuration] = useState<15 | 30 | 60>(30);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<{ durationMs?: number; review?: Record<string, unknown> } | null>(null);
  const [sandboxError, setSandboxError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();
        if (isMounted) setAuthorized(Boolean(data.authorized));
      } catch {
        if (isMounted) setAuthorized(false);
      }
    }
    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
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
      if (res.ok && data.authorized) {
        setAuthorized(true);
      } else {
        setAuthError(data.message || "Invalid Admin Secret Key");
      }
    } catch {
      setAuthError("Failed to connect to authentication endpoint");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthorized(false);
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
      if (logFilter !== "ALL") params.set("level", logFilter);
      if (logSearch) params.set("search", logSearch);
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
    let isMounted = true;

    async function loadTabData() {
      if (activeTab === "overview") {
        setLoadingStats(true);
        try {
          const res = await fetch("/api/admin/stats");
          if (res.ok && isMounted) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isMounted) setLoadingStats(false);
        }
      } else if (activeTab === "quota") {
        setLoadingQuota(true);
        try {
          const res = await fetch("/api/admin/quota");
          if (res.ok && isMounted) {
            const data = await res.json();
            setQuota(data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isMounted) setLoadingQuota(false);
        }
      } else if (activeTab === "logs") {
        setLoadingLogs(true);
        try {
          const params = new URLSearchParams();
          if (logFilter !== "ALL") params.set("level", logFilter);
          if (logSearch) params.set("search", logSearch);
          const res = await fetch(`/api/admin/logs?${params.toString()}`);
          if (res.ok && isMounted) {
            const data = await res.json();
            setLogs(data.logs || []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isMounted) setLoadingLogs(false);
        }
      }
    }

    void loadTabData();
    return () => {
      isMounted = false;
    };
  }, [authorized, activeTab, logFilter, logSearch]);

  const toggleGlobalUnlimited = async (current: boolean) => {
    setTogglingGlobal(true);
    try {
      const res = await fetch("/api/admin/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_global_unlimited", enabled: !current }),
      });
      if (res.ok) {
        void fetchQuota();
      }
    } finally {
      setTogglingGlobal(false);
    }
  };

  const toggleUserUnlimited = async (userId: string, current: boolean) => {
    try {
      const res = await fetch("/api/admin/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_user_unlimited", userId, enabled: !current }),
      });
      if (res.ok) {
        void fetchQuota();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetRateLimits = async () => {
    if (!confirm("Are you sure you want to reset all rate limit buckets?")) return;
    try {
      const res = await fetch("/api/admin/quota", { method: "DELETE" });
      if (res.ok) {
        void fetchQuota();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSampleLog = async (level: "INFO" | "WARN" | "ERROR") => {
    try {
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          message: `Test ${level} log entry generated by Admin Panel`,
          source: "admin_tester",
          meta: { timestamp: new Date().toISOString(), sample: true },
        }),
      });
      void fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all system logs?")) return;
    try {
      const res = await fetch("/api/admin/logs", { method: "DELETE" });
      if (res.ok) {
        void fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setSandboxLoading(true);
    setSandboxError("");
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
      if (res.ok && data.success) {
        setSandboxResult(data);
      } else {
        setSandboxError(data.message || "Review test failed");
      }
    } catch (err) {
      setSandboxError(String(err));
    } finally {
      setSandboxLoading(false);
    }
  };

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 font-sans text-stone-800">
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
          <p className="text-sm font-semibold text-emerald-800 animate-pulse">Checking Admin Authorization...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-900 px-4 py-12 font-sans">
        <div className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-950 p-8 shadow-2xl">
          <div className="text-center">
            <span className="inline-block rounded-full bg-emerald-950/80 px-4 py-1 text-xs font-bold text-emerald-400 border border-emerald-800/40">
              Hookdee Control Panel
            </span>
            <h1 className="mt-4 text-2xl font-bold text-stone-100">Admin Authentication</h1>
            <p className="mt-2 text-sm text-stone-400">Enter your Admin Secret Key to access unlimited quota settings and system logs.</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                Admin Secret Key
              </label>
              <input
                type="password"
                required
                value={adminKeyInput}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                placeholder="Enter AUTH_SECRET or ADMIN_SECRET"
                className="w-full rounded-xl border border-stone-800 bg-stone-900 px-4 py-3 text-stone-100 placeholder-stone-600 focus:border-emerald-500 focus:outline-none text-sm"
              />
            </div>

            {authError && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loggingIn ? "Authenticating..." : "Sign In to Admin Panel"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-stone-500 hover:text-stone-300">
              &larr; Back to Hookdee Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-800 bg-stone-950 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight text-emerald-400">
              Hookdee <span className="text-xs font-semibold uppercase tracking-widest text-stone-400 border border-stone-800 rounded px-2 py-0.5 bg-stone-900 ml-2">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-stone-800 pb-4 mb-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "overview"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-stone-950 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            }`}
          >
            📊 Overview & Health
          </button>
          <button
            onClick={() => setActiveTab("quota")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "quota"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-stone-950 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            }`}
          >
            ⚡ Quota & Rate Limits
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "logs"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-stone-950 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            }`}
          >
            📜 Console & System Logs
          </button>
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "sandbox"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-stone-950 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            }`}
          >
            🧪 AI Script Tester
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-100">System Metrics & Overview</h2>
              <button
                onClick={fetchStats}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-700"
              >
                {loadingStats ? "Refreshing..." : "🔄 Refresh Metrics"}
              </button>
            </div>

            {stats && (
              <>
                {/* Health Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Database Connection</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${stats.health.databaseConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                      <p className="text-lg font-bold text-stone-100">
                        {stats.health.databaseConnected ? "PostgreSQL Ready" : "Disconnected"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Gemini AI API Key</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${stats.health.geminiConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <p className="text-lg font-bold text-stone-100">
                        {stats.health.geminiConfigured ? "Configured" : "Missing Key"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Auth Secret</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${stats.health.authSecretConfigured ? "bg-emerald-500" : "bg-red-500"}`} />
                      <p className="text-lg font-bold text-stone-100">
                        {stats.health.authSecretConfigured ? "Configured" : "Missing Secret"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI & Usage Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Total AI Requests</p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-400">{stats.aiMetrics.totalRequests}</p>
                    <p className="mt-1 text-xs text-stone-500">Logged Gemini calls</p>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Estimated Cost (USD)</p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-400">${stats.aiMetrics.estimatedCostUsd.toFixed(6)}</p>
                    <p className="mt-1 text-xs text-stone-500">Based on Gemini Flash rates</p>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">Total Tokens Processed</p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-400">{stats.aiMetrics.totalTokens.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      In: {stats.aiMetrics.inputTokens.toLocaleString()} | Out: {stats.aiMetrics.outputTokens.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
                    <p className="text-xs font-medium text-stone-400">System Logs Count</p>
                    <p className="mt-2 text-3xl font-extrabold text-stone-100">{stats.logMetrics.total}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      <span className="text-red-400 font-bold">{stats.logMetrics.error} ERROR</span> |{" "}
                      <span className="text-amber-400 font-bold">{stats.logMetrics.warn} WARN</span> |{" "}
                      <span className="text-blue-400 font-bold">{stats.logMetrics.info} INFO</span>
                    </p>
                  </div>
                </div>

                {/* App Data Metrics */}
                <div className="rounded-2xl border border-stone-800 bg-stone-950 p-6">
                  <h3 className="text-base font-bold text-stone-200 mb-4">Application Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
                    <div className="rounded-xl bg-stone-900 p-4 border border-stone-800">
                      <p className="text-xs text-stone-400">Registered Users</p>
                      <p className="text-2xl font-bold text-stone-100 mt-1">{stats.appMetrics.users}</p>
                    </div>
                    <div className="rounded-xl bg-stone-900 p-4 border border-stone-800">
                      <p className="text-xs text-stone-400">Saved Scripts</p>
                      <p className="text-2xl font-bold text-stone-100 mt-1">{stats.appMetrics.scripts}</p>
                    </div>
                    <div className="rounded-xl bg-stone-900 p-4 border border-stone-800">
                      <p className="text-xs text-stone-400">Completed Reviews</p>
                      <p className="text-2xl font-bold text-stone-100 mt-1">{stats.appMetrics.reviews}</p>
                    </div>
                    <div className="rounded-xl bg-stone-900 p-4 border border-stone-800">
                      <p className="text-xs text-stone-400">Active Rate Limit Buckets</p>
                      <p className="text-2xl font-bold text-stone-100 mt-1">{stats.appMetrics.rateLimitBuckets}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: QUOTA & RATE LIMITS */}
        {activeTab === "quota" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-100">Quota & Rate Limit Control</h2>
                <p className="text-xs text-stone-400 mt-1">Manage global rate limits and individual user unlimited access.</p>
              </div>
              <button
                onClick={fetchQuota}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-700"
              >
                {loadingQuota ? "Loading..." : "🔄 Refresh Quota Data"}
              </button>
            </div>

            {quota && (
              <>
                {/* Global Master Switch */}
                <div className="rounded-3xl border border-emerald-900/60 bg-emerald-950/20 p-6 text-stone-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-block rounded-full bg-emerald-900/80 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-700">
                      Master Switch
                    </span>
                    <h3 className="text-xl font-bold mt-2">Global Unlimited Quota Bypass</h3>
                    <p className="text-sm text-stone-300 mt-1 max-w-xl">
                      When enabled, all script reviews (demo & user requests) bypass rate limits and allow infinite review generation.
                    </p>
                  </div>
                  <button
                    onClick={() => toggleGlobalUnlimited(quota.globalUnlimited)}
                    disabled={togglingGlobal}
                    className={`rounded-2xl px-6 py-4 font-bold text-sm transition shadow-lg flex items-center gap-3 ${
                      quota.globalUnlimited
                        ? "bg-emerald-500 text-stone-950 hover:bg-emerald-400"
                        : "bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${quota.globalUnlimited ? "bg-stone-950 animate-ping" : "bg-stone-500"}`} />
                    {quota.globalUnlimited ? "GLOBAL UNLIMITED ACTIVE (Click to Disable)" : "ENABLE GLOBAL UNLIMITED QUOTA"}
                  </button>
                </div>

                {/* Rate Limit Buckets & Reset */}
                <div className="rounded-2xl border border-stone-800 bg-stone-950 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-stone-100">Rate Limit Buckets ({quota.totalBuckets})</h3>
                      <p className="text-xs text-stone-400">Tracked IP addresses and device IDs currently rate limited.</p>
                    </div>
                    <button
                      onClick={resetRateLimits}
                      className="rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900"
                    >
                      🔥 Reset All Rate Limits
                    </button>
                  </div>

                  {quota.rateLimitBuckets.length === 0 ? (
                    <p className="text-xs text-stone-500 py-4 text-center">No active rate limit buckets recorded.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-300">
                        <thead className="border-b border-stone-800 bg-stone-900 text-stone-400 uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Scope</th>
                            <th className="py-2.5 px-3">Hashed Subject</th>
                            <th className="py-2.5 px-3">Attempts Count</th>
                            <th className="py-2.5 px-3">Last Updated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {quota.rateLimitBuckets.map((bucket) => (
                            <tr key={bucket.id} className="hover:bg-stone-900/50">
                              <td className="py-2 px-3 font-mono text-emerald-400">{bucket.scope}</td>
                              <td className="py-2 px-3 font-mono text-stone-400">{bucket.subjectHash.slice(0, 20)}...</td>
                              <td className="py-2 px-3 font-bold text-amber-400">{bucket.count}</td>
                              <td className="py-2 px-3 text-stone-500">{new Date(bucket.updatedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* User Quota Table */}
                <div className="rounded-2xl border border-stone-800 bg-stone-950 p-6">
                  <h3 className="text-base font-bold text-stone-100 mb-1">User Account Quota Permissions</h3>
                  <p className="text-xs text-stone-400 mb-4">Grant specific registered users unlimited quota privileges.</p>

                  {quota.users.length === 0 ? (
                    <p className="text-xs text-stone-500 py-4 text-center">No registered users found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-300">
                        <thead className="border-b border-stone-800 bg-stone-900 text-stone-400 uppercase">
                          <tr>
                            <th className="py-2.5 px-3">User</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Unlimited Status</th>
                            <th className="py-2.5 px-3">Toggle Quota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {quota.users.map((u) => (
                            <tr key={u.id} className="hover:bg-stone-900/50">
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-stone-200">{u.name || "Unnamed User"}</p>
                                <p className="text-stone-500 text-[11px]">{u.email || u.id}</p>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="rounded bg-stone-900 border border-stone-800 px-2 py-0.5 text-[10px] font-bold text-stone-300">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  u.hasUnlimitedQuota
                                    ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                    : "bg-stone-900 text-stone-500"
                                }`}>
                                  {u.hasUnlimitedQuota ? "Unlimited Quota" : "Standard Limits"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  onClick={() => toggleUserUnlimited(u.id, u.hasUnlimitedQuota)}
                                  className="rounded bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700"
                                >
                                  {u.hasUnlimitedQuota ? "Revoke Unlimited" : "Grant Unlimited"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: CONSOLE LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stone-100">Console & System Logs</h2>
                <p className="text-xs text-stone-400 mt-1">Real-time inspection of system operations, errors, warnings, and info events.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCreateSampleLog("INFO")}
                  className="rounded-lg bg-blue-950/60 border border-blue-800/60 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-900"
                >
                  + Sample INFO
                </button>
                <button
                  onClick={() => handleCreateSampleLog("WARN")}
                  className="rounded-lg bg-amber-950/60 border border-amber-800/60 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-900"
                >
                  + Sample WARN
                </button>
                <button
                  onClick={() => handleCreateSampleLog("ERROR")}
                  className="rounded-lg bg-red-950/60 border border-red-800/60 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-900"
                >
                  + Sample ERROR
                </button>
                <button
                  onClick={handleClearLogs}
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-red-400 hover:bg-stone-700"
                >
                  Clear Logs
                </button>
              </div>
            </div>

            {/* Filter Pills and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 mr-2">Level:</span>
                {(["ALL", "ERROR", "WARN", "INFO"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLogFilter(level)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      logFilter === level
                        ? level === "ERROR"
                          ? "bg-red-600 text-white"
                          : level === "WARN"
                          ? "bg-amber-600 text-white"
                          : level === "INFO"
                          ? "bg-blue-600 text-white"
                          : "bg-emerald-600 text-white"
                        : "bg-stone-900 text-stone-400 hover:bg-stone-800"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search log messages..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={fetchLogs}
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-stone-200 hover:bg-stone-700"
                >
                  {loadingLogs ? "Loading..." : "Search"}
                </button>
              </div>
            </div>

            {/* Log Table / List */}
            <div className="rounded-2xl border border-stone-800 bg-stone-950 overflow-hidden">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs">
                  {loadingLogs ? "Fetching logs..." : "No system logs match the selected filter."}
                </div>
              ) : (
                <div className="divide-y divide-stone-800/60 font-mono text-xs">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-stone-900/50 transition flex flex-col md:flex-row md:items-center justify-between gap-2"
                    >
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
                          className="rounded bg-stone-900 border border-stone-800 px-2.5 py-1 text-[11px] text-stone-400 hover:text-stone-200 shrink-0 self-start md:self-auto font-sans"
                        >
                          🔍 Inspect JSON Meta
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta Modal */}
            {selectedLogMeta && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <h3 className="font-bold text-stone-200 text-sm">
                      Inspect Log Details [{selectedLogMeta.level}]
                    </h3>
                    <button
                      onClick={() => setSelectedLogMeta(null)}
                      className="text-stone-400 hover:text-stone-100 text-sm font-bold"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="text-stone-300 font-semibold">{selectedLogMeta.message}</p>
                    <p className="text-stone-500">
                      ID: {selectedLogMeta.id} | Time: {new Date(selectedLogMeta.createdAt).toISOString()}
                    </p>
                    <div className="mt-3 rounded-xl border border-stone-800 bg-stone-900 p-4">
                      <p className="text-[11px] font-bold text-stone-400 mb-2">JSON Metadata:</p>
                      <pre className="overflow-x-auto text-[11px] text-emerald-400 font-mono">
                        {JSON.stringify(selectedLogMeta.meta, null, 2)}
                      </pre>
                    </div>
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
              <p className="text-xs text-stone-400 mt-1">Directly test Script Coach AI review generation without consuming regular rate limit quota.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Test Input Form */}
              <form onSubmit={handleRunSandbox} className="rounded-2xl border border-stone-800 bg-stone-950 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Script Text (ข้อความสคริปต์):
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={sandboxText}
                    onChange={(e) => setSandboxText(e.target.value)}
                    className="w-full rounded-xl border border-stone-800 bg-stone-900 p-3 text-xs text-stone-100 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Niche:</label>
                    <select
                      value={sandboxNiche}
                      onChange={(e) => setSandboxNiche(e.target.value as typeof sandboxNiche)}
                      className="w-full rounded-xl border border-stone-800 bg-stone-900 p-2.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
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
                      className="w-full rounded-xl border border-stone-800 bg-stone-900 p-2.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
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
                  className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {sandboxLoading ? "Processing AI Review..." : "🚀 Run Sandbox Test (Unlimited Quota)"}
                </button>
              </form>

              {/* Output Result */}
              <div className="rounded-2xl border border-stone-800 bg-stone-950 p-6">
                <h3 className="text-sm font-bold text-stone-200 mb-3">AI Response Result</h3>
                {!sandboxResult && !sandboxLoading && (
                  <p className="text-xs text-stone-500 py-12 text-center">Run a test script review to inspect output scores and latency.</p>
                )}

                {sandboxLoading && (
                  <div className="py-12 text-center text-xs text-emerald-400 animate-pulse">
                    Calling Gemini API & validating Thai script review output...
                  </div>
                )}

                {sandboxResult && typeof sandboxResult === "object" && (
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl bg-stone-900 border border-stone-800 p-3 flex justify-between items-center text-stone-300">
                      <span>Latency: <strong className="text-emerald-400">{sandboxResult.durationMs ?? 0} ms</strong></span>
                      <span className="text-emerald-400 font-bold">SUCCESS 200 OK</span>
                    </div>

                    <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
                      <p className="font-bold text-stone-200 mb-2">JSON Review Output:</p>
                      <pre className="overflow-x-auto text-[11px] text-emerald-300 font-mono max-h-96">
                        {JSON.stringify(sandboxResult.review, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
