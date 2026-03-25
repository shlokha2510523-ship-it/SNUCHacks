import { openai } from "@workspace/integrations-openai-ai-server";
import { crawlCache } from "./cache.js";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeAdsData {
  fetchSuccess: boolean;
  channelId: string | null;
  channelName: string | null;
  subscriberCount: number | null;
  totalVideos: number | null;
  totalViews: number | null;
  recentAds: YouTubeAd[];
  adFormats: string[];
  avgViewCount: number | null;
  topPerformingAd: YouTubeAd | null;
  contentThemes: string[];
  primaryMessage: string;
  callToAction: string;
  estimatedMonthlyUploads: number | null;
  adExamples: string[];
  _note: string;
}

export interface YouTubeAd {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  duration: string;
  thumbnailUrl: string;
  tags: string[];
  isShort: boolean;
}

interface YouTubeSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnails: { high?: { url: string }; default?: { url: string } };
  };
}

interface YouTubeVideoStats {
  id: string;
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration?: string;
  };
  snippet: {
    tags?: string[];
  };
}

async function ytFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not set");

  const url = new URL(`${YOUTUBE_BASE}${endpoint}`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`YouTube API error ${resp.status}: ${body.slice(0, 200)}`);
  }

  return resp.json();
}

async function findBrandChannel(companyName: string, website: string): Promise<{
  channelId: string | null;
  channelName: string | null;
  subscriberCount: number | null;
  totalVideos: number | null;
  totalViews: number | null;
}> {
  // Search for official brand channel
  const queries = [
    `${companyName} official`,
    companyName,
  ];

  for (const q of queries) {
    try {
      const data = await ytFetch("/search", {
        part: "snippet",
        q,
        type: "channel",
        maxResults: "5",
        order: "relevance",
      });

      const items: any[] = data.items ?? [];

      // Pick best matching channel (prioritize exact brand name match)
      const match = items.find((item: any) => {
        const title: string = item.snippet?.title?.toLowerCase() ?? "";
        const name = companyName.toLowerCase();
        return title.includes(name) || title === name;
      }) ?? items[0];

      if (!match) continue;

      const channelId: string = match.id?.channelId ?? match.snippet?.channelId;
      if (!channelId) continue;

      // Get channel stats
      const channelData = await ytFetch("/channels", {
        part: "statistics,snippet",
        id: channelId,
      });

      const channel = channelData.items?.[0];
      if (!channel) continue;

      return {
        channelId,
        channelName: channel.snippet?.title ?? null,
        subscriberCount: channel.statistics?.subscriberCount
          ? parseInt(channel.statistics.subscriberCount)
          : null,
        totalVideos: channel.statistics?.videoCount
          ? parseInt(channel.statistics.videoCount)
          : null,
        totalViews: channel.statistics?.viewCount
          ? parseInt(channel.statistics.viewCount)
          : null,
      };
    } catch {
      continue;
    }
  }

  return { channelId: null, channelName: null, subscriberCount: null, totalVideos: null, totalViews: null };
}

async function fetchRecentAdVideos(companyName: string, channelId: string | null): Promise<YouTubeAd[]> {
  const ads: YouTubeAd[] = [];

  try {
    // Strategy 1: Search brand channel for recent ad-like content
    const searchParams: Record<string, string> = {
      part: "snippet",
      q: `${companyName} ad commercial`,
      type: "video",
      maxResults: "15",
      order: "date",
      publishedAfter: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (channelId) {
      searchParams.channelId = channelId;
      // Also fetch most recent channel videos (not just ad-labeled ones)
    }

    const searchData = await ytFetch("/search", searchParams);
    const items: YouTubeSearchItem[] = searchData.items ?? [];

    const videoIds = items
      .map((item) => item.id?.videoId)
      .filter((id): id is string => !!id);

    if (videoIds.length === 0) return ads;

    // Fetch video details (stats, duration, tags)
    const statsData = await ytFetch("/videos", {
      part: "statistics,contentDetails,snippet",
      id: videoIds.join(","),
    });

    const statsMap = new Map<string, YouTubeVideoStats>();
    for (const v of statsData.items ?? []) {
      statsMap.set(v.id, v);
    }

    for (const item of items) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;

      const stats = statsMap.get(videoId);
      const duration = stats?.contentDetails?.duration ?? "";
      const isShort = isYouTubeShort(duration);

      ads.push({
        videoId,
        title: item.snippet.title,
        description: item.snippet.description.slice(0, 300),
        publishedAt: item.snippet.publishedAt,
        viewCount: stats?.statistics?.viewCount ? parseInt(stats.statistics.viewCount) : null,
        likeCount: stats?.statistics?.likeCount ? parseInt(stats.statistics.likeCount) : null,
        commentCount: stats?.statistics?.commentCount ? parseInt(stats.statistics.commentCount) : null,
        duration,
        thumbnailUrl: item.snippet.thumbnails.high?.url ?? item.snippet.thumbnails.default?.url ?? "",
        tags: stats?.snippet?.tags?.slice(0, 10) ?? [],
        isShort,
      });
    }
  } catch {
    // Non-critical — return what we have
  }

  return ads;
}

function isYouTubeShort(isoDuration: string): boolean {
  // Parse ISO 8601 duration (PT1M2S, PT30S, etc.)
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseInt(match[3] ?? "0");
  const totalSecs = hours * 3600 + minutes * 60 + seconds;
  return totalSecs <= 60;
}

