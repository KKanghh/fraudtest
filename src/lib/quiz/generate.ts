import "server-only";
import { generateStructuredOutput, isAiConfigured } from "@/lib/ai/claude";
import { CardVariantSchema, DiagnosisReportSchema, ExplanationSchema } from "@/lib/ai/schemas";
import type { DiagnosisReport, QuizCard, QuizResultItem, SeedScenario } from "./types";

const FRAUD_GUARD_SYSTEM_PROMPT =
  "당신은 금융 사기 예방 교육 서비스 '사기가드'의 콘텐츠 작가입니다. " +
  "주어진 실제 사기 유형 설명을 절대 왜곡하지 않고, 표현과 등장인물 설정만 바꿔 새로운 버전을 만듭니다. " +
  "위험 여부를 판단하는 핵심 단서(수법 패턴)는 반드시 그대로 유지해야 하며, " +
  "원본처럼 결과가 확정되기 전 판단이 필요한 시점에서 이야기를 끝내야 합니다. " +
  "사용자에게 보여줄 문구에서는 '이것은 사기입니다/사기가 아닙니다'처럼 단정하지 말고, " +
  "'위험해요/괜찮아요'처럼 주의를 환기하는 어조를 사용하세요.";

// AI 키가 없는 로컬 개발/데모 환경에서도 카드가 그대로 노출되지만, 정답(answer)만 제외하면
// 큐레이션된 시드 자체가 이미 완성된 콘텐츠이므로 체험에는 문제가 없다.
export async function buildQuizCard(scenario: SeedScenario): Promise<QuizCard> {
  if (scenario.verifiedTitle && scenario.verifiedContent) {
    return {
      scenarioId: scenario.id,
      type: scenario.type,
      format: scenario.format,
      title: scenario.verifiedTitle,
      content: scenario.verifiedContent,
    };
  }

  if (!isAiConfigured()) {
    return {
      scenarioId: scenario.id,
      type: scenario.type,
      format: scenario.format,
      title: scenario.title,
      content: scenario.content,
    };
  }

  try {
    const variant = await generateStructuredOutput({
      systemPrompt: FRAUD_GUARD_SYSTEM_PROMPT,
      userPrompt:
        `다음 사기 유형(${scenario.type}) 시나리오를 다른 등장인물·표현으로 변형해줘.\n\n` +
        `[원본 제목] ${scenario.title}\n[원본 상황] ${scenario.content}\n\n` +
        "핵심 수법 패턴과 '판단 시점에서 끝난다'는 구조는 그대로 유지하고, " +
        "문장 길이는 원본과 비슷하게 유지해줘.",
      schema: CardVariantSchema,
      maxTokens: 512,
    });
    return {
      scenarioId: scenario.id,
      type: scenario.type,
      format: scenario.format,
      title: variant.title,
      content: variant.content,
    };
  } catch {
    return {
      scenarioId: scenario.id,
      type: scenario.type,
      format: scenario.format,
      title: scenario.title,
      content: scenario.content,
    };
  }
}

export async function buildExplanation(scenario: SeedScenario): Promise<string> {
  if (!isAiConfigured()) {
    return scenario.explanation;
  }

  try {
    const result = await generateStructuredOutput({
      systemPrompt: FRAUD_GUARD_SYSTEM_PROMPT,
      userPrompt:
        `아래 상황을 왜 '${scenario.answer === "fraud" ? "위험하게" : "안심해도 되게"}' 봐야 하는지, ` +
        "단정적인 판정 대신 어떤 신호를 눈여겨봐야 하는지 사용자가 이해하기 쉬운 말로 설명해줘.\n\n" +
        `[상황] ${scenario.content}\n[근거 힌트] ${scenario.explanation}`,
      schema: ExplanationSchema,
      maxTokens: 400,
    });
    return result.explanation;
  } catch {
    return scenario.explanation;
  }
}

function fallbackReport(weakType: string | null, correctCount: number, total: number): DiagnosisReport {
  const level = levelForScore(correctCount, total);
  return {
    level,
    weakTypes: weakType ? [weakType as DiagnosisReport["weakTypes"][number]] : [],
    summary: `${total}문항 중 ${correctCount}문항을 맞혔어요.`,
    tips: weakType
      ? [
          `${weakType} 유형은 특히 조심하세요. 선입금·급전 요구·확인 회피 신호가 있는지 항상 점검하세요.`,
          "낯선 요청에는 공식 채널(고객센터, 본인 확인 전화)로 직접 확인하는 습관을 들이세요.",
          "의심스러운 상황은 혼자 판단하지 말고 가족이나 주변에 먼저 이야기해보세요.",
        ]
      : [
          "전반적으로 판단력이 좋아요. 방심하지 말고 새로운 수법 뉴스도 꾸준히 확인하세요.",
          "선입금·긴박감 조성·본인 확인 회피는 언제나 의심 신호입니다.",
          "확신이 안 서면 공식 채널로 직접 확인하는 습관을 유지하세요.",
        ],
  };
}

function levelForScore(correctCount: number, total: number): string {
  const ratio = total === 0 ? 0 : correctCount / total;
  if (ratio >= 0.8) return "사기 판별 마스터";
  if (ratio >= 0.5) return "사기 판별 견습생";
  return "사기 초보 탐지자";
}

export async function buildDiagnosisReport(results: QuizResultItem[]): Promise<DiagnosisReport> {
  const total = results.length;
  const correctCount = results.filter((r) => r.correct).length;

  const wrongByType = new Map<string, number>();
  for (const result of results) {
    if (!result.correct) {
      wrongByType.set(result.type, (wrongByType.get(result.type) ?? 0) + 1);
    }
  }
  const weakType = [...wrongByType.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const level = levelForScore(correctCount, total);

  if (!isAiConfigured()) {
    return fallbackReport(weakType, correctCount, total);
  }

  try {
    const statsSummary = [...wrongByType.entries()]
      .map(([type, count]) => `${type}: 오답 ${count}회`)
      .join(", ") || "오답 없음";

    const result = await generateStructuredOutput({
      systemPrompt: FRAUD_GUARD_SYSTEM_PROMPT,
      userPrompt:
        `사용자가 사기 판별 퀴즈 ${total}문항 중 ${correctCount}문항을 맞혔습니다.\n` +
        `유형별 오답 현황: ${statsSummary}\n\n` +
        "이 사용자에게 어떤 유형에 취약한지 알려주고, 구체적인 예방 팁 3가지를 제안해줘.",
      schema: DiagnosisReportSchema,
      maxTokens: 600,
    });
    return {
      level,
      weakTypes: weakType ? [weakType as DiagnosisReport["weakTypes"][number]] : [],
      summary: `${result.summary} ${result.weakTypeComment}`.trim(),
      tips: result.tips,
    };
  } catch {
    return fallbackReport(weakType, correctCount, total);
  }
}
