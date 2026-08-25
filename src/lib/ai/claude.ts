import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

const MODEL = "claude-sonnet-5";

let cachedClient: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았어요.");
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

// 카드 변형·설명·진단 리포트 생성이 공용으로 쓰는 구조화 출력 헬퍼.
// thinking을 끄는 이유: 세 작업 모두 추론이 아니라 시드 데이터를 근거로 한 변형·요약이므로 지연시간·비용을 아낀다.
export async function generateStructuredOutput<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const client = getClient();

  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    thinking: { type: "disabled" },
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userPrompt }],
    output_config: { format: zodOutputFormat(params.schema) },
  });

  if (message.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리하지 못했습니다.");
  }
  if (!message.parsed_output) {
    throw new Error("Claude 응답에서 구조화된 출력을 받지 못했어요.");
  }
  return message.parsed_output;
}
