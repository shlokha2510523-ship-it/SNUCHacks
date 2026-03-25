import { openai } from "@workspace/integrations-openai-ai-server";

interface Company {
  id: number;
  name: string;
  website: string;
  isUserCompany: boolean;
  scrapeData?: any;
}

interface AnalysisOutput {
  overallScore: number;
  rank: number;
  totalCompanies: number;
  reasonsForFailure: FailureReason[];
  missedOpportunities: MissedOpportunity[];
  competitorInsights: CompetitorInsight[];
  rankings: RankingsData;
  actionPlan: ActionPlan;
  trends: TrendsData;
}

interface FailureReason {
  category: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  impactScore: number;
}

interface MissedOpportunity {
  title: string;
  description: string;
  potentialImpact: string;
  effort: "low" | "medium" | "high";
  category: string;
}

interface CompetitorInsight {
  companyName: string;
  strength: string;
  trend: string;
  marketingStyle: string;
  keyDifferentiator: string;
}

interface RankEntry {
  companyId: number;
  companyName: string;
  score: number;
  rank: number;
  isUserCompany: boolean;
}

interface RankingsData {
  overall: RankEntry[];
  byMetric: Record<string, RankEntry[]>;
  userCompanyHighlights: {
    leadingIn: string[];
    laggingIn: string[];
    biggestGap: string;
    biggestAdvantage: string;
  };
}

interface ActionPlan {
  immediateActions: ActionItem[];
  shortTermActions: ActionItem[];
  longTermActions: ActionItem[];
  marketingGapSummary: string;
  competitivePriority: string;
}

interface ActionItem {
  title: string;
  description: string;
  category: string;
  expectedImpact: string;
  timeframe: string;
}

interface TrendsData {
  industryTrends: TrendItem[];
  competitorTrends: CompetitorTrend[];
  whitespaceOpportunities: string[];
}

interface TrendItem {
  name: string;
  description: string;
  adoption: "low" | "medium" | "high";
  relevance: number;
}

interface CompetitorTrend {
  companyName: string;
  recentShift: string;
  targetAudience: string;
  contentStyle: string;
}

