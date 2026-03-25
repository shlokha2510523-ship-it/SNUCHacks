import { openai } from "@workspace/integrations-openai-ai-server";

export interface TimelinePoint {
  month: string;
  monthKey: string;
  sentimentScore: number;
  reviewCount: number;
  positivePercent: number;
  negativePercent: number;
  adActivity: number;
  priceSignal: "stable" | "increased" | "decreased";
  keyEvent: string | null;
}

export interface CompanyTimeline {
  companyId: number;
  companyName: string;
  isUserCompany: boolean;
  websiteUrl: string;
  sentimentTrend: "improving" | "declining" | "stable";
  correlationInsights: string[];
  timeline: TimelinePoint[];
}

export interface TimelineData {
  companies: CompanyTimeline[];
  overallInsights: string[];
  dataNote: string;
  generatedAt: string;
}

interface CompanyInput {
  id: number;
  name: string;
  website: string;
  isUserCompany: boolean;
  scrapeData: any;
}

function getLast12Months(): Array<{ label: string; key: string }> {
  const result = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ label, key });
  }
  return result;
}

function buildDefaultTimeline(months: Array<{ label: string; key: string }>): TimelinePoint[] {
  return months.map((m) => ({
    month: m.label,
    monthKey: m.key,
    sentimentScore: 70,
    reviewCount: 200,
    positivePercent: 70,
    negativePercent: 15,
    adActivity: 50,
    priceSignal: "stable",
    keyEvent: null,
  }));
}

