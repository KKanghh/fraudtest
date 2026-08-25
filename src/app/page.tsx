import Link from "next/link";

const FRAUD_TYPES = [
  "중고거래 사기",
  "투자 리딩방",
  "로맨스스캠",
  "스미싱",
  "대환·작업대출",
  "몸캠피싱",
  "가짜 쇼핑몰",
  "대리입금",
  "메신저피싱",
  "취업사기",
  "전세사기",
  "택배기사 사칭",
  "중고차 사기",
  "반려동물 분양사기",
  "티켓 되팔이",
];

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-600">사기가드</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">이거, 사기일까요?</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          중고거래부터 투자 리딩방, 로맨스스캠까지 — 실제 사기 사례를 바탕으로 재구성한
          상황을 보고 위험한 상황인지 직접 판단해보세요. 끝나면 어떤 유형에 취약한지 알려드려요.
        </p>

        <Link
          href="/quiz"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
        >
          퀴즈 시작하기 (10문항)
        </Link>
        <p className="mt-3 text-xs text-slate-400">회원가입 없이 바로 시작할 수 있어요</p>

        <div className="mt-12 text-left">
          <h2 className="text-sm font-semibold text-slate-500">다루는 사기 유형</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {FRAUD_TYPES.map((type) => (
              <li
                key={type}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
              >
                {type}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
