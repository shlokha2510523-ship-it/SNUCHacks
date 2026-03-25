import { openai } from "@workspace/integrations-openai-ai-server";

// ─── Angle Definitions ──────────────────────────────────────────────────────

export interface AngleDefinition {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
}

export const POSITIONING_ANGLES: AngleDefinition[] = [
  {
    id: "ai",
    name: "AI / Smart Features",
    icon: "🤖",
    keywords: [
      "ai", "artificial intelligence", "machine learning", "smart", "intelligent",
      "neural", "gpt", "generative", "on-device ai", "copilot", "llm", "assistant",
      "voice assistant", "auto", "adaptive", "predictive",
    ],
  },
  {
    id: "battery",
    name: "Battery / Efficiency",
    icon: "🔋",
    keywords: [
      "battery", "power", "efficiency", "endurance", "mah", "charging",
      "long-lasting", "all-day", "fast charge", "quick charge", "wired", "wireless charge",
      "energy", "standby", "unplugged",
    ],
  },
  {
    id: "camera",
    name: "Camera / Imaging",
    icon: "📷",
    keywords: [
      "camera", "photography", "photo", "image", "lens", "megapixel", "mp",
      "optical zoom", "portrait", "night mode", "video", "4k", "8k", "cinematic",
      "sensor", "aperture", "stabilization",
    ],
  },
  {
    id: "performance",
    name: "Performance / Speed",
    icon: "⚡",
    keywords: [
      "performance", "speed", "fast", "processor", "chip", "cpu", "gpu",
      "fps", "benchmark", "lag-free", "smooth", "powerful", "flagship",
      "snapdragon", "dimensity", "apple silicon", "exynos",
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: "🎮",
    keywords: [
      "gaming", "game", "gamer", "esports", "e-sports", "refresh rate",
      "hdr", "haptic", "trigger", "controller", "joystick", "play",
      "144hz", "120hz", "rgb", "rog", "black shark",
    ],
  },
  {
    id: "premium",
    name: "Premium / Design",
    icon: "💎",
    keywords: [
      "premium", "luxury", "design", "aesthetic", "slim", "elegant", "thin",
      "titanium", "glass", "metal", "craftsmanship", "style", "beautiful",
      "iconic", "refined", "artisan", "sophisticated",
    ],
  },
  {
    id: "budget",
    name: "Budget / Value",
    icon: "💰",
    keywords: [
      "budget", "affordable", "value", "price", "cost", "deal", "cheap",
      "mid-range", "economy", "low-cost", "save", "best price", "discount",
      "promotion", "offer", "bang for buck",
    ],
  },
  {
    id: "sustainability",
    name: "Sustainability",
    icon: "🌱",
    keywords: [
      "sustainable", "eco", "environment", "green", "recycled", "carbon",
      "planet", "responsible", "ethical", "biodegradable", "renewable",
      "zero waste", "fair trade", "climate", "footprint",
    ],
  },
  {
    id: "durability",
    name: "Durability / Ruggedness",
    icon: "🛡️",
    keywords: [
      "durable", "rugged", "tough", "military grade", "water resistant",
      "waterproof", "drop proof", "shockproof", "ip68", "ip67", "scratch",
      "strong", "robust", "built to last", "lifetime",
    ],
  },
  {
    id: "privacy",
    name: "Privacy / Security",
    icon: "🔒",
    keywords: [
      "privacy", "security", "secure", "encrypted", "biometric", "face id",
      "fingerprint", "safe", "protection", "data privacy", "vpn", "trust",
      "confidential",
    ],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AngleResult {
  angleId: string;
  angleName: string;
  icon: string;
  competitorsUsing: string[];
  totalCompetitors: number;
  usageRatio: number;
  category: "overused" | "balanced" | "whitespace";
  userCompanyUsesIt: boolean;
  insight: string;
  opportunityOrRisk: string;
}

export interface PositioningAnalysisData {
  angles: AngleResult[];
  overused: AngleResult[];
  balanced: AngleResult[];
  whitespace: AngleResult[];
  summary: string;
  generatedAt: string;
}

interface CompanyInput {
  id: number;
  name: string;
  isUserCompany: boolean;
  scrapeData: any;
}

// ─── Text Extraction ─────────────────────────────────────────────────────────

function extractAllText(scrapeData: any): string {
  if (!scrapeData) return "";
  const parts: string[] = [];

  const website = scrapeData.website ?? {};
  parts.push(...(website.keyMessages ?? []));
  parts.push(...(website.topKeywords ?? []));

  const social = scrapeData.social ?? {};
  parts.push(...(social.contentThemes ?? []));
  parts.push(...(social.recentCaptions ?? []));
  if (social.bio) parts.push(social.bio);

  const ads = scrapeData.ads ?? {};
  if (ads.primaryMessage) parts.push(ads.primaryMessage);
  if (ads.callToAction) parts.push(ads.callToAction);
  parts.push(...(ads.adExamples ?? []));

  const features = scrapeData.features ?? {};
  if (features.marketPositioning) parts.push(features.marketPositioning);

  const reviews = scrapeData.reviews ?? {};
  parts.push(...(reviews.positiveHighlights ?? []));
  parts.push(...(reviews.frequentlyMentionedFeatures ?? []));
  parts.push(...(reviews.recentReviewSamples ?? []));

  return parts.join(" ").toLowerCase();
}

// ─── Classification ───────────────────────────────────────────────────────────

function companyUsesAngle(text: string, angle: AngleDefinition): boolean {
  return angle.keywords.some((kw) => text.includes(kw.toLowerCase()));
}

// ─── Insight Generation ───────────────────────────────────────────────────────

async function generateInsights(
  angles: Omit<AngleResult, "insight" | "opportunityOrRisk">[],
  allCompanyNames: string[],
  userCompanyName: string,
): Promise<{ angleId: string; insight: string; opportunityOrRisk: string }[]> {
  const summaries = angles.map((a) => ({
    angleId: a.angleId,
    angleName: a.angleName,
    category: a.category,
    competitorsUsing: a.competitorsUsing,
    totalCompetitors: a.totalCompetitors,
    usageRatio: (a.usageRatio * 100).toFixed(0) + "%",
    userCompanyUsesIt: a.userCompanyUsesIt,
  }));

  const prompt = `You are a strategic marketing analyst specializing in consumer electronics competitive positioning.

Based on the following positioning angle usage data, generate a concise, data-grounded one-sentence insight and a one-sentence actionable opportunity-or-risk statement for each angle.

User company: ${userCompanyName}
All brands analyzed: ${allCompanyNames.join(", ")}

Angle data:
${JSON.stringify(summaries, null, 2)}

Rules:
- "insight": 1 sentence describing the saturation or scarcity of this angle (e.g., "AI messaging is heavily saturated, used by 4 of 5 competitors.")
- "opportunityOrRisk": 1 sentence for the user company: opportunity if it's whitespace, risk or advice if overused (e.g., "Differentiating here is difficult — focus on a sub-angle like on-device AI privacy instead.")
- If userCompanyUsesIt=false and category=whitespace → strong opportunity signal
- If userCompanyUsesIt=true and category=overused → they are blending in, risk of commoditization
- Be specific and actionable. Do NOT mention being "unique" generically.
- Keep each sentence under 20 words.

Return ONLY a JSON array:
[
  { "angleId": "<id>", "insight": "<1 sentence>", "opportunityOrRisk": "<1 sentence>" },
  ...
]`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const arr = Array.isArray(raw) ? raw : (raw.angles ?? raw.results ?? []);
    return arr.filter((x: any) => x?.angleId && x?.insight);
  } catch {
    return [];
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function analyzePositioning(companies: CompanyInput[]): Promise<PositioningAnalysisData> {
  const competitors = companies.filter((c) => !c.isUserCompany);
  const userCompany = companies.find((c) => c.isUserCompany);

  const totalCompetitors = competitors.length;

  // Build text maps
  const companyTexts = new Map<number, string>();
  for (const c of companies) {
    companyTexts.set(c.id, extractAllText(c.scrapeData));
  }

  // Classify each angle
  const baseAngles: Omit<AngleResult, "insight" | "opportunityOrRisk">[] = POSITIONING_ANGLES.map((angle) => {
    const competitorsUsing = competitors
      .filter((c) => companyUsesAngle(companyTexts.get(c.id) ?? "", angle))
      .map((c) => c.name);

    const userUsesIt = userCompany
      ? companyUsesAngle(companyTexts.get(userCompany.id) ?? "", angle)
      : false;

    const usageRatio = totalCompetitors > 0 ? competitorsUsing.length / totalCompetitors : 0;

    let category: "overused" | "balanced" | "whitespace";
    if (usageRatio >= 0.6) category = "overused";
    else if (usageRatio >= 0.3) category = "balanced";
    else category = "whitespace";

    return {
      angleId: angle.id,
      angleName: angle.name,
      icon: angle.icon,
      competitorsUsing,
      totalCompetitors,
      usageRatio,
      category,
      userCompanyUsesIt: userUsesIt,
    };
  });

  // Generate insights
  const allCompanyNames = companies.map((c) => c.name);
  const userCompanyName = userCompany?.name ?? "Your company";
  const insightMap = await generateInsights(baseAngles, allCompanyNames, userCompanyName);

  const insightLookup = new Map(insightMap.map((x) => [x.angleId, x]));

  const angles: AngleResult[] = baseAngles.map((a) => {
    const ins = insightLookup.get(a.angleId);
    return {
      ...a,
      insight: ins?.insight ?? (
        a.category === "overused"
          ? `${a.angleName} messaging is used by ${a.competitorsUsing.length} of ${a.totalCompetitors} competitors.`
          : a.category === "whitespace"
          ? `${a.angleName} is largely untapped — only ${a.competitorsUsing.length} of ${a.totalCompetitors} competitors use it.`
          : `${a.angleName} has moderate adoption among competitors.`
      ),
      opportunityOrRisk: ins?.opportunityOrRisk ?? (
        a.category === "whitespace"
          ? "Strong differentiation opportunity — claim this space early."
          : a.category === "overused"
          ? "This angle is crowded; consider a distinctive sub-angle instead."
          : "Viable angle — executing it distinctively can still differentiate."
      ),
    };
  });

  const overused = angles.filter((a) => a.category === "overused");
  const balanced = angles.filter((a) => a.category === "balanced");
  const whitespace = angles.filter((a) => a.category === "whitespace");

  const summary =
    `${overused.length} saturated angles, ${balanced.length} contested, and ${whitespace.length} untapped whitespace opportunities identified across ${companies.length} brands.`;

  return {
    angles,
    overused,
    balanced,
    whitespace,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
