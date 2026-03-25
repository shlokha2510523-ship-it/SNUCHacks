import { openai } from "@workspace/integrations-openai-ai-server";
import { crawlWebsite, crawlInstagramPublic, type RawWebsiteData } from "./web-crawler.js";
import { fetchYouTubeAdsData } from "./youtube-ads.js";
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
    dataSource: "crawled" | "partial" | "ai_generated" | "unavailable";
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

function isCrawlMeaningful(raw: RawWebsiteData | null): boolean {
  if (!raw || !raw.fetchSuccess) return false;
  const hasHeadings = raw.h1Tags.length > 0 || raw.h2Tags.length > 0;
  const hasKeywords = raw.wordFrequencies.length > 0;
  const hasContent = raw.bodyText.length > 200;
  return hasHeadings || hasKeywords || hasContent;
}

async function scrapeCompanyRealData(company: Company): Promise<ScrapeData> {
  const cacheKey = `scrape:${company.website}`;
  const cached = crawlCache.get(cacheKey);
  if (cached) return cached;

  // Step 1: Crawl website, Instagram, and YouTube in parallel
  const [rawWebsite, rawSocial, rawYouTube] = await Promise.all([
    crawlWebsite(company.website).catch(() => null),
    company.instagramHandle
      ? crawlInstagramPublic(company.instagramHandle).catch(() => null)
      : Promise.resolve(null),
    fetchYouTubeAdsData(company.name, company.website).catch(() => null),
  ]);

  const crawlHasMeaningfulData = isCrawlMeaningful(rawWebsite);

  let result: ScrapeData;

  if (crawlHasMeaningfulData) {
    // Step 2a: Real path — structure the actual crawled content
    const structuredData = await structureCrawledData(company, rawWebsite, rawSocial);

    // Step 2b: Check if the structured website data is too sparse (0 CTAs, no key messages)
    // This happens when sites block crawlers but return a minimal HTML shell.
    // In that case, supplement the empty marketing fields with AI-generated estimates.
    let websiteData = structuredData.website;
    let dataSource: ScrapeData["_meta"]["dataSource"] = "crawled";

    if (isWebsiteDataSparse(websiteData, rawWebsite)) {
      const supplemented = await supplementSparseWebsiteData(company, websiteData, rawWebsite);
      websiteData = supplemented;
      dataSource = "partial";
    }

    result = {
      _meta: {
        crawledAt: new Date().toISOString(),
        websiteCrawled: true,
        socialCrawled: rawSocial?.fetchSuccess ?? false,
        adsCrawled: rawYouTube?.fetchSuccess ?? false,
        reviewsAvailable: false,
        dataSource,
      },
      website: websiteData,
      social: structuredData.social,
      ads: buildAdsFromYouTube(rawYouTube, rawWebsite),
      features: structuredData.features,
      reviews: buildUnavailableReviews(structuredData.features),
    };
  } else {
    // Step 2b: Crawl returned empty — fall back to AI-generated mock data
    const mockData = await generateAIMockData(company);

    result = {
      _meta: {
        crawledAt: new Date().toISOString(),
        websiteCrawled: false,
        socialCrawled: false,
        adsCrawled: rawYouTube?.fetchSuccess ?? false,
        reviewsAvailable: false,
        dataSource: "ai_generated",
      },
      website: mockData.website,
      social: mockData.social,
      // Still use real YouTube ads if we got them, even when website crawl failed
      ads: rawYouTube?.fetchSuccess
        ? buildAdsFromYouTube(rawYouTube, null)
        : mockData.ads,
      features: mockData.features,
      reviews: mockData.reviews,
    };
  }

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

/**
 * Returns true when the structured website data is too sparse to be useful.
 * This catches sites that return some HTML but block meaningful content —
 * e.g. JS-rendered SPAs, bot-detection walls, or near-empty splash pages.
 */
function isWebsiteDataSparse(
  website: ScrapeData["website"] | undefined,
  rawWebsite: RawWebsiteData | null
): boolean {
  if (!website) return true;
  const hasNoCtas = website.ctaCount === 0;
  const hasNoMessages = (website.keyMessages ?? []).length === 0;
  const hasNoKeywords = (website.topKeywords ?? []).length === 0;
  // Also check the raw crawl — if body text was tiny even though it "succeeded", treat as sparse
  const bodyTooShort = !rawWebsite || rawWebsite.bodyText.length < 400;
  return hasNoCtas && hasNoMessages && (hasNoKeywords || bodyTooShort);
}

/**
 * Supplements sparse website fields with AI-generated estimates.
 * Keeps the real crawl values for any field that is already populated
 * (load time, scores derived from real signals, pricing, etc.).
 */
async function supplementSparseWebsiteData(
  company: Company,
  existing: ScrapeData["website"] | undefined,
  rawWebsite: RawWebsiteData | null
): Promise<ScrapeData["website"]> {
  const prompt = `You are a consumer electronics marketing intelligence analyst.
The website crawler retrieved a page for "${company.name}" (${company.website}) but it returned minimal or no useful marketing content (0 CTAs, no key messages, no keyword data). This usually means the site uses JavaScript rendering or bot-protection.

Based on your knowledge of "${company.name}" as a consumer electronics brand, generate realistic estimates ONLY for the following missing marketing fields:
- ctaCount: How many CTA buttons would a real visit to their site typically show? (e.g. "Buy Now", "Learn More", "Compare")
- keyMessages: 3–5 short brand headlines or slogans you would expect on their homepage
- topKeywords: 6–8 keywords that reflect their actual product marketing
- pricingVisible: true/false — does this company typically show prices on their main website?

Return ONLY a JSON object with exactly these four keys:
{
  "ctaCount": <number>,
  "keyMessages": [<strings>],
  "topKeywords": [<strings>],
  "pricingVisible": <boolean>
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");

    return {
      loadTime: existing?.loadTime ?? 0,
      mobileScore: existing?.mobileScore ?? 70,
      seoScore: existing?.seoScore ?? 70,
      designScore: existing?.designScore ?? 70,
      ctaCount: raw.ctaCount ?? existing?.ctaCount ?? 5,
      pricingVisible: raw.pricingVisible ?? existing?.pricingVisible ?? false,
      keyMessages: raw.keyMessages?.length ? raw.keyMessages : (existing?.keyMessages ?? []),
      topKeywords: raw.topKeywords?.length ? raw.topKeywords : (existing?.topKeywords ?? []),
    };
  } catch {
    // If AI call fails, return existing data unchanged
    return existing ?? {
      loadTime: 0,
      mobileScore: 70,
      seoScore: 70,
      designScore: 70,
      ctaCount: 5,
      pricingVisible: false,
      keyMessages: [],
      topKeywords: [],
    };
  }
}

function buildAdsFromYouTube(
  yt: import("./youtube-ads.js").YouTubeAdsData | null,
  rawWebsite: RawWebsiteData | null
): ScrapeData["ads"] {
  if (yt?.fetchSuccess) {
    return {
      activeAdsCount: yt.recentAds.length,
      adFormats: yt.adFormats,
      avgAdDuration: null,
      primaryMessage: yt.primaryMessage || rawWebsite?.h1Tags[0] || "",
      callToAction: yt.callToAction || rawWebsite?.ctaTexts[0] || "",
      estimatedSpend: "Unavailable (YouTube API does not expose ad spend)",
      adExamples: yt.adExamples,
      _note: yt._note,
    };
  }

  // Fallback: minimal data from website crawl
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
    _note: yt?._note ?? "YouTube API unavailable. Minimal data from website crawl.",
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

function buildUnavailableReviews(features?: ScrapeData["features"]): ScrapeData["reviews"] {
  return {
    averageRating: null,
    totalReviews: null,
    ratingDistribution: null,
    commonComplaints: [],
    positiveHighlights: [],
    frequentlyMentionedFeatures: features
      ? (["battery", "camera", "gaming", "durability", "sustainability", "ai"] as const)
          .filter((k) => features && (features as any)[`${k}Score`] >= 60)
      : [],
    sentimentScore: null,
    recentReviewSamples: [],
    _note: "Google Reviews integration requires a Google Places API key. Real review data is unavailable.",
  };
}

async function generateAIMockData(company: Company): Promise<{
  website: ScrapeData["website"];
  social: ScrapeData["social"];
  ads: ScrapeData["ads"];
  features: ScrapeData["features"];
  reviews: ScrapeData["reviews"];
}> {
  const prompt = `You are a consumer electronics marketing intelligence analyst.
Generate realistic marketing data for the company "${company.name}" (website: ${company.website}).
This data should reflect what their real website, social media, and advertising would typically show.
Base your estimates on the company's known market position, products, and industry reputation.

Return a JSON object with EXACTLY this structure (no extra keys):
{
  "website": {
    "loadTime": <number, seconds, e.g. 0.8>,
    "mobileScore": <number 0-100>,
    "seoScore": <number 0-100>,
    "designScore": <number 0-100>,
    "ctaCount": <number>,
    "pricingVisible": <boolean>,
    "keyMessages": [<3-5 short brand slogans or headlines>],
    "topKeywords": [<6-8 keywords from their website>]
  },
  "social": {
    "instagramFollowers": <number or null>,
    "instagramEngagementRate": <number or null>,
    "postFrequency": <posts per week, number or null>,
    "avgLikes": <number or null>,
    "avgComments": <number or null>,
    "contentThemes": [<3-4 content themes>],
    "bio": "<one line bio>",
    "recentCaptions": [<2-3 realistic caption examples>]
  },
  "ads": {
    "activeAdsCount": <number>,
    "adFormats": [<formats like "Video", "Carousel", "Stories">],
    "avgAdDuration": <seconds or null>,
    "primaryMessage": "<main ad message>",
    "callToAction": "<CTA text>",
    "estimatedSpend": "<spend estimate string>",
    "adExamples": [<3-4 realistic ad headline examples>]
  },
  "features": {
    "batteryScore": <number 0-100>,
    "cameraScore": <number 0-100>,
    "gamingScore": <number 0-100>,
    "durabilityScore": <number 0-100>,
    "sustainabilityScore": <number 0-100>,
    "aiFeatureScore": <number 0-100>,
    "priceRange": "<price range string>",
    "discounts": "<discount info or 'Not specified'>",
    "marketPositioning": "<'budget' | 'mid-range' | 'premium' | 'ultra-premium'>"
  },
  "reviews": {
    "averageRating": <number 1-5 or null>,
    "totalReviews": <number or null>,
    "ratingDistribution": {"5": <pct>, "4": <pct>, "3": <pct>, "2": <pct>, "1": <pct>},
    "commonComplaints": [<2-3 common complaint themes>],
    "positiveHighlights": [<2-3 positive highlight themes>],
    "frequentlyMentionedFeatures": [<3-4 features>],
    "sentimentScore": <number 0-100 or null>,
    "recentReviewSamples": [<2-3 short realistic review quotes>]
  }
}
Return ONLY the JSON object. No markdown, no explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");

  return {
    website: {
      loadTime: raw.website?.loadTime ?? 1.0,
      mobileScore: raw.website?.mobileScore ?? 70,
      seoScore: raw.website?.seoScore ?? 70,
      designScore: raw.website?.designScore ?? 70,
      ctaCount: raw.website?.ctaCount ?? 5,
      pricingVisible: raw.website?.pricingVisible ?? false,
      keyMessages: raw.website?.keyMessages ?? [],
      topKeywords: raw.website?.topKeywords ?? [],
    },
    social: {
      instagramFollowers: raw.social?.instagramFollowers ?? null,
      instagramEngagementRate: raw.social?.instagramEngagementRate ?? null,
      postFrequency: raw.social?.postFrequency ?? null,
      avgLikes: raw.social?.avgLikes ?? null,
      avgComments: raw.social?.avgComments ?? null,
      contentThemes: raw.social?.contentThemes ?? [],
      bio: raw.social?.bio ?? "",
      recentCaptions: raw.social?.recentCaptions ?? [],
      _note: "Website crawl returned no data. This social data is AI-estimated based on the company's known market presence.",
    },
    ads: {
      activeAdsCount: raw.ads?.activeAdsCount ?? null,
      adFormats: raw.ads?.adFormats ?? [],
      avgAdDuration: raw.ads?.avgAdDuration ?? null,
      primaryMessage: raw.ads?.primaryMessage ?? "",
      callToAction: raw.ads?.callToAction ?? "",
      estimatedSpend: raw.ads?.estimatedSpend ?? "Unavailable",
      adExamples: raw.ads?.adExamples ?? [],
      _note: "Website crawl returned no data. This ad data is AI-estimated based on the company's known advertising patterns.",
    },
    features: {
      batteryScore: raw.features?.batteryScore ?? 50,
      cameraScore: raw.features?.cameraScore ?? 50,
      gamingScore: raw.features?.gamingScore ?? 50,
      durabilityScore: raw.features?.durabilityScore ?? 50,
      sustainabilityScore: raw.features?.sustainabilityScore ?? 40,
      aiFeatureScore: raw.features?.aiFeatureScore ?? 50,
      priceRange: raw.features?.priceRange ?? "Not publicly listed",
      discounts: raw.features?.discounts ?? "Not specified",
      marketPositioning: raw.features?.marketPositioning ?? "mid-range",
    },
    reviews: {
      averageRating: raw.reviews?.averageRating ?? null,
      totalReviews: raw.reviews?.totalReviews ?? null,
      ratingDistribution: raw.reviews?.ratingDistribution ?? null,
      commonComplaints: raw.reviews?.commonComplaints ?? [],
      positiveHighlights: raw.reviews?.positiveHighlights ?? [],
      frequentlyMentionedFeatures: raw.reviews?.frequentlyMentionedFeatures ?? [],
      sentimentScore: raw.reviews?.sentimentScore ?? null,
      recentReviewSamples: raw.reviews?.recentReviewSamples ?? [],
      _note: "Website crawl returned no data. This review data is AI-estimated based on the company's known reputation.",
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
