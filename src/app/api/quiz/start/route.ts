import { NextResponse } from "next/server";
import { z } from "zod";
import { pickQuizSet } from "@/lib/quiz/seed-data";

const QUIZ_LENGTH = 10;

const RequestSchema = z.object({
  excludeIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  let excludeIds: string[] = [];
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (parsed.success) {
      excludeIds = parsed.data.excludeIds ?? [];
    }
  } catch {
    // 바디가 없거나 JSON이 아니어도 제외 목록 없이 진행한다.
  }

  const scenarioIds = pickQuizSet(QUIZ_LENGTH, excludeIds);
  return NextResponse.json({ scenarioIds });
}
