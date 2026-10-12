"use client";

import type { ScriptCoachResult } from "@/lib/ai/review-schema";
import { th } from "@/lib/i18n/th";

const SCORE_KEYS = [
  "hook",
  "pacing",
  "clarity",
  "cta",
  "naturalThai",
] as const;

interface ReviewResultProps {
  review: ScriptCoachResult;
  onCopy: () => void;
  copyStatus: "idle" | "copied" | "failed";
}

export function ReviewResult({
  review,
  onCopy,
  copyStatus,
}: ReviewResultProps) {
  return (
    <section
      aria-labelledby="review-result-title"
      className="mt-6 border-t border-stone-200 pt-6"
    >
      <h3 className="text-xl font-bold text-stone-900" id="review-result-title">
        {th.demo.resultTitle}
      </h3>
      <h4 className="mt-5 text-sm font-bold text-stone-700">{th.demo.scoresTitle}</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {SCORE_KEYS.map((key) => (
          <article
            className="rounded-2xl border border-stone-200 bg-white p-4"
            key={key}
          >
            <div className="flex items-center justify-between gap-3">
              <h5 className="font-semibold text-stone-800">
                {th.demo.scoreNames[key]}
              </h5>
              <p className="shrink-0 font-bold text-emerald-900">
                {review.scores[key].score}/10
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {review.scores[key].reason}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-bold text-stone-700">{th.demo.weakSpotsTitle}</h4>
        {review.weakSpots.length ? (
          <ul className="mt-3 space-y-3">
            {review.weakSpots.map((spot, index) => (
              <li
                className="rounded-2xl border-l-4 border-orange-400 bg-orange-50 px-4 py-3"
                key={`${spot.quote}-${index}`}
              >
                <blockquote className="font-semibold leading-7 text-stone-900">
                  “{spot.quote}”
                </blockquote>
                <p className="mt-1 text-sm leading-6 text-stone-700">
                  {spot.reason}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-600">{th.demo.emptyWeakSpots}</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-emerald-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-emerald-950">{th.demo.rewriteTitle}</h4>
          <button
            className="rounded-full border border-emerald-900/20 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            onClick={onCopy}
            type="button"
          >
            {copyStatus === "copied" ? th.demo.copied : th.demo.copy}
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-stone-900">
          {review.rewrite}
        </p>
        {copyStatus === "failed" ? (
          <p className="mt-2 text-sm text-red-700" role="status">
            {th.demo.copyFailed}
          </p>
        ) : null}
      </div>
    </section>
  );
}