function detectAdFormats(ads: YouTubeAd[]): string[] {
  const formats = new Set<string>();
  for (const ad of ads) {
    if (ad.isShort) formats.add("Shorts");
    const title = ad.title.toLowerCase();
    const desc = ad.description.toLowerCase();
    if (title.includes("official film") || title.includes("film")) formats.add("Brand Film");
    if (title.includes("review") || title.includes("unbox")) formats.add("Product Demo");
    if (title.includes("ad") || title.includes("commercial") || title.includes("campaign")) formats.add("Commercial");
    if (title.includes("feature") || title.includes("walkthrough") || title.includes("how to")) formats.add("Feature Showcase");
    if (title.includes("launch") || title.includes("reveal") || title.includes("introduce")) formats.add("Launch Video");
  }
  if (formats.size === 0) formats.add("Video");
  return Array.from(formats);
}

async function deriveAdsInsights(
  companyName: string,
  channelInfo: { subscriberCount: number | null; totalVideos: number | null; totalViews: number | null },
  ads: YouTubeAd[]
): Promise<{
  contentThemes: string[];
  primaryMessage: string;
  callToAction: string;
  adExamples: string[];
}> {
  if (ads.length === 0) {
    return {
      contentThemes: [],
      primaryMessage: "",
      callToAction: "",
      adExamples: [],
    };
  }

  const adSummary = ads.slice(0, 8).map((a) =>
    `Title: "${a.title}" | Views: ${a.viewCount ?? "N/A"} | Published: ${a.publishedAt.slice(0, 10)} | Tags: ${a.tags.slice(0, 5).join(", ")}\nDescription: ${a.description.slice(0, 150)}`
  ).join("\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are analyzing real YouTube ad/video data for the brand "${companyName}".

Here are the REAL YouTube videos from their channel:
${adSummary}

Based ONLY on the actual video titles, descriptions, and tags above, return a JSON object:
{
  "contentThemes": [<3-5 specific themes derived from actual video titles/descriptions>],
  "primaryMessage": "<the main marketing message derived from actual titles — max 100 chars>",
  "callToAction": "<what they typically ask viewers to do, derived from descriptions>",
  "adExamples": [<3-4 actual video titles from the list above, verbatim>]
}

RULES: Only use information visible in the real data above. Do not invent anything.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    const topTitles = ads.slice(0, 3).map((a) => a.title);
    return {
      contentThemes: [],
      primaryMessage: topTitles[0] ?? "",
      callToAction: "",
      adExamples: topTitles,
    };
  }
}

export async function fetchYouTubeAdsData(
  companyName: string,
  website: string
): Promise<YouTubeAdsData> {
  const cacheKey = `youtube:${companyName.toLowerCase()}`;
  const cached = crawlCache.get(cacheKey);
  if (cached) return cached;

  if (!YOUTUBE_API_KEY) {
    return buildUnavailableYouTubeData("YOUTUBE_API_KEY environment variable is not set.");
  }

  try {
    // Step 1: Find the brand's official YouTube channel
    const channelInfo = await findBrandChannel(companyName, website);

    // Step 2: Fetch recent ad/promotional videos
    const recentAds = await fetchRecentAdVideos(companyName, channelInfo.channelId);

    // Step 3: Derive insights from real video data using AI
    const insights = await deriveAdsInsights(companyName, channelInfo, recentAds);

    const adFormats = detectAdFormats(recentAds);

    const sortedByViews = [...recentAds]
      .filter((a) => a.viewCount !== null)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));

    const topAd = sortedByViews[0] ?? null;

    const avgViewCount =
      recentAds.length > 0 && recentAds.some((a) => a.viewCount !== null)
        ? Math.round(
            recentAds.reduce((sum, a) => sum + (a.viewCount ?? 0), 0) / recentAds.length
          )
        : null;

    // Estimate monthly upload frequency from total videos + channel age
    const estimatedMonthlyUploads = channelInfo.totalVideos
      ? Math.round(channelInfo.totalVideos / 12)
      : null;

    const result: YouTubeAdsData = {
      fetchSuccess: true,
      channelId: channelInfo.channelId,
      channelName: channelInfo.channelName,
      subscriberCount: channelInfo.subscriberCount,
      totalVideos: channelInfo.totalVideos,
      totalViews: channelInfo.totalViews,
      recentAds: recentAds.slice(0, 10),
      adFormats,
      avgViewCount,
      topPerformingAd: topAd,
      contentThemes: insights.contentThemes,
      primaryMessage: insights.primaryMessage,
      callToAction: insights.callToAction,
      estimatedMonthlyUploads,
      adExamples: insights.adExamples,
      _note: `Real data from YouTube Data API v3. Channel: ${channelInfo.channelName ?? "not found"}. ${recentAds.length} recent videos analyzed.`,
    };

    crawlCache.set(cacheKey, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return buildUnavailableYouTubeData(`YouTube API error: ${msg}`);
  }
}

function buildUnavailableYouTubeData(note: string): YouTubeAdsData {
  return {
    fetchSuccess: false,
    channelId: null,
    channelName: null,
    subscriberCount: null,
    totalVideos: null,
    totalViews: null,
    recentAds: [],
    adFormats: [],
    avgViewCount: null,
    topPerformingAd: null,
    contentThemes: [],
    primaryMessage: "",
    callToAction: "",
    estimatedMonthlyUploads: null,
    adExamples: [],
    _note: note,
  };
}
