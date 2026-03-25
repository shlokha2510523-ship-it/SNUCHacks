import { openai } from "@workspace/integrations-openai-ai-server";

interface Company {
  id: number;
  name: string;
  website: string;
  instagramHandle?: string | null;
  facebookPage?: string | null;
  isUserCompany: boolean;
}

interface ScrapeData {
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
    instagramFollowers: number;
    instagramEngagementRate: number;
    postFrequency: number;
    avgLikes: number;
    avgComments: number;
    contentThemes: string[];
    bio: string;
    recentCaptions: string[];
  };
  ads?: {
    activeAdsCount: number;
    adFormats: string[];
    avgAdDuration: number;
    primaryMessage: string;
    callToAction: string;
    estimatedSpend: string;
    adExamples: string[];
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
}

export async function scrapeAllCompanies(companies: Company[]): Promise<Array<{ companyId: number; companyName: string; data: ScrapeData }>> {
  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const data = await generateSimulatedScrapeData(company);
        return { companyId: company.id, companyName: company.name, data };
      } catch {
        return { companyId: company.id, companyName: company.name, data: generateFallbackData(company.name) };
      }
    })
  );
  return results;
}

async function generateSimulatedScrapeData(company: Company): Promise<ScrapeData> {
  const prompt = `You are a web scraper and marketing analyst. Generate realistic marketing intelligence data for the consumer electronics company "${company.name}" with website "${company.website}"${company.instagramHandle ? ` and Instagram @${company.instagramHandle}` : ""}.

Generate realistic but simulated data that would be gathered from their website, social media, and Facebook ad library. Make the scores and metrics feel authentic and varied for this specific brand.

Return a JSON object with this exact structure:
{
  "website": {
    "loadTime": <number 1.0-4.0>,
    "mobileScore": <number 50-99>,
    "seoScore": <number 45-95>,
    "designScore": <number 50-99>,
    "ctaCount": <number 2-12>,
    "pricingVisible": <boolean>,
    "keyMessages": [<3-5 realistic marketing messages>],
    "topKeywords": [<5-8 relevant SEO keywords>]
  },
  "social": {
    "instagramFollowers": <number relevant to brand size>,
    "instagramEngagementRate": <number 0.5-8.0>,
    "postFrequency": <number posts per week>,
    "avgLikes": <number>,
    "avgComments": <number>,
    "contentThemes": [<3-5 content themes>],
    "bio": "<realistic Instagram bio>",
    "recentCaptions": [<2-3 realistic recent post captions>]
  },
  "ads": {
    "activeAdsCount": <number 1-50>,
    "adFormats": [<2-4 ad formats like "video", "carousel", "image">],
    "avgAdDuration": <days 7-90>,
    "primaryMessage": "<main ad message theme>",
    "callToAction": "<primary CTA>",
    "estimatedSpend": "<monthly spend estimate like '$50K-100K'>",
    "adExamples": [<2-3 realistic ad copy examples>]
  },
  "features": {
    "batteryScore": <number 40-99>,
    "cameraScore": <number 40-99>,
    "gamingScore": <number 40-99>,
    "durabilityScore": <number 40-99>,
    "sustainabilityScore": <number 30-90>,
    "aiFeatureScore": <number 30-95>,
    "priceRange": "<e.g. '$299-$999'>",
    "discounts": "<current discount strategy>",
    "marketPositioning": "<premium/mid-range/budget/etc>"
  }
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function generateFallbackData(companyName: string): ScrapeData {
  const seed = companyName.length;
  return {
    website: {
      loadTime: 1.5 + (seed % 30) / 10,
      mobileScore: 60 + (seed % 35),
      seoScore: 55 + (seed % 40),
      designScore: 60 + (seed % 35),
      ctaCount: 3 + (seed % 8),
      pricingVisible: seed % 2 === 0,
      keyMessages: ["Innovation meets performance", "Built for the future", "Your life, amplified"],
      topKeywords: ["smartphone", "electronics", "tech", "innovation", "performance"],
    },
    social: {
      instagramFollowers: 50000 + seed * 1000,
      instagramEngagementRate: 1.5 + (seed % 50) / 10,
      postFrequency: 3 + (seed % 5),
      avgLikes: 1000 + seed * 100,
      avgComments: 50 + seed * 10,
      contentThemes: ["Product showcases", "Lifestyle", "Behind the scenes"],
      bio: `${companyName} - Redefining tech for modern life. 📱`,
      recentCaptions: ["Experience the difference.", "New drop. Same commitment to quality."],
    },
    ads: {
      activeAdsCount: 5 + (seed % 20),
      adFormats: ["video", "image", "carousel"],
      avgAdDuration: 14 + (seed % 30),
      primaryMessage: "Experience next-level performance",
      callToAction: "Shop Now",
      estimatedSpend: "$30K-$80K/month",
      adExamples: ["The phone that keeps up with you.", "More power. Less compromise."],
    },
    features: {
      batteryScore: 55 + (seed % 40),
      cameraScore: 60 + (seed % 35),
      gamingScore: 50 + (seed % 45),
      durabilityScore: 60 + (seed % 35),
      sustainabilityScore: 45 + (seed % 40),
      aiFeatureScore: 55 + (seed % 40),
      priceRange: "$299-$899",
      discounts: "Seasonal sales, trade-in offers",
      marketPositioning: "mid-range",
    },
  };
}
