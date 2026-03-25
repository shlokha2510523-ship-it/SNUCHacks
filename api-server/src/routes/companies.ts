import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companySetsTable,
  companiesTable,
  analysisResultsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { analyzeCompetitiveData } from "../services/ai-analysis.js";
import { scrapeAllCompanies } from "../services/scraper.js";
import { generateTimeline } from "../services/timeline-service.js";

const router: IRouter = Router();

const CompanyInputSchema = z.object({
  name: z.string().min(1),
  website: z.string().url(),
  instagramHandle: z.string().optional(),
  facebookPage: z.string().optional(),
});

const CreateCompanySetSchema = z.object({
  name: z.string().min(1),
  userCompany: CompanyInputSchema,
  competitors: z.array(CompanyInputSchema).min(1).max(4),
});

router.get("/", async (req, res) => {
  try {
    const sets = await db.select().from(companySetsTable).orderBy(companySetsTable.createdAt);
    const result = await Promise.all(
      sets.map(async (set) => {
        const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, set.id));
        const userCompany = companies.find((c) => c.isUserCompany);
        const competitors = companies.filter((c) => !c.isUserCompany);
        return {
          id: set.id,
          name: set.name,
          status: set.status,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt,
          userCompany: userCompany ? mapCompany(userCompany) : null,
          competitors: competitors.map(mapCompany),
        };
      })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list companies");
    res.status(500).json({ error: "Failed to list company sets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateCompanySetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { name, userCompany, competitors } = parsed.data;

    const [set] = await db.insert(companySetsTable).values({ name, status: "pending" }).returning();

    const [uc] = await db
      .insert(companiesTable)
      .values({
        companySetId: set.id,
        name: userCompany.name,
        website: userCompany.website,
        instagramHandle: userCompany.instagramHandle ?? null,
        facebookPage: userCompany.facebookPage ?? null,
        isUserCompany: true,
      })
      .returning();

    const competitorRecords = await db
      .insert(companiesTable)
      .values(
        competitors.map((c) => ({
          companySetId: set.id,
          name: c.name,
          website: c.website,
          instagramHandle: c.instagramHandle ?? null,
          facebookPage: c.facebookPage ?? null,
          isUserCompany: false,
        }))
      )
      .returning();

    res.status(201).json({
      id: set.id,
      name: set.name,
      status: set.status,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
      userCompany: mapCompany(uc),
      competitors: competitorRecords.map(mapCompany),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create company set");
    res.status(500).json({ error: "Failed to create company set" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.select().from(companySetsTable).where(eq(companySetsTable.id, id));
    if (!set) { res.status(404).json({ error: "Not found" }); return; }

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, id));
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    const userCompany = companies.find((c) => c.isUserCompany);
    const competitors = companies.filter((c) => !c.isUserCompany);

    res.json({
      id: set.id,
      name: set.name,
      status: set.status,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
      userCompany: userCompany ? mapCompany(userCompany) : null,
      competitors: competitors.map(mapCompany),
      analysis: analysis ? mapAnalysis(analysis) : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get company set");
    res.status(500).json({ error: "Failed to get company set" });
  }
});

router.post("/:id/scrape", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.select().from(companySetsTable).where(eq(companySetsTable.id, id));
    if (!set) { res.status(404).json({ error: "Not found" }); return; }

    await db.update(companySetsTable).set({ status: "scraping", updatedAt: new Date() }).where(eq(companySetsTable.id, id));

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, id));
    const scrapeResults = await scrapeAllCompanies(companies);

    for (const result of scrapeResults) {
      await db.update(companiesTable).set({ scrapeData: result.data as any }).where(eq(companiesTable.id, result.companyId));
    }

    await db.update(companySetsTable).set({ status: "analyzing", updatedAt: new Date() }).where(eq(companySetsTable.id, id));

    res.json({
      companiesProcessed: scrapeResults.length,
      results: scrapeResults.map((r) => ({
        companyId: r.companyId,
        companyName: r.companyName,
        website: (r.data as any)?.website,
        social: (r.data as any)?.social,
        ads: (r.data as any)?.ads,
        features: (r.data as any)?.features,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Scrape failed");
    await db.update(companySetsTable).set({ status: "error", updatedAt: new Date() }).where(eq(companySetsTable.id, parseInt(req.params.id)));
    res.status(500).json({ error: "Scraping failed" });
  }
});

router.post("/:id/analyze", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.select().from(companySetsTable).where(eq(companySetsTable.id, id));
    if (!set) { res.status(404).json({ error: "Not found" }); return; }

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, id));
    const userCompany = companies.find((c) => c.isUserCompany);
    const competitors = companies.filter((c) => !c.isUserCompany);

    await db.update(companySetsTable).set({ status: "analyzing", updatedAt: new Date() }).where(eq(companySetsTable.id, id));

    const analysisData = await analyzeCompetitiveData(userCompany!, competitors);

    const existing = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    if (existing.length > 0) {
      await db.update(analysisResultsTable).set({
        overallScore: Math.round(analysisData.overallScore),
        rank: analysisData.rank,
        totalCompanies: analysisData.totalCompanies,
        reasonsForFailure: analysisData.reasonsForFailure as any,
        missedOpportunities: analysisData.missedOpportunities as any,
        competitorInsights: analysisData.competitorInsights as any,
        rankings: analysisData.rankings as any,
        actionPlan: analysisData.actionPlan as any,
        trends: analysisData.trends as any,
        generatedAt: new Date(),
      }).where(eq(analysisResultsTable.companySetId, id));
    } else {
      await db.insert(analysisResultsTable).values({
        companySetId: id,
        overallScore: Math.round(analysisData.overallScore),
        rank: analysisData.rank,
        totalCompanies: analysisData.totalCompanies,
        reasonsForFailure: analysisData.reasonsForFailure as any,
        missedOpportunities: analysisData.missedOpportunities as any,
        competitorInsights: analysisData.competitorInsights as any,
        rankings: analysisData.rankings as any,
        actionPlan: analysisData.actionPlan as any,
        trends: analysisData.trends as any,
      });
    }

    await db.update(companySetsTable).set({ status: "complete", updatedAt: new Date() }).where(eq(companySetsTable.id, id));

    res.json({
      companySetId: id,
      overallScore: analysisData.overallScore,
      rank: analysisData.rank,
      totalCompanies: analysisData.totalCompanies,
      reasonsForFailure: analysisData.reasonsForFailure,
      missedOpportunities: analysisData.missedOpportunities,
      competitorInsights: analysisData.competitorInsights,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Analysis failed");
    await db.update(companySetsTable).set({ status: "error", updatedAt: new Date() }).where(eq(companySetsTable.id, parseInt(req.params.id)));
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.get("/:id/rankings", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    if (!analysis) { res.status(404).json({ error: "Analysis not found. Run analysis first." }); return; }
    const rankings = analysis.rankings as any;
    res.json({ companySetId: id, ...rankings });
  } catch (err) {
    req.log.error({ err }, "Failed to get rankings");
    res.status(500).json({ error: "Failed to get rankings" });
  }
});

router.get("/:id/action-plan", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    if (!analysis) { res.status(404).json({ error: "Analysis not found. Run analysis first." }); return; }
    const actionPlan = analysis.actionPlan as any;
    res.json({ companySetId: id, ...actionPlan });
  } catch (err) {
    req.log.error({ err }, "Failed to get action plan");
    res.status(500).json({ error: "Failed to get action plan" });
  }
});

router.get("/:id/trends", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    if (!analysis) { res.status(404).json({ error: "Analysis not found. Run analysis first." }); return; }
    const trends = analysis.trends as any;
    res.json({ companySetId: id, ...trends });
  } catch (err) {
    req.log.error({ err }, "Failed to get trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

router.get("/:id/timeline", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.select().from(companySetsTable).where(eq(companySetsTable.id, id));
    if (!set) { res.status(404).json({ error: "Not found" }); return; }
    if (set.status !== "complete") { res.status(400).json({ error: "Analysis not complete yet." }); return; }

    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));
    if (!analysis) { res.status(404).json({ error: "Analysis not found." }); return; }

    // Return cached timeline if available
    if (analysis.timeline) {
      res.json(analysis.timeline);
      return;
    }

    // Generate timeline and cache it
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, id));
    const companyInputs = companies.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      isUserCompany: c.isUserCompany,
      scrapeData: c.scrapeData,
    }));

    const timelineData = await generateTimeline(companyInputs);

    await db.update(analysisResultsTable)
      .set({ timeline: timelineData as any })
      .where(eq(analysisResultsTable.companySetId, id));

    res.json(timelineData);
  } catch (err) {
    req.log.error({ err }, "Failed to generate timeline");
    res.status(500).json({ error: "Failed to generate timeline" });
  }
});