export async function analyzeCompetitiveData(
  userCompany: Company,
  competitors: Company[]
): Promise<AnalysisOutput> {
  const allCompanies = [userCompany, ...competitors];

  const companiesContext = allCompanies.map((c) => {
    const data = c.scrapeData || {};
    const meta = data._meta || {};

    const reviewsBlock =
      data.reviews?.averageRating != null
        ? `
Google Reviews (REAL): rating=${data.reviews.averageRating}/5 (${data.reviews.totalReviews} reviews), sentiment=${data.reviews.sentimentScore}%
Common complaints: ${data.reviews.commonComplaints?.join("; ") || "N/A"}
Positive highlights: ${data.reviews.positiveHighlights?.join("; ") || "N/A"}
Frequently mentioned features: ${data.reviews.frequentlyMentionedFeatures?.join(", ") || "N/A"}
Recent review samples: ${data.reviews.recentReviewSamples?.join(" | ") || "N/A"}`
        : `\nGoogle Reviews: NOT AVAILABLE (${data.reviews?._note || "no API key"})`;

    const socialFollowers =
      data.social?.instagramFollowers != null
        ? `followers=${data.social.instagramFollowers}`
        : "followers=UNAVAILABLE";
    const socialEngagement =
      data.social?.instagramEngagementRate != null
        ? `engagement=${data.social.instagramEngagementRate}%`
        : "engagement=UNAVAILABLE";
    const socialFreq =
      data.social?.postFrequency != null
        ? `postsPerWeek=${data.social.postFrequency}`
        : "postsPerWeek=UNAVAILABLE";

    const hasYouTubeData = data.ads?.activeAdsCount != null;
    const adsBlock = hasYouTubeData
      ? `YouTube Ads (REAL): recentVideoAds=${data.ads.activeAdsCount}, formats=[${data.ads?.adFormats?.join(", ")}], adFormats note: data from YouTube Data API`
      : `YouTube Ads: NOT AVAILABLE (${data.ads?._note || "requires authentication"})`;

    const primaryAdMsg = data.ads?.primaryMessage
      ? `Primary message (from real YouTube video titles): ${data.ads.primaryMessage}`
      : "Primary ad message: N/A";

    const adExamplesBlock =
      data.ads?.adExamples?.length > 0
        ? `Real ad video titles: ${data.ads.adExamples.join(" | ")}`
        : "";

    return `
Company: ${c.name} (${c.isUserCompany ? "USER COMPANY" : "COMPETITOR"})
Website: ${c.website}
Data Source: ${meta.dataSource || "unknown"} | Website Crawled: ${meta.websiteCrawled ?? false} | Social Crawled: ${meta.socialCrawled ?? false}
Web metrics (REAL crawl): loadTime=${data.website?.loadTime ?? "N/A"}s, mobileScore=${data.website?.mobileScore ?? "N/A"}, seoScore=${data.website?.seoScore ?? "N/A"}, designScore=${data.website?.designScore ?? "N/A"}
Key messages (from real headings): ${data.website?.keyMessages?.join(", ") || "N/A"}
Top keywords (from real content): ${data.website?.topKeywords?.join(", ") || "N/A"}
CTAs found: ${data.website?.ctaCount ?? "N/A"}, Pricing visible: ${data.website?.pricingVisible ?? "N/A"}
Social: ${socialFollowers}, ${socialEngagement}, ${socialFreq}
Content themes: ${data.social?.contentThemes?.join(", ") || "N/A"}
Instagram bio: ${data.social?.bio || "N/A"}
${adsBlock}
${primaryAdMsg}
${adExamplesBlock}
Features - battery=${data.features?.batteryScore ?? 50}, camera=${data.features?.cameraScore ?? 50}, gaming=${data.features?.gamingScore ?? 50}, durability=${data.features?.durabilityScore ?? 50}, sustainability=${data.features?.sustainabilityScore ?? 40}, ai=${data.features?.aiFeatureScore ?? 40}
Price range: ${data.features?.priceRange || "N/A"}, Positioning: ${data.features?.marketPositioning || "N/A"}${reviewsBlock}
`;
  }).join("\n---\n");

  const prompt = `You are a world-class competitive marketing intelligence analyst specializing in consumer electronics.

Here is the REAL crawled marketing data for ${userCompany.name} and its competitors. This data was collected via live web crawling — it is real, not simulated. Some fields are marked UNAVAILABLE where live API access was not available (social follower counts, ad spend, Google Reviews).

${companiesContext}

IMPORTANT ANALYSIS INSTRUCTIONS:
- Base your analysis ONLY on the real data provided. Do NOT invent metrics, follower counts, or review data that is marked UNAVAILABLE.
- When data is UNAVAILABLE for a metric, note the limitation and base scoring on available signals instead.
- Website data (loadTime, seoScore, mobileScore, designScore, keyMessages, topKeywords) was crawled in real-time — treat this as ground truth.
- Feature scores (battery, camera, gaming, etc.) are derived from real keyword mentions on actual product pages — weight them accordingly.
- For social engagement and ad strength scores: if live data is unavailable, score based on website content quality signals and brand positioning instead.
- Key messages and top keywords come from actual website headings and word frequency analysis — use them to assess brand positioning.
- If Google Reviews are unavailable, do not infer complaints — acknowledge the limitation in analysis.
- Derive insights from what IS actually there: real headlines, real CTAs, real pricing, real feature mentions.

Perform a comprehensive competitive analysis. Return a JSON object with exactly this structure:

{
  "overallScore": <0-100 score for user company overall marketing strength>,
  "rank": <rank of user company from 1=best to ${allCompanies.length}=worst>,
  "totalCompanies": ${allCompanies.length},
  "reasonsForFailure": [
    {
      "category": "<e.g. Social Media, Ad Strategy, Product Marketing, Website, SEO>",
      "title": "<concise failure point title>",
      "description": "<detailed explanation of why this is a failure and what competitors do better>",
      "severity": "<critical|high|medium|low>",
      "impactScore": <0-100>
    }
  ],
  "missedOpportunities": [
    {
      "title": "<opportunity title>",
      "description": "<what the opportunity is and why it matters>",
      "potentialImpact": "<expected business impact>",
      "effort": "<low|medium|high>",
      "category": "<category>"
    }
  ],
  "competitorInsights": [
    {
      "companyName": "<competitor name>",
      "strength": "<what they do exceptionally well>",
      "trend": "<their recent marketing shift or trend>",
      "marketingStyle": "<their marketing style/voice/approach>",
      "keyDifferentiator": "<what makes them stand out>"
    }
  ],
  "rankings": {
    "overall": [
      { "companyId": <id>, "companyName": "<name>", "score": <0-100>, "rank": <1-${allCompanies.length}>, "isUserCompany": <bool> }
    ],
    "byMetric": {
      "Battery": [{ "companyId": <id>, "companyName": "<name>", "score": <feature score>, "rank": <rank>, "isUserCompany": <bool> }],
      "Camera": [...],
      "Gaming": [...],
      "Durability": [...],
      "Sustainability": [...],
      "AI Features": [...],
      "Social Engagement": [...],
      "Ad Strength": [...],
      "Website UX": [...],
      "Pricing Value": [...]
    },
    "userCompanyHighlights": {
      "leadingIn": [<metrics where user company leads, 1-3 items>],
      "laggingIn": [<metrics where user company is weakest, 2-4 items>],
      "biggestGap": "<the single biggest area where competitors outperform>",
      "biggestAdvantage": "<the single biggest area where user company leads>"
    }
  },
  "actionPlan": {
    "immediateActions": [
      {
        "title": "<action>",
        "description": "<specific steps>",
        "category": "<category>",
        "expectedImpact": "<expected result>",
        "timeframe": "This week"
      }
    ],
    "shortTermActions": [
      {
        "title": "<action>",
        "description": "<specific steps>",
        "category": "<category>",
        "expectedImpact": "<expected result>",
        "timeframe": "Next 30 days"
      }
    ],
    "longTermActions": [
      {
        "title": "<action>",
        "description": "<specific steps>",
        "category": "<category>",
        "expectedImpact": "<expected result>",
        "timeframe": "Next 90 days"
      }
    ],
    "marketingGapSummary": "<2-3 sentence summary of the biggest marketing gaps>",
    "competitivePriority": "<the single most important thing the company must do to improve its competitive position>"
  },
  "trends": {
    "industryTrends": [
      {
        "name": "<trend name>",
        "description": "<what it is and why it matters>",
        "adoption": "<low|medium|high>",
        "relevance": <relevance score from 0 to 10>
      }
    ],
    "competitorTrends": [
      {
        "companyName": "<competitor>",
        "recentShift": "<recent change in their marketing approach>",
        "targetAudience": "<who they're targeting now>",
        "contentStyle": "<their content style>"
      }
    ],
    "whitespaceOpportunities": [<3-5 untapped market opportunities the user company could own>],
    "underservedSegments": [
      {
        "segmentName": "<specific audience segment name, e.g. 'Budget-conscious gamers'>",
        "description": "<1-2 sentences: who they are, demographics, key traits>",
        "whyUnderserved": "<1-2 sentences: based on competitor ads, reviews, and feature data — why no one is serving them well>",
        "opportunityInsight": "<1-2 sentences: what the user company could do to capture this segment>"
      }
    ]
  }
}

Make the analysis specific, actionable, and grounded in the real crawled data. Include exactly:
- 3-6 reasons for failure (grounded in real website, SEO, content, or feature data; only reference reviews if real review data was provided)
- 4-6 missed opportunities based on what was and was not found in real crawled content
- One insight per competitor based on their real website content and positioning
- 3-5 immediate actions, 3-4 short-term actions, 3-4 long-term actions
- 5-7 industry trends
- One trend entry per competitor
- 3-5 whitespace opportunities derived from real positioning gaps seen in the crawled data
- Exactly 3 underserved segments (grounded in competitor positioning gaps and product feature signals)

Company IDs for reference: ${allCompanies.map((c) => `${c.name}=${c.id}`).join(", ")}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as AnalysisOutput;
}
