import { z } from "zod";

export const CardVariantSchema = z.object({
  title: z.string().describe("변형된 상황 카드의 짧은 제목 (원본과 다른 표현)"),
  content: z
    .string()
    .describe(
      "변형된 상황 설명. 핵심 수법 패턴은 유지하되 인물 설정·구체 표현만 바꾼다. " +
        "원본과 마찬가지로 결과가 확정되기 전, 사용자가 판단해야 하는 시점에서 끝나야 하며 " +
        "'피해를 입었다/협박당했다/사기였다'처럼 결말을 먼저 밝혀서는 안 된다.",
    ),
});
export type CardVariant = z.infer<typeof CardVariantSchema>;

export const ExplanationSchema = z.object({
  explanation: z
    .string()
    .describe(
      "이 상황을 왜 위험하게(또는 안심해도 되게) 봐야 하는지 근거를 설명하는 2~3문장의 자연어 설명. " +
        "'이것은 사기입니다/사기가 아닙니다'처럼 단정하는 말투 대신, 어떤 신호를 주의 깊게 봐야 하는지 알려주는 톤으로 작성한다.",
    ),
});
export type ExplanationOutput = z.infer<typeof ExplanationSchema>;

export const DiagnosisReportSchema = z.object({
  summary: z.string().describe("사용자의 전체 결과를 한두 문장으로 요약하는 코멘트"),
  weakTypeComment: z.string().describe("가장 취약한 사기 유형과 그 이유를 설명하는 2~3문장"),
  tips: z.array(z.string()).describe("취약 유형에 맞춘 구체적인 예방 팁 3가지"),
});
export type DiagnosisReportOutput = z.infer<typeof DiagnosisReportSchema>;
