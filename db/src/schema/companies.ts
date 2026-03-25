import { pgTable, text, serial, boolean, integer, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySetStatusEnum = pgEnum("company_set_status", ["pending", "scraping", "analyzing", "complete", "error"]);

export const companySetsTable = pgTable("company_sets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: companySetStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  companySetId: integer("company_set_id").notNull().references(() => companySetsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website").notNull(),
  instagramHandle: text("instagram_handle"),
  facebookPage: text("facebook_page"),
  isUserCompany: boolean("is_user_company").notNull().default(false),
  scrapeData: jsonb("scrape_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analysisResultsTable = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  companySetId: integer("company_set_id").notNull().references(() => companySetsTable.id, { onDelete: "cascade" }),
  overallScore: integer("overall_score").notNull().default(0),
  rank: integer("rank").notNull().default(1),
  totalCompanies: integer("total_companies").notNull().default(1),
  reasonsForFailure: jsonb("reasons_for_failure"),
  missedOpportunities: jsonb("missed_opportunities"),
  competitorInsights: jsonb("competitor_insights"),
  rankings: jsonb("rankings"),
  actionPlan: jsonb("action_plan"),
  trends: jsonb("trends"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertCompanySetSchema = createInsertSchema(companySetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true });
export const insertAnalysisResultSchema = createInsertSchema(analysisResultsTable).omit({ id: true, generatedAt: true });

export type CompanySet = typeof companySetsTable.$inferSelect;
export type Company = typeof companiesTable.$inferSelect;
export type AnalysisResult = typeof analysisResultsTable.$inferSelect;
export type InsertCompanySet = z.infer<typeof insertCompanySetSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;
