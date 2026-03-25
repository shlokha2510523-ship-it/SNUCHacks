import * as cheerio from "cheerio";

export interface RawWebsiteData {
  url: string;
  fetchTimeMs: number;
  fetchSuccess: boolean;
  statusCode: number | null;
  title: string;
  metaDescription: string;
  metaKeywords: string;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  navLinks: string[];
  ctaTexts: string[];
  ctaCount: number;
  pricingPageFound: boolean;
  pricingMentions: string[];
  hasMobileViewport: boolean;
  hasCanonical: boolean;
  metaRobotsContent: string;
  openGraphData: Record<string, string>;
  schemaTypes: string[];
  bodyText: string;
  wordFrequencies: Array<{ word: string; count: number }>;
  internalLinks: string[];
  productPageHints: string[];
  featureMentions: string[];
}

export interface RawSocialData {
  platform: "instagram";
  handle: string;
  fetchSuccess: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; MarketingIntelBot/1.0; +https://marketing-intel.replit.app)";

const FETCH_TIMEOUT_MS = 6000;

const CTA_KEYWORDS = [
  "buy", "shop", "order", "get", "try", "start", "sign up", "sign-up", "signup",
  "download", "learn more", "explore", "discover", "book", "schedule", "contact",
  "subscribe", "join", "register", "free trial", "get started", "add to cart",
  "checkout", "see all", "view all", "compare",
];

const PRICING_KEYWORDS = [
  "price", "pricing", "plans", "cost", "$", "usd", "eur", "buy now", "per month",
  "per year", "subscription", "tier", "package", "edition",
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "up", "about", "into", "through", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can", "it",
  "its", "this", "that", "these", "those", "we", "our", "you", "your", "they",
  "their", "more", "all", "any", "some", "no", "not", "so", "if", "as", "get",
  "new", "one", "now",
]);

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function extractWordFrequencies(text: string, topN = 20): Array<{ word: string; count: number }> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

function looksLikeCta(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return CTA_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function crawlWebsite(url: string): Promise<RawWebsiteData> {
  const start = Date.now();
  let html = "";
  let statusCode: number | null = null;
  let fetchSuccess = false;

  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const response = await fetchWithTimeout(normalizedUrl);
    statusCode = response.status;
    if (response.ok) {
      html = await response.text();
      fetchSuccess = true;
    }
  } catch {
    // Timeout or network error - fetchSuccess stays false
  }

  const fetchTimeMs = Date.now() - start;

  if (!fetchSuccess || !html) {
    return buildEmptyRawData(url, fetchTimeMs, statusCode);
  }

  const $ = cheerio.load(html);

  // Remove script/style/noscript for text extraction
  $("script, style, noscript, svg, img").remove();

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const metaKeywords = $('meta[name="keywords"]').attr("content")?.trim() ?? "";
  const metaRobotsContent = $('meta[name="robots"]').attr("content")?.trim() ?? "";

  const hasCanonical = $('link[rel="canonical"]').length > 0;
  const hasMobileViewport = $('meta[name="viewport"]').length > 0;

  // OG data
  const openGraphData: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property") ?? "";
    const content = $(el).attr("content") ?? "";
    if (prop && content) openGraphData[prop.replace("og:", "")] = content;
  });

  // Schema.org types
  const schemaTypes: string[] = [];
  $('[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "{}");
      const type = json["@type"];
      if (type) schemaTypes.push(typeof type === "string" ? type : JSON.stringify(type));
    } catch {
      // ignore
    }
  });

  // Headings
  const h1Tags = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 6);

  const h2Tags = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 12);

  const h3Tags = $("h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 10);

  // Nav links (href text in nav)
  const navLinks = $("nav a, header a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 1 && t.length < 40)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 20);

  // CTA buttons/links
  const ctaElements: string[] = [];
  $("button, a, [role='button'], input[type='submit'], input[type='button']").each((_, el) => {
    const text = ($(el).text() || $(el).attr("value") || $(el).attr("aria-label") || "").trim();
    if (text && looksLikeCta(text) && text.length < 60) {
      ctaElements.push(text);
    }
  });
  const uniqueCtas = [...new Set(ctaElements)].slice(0, 15);

  // Pricing detection
  const bodyText = $.root().text().replace(/\s+/g, " ").trim();
  const lowerBody = bodyText.toLowerCase();
  const pricingPageFound =
    PRICING_KEYWORDS.some((kw) => lowerBody.includes(kw)) ||
    $('a[href*="pric"], a[href*="plan"], a[href*="cost"]').length > 0;

  const pricingMentions: string[] = [];
  const pricingRegex = /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year|user))?/gi;
  const priceMatches = bodyText.match(pricingRegex) ?? [];
  pricingMentions.push(...[...new Set(priceMatches)].slice(0, 8));

  // Internal links
  const baseHost = (() => {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    } catch {
      return "";
    }
  })();

  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("/") || (baseHost && href.includes(baseHost))) {
      internalLinks.push(href);
    }
  });

  // Product page hints from URLs
  const productPageHints = internalLinks
    .filter((l) => /product|shop|store|spec|feature|device|model/i.test(l))
    .slice(0, 8);

  // Feature mentions
  const featureKeywords = [
    "battery", "camera", "display", "screen", "processor", "chip", "storage",
    "memory", "ram", "waterproof", "durable", "5g", "bluetooth", "wifi",
    "fast charging", "wireless", "ai", "gaming", "performance", "ultra",
    "pro", "lite", "max", "night mode", "zoom", "portrait", "video", "audio",
    "speaker", "biometric", "fingerprint", "face id", "satellite",
  ];

  const featureMentions = featureKeywords
    .filter((kw) => lowerBody.includes(kw))
    .slice(0, 20);

  const wordFrequencies = extractWordFrequencies(
    [title, metaDescription, ...h1Tags, ...h2Tags, ...h3Tags, bodyText.slice(0, 5000)].join(" ")
  );

  return {
    url,
    fetchTimeMs,
    fetchSuccess: true,
    statusCode,
    title,
    metaDescription,
    metaKeywords,
    h1Tags,
    h2Tags,
    h3Tags,
    navLinks,
    ctaTexts: uniqueCtas,
    ctaCount: uniqueCtas.length,
    pricingPageFound,
    pricingMentions,
    hasMobileViewport,
    hasCanonical,
    metaRobotsContent,
    openGraphData,
    schemaTypes,
    bodyText: bodyText.slice(0, 8000),
    wordFrequencies,
    internalLinks: [...new Set(internalLinks)].slice(0, 30),
    productPageHints,
    featureMentions,
  };
}

