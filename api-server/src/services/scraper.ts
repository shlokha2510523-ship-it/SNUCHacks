import { openai } from "@workspace/integrations-openai-ai-server";
import { crawlWebsite, crawlInstagramPublic, crawlFacebookAdLibrary, type RawWebsiteData } from "./web-crawler.js";
import { crawlCache } from "./cache.js";

interface Company {
  id: number;
  name: string;
  website: string;
  instagramHandle?: string | null;
  facebookPage?: string | null;
  isUserCompany: boolean;
}

export interface ScrapeData {
  _meta: {
    crawledAt: string;
    websiteCrawled: boolean;
    socialCrawled: boolean;
    adsCrawled: boolean;
    reviewsAvailable: boolean;
    dataSource: "crawled" | "partial" | "unavailable";
  };
  website?: {
    loadTime: number;
    mobileScore: number;
    seoScore: number;
    designScore: number;
    ctaCount: number;
    pricingVisible: boolean;
    keyMessages: string[];
    topKeywords: string[];
  };
  social?: {
    instagramFollowers: number | null;
    instagramEngagementRate: number | null;
    postFrequency: number | null;
    avgLikes: number | null;
    avgComments: number | null;
    contentThemes: string[];
    bio: string;
    recentCaptions: string[];
    _note: string;
  };
  ads?: {
    activeAdsCount: number | null;
    adFormats: string[];
    avgAdDuration: number | null;
    primaryMessage: string;
    callToAction: string;
    estimatedSpend: string;
    adExamples: string[];
    _note: string;
  };
  features?: {
    batteryScore: number;
    cameraScore: number;
    gamingScore: number;
    durabilityScore: number;
    sustainabilityScore: number;
    aiFeatureScore: number;
    priceRange: string;
    discounts: string;
    marketPositioning: string;
  };
  reviews?: {
    averageRating: number | null;
    totalReviews: number | null;
    ratingDistribution: { "5": number; "4": number; "3": number; "2": number; "1": number } | null;
    commonComplaints: string[];
    positiveHighlights: string[];
    frequentlyMentionedFeatures: string[];
    sentimentScore: number | null;
    recentReviewSamples: string[];
    _note: string;
  };
}

export async function scrapeAllCompanies(
  companies: Company[]
): Promise<Array<{ companyId: number; companyName: string; data: ScrapeData }>> {
  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const data = await scrapeCompanyRealData(company);
        return { companyId: company.id, companyName: company.name, data };
      } catch {
        return { companyId: company.id, companyName: company.name, data: buildUnavailableData() };
      }
    })
  );
  return results;
}

async function scrapeCompanyRealData(company: Company): Promise<ScrapeData> {
  const cacheKey = `scrape:${company.website}`;
  const cached = crawlCache.get(cacheKey);
  if (cached) return cached;

  // Step 1: Crawl website in parallel with Instagram
  const [rawWebsite, rawSocial, rawAds] = await Promise.all([
    crawlWebsite(company.website).catch(() => null),
    company.instagramHandle
      ? crawlInstagramPublic(company.instagramHandle).catch(() => null)
      : Promise.resolve(null),
    crawlFacebookAdLibrary(company.name, company.facebookPage ?? undefined).catch(() => null),
  ]);

  // Step 2: Use AI to structure the REAL crawled content
  const structuredData = await structureCrawledData(company, rawWebsite, rawSocial);

  const result: ScrapeData = {
    _meta: {
      crawledAt: new Date().toISOString(),
      websiteCrawled: rawWebsite?.fetchSuccess ?? false,
      socialCrawled: rawSocial?.fetchSuccess ?? false,
      adsCrawled: false,
      reviewsAvailable: false,
      dataSource: rawWebsite?.fetchSuccess ? "crawled" : "partial",
    },
    website: structuredData.website,
    social: structuredData.social,
    ads: buildAdsFromCrawledContext(rawWebsite, rawSocial, rawAds),
    features: structuredData.features,
    reviews: {
      averageRating: null,
      totalReviews: null,
      ratingDistribution: null,
      commonComplaints: [],
      positiveHighlights: [],
      frequentlyMentionedFeatures: structuredData.features
        ? Object.keys(
            Object.fromEntries(
              (["battery", "camera", "gaming", "durability", "sustainability", "ai"] as const).filter((k) => {
                const key = `${k}Score` as keyof typeof structuredData.features;
                return structuredData.features && (structuredData.features as any)[key] >= 60;
              }).map((k) => [k, true])
            )
          )
        : [],
      sentimentScore: null,
      recentReviewSamples: [],
      _note: "Google Reviews integration requires a Google Places API key. Real review data is unavailable.",
    },
  };

  crawlCache.set(cacheKey, result);
  return result;
}