router.post("/:id/quick-fix", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fixType, currentContent, tone } = req.body;
    const productName = currentContent;
    const productFeatures = tone;
    if (!fixType || !productName) {
      res.status(400).json({ error: "fixType and productName are required" });
      return;
    }

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.companySetId, id));
    const userCompany = companies.find((c) => c.isUserCompany);
    const competitors = companies.filter((c) => !c.isUserCompany);
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.companySetId, id));

    const competitorContentByType = competitors.map((c) => {
      const scrape = (c.scrapeData as any) ?? {};
      if (fixType === "ad_caption") {
        return `${c.name}: ads=[${(scrape.ads?.adExamples ?? []).join(" | ")}], primaryMsg="${scrape.ads?.primaryMessage ?? ""}", cta="${scrape.ads?.callToAction ?? ""}"`;
      } else if (fixType === "instagram_bio") {
        return `${c.name}: captions=[${(scrape.social?.recentCaptions ?? []).join(" | ")}], bio="${scrape.social?.bio ?? ""}", themes=[${(scrape.social?.contentThemes ?? []).join(", ")}]`;
      } else {
        return `${c.name}: headlines=[${(scrape.website?.keyMessages ?? []).join(" | ")}], keywords=[${(scrape.website?.topKeywords ?? []).join(", ")}]`;
      }
    }).join("\n");

    const trends = (analysis?.trends as any) ?? {};
    const industryTrends = (trends.industryTrends ?? [])
      .slice(0, 5)
      .map((t: any) => `- ${t.name}: ${t.description}`)
      .join("\n");
    const competitorTrends = (trends.competitorTrends ?? [])
      .map((t: any) => `- ${t.companyName}: shift="${t.recentShift}", style="${t.contentStyle}"`)
      .join("\n");
    const whitespace = (trends.whitespaceOpportunities ?? []).join(", ");

    const competitorInsights = ((analysis?.competitorInsights as any[]) ?? [])
      .map((ci: any) => `- ${ci.companyName}: style="${ci.marketingStyle}", differentiator="${ci.keyDifferentiator}", trend="${ci.trend}"`)
      .join("\n");

    const contentTypeDescriptions: Record<string, string> = {
      ad_caption: "short, punchy, high-conversion ad captions for paid ads (Facebook/Instagram/Google)",
      instagram_bio: "Instagram post headline + a brief creative idea for the post (format: HEADLINE // Creative idea: ...)",
      website_headline: "clean, impactful, brand-focused website hero headlines",
    };
    const outputDescription = contentTypeDescriptions[fixType] ?? "marketing copy";

    const userCompanyName = userCompany?.name ?? "the brand";
    const featuresText = productFeatures ? `Product features: ${productFeatures}` : "";

    const systemPrompt = `You are a world-class marketing copywriter for consumer electronics brands. You write platform-native, trend-aware copy that feels modern, bold, and human — never generic or robotic. You study what competitors do and craft content that outperforms them by being more specific, more emotional, or more clever.
Always return valid JSON with keys: improved (string), alternatives (array of exactly 4 strings), explanation (string).`;

    const userPrompt = `You are crafting ${outputDescription} for the brand "${userCompanyName}" promoting their product "${productName}".
${featuresText}

--- COMPETITOR CONTENT (${fixType}) ---
${competitorContentByType || "No competitor data available."}

--- INDUSTRY TRENDS ---
${industryTrends || "No trend data available."}

--- COMPETITOR MARKETING TRENDS ---
${competitorTrends || "No competitor trend data available."}

--- COMPETITOR INSIGHTS ---
${competitorInsights || "No insights available."}

--- WHITESPACE OPPORTUNITIES ---
${whitespace || "None identified."}

Instructions:
1. Study the competitor content above — identify their tone, keywords, and messaging angles.
2. Identify what's trending (bold AI messaging, sustainability, performance-first, lifestyle, etc.).
3. Generate content that beats competitors by being more specific, more emotionally resonant, or cleverly different.
4. Align with the whitespace opportunities where possible.
5. Highlight the product's actual features (${productFeatures || "as provided"}).
6. Make every output feel platform-native and modern — avoid clichés like "next-level" or "game-changer".

Return exactly this JSON:
{
  "improved": "<the single best output — the one you'd stake your reputation on>",
  "alternatives": ["<alt 1>", "<alt 2>", "<alt 3>", "<alt 4>"],
  "explanation": "<2-3 sentences: what trends you spotted, how you beat competitors, and why this approach wins>"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    res.json({
      original: productName,
      improved: parsed.improved ?? "",
      alternatives: parsed.alternatives ?? [],
      explanation: parsed.explanation ?? "",
    });
  } catch (err) {
    req.log.error({ err }, "Quick fix failed");
    res.status(500).json({ error: "Quick fix failed" });
  }
});

function mapCompany(c: any) {
  return {
    id: c.id,
    name: c.name,
    website: c.website,
    instagramHandle: c.instagramHandle,
    facebookPage: c.facebookPage,
    isUserCompany: c.isUserCompany,
  };
}

function mapAnalysis(a: any) {
  return {
    companySetId: a.companySetId,
    overallScore: a.overallScore,
    rank: a.rank,
    totalCompanies: a.totalCompanies,
    reasonsForFailure: a.reasonsForFailure ?? [],
    missedOpportunities: a.missedOpportunities ?? [],
    competitorInsights: a.competitorInsights ?? [],
    generatedAt: a.generatedAt,
  };
}

export default router;