function buildEmptyRawData(url: string, fetchTimeMs: number, statusCode: number | null): RawWebsiteData {
  return {
    url,
    fetchTimeMs,
    fetchSuccess: false,
    statusCode,
    title: "",
    metaDescription: "",
    metaKeywords: "",
    h1Tags: [],
    h2Tags: [],
    h3Tags: [],
    navLinks: [],
    ctaTexts: [],
    ctaCount: 0,
    pricingPageFound: false,
    pricingMentions: [],
    hasMobileViewport: false,
    hasCanonical: false,
    metaRobotsContent: "",
    openGraphData: {},
    schemaTypes: [],
    bodyText: "",
    wordFrequencies: [],
    internalLinks: [],
    productPageHints: [],
    featureMentions: [],
  };
}

export async function crawlInstagramPublic(handle: string): Promise<RawSocialData> {
  const result: RawSocialData = {
    platform: "instagram",
    handle,
    fetchSuccess: false,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  };

  if (!handle) return result;

  try {
    const url = `https://www.instagram.com/${handle}/`;
    const response = await fetchWithTimeout(url, 5000);
    if (!response.ok) return result;

    const html = await response.text();
    const $ = cheerio.load(html);

    result.ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
    result.ogDescription = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
    result.ogImage = $('meta[property="og:image"]').attr("content")?.trim() ?? "";
    result.fetchSuccess = !!(result.ogTitle || result.ogDescription);
  } catch {
    // Instagram often blocks crawlers - that's expected
  }

  return result;
}

export async function crawlFacebookAdLibrary(companyName: string, facebookPage?: string): Promise<{
  fetchSuccess: boolean;
  note: string;
}> {
  // Facebook Ad Library requires OAuth token for API access.
  // The public web interface is JavaScript-rendered and cannot be scraped.
  // We record this as unavailable for transparency.
  return {
    fetchSuccess: false,
    note: "Facebook Ad Library requires authenticated API access. Data unavailable without credentials.",
  };
}
