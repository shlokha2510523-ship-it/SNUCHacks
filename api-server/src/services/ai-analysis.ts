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
    const reviewsBlock = data.reviews ? `
Google Reviews: rating=${data.reviews.averageRating}/5 (${data.reviews.totalReviews} reviews), sentiment=${data.reviews.sentimentScore}%
Common complaints: ${data.reviews.commonComplaints?.join("; ") || "N/A"}
Positive highlights: ${data.reviews.positiveHighlights?.join("; ") || "N/A"}
Frequently mentioned features: ${data.reviews.frequentlyMentionedFeatures?.join(", ") || "N/A"}
Recent review samples: ${data.reviews.recentReviewSamples?.join(" | ") || "N/A"}` : "";
    return `
Company: ${c.name} (${c.isUserCompany ? "USER COMPANY" : "COMPETITOR"})
Website: ${c.website}
Web metrics: loadTime=${data.website?.loadTime}s, mobileScore=${data.website?.mobileScore}, seoScore=${data.website?.seoScore}, designScore=${data.website?.designScore}
Key messages: ${data.website?.keyMessages?.join(", ") || "N/A"}
Social: followers=${data.social?.instagramFollowers}, engagement=${data.social?.instagramEngagementRate}%, postsPerWeek=${data.social?.postFrequency}
Content themes: ${data.social?.contentThemes?.join(", ") || "N/A"}
Ads: activeAds=${data.ads?.activeAdsCount}, spend=${data.ads?.estimatedSpend}, formats=${data.ads?.adFormats?.join(", ")}
Primary ad message: ${data.ads?.primaryMessage || "N/A"}
Features - battery=${data.features?.batteryScore}, camera=${data.features?.cameraScore}, gaming=${data.features?.gamingScore}, durability=${data.features?.durabilityScore}, sustainability=${data.features?.sustainabilityScore}, ai=${data.features?.aiFeatureScore}
Price range: ${data.features?.priceRange}, Positioning: ${data.features?.marketPositioning}${reviewsBlock}
`;
  }).join("\n---\n");

  const prompt = `You are a world-class competitive marketing intelligence analyst specializing in consumer electronics.

Here is the collected marketing data for ${userCompany.name} and its competitors. Data includes website metrics, social media, ads, product features, AND Google Reviews sentiment analysis:

${companiesContext}

IMPORTANT ANALYSIS INSTRUCTIONS:
- Use Google Reviews data (complaints, highlights, sentiment scores) to directly inform "Reasons for Failure" — if customers complain about battery or support, that must appear as a failure reason.
- Review sentiment scores should influence overall scoring: lower sentiment = lower score contribution.
- Frequently mentioned complaints that competitors don't share should be flagged as critical failure points.
- Use unmet customer needs from reviews to identify whitespace and underserved segment opportunities.

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

Make the analysis specific, actionable, and data-driven. Include exactly:
- 3-6 reasons for failure (at least 1-2 must be directly grounded in Google Reviews complaints)
- 4-6 missed opportunities  
- One insight per competitor
- 3-5 immediate actions, 3-4 short-term actions, 3-4 long-term actions
- 5-7 industry trends
- One trend entry per competitor
- 3-5 whitespace opportunities
- Exactly 3 underserved segments (grounded in review unmet needs + competitor targeting gaps)

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
