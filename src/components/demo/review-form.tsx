"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  DemoReviewErrorSchema,
  DemoReviewSuccessSchema,
  ScriptNicheSchema,
  type ScriptCoachInput,
  type ScriptCoachResult,
} from "@/lib/ai/review-schema";
import { th } from "@/lib/i18n/th";
import { ReviewResult } from "./review-result";

function durationFromForm(value: string): 15 | 30 | 60 | undefined {
  if (value === "15") return 15;
  if (value === "30") return 30;
  if (value === "60") return 60;
  return undefined;
}

export function DemoForm() {
  const [scriptText, setScriptText] = useState("");
  const [niche, setNiche] = useState<ScriptCoachInput["niche"] | "">("");
  const [duration, setDuration] = useState("");
  const [review, setReview] = useState<ScriptCoachResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoginUrl(null);
    setIsSubmitting(true);

    const targetDurationSeconds = durationFromForm(duration);
    const payload: ScriptCoachInput = {
      scriptText,
      ...(niche ? { niche } : {}),
      ...(targetDurationSeconds
        ? { targetDurationSeconds }
        : {}),
    };

    try {
      const response = await fetch("/api/demo/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setError(th.demo.serviceUnavailable);
        return;
      }

      if (!response.ok) {
        const errorData = DemoReviewErrorSchema.safeParse(data);
        if (!errorData.success) {
          setError(th.demo.serviceUnavailable);
          return;
        }
        if (errorData.data.code === "DEMO_LIMIT_REACHED") {
          setRemaining(0);
          setLoginUrl(errorData.data.loginUrl ?? "/login");
        }
        setError(errorData.data.message ?? th.demo.serviceUnavailable);
        return;
      }

      const success = DemoReviewSuccessSchema.safeParse(data);
      if (!success.success) {
        setError(th.demo.serviceUnavailable);
        return;
      }
      setReview(success.data.review);
      setRemaining(success.data.remaining);
      setCopyStatus("idle");
      if (success.data.remaining === 0) {
        setLoginUrl("/login");
      }
    } catch {
      setError(th.demo.networkError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyRewrite() {
    if (!review) {
      return;
    }

    try {
      await navigator.clipboard.writeText(review.rewrite);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  const isLimitReached = remaining === 0 || loginUrl !== null;

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_22px_70px_-42px_rgba(28,25,23,0.35)] sm:p-7">
      <form className="space-y-5" onSubmit={submit}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-sm font-bold text-stone-800"
              htmlFor="scriptText"
            >
              {th.demo.scriptLabel}
            </label>
            <span className="text-xs text-stone-400">
              {th.demo.characterCount(scriptText.length)}
            </span>
          </div>
          <textarea
            className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-stone-300 bg-[#fdfdfb] px-4 py-3.5 text-base leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
            id="scriptText"
            maxLength={12_000}
            onChange={(event) => setScriptText(event.target.value)}
            placeholder={th.demo.scriptPlaceholder}
            required
            value={scriptText}
          />
          <p className="mt-1.5 text-xs leading-5 text-stone-500">
            {th.demo.scriptHint}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-semibold text-stone-700"
              htmlFor="niche"
            >
              {th.demo.nicheLabel}
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-stone-800 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
              id="niche"
              onChange={(event) => {
                const value = event.target.value;
                const parsed = ScriptNicheSchema.safeParse(value);
                setNiche(parsed.success ? parsed.data : "");
              }}
              value={niche}
            >
              <option value="">{th.demo.nichePlaceholder}</option>
              {Object.entries(th.demo.niches).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="text-sm font-semibold text-stone-700"
              htmlFor="duration"
            >
              {th.demo.durationLabel}
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-stone-800 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
              id="duration"
              onChange={(event) => setDuration(event.target.value)}
              value={duration}
            >
              <option value="">{th.demo.durationPlaceholder}</option>
              <option value="15">{th.demo.durations.seconds15}</option>
              <option value="30">{th.demo.durations.seconds30}</option>
              <option value="60">{th.demo.durations.seconds60}</option>
            </select>
          </div>
        </div>

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={isSubmitting || isLimitReached}
          type="submit"
        >
          {isSubmitting ? th.demo.submitting : th.demo.submit}
        </button>
        {remaining !== null ? (
          <p className="text-center text-sm text-stone-600" role="status">
            {th.demo.remaining(remaining)}
          </p>
        ) : null}
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {loginUrl ? (
        <Link
          className="mt-4 inline-flex w-full justify-center rounded-full border border-emerald-800 px-5 py-3 font-bold text-emerald-900 transition hover:bg-emerald-50"
          href={loginUrl}
        >
          {th.demo.loginToContinue}
        </Link>
      ) : null}
      {review ? (
        <ReviewResult
          copyStatus={copyStatus}
          onCopy={copyRewrite}
          review={review}
        />
      ) : null}
    </div>
  );
}
