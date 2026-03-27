export interface PlatformInfo {
  isVideo: boolean;
  platform: string | null;
  icon: string;
  isPlaylist: boolean;
}

interface PlatformPattern {
  platform: string;
  icon: string;
  patterns: RegExp[];
  playlistPatterns?: RegExp[];
}

const PLATFORMS: PlatformPattern[] = [
  {
    platform: "youtube",
    icon: "youtube",
    patterns: [
      /(?:youtube\.com\/(?:watch|shorts|embed|v)|youtu\.be\/)/i,
      /youtube\.com\/playlist/i,
      /youtube\.com\/@[^/]+/i,
      /music\.youtube\.com\/watch/i,
    ],
    playlistPatterns: [
      /youtube\.com\/playlist\?list=/i,
      /youtube\.com\/.*[?&]list=/i,
      /youtube\.com\/@[^/]+\/videos/i,
    ],
  },
  {
    platform: "facebook",
    icon: "facebook",
    patterns: [
      /facebook\.com\/.*\/videos\//i,
      /facebook\.com\/watch/i,
      /facebook\.com\/reel\//i,
      /fb\.watch\//i,
      /facebook\.com\/.*\/posts\//i,
    ],
  },
  {
    platform: "instagram",
    icon: "instagram",
    patterns: [
      /instagram\.com\/p\//i,
      /instagram\.com\/reel\//i,
      /instagram\.com\/reels\//i,
      /instagram\.com\/tv\//i,
      /instagram\.com\/stories\//i,
    ],
  },
  {
    platform: "tiktok",
    icon: "tiktok",
    patterns: [
      /tiktok\.com\/@[^/]+\/video\//i,
      /tiktok\.com\/t\//i,
      /vm\.tiktok\.com\//i,
    ],
  },
  {
    platform: "twitter",
    icon: "twitter",
    patterns: [
      /(?:twitter\.com|x\.com)\/[^/]+\/status\//i,
    ],
  },
  {
    platform: "twitch",
    icon: "twitch",
    patterns: [
      /twitch\.tv\/videos\//i,
      /twitch\.tv\/[^/]+\/clip\//i,
      /clips\.twitch\.tv\//i,
    ],
  },
  {
    platform: "vimeo",
    icon: "vimeo",
    patterns: [
      /vimeo\.com\/\d+/i,
      /player\.vimeo\.com\/video\//i,
    ],
  },
  {
    platform: "dailymotion",
    icon: "dailymotion",
    patterns: [
      /dailymotion\.com\/video\//i,
      /dai\.ly\//i,
    ],
  },
  {
    platform: "reddit",
    icon: "reddit",
    patterns: [
      /reddit\.com\/r\/[^/]+\/comments\//i,
      /v\.redd\.it\//i,
    ],
  },
  {
    platform: "soundcloud",
    icon: "soundcloud",
    patterns: [
      /soundcloud\.com\/[^/]+\/[^/]+/i,
    ],
  },
  {
    platform: "bilibili",
    icon: "bilibili",
    patterns: [
      /bilibili\.com\/video\//i,
      /b23\.tv\//i,
    ],
  },
];

export function detectPlatform(url: string): PlatformInfo {
  const trimmed = url.trim();

  for (const p of PLATFORMS) {
    for (const pattern of p.patterns) {
      if (pattern.test(trimmed)) {
        let isPlaylist = false;
        if (p.playlistPatterns) {
          isPlaylist = p.playlistPatterns.some((pp) => pp.test(trimmed));
        }
        return {
          isVideo: true,
          platform: p.platform,
          icon: p.icon,
          isPlaylist,
        };
      }
    }
  }

  return {
    isVideo: false,
    platform: null,
    icon: "",
    isPlaylist: false,
  };
}

export function getPlatformLabel(platform: string | null): string {
  if (!platform) return "Video";
  const labels: Record<string, string> = {
    youtube: "YouTube",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    twitter: "X (Twitter)",
    twitch: "Twitch",
    vimeo: "Vimeo",
    dailymotion: "Dailymotion",
    reddit: "Reddit",
    soundcloud: "SoundCloud",
    bilibili: "Bilibili",
  };
  return labels[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
