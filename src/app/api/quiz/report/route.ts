import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDiagnosisReport } from "@/lib/quiz/generate";
import type { FraudType } from "@/lib/quiz/types";

const RequestSchema = z.object({
  results: z.array(
    z.object({
      type: z.string(),
      correct: z.boolean(),
    }),
  ),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "results 배열이 필요합니다." }, { status: 400 });
  }

  const report = await buildDiagnosisReport(
    parsed.data.results.map((r) => ({ type: r.type as FraudType, correct: r.correct })),
  );
  return NextResponse.json({ report });
}