async function structureCrawledData(
  company: Company,
  rawWebsite: RawWebsiteData | null,
  rawSocial: any | null
): Promise<{
  website?: ScrapeData["website"];
  social?: ScrapeData["social"];
  features?: ScrapeData["features"];
}> {
  const websiteContext = rawWebsite?.fetchSuccess
    ? `REAL CRAWLED DATA from ${company.website}:
Title: ${rawWebsite.title}
Meta Description: ${rawWebsite.metaDescription}
Meta Keywords: ${rawWebsite.metaKeywords}
H1 Tags: ${rawWebsite.h1Tags.join(" | ")}
H2 Tags: ${rawWebsite.h2Tags.join(" | ")}
H3 Tags: ${rawWebsite.h3Tags.join(" | ")}
Nav Links: ${rawWebsite.navLinks.join(", ")}
CTA Buttons Found: ${rawWebsite.ctaTexts.join(", ")}
CTA Count: ${rawWebsite.ctaCount}
Pricing Page Found: ${rawWebsite.pricingPageFound}
Price Mentions Extracted: ${rawWebsite.pricingMentions.join(", ")}
Mobile Viewport Tag: ${rawWebsite.hasMobileViewport}
Has Canonical Tag: ${rawWebsite.hasCanonical}
Meta Robots: ${rawWebsite.metaRobotsContent}
Schema.org Types: ${rawWebsite.schemaTypes.join(", ")}
OG Data: ${JSON.stringify(rawWebsite.openGraphData)}
Feature Keywords Found in Page: ${rawWebsite.featureMentions.join(", ")}
Top Word Frequencies: ${rawWebsite.wordFrequencies.slice(0, 15).map((w) => `${w.word}(${w.count})`).join(", ")}
Product Page Links Found: ${rawWebsite.productPageHints.join(", ")}
Page Load Time (ms): ${rawWebsite.fetchTimeMs}
Status Code: ${rawWebsite.statusCode}
Page Body Excerpt (first 2000 chars):
${rawWebsite.bodyText.slice(0, 2000)}`
    : `Website crawl FAILED for ${company.website}. Only company name "${company.name}" is known.`;

  const socialContext = rawSocial?.fetchSuccess
    ? `Instagram public OG data for @${rawSocial.handle}:
OG Title: ${rawSocial.ogTitle}
OG Description: ${rawSocial.ogDescription}`
    : company.instagramHandle
    ? `Instagram public data unavailable for @${company.instagramHandle} (blocked by Instagram)`
    : "No Instagram handle provided";

  const prompt = `You are a marketing data analyst. You are given REAL crawled data from a company's website.
Your job is to STRUCTURE this data into a schema — you must ONLY use what is actually present in the crawled data.
Do NOT invent scores, messages, or keywords that aren't supported by the crawled content.
For numeric scores (0-100), derive them logically from what IS present (e.g. presence of mobile viewport = higher mobile score).

Company: ${company.name}
Website: ${company.website}

${websiteContext}

${socialContext}

Based ONLY on the above crawled data, return a JSON object with this structure:

{
  "website": {
    "loadTime": <actual ms divided by 1000 as seconds, e.g. ${rawWebsite?.fetchTimeMs ? (rawWebsite.fetchTimeMs / 1000).toFixed(1) : "null"}>,
    "mobileScore": <0-100 derived from: hasMobileViewport=${rawWebsite?.hasMobileViewport}, presence of responsive CSS signals in body>,
    "seoScore": <0-100 derived from: metaDescription presence=${!!rawWebsite?.metaDescription}, hasCanonical=${rawWebsite?.hasCanonical}, h1Count=${rawWebsite?.h1Tags.length ?? 0}, metaKeywords=${!!rawWebsite?.metaKeywords}>,
    "designScore": <0-100 derived from: schemaTypes, ogData completeness, heading structure quality>,
    "ctaCount": ${rawWebsite?.ctaCount ?? 0},
    "pricingVisible": ${rawWebsite?.pricingPageFound ?? false},
    "keyMessages": [<ONLY use text from actual h1Tags, h2Tags, ogTitle/description — max 5 items, real quotes>],
    "topKeywords": [<ONLY use words from wordFrequencies and metaKeywords — max 8 items>]
  },
  "social": {
    "instagramFollowers": null,
    "instagramEngagementRate": null,
    "postFrequency": null,
    "avgLikes": null,
    "avgComments": null,
    "contentThemes": [<derive from Instagram OG description and website content themes if available — max 4>],
    "bio": "<use Instagram ogDescription if available, else derive from metaDescription or ogDescription from website>",
    "recentCaptions": [],
    "_note": "Live social metrics unavailable without authenticated API. Themes derived from crawled content."
  },
  "features": {
    "batteryScore": <0-100: score ONLY if "battery" appears in featureMentions or bodyText; else 50>,
    "cameraScore": <0-100: score ONLY if "camera" appears; else 50>,
    "gamingScore": <0-100: score ONLY if "gaming" or "game" appears; else 50>,
    "durabilityScore": <0-100: score ONLY if "durable", "waterproof", "rugged" appears; else 50>,
    "sustainabilityScore": <0-100: score ONLY if "sustainab", "eco", "recycle", "carbon" appears; else 40>,
    "aiFeatureScore": <0-100: score ONLY if "ai", "artificial intelligence", "machine learning", "neural" appears; else 40>,
    "priceRange": "<ONLY use actual price mentions like ${rawWebsite?.pricingMentions.slice(0, 3).join(", ") || "N/A"}; if none found write 'Not publicly listed'>",
    "discounts": "<derive ONLY from actual crawled text — look for sale, discount, off, promo keywords; else 'Not specified'>",
    "marketPositioning": "<derive from price range and messaging tone: premium/mid-range/budget/gaming/enterprise>"
  }
}

CRITICAL RULES:
- keyMessages MUST be real text from the crawled headings or OG data — not invented marketing copy
- topKeywords MUST come from actual wordFrequencies or metaKeywords — not made up
- priceRange MUST use actual price values found in pricingMentions — if none, write "Not publicly listed"
- All null values for social metrics are correct — do not replace with invented numbers
- If website crawl failed, set all website scores to 50 and keyMessages/topKeywords to []`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return buildStructuredFallback(rawWebsite);
  }
}

