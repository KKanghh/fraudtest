"use client";

import { useState } from "react";
import Link from "next/link";
import raw from "@/data/difficulty-test-scenarios.json";

type Answer = "fraud" | "safe";

interface TestScenario {
  id: string;
  type: string;
  format: string;
  title: string;
  content: string;
  answer: Answer;
  explanation: string;
}

interface AnsweredItem extends TestScenario {
  userAnswer: Answer;
  correct: boolean;
}

const FORMAT_LABEL: Record<string, string> = {
  text: "상황 설명",
  dialogue: "대화 상황",
  sms: "문자 메시지",
  notice: "안내문",
};

function displayType(type: string): string {
  return type.replace(/_/g, " ");
}

const SCENARIOS = raw.scenarios as TestScenario[];

export default function DifficultyTestPage() {
  const [scenarios] = useState<TestScenario[]>(SCENARIOS);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<AnsweredItem[]>([]);
  const [started, setStarted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(choice: Answer) {
    const current = scenarios[index];
    const item: AnsweredItem = { ...current, userAnswer: choice, correct: choice === current.answer };
    setAnswered((prev) => [...prev, item]);
    setIndex((i) => i + 1);
  }

  if (!started) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16 text-center">
        <span className="mx-auto inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          내부 테스트용 · 실제 서비스 데이터 아님
        </span>
        <h1 className="mt-4 text-2xl font-bold">사기가드 난이도 테스트</h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          지금까지 만든 문제 후보 {scenarios.length}개를 그대로 보여드릴게요. 각 상황이
          위험한지(fraud) 안전한지(safe) 판단해주세요. 중간 정답 공개는 없고, 전부 푼 뒤
          마지막에 결과를 한 번에 보여드립니다.
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          시작하기
        </button>
      </main>
    );
  }

  if (index >= scenarios.length) {
    const correctCount = answered.filter((a) => a.correct).length;
    const wrongNumbers = answered.map((a, i) => (a.correct ? null : i + 1)).filter((n): n is number => n !== null);
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-12">
        <div className="text-center">
          <p className="text-sm font-semibold text-blue-600">테스트 결과</p>
          <h1 className="mt-2 text-2xl font-bold">
            {correctCount} / {scenarios.length} 정답
          </h1>
          <p className="mt-1 text-slate-500">아래에서 문제별로 어떤 걸 놓쳤는지 확인해보세요.</p>
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {wrongNumbers.length > 0 ? `틀린 문제: ${wrongNumbers.join(", ")}번` : "틀린 문제 없음 🎉"}
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {answered.map((item, i) => {
            const isExpanded = expandedId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  item.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {i + 1}. {displayType(item.type)}
                    </span>
                    <span className={item.correct ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                      {item.correct ? "정답" : "오답"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    내 답: {item.userAnswer === "fraud" ? "위험해요" : "괜찮아요"} · 실제 정답:{" "}
                    {item.answer === "fraud" ? "위험해요" : "괜찮아요"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-blue-600">
                    {isExpanded ? "해설 접기 ▲" : "해설 보기 ▼"}
                  </p>
                </button>
                {isExpanded && (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-slate-700">
                    {item.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            const summary = [
              `사기가드 난이도 테스트 결과: ${correctCount} / ${scenarios.length} 정답`,
              wrongNumbers.length > 0 ? "틀린 문제:" : "틀린 문제 없음 🎉",
              ...answered
                .map((item, i) => (item.correct ? null : `${i + 1}. ${item.title}`))
                .filter((line): line is string => line !== null),
            ].join("\n");
            void navigator.clipboard.writeText(summary).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="mt-8 w-full rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 text-base font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {copied ? "복사했어요!" : "결과 복사하기 (채팅에 붙여넣기)"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setAnswered([]);
            setExpandedId(null);
            setStarted(true);
          }}
          className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          다시 풀기
        </button>
        <Link href="/" className="mt-4 text-center text-xs text-slate-400 underline underline-offset-2">
          처음으로 돌아가기
        </Link>
      </main>
    );
  }

  const current = scenarios[index];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between text-sm text-slate-500">
        <span>
          문제 {index + 1} / {scenarios.length}
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">내부 테스트</span>
      </header>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={0}
        aria-valuemax={scenarios.length}
      >
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((index + 1) / scenarios.length) * 100}%` }} />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {FORMAT_LABEL[current.format] ?? "상황"}
        </span>
        <h2 className="mt-3 text-lg font-bold">{current.title}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{current.content}</p>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => submit("fraud")}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-base font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          위험해요
        </button>
        <button
          type="button"
          onClick={() => submit("safe")}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-base font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          괜찮아요
        </button>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-slate-400 underline underline-offset-2">
          그만하고 처음으로
        </Link>
      </div>
    </main>
  );
}
