# 사기가드 — 이거 사기예요?

다양한 금융 사기 상황(중고거래·투자리딩방·로맨스스캠·스미싱 등 12개 유형)을 카드로 제시하고,
사용자가 사기 여부를 직접 판단해보며 사기 인지력을 기르는 판별 퀴즈 서비스입니다.

퀴즈 세트가 끝나면 생성형 AI가 오답 패턴을 분석해 개인별 취약 유형 진단 리포트를 제공합니다.
자세한 기획 배경은 상위 폴더의 [`기획서_초안.md`](../기획서_초안.md), 구현 범위는
[`기능명세서_초안.md`](../기능명세서_초안.md)를 참고하세요.

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

`.env.example`을 `.env.local`로 복사하고 `ANTHROPIC_API_KEY`를 채우면 생성형 AI가
시나리오 변형·설명·진단 리포트를 생성합니다. 키가 없으면 큐레이션된 시드 데이터를
그대로 사용하는 폴백 모드로 동작해 별도 설정 없이도 전체 플로우를 체험할 수 있습니다.

## 구조

- `src/data/seed-scenarios.json` — 12개 사기 유형, 22종 큐레이션 시드 시나리오(정답·설명 포함)
- `src/lib/quiz/` — 퀴즈 세트 구성, 타입, AI 폴백 포함 생성 로직
- `src/lib/ai/claude.ts` — Claude API 구조화 출력 헬퍼
- `src/app/api/quiz/{start,card,answer,report}` — 퀴즈 세트 시작, 카드 생성, 채점+설명, 진단 리포트 API
- `src/app/quiz/page.tsx` — 퀴즈 진행(문제 → 판단 → 피드백 → 리포트) 클라이언트 플로우

## 테스트

```bash
npm run lint
npx tsc --noEmit
npm run build
```
