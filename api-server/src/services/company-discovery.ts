import { openai } from "@workspace/integrations-openai-ai-server";

export interface DiscoveredCompany {
  name: string;
  website: string;
  instagramHandle: string;
  facebookPage: string;
  isUserCompany: boolean;
  rationale: string;
}

export interface DiscoveryResult {
  userCompany: DiscoveredCompany;
  competitors: DiscoveredCompany[];
  industry: string;
  marketSegment: string;
}

export async function discoverCompetitors(companyName: string): Promise<DiscoveryResult> {
  const prompt = `You are a competitive intelligence expert specializing in consumer electronics.

A user wants to analyze the company: "${companyName}"

Your tasks:
1. Identify this company's industry, market segment, and key product lines within consumer electronics
2. Find its official website, Instagram handle, and Facebook page
3. Identify 4 to 5 of its most direct and relevant competitors based on:
   - Similar product categories and price points
   - Comparable market share and brand scale  
   - Geographic presence overlap
   - Target demographic alignment
4. For each competitor, find their official website, Instagram handle, and Facebook page

Return a JSON object with this exact structure:
{
  "industry": "<e.g. Smartphones, Consumer Electronics, Wearables, PC Hardware>",
  "marketSegment": "<e.g. Premium flagship, Mid-range, Budget, Gaming, Enterprise>",
  "userCompany": {
    "name": "${companyName}",
    "website": "<official website URL starting with https://>",
    "instagramHandle": "<instagram username without @ sign, e.g. apple>",
    "facebookPage": "<facebook page URL, e.g. https://facebook.com/apple>",
    "rationale": "The primary subject company for this analysis"
  },
  "competitors": [
    {
      "name": "<competitor brand name>",
      "website": "<https://...>",
      "instagramHandle": "<instagram username without @>",
      "facebookPage": "<https://facebook.com/...>",
      "rationale": "<1-2 sentences on why this is a key competitor>"
    }
  ]
}

Rules:
- Use real, verified URLs (major consumer electronics brands have well-known web presence)
- Instagram handles should be the main official account (e.g. for Apple it's "apple", Samsung is "samsung")
- Facebook pages should be the official brand page
- Include exactly 4 competitors (not 3, not 5 — exactly 4)
- If the company is not a consumer electronics company, still do your best to identify competitors
- All URLs must start with https://
- Do NOT include the @ symbol in instagramHandle`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  // Normalize and validate
  const userCompany: DiscoveredCompany = {
    name: parsed.userCompany?.name || companyName,
    website: normalizeUrl(parsed.userCompany?.website || `https://www.${companyName.toLowerCase().replace(/\s/g, "")}.com`),
    instagramHandle: normalizeInstagram(parsed.userCompany?.instagramHandle || ""),
    facebookPage: normalizeFacebook(parsed.userCompany?.facebookPage || ""),
    isUserCompany: true,
    rationale: parsed.userCompany?.rationale || "Primary analysis subject",
  };

  const competitors: DiscoveredCompany[] = (parsed.competitors || []).slice(0, 4).map((c: any) => ({
    name: c.name || "Unknown",
    website: normalizeUrl(c.website || ""),
    instagramHandle: normalizeInstagram(c.instagramHandle || ""),
    facebookPage: normalizeFacebook(c.facebookPage || ""),
    isUserCompany: false,
    rationale: c.rationale || "",
  }));

  return {
    userCompany,
    competitors,
    industry: parsed.industry || "Consumer Electronics",
    marketSegment: parsed.marketSegment || "General",
  };
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return `https://${url}`;
  return url;
}

function normalizeInstagram(handle: string): string {
  if (!handle) return "";
  return handle.replace(/^@/, "").trim();
}

function normalizeFacebook(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return `https://facebook.com/${url}`;
  return url;
}
