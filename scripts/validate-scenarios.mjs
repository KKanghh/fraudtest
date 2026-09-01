// 생성 에이전트(카드 변형 생성) → 검증 에이전트(주장된 정답이 실제로 타당한지 재판정) →
// 풀이 에이전트(정답 없이 fraud/safe 판단), 3단계 파이프라인.
//
// 채택 기준은 "풀이 에이전트가 정답을 맞히지 못함"(=너무 쉽지 않은, 난이도가 있는 카드)이다.
// 하지만 실험 결과, 위험 신호를 늘려 풀이 에이전트를 일부러 틀리게 만드는 과정에서 생성
// 에이전트가 실제로 알려진 사기 수법 패턴을 그대로 만들어버려 "정답 자체가 틀렸다"고 봐야
// 하는 후보가 나왔다(예: 스미싱 카드에 해외발신+통관보류 긴급+축약링크를 넣어 놓고 정답을
// safe라고 우기는 경우 — 이건 실제로 알려진 스미싱 템플릿이라 안전하다고 볼 수 없다).
// 생성 에이전트 자신의 "자체 점검"만으로는 이걸 못 걸렀다(자기가 만든 걸 자기가 정당화하는
// 경향). 그래서 **독립된 새 컨텍스트의 검증 에이전트**를 중간에 끼워 넣어, "이 후보의 주장된
// 정답이 실제 사기 수법 패턴과 겹치지 않고 여전히 타당한가"를 다시 판정한다. 검증에서
// FAIL이면 풀이 단계로 넘기지도 않고(비용 절약) 바로 폐기·재생성한다.
//
// 풀이 에이전트는 "대충 훑어보라"는 프롬프트만으로는 약해지지 않는다(모델 자체 추론력은
// 그대로이므로) — 그래서 생성/검증과 다른 더 약한 모델(SOLVER_MODEL)을 실제 이용자의 직관적
// 판단력 대리로 사용한다. 검증 에이전트는 반대로 전체 컨텍스트를 다 보고 전문가처럼 깊이
// 판단해야 하므로 생성과 같은 모델(MODEL)을 쓴다.
//
// 실행: web/.env.local 에 ANTHROPIC_API_KEY 설정 후
//   npm run validate-scenarios              # 전체 74개
//   npm run validate-scenarios -- --type 로맨스스캠   # 특정 유형만
//   npm run validate-scenarios -- --limit 5           # 앞에서 N개만 (동작 확인용)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DATA_PATH = path.join(__dirname, "../src/data/seed-scenarios.json");
const ROOT_DATA_PATH = path.join(__dirname, "../../data/seed-scenarios.json");
const MODEL = "claude-sonnet-5";
const SOLVER_MODEL = "claude-haiku-4-5-20251001";
const MAX_ATTEMPTS = 5;

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--type") opts.type = args[++i];
    if (args[i] === "--limit") opts.limit = Number(args[++i]);
  }
  return opts;
}

const FRAUD_GUARD_SYSTEM_PROMPT =
  "당신은 금융 사기 예방 교육 서비스 '사기가드'의 콘텐츠 작가입니다. " +
  "주어진 실제 사기 유형 설명을 절대 왜곡하지 않고, 표현과 등장인물 설정만 바꿔 새로운 버전을 만듭니다. " +
  "위험 여부를 판단하는 핵심 단서(수법 패턴)는 반드시 그대로 유지해야 하며, " +
  "원본처럼 결과가 확정되기 전 판단이 필요한 시점에서 이야기를 끝내야 합니다. " +
  "사용자에게 보여줄 문구에서는 '이것은 사기입니다/사기가 아닙니다'처럼 단정하지 말고, " +
  "'위험해요/괜찮아요'처럼 주의를 환기하는 어조를 사용하세요.";

const CardVariantSchema = z.object({
  title: z.string().describe("변형된 상황 카드의 짧은 제목 (원본과 다른 표현)"),
  content: z
    .string()
    .describe(
      "변형된 상황 설명. 핵심 수법 패턴은 유지하되 인물 설정·구체 표현만 바꾼다. " +
        "원본과 마찬가지로 결과가 확정되기 전, 사용자가 판단해야 하는 시점에서 끝나야 하며 " +
        "'피해를 입었다/협박당했다/사기였다'처럼 결말을 먼저 밝혀서는 안 된다.",
    ),
});