function buildAdsFromCrawledContext(
  rawWebsite: RawWebsiteData | null,
  rawSocial: any | null,
  rawAds: any | null
): ScrapeData["ads"] {
  // Derive minimal ad context from crawled website CTAs/messaging
  const primaryMessage = rawWebsite?.h1Tags[0] ?? rawWebsite?.openGraphData?.["description"] ?? "";
  const callToAction = rawWebsite?.ctaTexts[0] ?? "";

  return {
    activeAdsCount: null,
    adFormats: [],
    avgAdDuration: null,
    primaryMessage: primaryMessage.slice(0, 200),
    callToAction: callToAction.slice(0, 80),
    estimatedSpend: "Unavailable",
    adExamples: [],
    _note:
      "Facebook Ad Library requires OAuth credentials. Ad spend and active ad counts are unavailable. Primary message derived from crawled website headline.",
  };
}

function buildStructuredFallback(rawWebsite: RawWebsiteData | null): {
  website?: ScrapeData["website"];
  social?: ScrapeData["social"];
  features?: ScrapeData["features"];
} {
  if (!rawWebsite?.fetchSuccess) {
    return {
      website: {
        loadTime: 0,
        mobileScore: 50,
        seoScore: 50,
        designScore: 50,
        ctaCount: 0,
        pricingVisible: false,
        keyMessages: [],
        topKeywords: [],
      },
      social: {
        instagramFollowers: null,
        instagramEngagementRate: null,
        postFrequency: null,
        avgLikes: null,
        avgComments: null,
        contentThemes: [],
        bio: "",
        recentCaptions: [],
        _note: "Website crawl failed. Social data unavailable.",
      },
      features: {
        batteryScore: 50,
        cameraScore: 50,
        gamingScore: 50,
        durabilityScore: 50,
        sustainabilityScore: 40,
        aiFeatureScore: 40,
        priceRange: "Not publicly listed",
        discounts: "Not specified",
        marketPositioning: "Unknown",
      },
    };
  }

  return {
    website: {
      loadTime: parseFloat((rawWebsite.fetchTimeMs / 1000).toFixed(1)),
      mobileScore: rawWebsite.hasMobileViewport ? 70 : 40,
      seoScore: [rawWebsite.metaDescription, rawWebsite.hasCanonical, rawWebsite.h1Tags.length > 0]
        .filter(Boolean).length * 25 + 25,
      designScore: rawWebsite.openGraphData?.["image"] ? 70 : 55,
      ctaCount: rawWebsite.ctaCount,
      pricingVisible: rawWebsite.pricingPageFound,
      keyMessages: rawWebsite.h1Tags.slice(0, 3),
      topKeywords: rawWebsite.wordFrequencies.slice(0, 8).map((w) => w.word),
    },
    social: {
      instagramFollowers: null,
      instagramEngagementRate: null,
      postFrequency: null,
      avgLikes: null,
      avgComments: null,
      contentThemes: [],
      bio: rawWebsite.metaDescription.slice(0, 150),
      recentCaptions: [],
      _note: "AI structuring failed. Minimal data derived directly from crawled content.",
    },
    features: {
      batteryScore: rawWebsite.featureMentions.includes("battery") ? 65 : 50,
      cameraScore: rawWebsite.featureMentions.includes("camera") ? 65 : 50,
      gamingScore: rawWebsite.featureMentions.includes("gaming") ? 65 : 50,
      durabilityScore: rawWebsite.featureMentions.some((f) => ["waterproof", "durable"].includes(f)) ? 65 : 50,
      sustainabilityScore: rawWebsite.featureMentions.some((f) => ["sustainability"].includes(f)) ? 60 : 40,
      aiFeatureScore: rawWebsite.featureMentions.includes("ai") ? 65 : 40,
      priceRange: rawWebsite.pricingMentions.slice(0, 2).join(" - ") || "Not publicly listed",
      discounts: "Not specified",
      marketPositioning: "Unknown",
    },
  };
}

