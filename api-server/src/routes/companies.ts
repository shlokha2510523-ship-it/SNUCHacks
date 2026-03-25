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

router.post("/:id/quick-fix", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fixType, currentContent, targetAudience, tone } = req.body;
    if (!fixType || !currentContent) {
      res.status(400).json({ error: "fixType and currentContent are required" });
      return;
    }

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const systemPrompt = `You are an expert marketing copywriter for consumer electronics brands. 
You specialize in crafting compelling, conversion-focused copy that stands out in a competitive market.
Always return a valid JSON object with keys: improved (string), alternatives (array of 3 strings), explanation (string).`;

    const userPrompt = `Fix type: ${fixType}
Current content: "${currentContent}"
${targetAudience ? `Target audience: ${targetAudience}` : ""}
${tone ? `Desired tone: ${tone}` : ""}

Improve this marketing copy to be more compelling, clear, and conversion-focused for a consumer electronics brand.
Return JSON with: { "improved": "...", "alternatives": ["...", "...", "..."], "explanation": "..." }`;

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
      original: currentContent,
      improved: parsed.improved ?? currentContent,
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
