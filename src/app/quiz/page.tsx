"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AnswerResult, DiagnosisReport, QuizCard, QuizResultItem, UserChoice } from "@/lib/quiz/types";

type Phase = "loading" | "question" | "submitting" | "feedback" | "finishing" | "report" | "error";

const QUESTION_SCORE = 10;

function displayType(type: string): string {
  return type.replace(/_/g, " ");
}

const FORMAT_LABEL: Record<string, string> = {
  text: "상황 설명",
  dialogue: "대화 상황",
  sms: "문자 메시지",
  notice: "안내문",
};

const RECENT_IDS_KEY = "fraudguard_recent_scenario_ids";
const RECENT_IDS_LIMIT = 20;

function getRecentScenarioIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem(RECENT_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberScenarioIds(ids: string[]) {
  try {
    const merged = [...getRecentScenarioIds(), ...ids].slice(-RECENT_IDS_LIMIT);
    window.sessionStorage.setItem(RECENT_IDS_KEY, JSON.stringify(merged));
  } catch {
    // 세션 스토리지를 못 쓰는 환경이면 반복회피 없이 그냥 진행한다.
  }
}

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [scenarioIds, setScenarioIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<QuizCard | null>(null);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCard = useCallback(async (scenarioId: string) => {
    const res = await fetch("/api/quiz/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    });
    if (!res.ok) throw new Error("문제를 불러오지 못했어요.");
    const data = await res.json();
    return data.card as QuizCard;
  }, []);

  const start = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const excludeIds = getRecentScenarioIds();
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeIds }),
      });
      if (!res.ok) throw new Error("퀴즈를 시작하지 못했어요.");
      const data = await res.json();
      const ids: string[] = data.scenarioIds;
      rememberScenarioIds(ids);
      setScenarioIds(ids);
      setCurrentIndex(0);
      setResults([]);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setReport(null);
      const card = await fetchCard(ids[0]);
      setCurrentCard(card);
      setPhase("question");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
      setPhase("error");
    }
  }, [fetchCard]);

  useEffect(() => {
    // 마운트 시 첫 문제 세트를 불러온다. start()가 초기값과 동일한 상태를 다시
    // 설정하는 것뿐이라 실제 렌더 연쇄는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAnswer(choice: UserChoice) {
    if (!currentCard) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: currentCard.scenarioId, userAnswer: choice }),
      });
      if (!res.ok) throw new Error("채점에 실패했어요.");
      const data: AnswerResult = await res.json();
      setLastResult(data);
      setResults((prev) => [...prev, { type: currentCard.type, correct: data.correct }]);
      if (data.correct) {
        setScore((s) => s + QUESTION_SCORE);
        setStreak((s) => {
          const next = s + 1;
          setMaxStreak((m) => Math.max(m, next));
          return next;
        });
      } else {
        setStreak(0);
      }
      setPhase("feedback");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
      setPhase("error");
    }
  }

  async function nextQuestion() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= scenarioIds.length) {
      setPhase("finishing");
      try {
        const res = await fetch("/api/quiz/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results }),
        });
        if (!res.ok) throw new Error("진단 리포트를 만들지 못했어요.");
        const data = await res.json();
        setReport(data.report as DiagnosisReport);
        setPhase("report");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
        setPhase("error");
      }
      return;
    }

    setPhase("loading");
    setCurrentIndex(nextIndex);
    try {
      const card = await fetchCard(scenarioIds[nextIndex]);
      setCurrentCard(card);
      setPhase("question");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
      setPhase("error");
    }
  }

  if (phase === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-slate-600">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
        >
          다시 시도하기
        </button>
      </main>
    );
  }

  if (phase === "report" && report) {
    return <ReportView report={report} score={score} maxStreak={maxStreak} total={scenarioIds.length} onRestart={() => void start()} />;
  }

  if (phase === "loading" || phase === "finishing" || !currentCard) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-slate-500">
          {phase === "finishing" ? "결과를 분석하는 중이에요..." : "문제를 준비하는 중이에요..."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between text-sm text-slate-500">
        <span>
          문제 {currentIndex + 1} / {scenarioIds.length}
        </span>
        <span className="flex items-center gap-3">
          <span>점수 {score}</span>
          {streak >= 2 && <span className="font-semibold text-orange-500">🔥 {streak}연속 정답</span>}
        </span>
      </header>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={0}
        aria-valuemax={scenarioIds.length}
      >
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${((currentIndex + 1) / scenarioIds.length) * 100}%` }}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {FORMAT_LABEL[currentCard.format] ?? "상황"}
        </span>
        <h2 className="mt-3 text-lg font-bold">{currentCard.title}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{currentCard.content}</p>
      </section>

      {phase !== "feedback" ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AnswerButton
            label="위험해요"
            onClick={() => submitAnswer("fraud")}
            disabled={phase === "submitting"}
            variant="danger"
          />
          <AnswerButton
            label="괜찮아요"
            onClick={() => submitAnswer("safe")}
            disabled={phase === "submitting"}
            variant="safe"
          />
          <AnswerButton
            label="잘 모르겠어요"
            onClick={() => submitAnswer("unsure")}
            disabled={phase === "submitting"}
            variant="neutral"
          />
        </div>
      ) : (
        lastResult && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
            <p
              className={`text-sm font-bold ${lastResult.correct ? "text-emerald-600" : "text-rose-600"}`}
            >
              {lastResult.correct ? "잘 짚었어요!" : "다시 한번 살펴볼까요."} 이 상황은{" "}
              {lastResult.correctAnswer === "fraud" ? "위험해요" : "괜찮은 편이에요"}.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{lastResult.explanation}</p>
            <p className="mt-3 text-xs text-slate-400">유형: {displayType(currentCard.type)}</p>
            <button
              type="button"
              onClick={() => void nextQuestion()}
              className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {currentIndex + 1 >= scenarioIds.length ? "결과 보기" : "다음 문제"}
            </button>
          </div>
        )
      )}

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-slate-400 underline underline-offset-2">
          그만하고 처음으로
        </Link>
      </div>
    </main>
  );
}

function AnswerButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: "danger" | "safe" | "neutral";
}) {
  const variantClass = {
    danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    safe: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    neutral: "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${variantClass}`}
    >
      {label}
    </button>
  );
}

function ReportView({
  report,
  score,
  maxStreak,
  total,
  onRestart,
}: {
  report: DiagnosisReport;
  score: number;
  maxStreak: number;
  total: number;
  onRestart: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold text-blue-600">진단 결과</p>
        <h1 className="mt-2 text-2xl font-bold">{report.level}</h1>
        <p className="mt-1 text-slate-500">
          {total}문항 중 {score / QUESTION_SCORE}문항 정답 · 최고 연속 정답 {maxStreak}회
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold">나의 취약 유형</h2>
        {report.weakTypes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {report.weakTypes.map((type) => (
              <span
                key={type}
                className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-600"
              >
                {displayType(type)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">뚜렷한 약점 유형이 없어요. 훌륭해요!</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{report.summary}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold">맞춤 예방 팁</h2>
        <ul className="mt-3 space-y-2">
          {report.tips.map((tip, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="text-blue-600">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={onRestart}
        className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        다시 풀기
      </button>
      <Link href="/" className="mt-4 text-center text-xs text-slate-400 underline underline-offset-2">
        처음으로 돌아가기
      </Link>
    </main>
  );
}