function buildUnavailableData(): ScrapeData {
  return {
    _meta: {
      crawledAt: new Date().toISOString(),
      websiteCrawled: false,
      socialCrawled: false,
      adsCrawled: false,
      reviewsAvailable: false,
      dataSource: "unavailable",
    },
    website: {
      loadTime: 0,
      mobileScore: 50,
      seoScore: 50,
      designScore: 50,
      ctaCount: 0,
      pricingVisible: false,
      keyMessages: [],
      topKeywords: [],
    },
    social: {
      instagramFollowers: null,
      instagramEngagementRate: null,
      postFrequency: null,
      avgLikes: null,
      avgComments: null,
      contentThemes: [],
      bio: "",
      recentCaptions: [],
      _note: "Data collection failed entirely for this company.",
    },
    ads: {
      activeAdsCount: null,
      adFormats: [],
      avgAdDuration: null,
      primaryMessage: "",
      callToAction: "",
      estimatedSpend: "Unavailable",
      adExamples: [],
      _note: "Data collection failed.",
    },
    reviews: {
      averageRating: null,
      totalReviews: null,
      ratingDistribution: null,
      commonComplaints: [],
      positiveHighlights: [],
      frequentlyMentionedFeatures: [],
      sentimentScore: null,
      recentReviewSamples: [],
      _note: "Data collection failed.",
    },
    features: {
      batteryScore: 50,
      cameraScore: 50,
      gamingScore: 50,
      durabilityScore: 50,
      sustainabilityScore: 40,
      aiFeatureScore: 40,
      priceRange: "Unknown",
      discounts: "Unknown",
      marketPositioning: "Unknown",
    },
  };
}