export async function generateTimeline(companies: CompanyInput[]): Promise<TimelineData> {
  const months = getLast12Months();

  const companySummaries = companies.map((c) => {
    const scrape = c.scrapeData ?? {};
    return `${c.name} (${c.website}):
  - Market positioning: ${scrape.features?.marketPositioning ?? "unknown"}
  - Price range: ${scrape.features?.priceRange ?? "unknown"}
  - Battery score: ${scrape.features?.batteryScore ?? 50}/100, Camera: ${scrape.features?.cameraScore ?? 50}/100, AI features: ${scrape.features?.aiFeatureScore ?? 50}/100
  - Key messages: ${(scrape.website?.keyMessages ?? []).join("; ") || "none"}
  - Discounts: ${scrape.features?.discounts ?? "not specified"}
  - Is user company: ${c.isUserCompany}`;
  }).join("\n\n");

  const monthLabels = months.map((m) => m.label).join(", ");

  const prompt = `You are a consumer electronics market analyst with expertise in brand sentiment tracking.

Generate a realistic 12-month review sentiment and marketing activity timeline for each of these companies. Base it on your knowledge of the consumer electronics industry, known product launches, pricing changes, and market events over the period.

Companies:
${companySummaries}

Months to generate (oldest to newest): ${monthLabels}

For EACH company AND EACH month, generate:
- sentimentScore: 0-100 (customer sentiment; spikes around successful launches, drops after pricing hikes, competitor launches, or controversies)
- reviewCount: estimated number of new reviews that month (range: 100-8000 for major brands, smaller for niche brands)
- positivePercent: 0-100 (% of reviews positive — should correlate with sentimentScore)
- negativePercent: 0-100 (% of reviews negative — positivePercent + negativePercent ≤ 100)
- adActivity: 0-100 (advertising intensity — high around Q4 holidays, product launches, price wars)
- priceSignal: "stable" | "increased" | "decreased"
- keyEvent: a short 1-sentence description of something notable that month (e.g. "Launched Galaxy S24 series", "Cut mid-range prices 12%", "Battery recall affected sentiment"), or null

Also generate per company:
- sentimentTrend: "improving" | "declining" | "stable" (compare last 3 months vs first 3 months)
- correlationInsights: 3-5 specific observations such as "March price increase correlated with a 14-point sentiment drop over the following 2 months" or "Heavy Q4 ad spend in November boosted positive reviews by 18%"

And overall across all companies:
- overallInsights: 4-6 cross-company insights such as "Samsung's aggressive Q1 campaign coincided with Apple's sentiment dipping 11 points" or "Both mid-range brands saw sharp sentiment drops in June following a shared supply chain issue"

Make data realistic and historically plausible. Show natural variance month-to-month. Major brands should have higher review volumes. Product launches should spike ad activity and initially boost, then normalize sentiment.

Return ONLY a JSON object with EXACTLY this structure:
{
  "companies": [
    {
      "companyId": <number — match the companyId provided>,
      "companyName": "<exact company name>",
      "isUserCompany": <boolean>,
      "sentimentTrend": "<improving|declining|stable>",
      "correlationInsights": ["<insight>", ...],
      "timeline": [
        {
          "month": "<e.g. Mar 2024>",
          "monthKey": "<e.g. 2024-03>",
          "sentimentScore": <number 0-100>,
          "reviewCount": <number>,
          "positivePercent": <number 0-100>,
          "negativePercent": <number 0-100>,
          "adActivity": <number 0-100>,
          "priceSignal": "<stable|increased|decreased>",
          "keyEvent": <string or null>
        }
      ]
    }
  ],
  "overallInsights": ["<insight>", ...]
}

The timeline array for each company must have exactly ${months.length} entries, one per month listed.
Company IDs to use: ${companies.map((c) => `${c.name} → id ${c.id}`).join(", ")}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");

    const mappedCompanies: CompanyTimeline[] = (raw.companies ?? []).map((rc: any) => {
      const original = companies.find((c) => c.id === rc.companyId || c.name === rc.companyName);
      if (!original) return null;

      const timelinePoints: TimelinePoint[] = months.map((m, idx) => {
        const pt = rc.timeline?.[idx] ?? {};
        return {
          month: m.label,
          monthKey: m.key,
          sentimentScore: typeof pt.sentimentScore === "number" ? Math.max(0, Math.min(100, pt.sentimentScore)) : 70,
          reviewCount: typeof pt.reviewCount === "number" ? Math.max(0, pt.reviewCount) : 200,
          positivePercent: typeof pt.positivePercent === "number" ? Math.max(0, Math.min(100, pt.positivePercent)) : 68,
          negativePercent: typeof pt.negativePercent === "number" ? Math.max(0, Math.min(100, pt.negativePercent)) : 15,
          adActivity: typeof pt.adActivity === "number" ? Math.max(0, Math.min(100, pt.adActivity)) : 50,
          priceSignal: ["stable", "increased", "decreased"].includes(pt.priceSignal) ? pt.priceSignal : "stable",
          keyEvent: typeof pt.keyEvent === "string" && pt.keyEvent.trim() ? pt.keyEvent.trim() : null,
        };
      });

      return {
        companyId: original.id,
        companyName: original.name,
        isUserCompany: original.isUserCompany,
        websiteUrl: original.website,
        sentimentTrend: ["improving", "declining", "stable"].includes(rc.sentimentTrend) ? rc.sentimentTrend : "stable",
        correlationInsights: Array.isArray(rc.correlationInsights) ? rc.correlationInsights.slice(0, 5) : [],
        timeline: timelinePoints,
      } as CompanyTimeline;
    }).filter(Boolean) as CompanyTimeline[];

    const missingIds = companies.filter((c) => !mappedCompanies.find((mc) => mc.companyId === c.id));
    for (const missing of missingIds) {
      mappedCompanies.push({
        companyId: missing.id,
        companyName: missing.name,
        isUserCompany: missing.isUserCompany,
        websiteUrl: missing.website,
        sentimentTrend: "stable",
        correlationInsights: [],
        timeline: buildDefaultTimeline(months),
      });
    }

    const userFirst = [...mappedCompanies].sort((a, b) => (b.isUserCompany ? 1 : 0) - (a.isUserCompany ? 1 : 0));

    return {
      companies: userFirst,
      overallInsights: Array.isArray(raw.overallInsights) ? raw.overallInsights.slice(0, 6) : [],
      dataNote: "Sentiment data is AI-synthesized based on each company's known market position, product launches, and consumer electronics industry patterns. Direct Trustpilot/review platform integration requires platform API credentials.",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      companies: companies.map((c) => ({
        companyId: c.id,
        companyName: c.name,
        isUserCompany: c.isUserCompany,
        websiteUrl: c.website,
        sentimentTrend: "stable",
        correlationInsights: [],
        timeline: buildDefaultTimeline(months),
      })),
      overallInsights: [],
      dataNote: "Timeline generation encountered an error. Showing estimated baseline data.",
      generatedAt: new Date().toISOString(),
    };
  }
}
