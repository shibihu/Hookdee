"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { th } from "@/lib/i18n/th";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  hasUnlimitedQuota: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkUserSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void checkUserSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleSignIn = () => {
    setRedirecting(true);
    router.push("/api/auth/google");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-12 font-sans text-stone-900">
      <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-lg sm:p-10">
        <p className="text-sm font-bold tracking-wide text-emerald-800 uppercase">Hookdee Account</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-950">
          {th.login.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {th.login.description}
        </p>

        {loading ? (
          <div className="my-8 py-4 text-xs font-semibold text-emerald-800 animate-pulse">
            กำลังตรวจสอบสถานะการเข้าสู่ระบบ...
          </div>
        ) : user ? (
          <div className="my-8 rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center">
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name || "User Avatar"}
                className="mx-auto h-16 w-16 rounded-full border-2 border-emerald-600 shadow-sm"
              />
            )}
            <h3 className="mt-3 text-base font-bold text-stone-900">{user.name || "ผู้ใช้งาน Hookdee"}</h3>
            <p className="text-xs text-stone-500">{user.email}</p>
            {user.hasUnlimitedQuota && (
              <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                ⚡ สิทธิ์การใช้งาน Unlimited Quota
              </span>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/"
                className="w-full rounded-xl bg-emerald-800 py-3 text-xs font-bold text-white transition hover:bg-emerald-900"
              >
                ไปที่หน้าใช้งานหลัก
              </Link>
              <button
                onClick={handleLogout}
                className="w-full rounded-xl border border-stone-300 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        ) : (
          <div className="my-8 space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={redirecting}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-300 bg-white px-6 py-3.5 text-sm font-bold text-stone-800 shadow-sm transition hover:bg-stone-50 hover:border-stone-400 disabled:opacity-60"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{redirecting ? th.login.signingIn : th.login.googleButton}</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-stone-400 my-4">
              <div className="h-px flex-1 bg-stone-200" />
              <span>หรือ</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <Link
              href="/admin"
              className="inline-block w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
            >
              🔐 {th.login.adminAction}
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 border-t border-stone-100 pt-6 sm:flex-row">
          <Link
            className="text-xs font-bold text-stone-600 hover:text-emerald-800"
            href="/"
          >
            {th.login.homeAction}
          </Link>
          <span className="hidden sm:inline text-stone-300">•</span>
          <Link
            className="text-xs font-bold text-stone-600 hover:text-emerald-800"
            href="/#pricing"
          >
            {th.login.pricingAction}
          </Link>
        </div>
      </section>
    </main>
  );
}