const SolverSchema = z.object({
  answer: z.enum(["fraud", "safe"]).describe("이 상황이 위험한(fraud) 상황인지 안전한(safe) 상황인지 판단"),
  reasoning: z.string().describe("판단 근거를 1~2문장으로"),
});

const VerifierSchema = z.object({
  verdict: z.enum(["pass", "fail"]).describe(
    "주장된 정답이 여전히 타당하면 pass, 실제 알려진 사기 수법 패턴과 겹쳐 정답이 의심스러우면 fail",
  ),
  reason: z.string().describe("어떤 실제 사기 패턴과 겹치는지/안 겹치는지 구체적 근거, 2~3문장"),
});

let client;
function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았어요. web/.env.local을 확인하세요.");
  }
  client = new Anthropic({ apiKey });
  return client;
}

const SELF_CHECK_INSTRUCTIONS =
  "최종안을 내놓기 전에 스스로 다음 세 가지를 반드시 점검하세요: " +
  "(1) 제시할 정답이 본문에 실제로 등장하는 구체적 단서로 뒷받침되는가(근거 없이 정답만 우기는 게 아닌가), " +
  "(2) 결과가 확정되기 전 판단이 필요한 시점에서 끝나는 구조를 지켰는가, " +
  "(3) 정보가 서로 모순되거나 아예 답을 낼 수 없게 불공정한 트릭 문제가 되지는 않았는가(어렵되 풀 수는 있어야 함). " +
  "이번 변형은 일부러 더 헷갈리게 — 그럴듯한 안심 요소나 방심 포인트를 넣어 — 난이도를 높여서 만들어주세요.";

async function generateCandidate(scenario) {
  const message = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 1536,
    thinking: { type: "enabled", budget_tokens: 1024 },
    system: FRAUD_GUARD_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `다음 사기 유형(${scenario.type}) 시나리오를 다른 등장인물·표현으로 변형해줘.\n\n` +
          `[원본 제목] ${scenario.title}\n[원본 상황] ${scenario.content}\n[원본 정답] ${scenario.answer}\n` +
          `[원본 근거] ${scenario.explanation}\n\n` +
          "핵심 수법 패턴과 '판단 시점에서 끝난다'는 구조는 그대로 유지하고, " +
          `문장 길이는 원본과 비슷하게 유지해줘.\n\n${SELF_CHECK_INSTRUCTIONS}`,
      },
    ],
    output_config: { format: zodOutputFormat(CardVariantSchema) },
  });
  if (!message.parsed_output) throw new Error("생성 에이전트가 구조화된 출력을 반환하지 않았어요.");
  return message.parsed_output;
}

async function verifyCandidate(candidate, scenario) {
  const message = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "enabled", budget_tokens: 768 },
    system:
      "당신은 금융 사기 예방 전문가입니다. 사기 판별 퀴즈 서비스에 올릴 후보 카드를 검토해, " +
      "생성 에이전트가 주장한 정답이 실제로 타당한지 판정하세요. 단순히 '위험해 보인다/안전해 보인다'는 " +
      "인상이 아니라, 카드 내용이 실제로 알려진 사기 수법 패턴(스미싱 템플릿, 가짜쇼핑몰 사업자정보 도용, " +
      "로맨스스캠·계정도용 등)과 겹치는지 구체적으로 판단해야 합니다. 근거로 제시된 사실이 실제로는 " +
      "안전을 보증하지 못하는 경우(예: 사업자정보 도용, 실제 주문정보 유출을 악용한 스피어 스미싱)도 " +
      "찾아내세요.",
    messages: [
      {
        role: "user",
        content:
          `[유형] ${scenario.type}\n[형식] ${scenario.format}\n` +
          `[제목] ${candidate.title}\n[내용] ${candidate.content}\n` +
          `[주장된 정답] ${scenario.answer}\n[주장된 근거] ${scenario.explanation}\n\n` +
          "이 내용에서 묘사되는 패턴이 실제로 알려진 사기 수법과 겹쳐서 주장된 정답이 의심스러운지, " +
          "아니면 여전히 타당한지 판정해줘.",
      },
    ],
    output_config: { format: zodOutputFormat(VerifierSchema) },
  });
  if (!message.parsed_output) throw new Error("검증 에이전트가 구조화된 출력을 반환하지 않았어요.");
  return message.parsed_output;
}

