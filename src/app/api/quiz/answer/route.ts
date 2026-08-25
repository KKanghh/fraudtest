import { NextResponse } from "next/server";
import { z } from "zod";
import { getSeedScenarioById } from "@/lib/quiz/seed-data";
import { buildExplanation } from "@/lib/quiz/generate";

const RequestSchema = z.object({
  scenarioId: z.string(),
  userAnswer: z.enum(["fraud", "safe", "unsure"]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "scenarioId와 userAnswer가 필요합니다." }, { status: 400 });
  }

  const scenario = getSeedScenarioById(parsed.data.scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "존재하지 않는 시나리오입니다." }, { status: 404 });
  }

  const explanation = await buildExplanation(scenario);
  const correct = parsed.data.userAnswer === scenario.answer;

  return NextResponse.json({
    scenarioId: scenario.id,
    correct,
    correctAnswer: scenario.answer,
    explanation,
  });
}
