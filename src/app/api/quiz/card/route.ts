import { NextResponse } from "next/server";
import { z } from "zod";
import { getSeedScenarioById } from "@/lib/quiz/seed-data";
import { buildQuizCard } from "@/lib/quiz/generate";

const RequestSchema = z.object({ scenarioId: z.string() });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "scenarioId가 필요합니다." }, { status: 400 });
  }

  const scenario = getSeedScenarioById(parsed.data.scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "존재하지 않는 시나리오입니다." }, { status: 404 });
  }

  const card = await buildQuizCard(scenario);
  return NextResponse.json({ card });
}
