export type FraudType =
  | "중고거래_사기"
  | "투자리딩방_사기"
  | "로맨스스캠"
  | "스미싱"
  | "대환작업대출_사기"
  | "몸캠피싱"
  | "가짜쇼핑몰"
  | "대리입금"
  | "지인사칭_메신저피싱"
  | "취업사기"
  | "전세사기"
  | "택배기사_사칭피싱"
  | "중고차_사기"
  | "반려동물_분양사기"
  | "티켓_되팔이_사기";

export type ScenarioFormat = "text" | "dialogue" | "sms" | "notice";
export type Answer = "fraud" | "safe";
export type UserChoice = Answer | "unsure";

export interface SeedScenario {
  id: string;
  type: FraudType;
  format: ScenarioFormat;
  title: string;
  content: string;
  answer: Answer;
  explanation: string;
  source: string;
  /** 생성 에이전트가 만들고 풀이 에이전트가 정답과 일치함을 검증한 카드(scripts/validate-scenarios.mjs 산출물). 있으면 실시간 생성 대신 그대로 서비스한다. */
  verifiedTitle?: string;
  verifiedContent?: string;
}

export interface QuizCard {
  scenarioId: string;
  type: FraudType;
  format: ScenarioFormat;
  title: string;
  content: string;
}

export interface AnswerResult {
  scenarioId: string;
  correct: boolean;
  correctAnswer: Answer;
  explanation: string;
}

export interface QuizResultItem {
  type: FraudType;
  correct: boolean;
}

export interface DiagnosisReport {
  level: string;
  weakTypes: FraudType[];
  summary: string;
  tips: string[];
}