async function solve(candidate, format) {
  const message = await getClient().messages.parse({
    model: SOLVER_MODEL,
    max_tokens: 300,
    thinking: { type: "disabled" },
    system:
      "당신은 바쁘게 스마트폰을 보다가 이 상황(형식: " +
      format +
      ")을 몇 초 안에 훑어보고 넘어가려는 실제 이용자입니다. " +
      "도메인 철자를 한 글자씩 대조하거나, 문장을 다시 읽으며 논리적으로 단서를 찾으려 하지 마세요 — " +
      "실제 사람들이 그러듯 전체적인 인상과 눈에 확 띄는 것만 보고 첫 직감으로만 판단하세요. " +
      "정답을 미리 알려주는 정보는 전혀 없습니다.",
    messages: [
      {
        role: "user",
        content: `[제목] ${candidate.title}\n[상황] ${candidate.content}`,
      },
    ],
    output_config: { format: zodOutputFormat(SolverSchema) },
  });
  if (!message.parsed_output) throw new Error("풀이 에이전트가 구조화된 출력을 반환하지 않았어요.");
  return message.parsed_output;
}

async function validateScenario(scenario) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = await generateCandidate(scenario);

    const verification = await verifyCandidate(candidate, scenario);
    if (verification.verdict === "fail") {
      console.log(`  [FAIL-VERIFY] attempt ${attempt}/${MAX_ATTEMPTS} — ${verification.reason}`);
      continue;
    }

    const verdict = await solve(candidate, scenario.format);
    if (verdict.answer !== scenario.answer) {
      console.log(
        `  [OK] attempt ${attempt}/${MAX_ATTEMPTS} — 난이도 확보(풀이=${verdict.answer} / 정답=${scenario.answer} 불일치)`,
      );
      return { verifiedTitle: candidate.title, verifiedContent: candidate.content };
    }
    console.log(`  [MISS] attempt ${attempt}/${MAX_ATTEMPTS} — 너무 쉬움(풀이 정답 일치), 폐기 후 재생성`);
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs();

  const raw = JSON.parse(fs.readFileSync(ROOT_DATA_PATH, "utf8"));
  let targets = raw.scenarios;
  if (opts.type) targets = targets.filter((s) => s.type === opts.type);
  if (opts.limit) targets = targets.slice(0, opts.limit);

  if (targets.length === 0) {
    console.log("검증 대상이 없습니다. --type 값을 확인하세요.");
    return;
  }

  console.log(`검증 대상: ${targets.length}개 시나리오\n`);

  let verifiedCount = 0;
  let failedIds = [];

  for (const [index, scenario] of targets.entries()) {
    console.log(`[${index + 1}/${targets.length}] ${scenario.id} (${scenario.type}/${scenario.format})`);
    const result = await validateScenario(scenario);
    if (result) {
      scenario.verifiedTitle = result.verifiedTitle;
      scenario.verifiedContent = result.verifiedContent;
      verifiedCount += 1;
    } else {
      delete scenario.verifiedTitle;
      delete scenario.verifiedContent;
      failedIds.push(scenario.id);
    }
  }

  const output = `${JSON.stringify(raw, null, 2)}\n`;
  fs.writeFileSync(ROOT_DATA_PATH, output);
  fs.writeFileSync(WEB_DATA_PATH, output);

  console.log(`\n완료: ${verifiedCount}/${targets.length}개 난이도 확보(서비스용 카드로 채택)`);
  if (failedIds.length > 0) {
    console.log(`미채택(계속 너무 쉬웠음, 사람 검토 필요): ${failedIds.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
