import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companySetsTable, companiesTable } from "@workspace/db";
import { discoverCompetitors } from "../services/company-discovery.js";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const { companyName } = req.body;

  if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
    res.status(400).json({ error: "companyName is required" });
    return;
  }

  try {
    req.log.info({ companyName }, "Auto-discovering competitors");

    const discovery = await discoverCompetitors(companyName.trim());

    const reportName = `${discovery.userCompany.name} — ${discovery.marketSegment} Analysis`;

    const [set] = await db
      .insert(companySetsTable)
      .values({ name: reportName, status: "pending" })
      .returning();

    const [uc] = await db
      .insert(companiesTable)
      .values({
        companySetId: set.id,
        name: discovery.userCompany.name,
        website: discovery.userCompany.website,
        instagramHandle: discovery.userCompany.instagramHandle || null,
        facebookPage: discovery.userCompany.facebookPage || null,
        isUserCompany: true,
      })
      .returning();

    const competitorRecords = await db
      .insert(companiesTable)
      .values(
        discovery.competitors.map((c) => ({
          companySetId: set.id,
          name: c.name,
          website: c.website,
          instagramHandle: c.instagramHandle || null,
          facebookPage: c.facebookPage || null,
          isUserCompany: false,
        }))
      )
      .returning();

    res.json({
      id: set.id,
      name: set.name,
      status: set.status,
      industry: discovery.industry,
      marketSegment: discovery.marketSegment,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
      userCompany: {
        id: uc.id,
        name: uc.name,
        website: uc.website,
        instagramHandle: uc.instagramHandle,
        facebookPage: uc.facebookPage,
        isUserCompany: true,
      },
      competitors: competitorRecords.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        instagramHandle: c.instagramHandle,
        facebookPage: c.facebookPage,
        isUserCompany: false,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Auto-discovery failed");
    res.status(500).json({ error: "Failed to discover competitors. Please try again." });
  }
});

export default router;
