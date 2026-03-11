import { watchProgressRepository } from "../../data/repository/watchProgressRepository.js";
import { watchedItemsRepository } from "../../data/repository/watchedItemsRepository.js";
import { WebOSPlayerExtensions } from "../../platform/webos/webosPlayerExtensions.js";
import { WatchProgressSyncService } from "../profile/watchProgressSyncService.js";

const WEBOS_SUBTITLE_COLOR_MAP = {
  "rgba(0, 0, 0, 0)": "none",
  "rgba(0, 0, 0, 255)": "black",
  "rgba(255, 255, 255, 255)": "white",
  "rgba(255, 255, 0, 255)": "yellow",
  "rgba(255, 0, 0, 255)": "red",
  "rgba(0, 255, 0, 255)": "green",
  "rgba(0, 0, 255, 255)": "blue",
  "rgba(0, 0, 0, 1)": "black",
  "rgba(255, 255, 255, 1)": "white",
  "rgba(255, 255, 0, 1)": "yellow",
  "rgba(255, 0, 0, 1)": "red",
  "rgba(0, 255, 0, 1)": "green",
  "rgba(0, 0, 255, 1)": "blue",
  "rgb(0, 0, 0)": "black",
  "rgb(255, 255, 255)": "white",
  "rgb(255, 255, 0)": "yellow",
  "rgb(255, 0, 0)": "red",
  "rgb(0, 255, 0)": "green",
  "rgb(0, 0, 255)": "blue",
  "#000000FF": "black",
  "#FFFFFFFF": "white",
  "#FFFF00FF": "yellow",
  "#FF0000FF": "red",
  "#00FF00FF": "green",
  "#0000FFFF": "blue",
  "#000000": "black",
  "#FFFFFF": "white",
  "#FFFF00": "yellow",
  "#FF0000": "red",
  "#00FF00": "green",
  "#0000FF": "blue"
};

const WEBOS_SUBTITLE_COLORS = new Set(["none", "black", "white", "yellow", "red", "green", "blue"]);
const WEBOS_UNSUPPORTED_AUDIO_CODECS_DEFAULT = ["DTS", "TRUEHD"];
const WEBOS_UNSUPPORTED_SUBTITLE_CODECS_DEFAULT = ["HDMV/PGS", "VOBSUB"];

function mapSubtitleOffsetToWebOs(offsetPercent) {
  const value = Number(offsetPercent);
  if (!Number.isFinite(value)) {
    return -2;
  }
  if (value <= 0) {
    return -3;
  }
  if (value <= 5) {
    return -2;
  }
  if (value <= 10) {
    return 0;
  }
  if (value <= 15) {
    return 2;
  }
  if (value <= 20) {
    return 4;
  }
  return -2;
}

function mapSubtitleSizeToWebOs(sizePercent) {
  const value = Number(sizePercent);
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 100) {
    return 1;
  }
  if (value <= 150) {
    return 3;
  }
  if (value <= 200) {
    return 4;
  }
  return 4;
}

export const PlayerController = {

  video: null,
  isPlaying: false,
  currentItemId: null,
  currentItemType: null,
  currentVideoId: null,
  currentSeason: null,
  currentEpisode: null,
  progressSaveTimer: null,
  lastProgressPushAt: 0,
  lifecycleBound: false,
  lifecycleFlushHandler: null,
  visibilityFlushHandler: null,
  hlsInstance: null,
  dashInstance: null,
  playbackEngine: "none",
  avplayActive: false,
  avplayUrl: "",
  avplayAudioTracks: [],
  avplaySubtitleTracks: [],
  selectedAvPlayAudioTrackIndex: -1,
  selectedAvPlaySubtitleTrackIndex: -1,
  avplayTickTimer: null,
  avplayReady: false,
  avplayEnded: false,
  avplayCurrentTimeMs: 0,
  avplayDurationMs: 0,
  lastPlaybackErrorCode: 0,
  currentPlaybackUrl: "",
  currentPlaybackHeaders: {},
  currentPlaybackMediaSourceType: null,
  avplayFallbackAttempts: new Set(),
  nativeWebOsMediaId: "",
  nativeWebOsAudioTracks: [],
  nativeWebOsSubtitleTracks: [],
  selectedNativeWebOsAudioTrackIndex: -1,
  selectedNativeWebOsSubtitleTrackIndex: -1,
  nativeWebOsTrackSyncToken: 0,
  nativeWebOsTrackSyncSucceeded: false,
  webOsDeviceInfoFetched: false,
  webOsUnsupportedAudioCodecs: WEBOS_UNSUPPORTED_AUDIO_CODECS_DEFAULT.slice(),
  webOsUnsupportedSubtitleCodecs: WEBOS_UNSUPPORTED_SUBTITLE_CODECS_DEFAULT.slice(),

  isExpectedPlayInterruption(error) {
    const message = String(error?.message || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();
    if (name === "aborterror") {
      return true;
    }
    return message.includes("interrupted by a new load request")
      || message.includes("the play() request was interrupted");
  },

  guessMediaMimeType(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return null;
    }

    const probeValues = [raw];
    try {
      probeValues.push(decodeURIComponent(raw));
    } catch (_) {
      // Ignore decode failures.
    }

    const inferByProbe = (value) => {
      const lower = String(value || "").toLowerCase();
      if (!lower) {
        return null;
      }
      if (
        lower.includes(".m3u8")
        || lower.includes("application/vnd.apple.mpegurl")
        || lower.includes("application/x-mpegurl")
        || /(?:^|[?&#])(type|format|protocol|manifest)=hls(?:$|[&#])/i.test(lower)
      ) {
        return "application/vnd.apple.mpegurl";
      }
      if (
        lower.includes(".mpd")
        || lower.includes("application/dash+xml")
        || /(?:^|[?&#])(type|format|protocol|manifest)=dash(?:$|[&#])/i.test(lower)
      ) {
        return "application/dash+xml";
      }
      return null;
    };

    try {
      const parsed = new URL(raw);
      const parsedResult = inferByProbe(`${parsed.pathname}${parsed.search}`);
      if (parsedResult) {
        return parsedResult;
      }
    } catch (_) {
      // Ignore URL parsing failures and fall back to raw probe strings.
    }

    for (const value of probeValues) {
      const inferred = inferByProbe(value);
      if (inferred) {
        return inferred;
      }
    }
    return null;
  },

  isLikelyHlsMimeType(mimeType) {
    const value = String(mimeType || "").trim().toLowerCase();
    if (!value) {
      return false;
    }
    return value === "hls"
      || value.includes("application/vnd.apple.mpegurl")
      || value.includes("application/x-mpegurl")
      || value.includes("audio/mpegurl")
      || value.includes(".m3u8");
  },

  isLikelyDashMimeType(mimeType) {
    const value = String(mimeType || "").trim().toLowerCase();
    if (!value) {
      return false;
    }
    return value === "dash"
      || value.includes("application/dash+xml")
      || value.includes(".mpd");
  },

  canUseHlsJs() {
    const Hls = globalThis.Hls;
    return Boolean(Hls && typeof Hls.isSupported === "function" && Hls.isSupported());
  },

  canUseDashJs() {
    const dashjs = globalThis.dashjs;
    if (!dashjs || typeof dashjs.MediaPlayer !== "function") {
      return false;
    }
    try {
      const player = dashjs.MediaPlayer();
      return Boolean(player && typeof player.create === "function");
    } catch (_) {
      return false;
    }
  },

  canPlayNatively(mimeType) {
    const video = this.video;
    if (!video || !mimeType) {
      return false;
    }
    try {
      const result = String(video.canPlayType(String(mimeType))).toLowerCase();
      return result === "probably" || result === "maybe";
    } catch (_) {
      return false;
    }
  },

  isUnsupportedSourceError(error) {
    const message = String(error?.message || "").toLowerCase();
    return message.includes("no supported source")
      || message.includes("no supported sources")
      || message.includes("not supported");
  },

  getAvPlay() {
    const webapis = globalThis.webapis;
    const avplay = webapis?.avplay || webapis?.avPlay || globalThis.avplay || null;
    if (!avplay || typeof avplay.open !== "function") {
      return null;
    }
    return avplay;
  },

  canUseAvPlay() {
    return Boolean(this.getAvPlay());
  },

  canUseWebOsLunaMedia() {
    return Boolean(globalThis.webOS?.service?.request);
  },

  lunaMediaRequest(method, parameters = {}, service = "luna://com.webos.media") {
    if (!this.canUseWebOsLunaMedia() || !method) {
      return Promise.reject(new Error("webos_luna_unavailable"));
    }
    return new Promise((resolve, reject) => {
      try {
        globalThis.webOS.service.request(service, {
          method,
          parameters: { ...(parameters || {}) },
          onSuccess: (result) => resolve(result || {}),
          onFailure: (result) => {
            reject(result || new Error("webos_luna_failure"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  getNativeMediaId() {
    const mediaId = this.video?.mediaId || this.video?.mediaid || "";
    return String(mediaId || "").trim();
  },

  isUsingNativePlayback() {
    return this.playbackEngine === "native" && !this.isUsingAvPlay();
  },

  resetNativeWebOsTrackState() {
    this.nativeWebOsMediaId = "";
    this.nativeWebOsAudioTracks = [];
    this.nativeWebOsSubtitleTracks = [];
    this.selectedNativeWebOsAudioTrackIndex = -1;
    this.selectedNativeWebOsSubtitleTrackIndex = -1;
    this.nativeWebOsTrackSyncSucceeded = false;
    this.nativeWebOsTrackSyncToken += 1;
  },

  getNativeWebOsAudioTracks() {
    return this.nativeWebOsAudioTracks.slice();
  },

  getNativeWebOsSubtitleTracks() {
    return this.nativeWebOsSubtitleTracks.slice();
  },

  getSelectedNativeWebOsAudioTrackIndex() {
    return Number.isFinite(this.selectedNativeWebOsAudioTrackIndex) ? this.selectedNativeWebOsAudioTrackIndex : -1;
  },

  getSelectedNativeWebOsSubtitleTrackIndex() {
    return Number.isFinite(this.selectedNativeWebOsSubtitleTrackIndex) ? this.selectedNativeWebOsSubtitleTrackIndex : -1;
  },

  normalizeWebOsTrackType(value = "") {
    const type = String(value || "").trim().toLowerCase();
    if (!type) {
      return "";
    }
    if (type.includes("audio")) {
      return "audio";
    }
    if (type.includes("text") || type.includes("subtitle") || type.includes("caption")) {
      return "text";
    }
    return type;
  },

  normalizeCodecLabel(value = "") {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  },

  isUnsupportedWebOsCodec(codecValue = "", kind = "audio") {
    const normalizedCodec = this.normalizeCodecLabel(codecValue);
    if (!normalizedCodec) {
      return false;
    }
    const sourceList = kind === "text"
      ? this.webOsUnsupportedSubtitleCodecs
      : this.webOsUnsupportedAudioCodecs;
    const candidates = Array.isArray(sourceList) ? sourceList : [];
    return candidates.some((entry) => {
      const normalizedEntry = this.normalizeCodecLabel(entry);
      return normalizedEntry && normalizedCodec.includes(normalizedEntry);
    });
  },

  async ensureWebOsDeviceInfo() {
    if (this.webOsDeviceInfoFetched || !this.canUseWebOsLunaMedia()) {
      return;
    }
    try {
      const payload = await this.lunaMediaRequest(
        "getConfigs",
        { configNames: ["tv.model.edidType"] },
        "luna://com.webos.service.config"
      );
      const edidType = String(payload?.configs?.["tv.model.edidType"] || "").trim().toLowerCase();
      if (edidType.includes("dts")) {
        this.webOsUnsupportedAudioCodecs = this.webOsUnsupportedAudioCodecs.filter((codec) => this.normalizeCodecLabel(codec) !== "DTS");
      }
      if (edidType.includes("truehd")) {
        this.webOsUnsupportedAudioCodecs = this.webOsUnsupportedAudioCodecs.filter((codec) => this.normalizeCodecLabel(codec) !== "TRUEHD");
      }
    } catch (_) {
      // Keep default compatibility assumptions when config lookup fails.
    } finally {
      this.webOsDeviceInfoFetched = true;
    }
  },

  filterUnsupportedWebOsTracks(tracks = [], kind = "audio") {
    return (tracks || []).filter((track) => !this.isUnsupportedWebOsCodec(track?.codec || "", kind));
  },

  extractWebOsTracksFromPayload(payload, kind = "audio") {
    const targetKind = kind === "audio" ? "audio" : "text";
    const buckets = [];
    const root = payload && typeof payload === "object" ? payload : {};

    const candidateArrays = Object.entries(root)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => ({ key: String(key || ""), value }));

    const nestedKeys = ["trackInfo", "tracks", "mediaTrackInfo"];
    nestedKeys.forEach((key) => {
      const nested = root?.[key];
      if (nested && typeof nested === "object") {
        Object.entries(nested).forEach(([nestedKey, nestedValue]) => {
          if (Array.isArray(nestedValue)) {
            candidateArrays.push({
              key: `${key}.${String(nestedKey || "")}`,
              value: nestedValue
            });
          }
        });
      }
    });

    candidateArrays.forEach(({ key, value }) => {
      const loweredKey = String(key || "").toLowerCase();
      const keyType = this.normalizeWebOsTrackType(loweredKey);
      value.forEach((track) => {
        if (!track || typeof track !== "object") {
          return;
        }
        const trackType = this.normalizeWebOsTrackType(track.type || track.trackType || track.mediaType || keyType);
        if (!trackType && keyType) {
          if (keyType !== targetKind) {
            return;
          }
        } else if (trackType && trackType !== targetKind) {
          return;
        }
        buckets.push(track);
      });
    });

    const normalized = buckets.map((track, fallbackIndex) => {
      const rawIndex = Number(
        track.index
        ?? track.trackIndex
        ?? track.id
        ?? track.trackId
        ?? fallbackIndex
      );
      const trackIndex = Number.isFinite(rawIndex) ? rawIndex : fallbackIndex;
      const language = String(track.language || track.lang || track.trackLang || "").trim();
      const label = String(
        track.label
        || track.name
        || track.title
        || (targetKind === "audio" ? `Track ${fallbackIndex + 1}` : `Subtitle ${fallbackIndex + 1}`)
      ).trim();
      const codec = String(
        track.codec
        || track.codecName
        || track.format
        || track.mime
        || track.mimeType
        || track.contentType
        || track.audioCodec
        || track.videoCodec
        || ""
      ).trim();
      const selected = Boolean(track.selected || track.current || track.default || track.isSelected);
      return {
        id: `native-${targetKind}-${trackIndex}`,
        label,
        language,
        codec,
        nativeTrackIndex: trackIndex,
        selected
      };
    });

    const dedupMap = new Map();
    normalized.forEach((track) => {
      const key = Number(track.nativeTrackIndex);
      if (!dedupMap.has(key)) {
        dedupMap.set(key, track);
      }
    });
    return Array.from(dedupMap.values()).sort((a, b) => Number(a.nativeTrackIndex) - Number(b.nativeTrackIndex));
  },

  async syncNativeWebOsTrackInfo() {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      this.resetNativeWebOsTrackState();
      return false;
    }

    await this.ensureWebOsDeviceInfo();

    const mediaId = this.getNativeMediaId();
    if (!mediaId) {
      return false;
    }

    this.nativeWebOsMediaId = mediaId;
    const syncToken = this.nativeWebOsTrackSyncToken + 1;
    this.nativeWebOsTrackSyncToken = syncToken;

    try {
      const payload = await this.lunaMediaRequest("getTrackInfo", { mediaId });
      if (syncToken !== this.nativeWebOsTrackSyncToken) {
        return false;
      }

      const audioTracks = this.filterUnsupportedWebOsTracks(
        this.extractWebOsTracksFromPayload(payload, "audio"),
        "audio"
      );
      const subtitleTracks = this.filterUnsupportedWebOsTracks(
        this.extractWebOsTracksFromPayload(payload, "text"),
        "text"
      );
      this.nativeWebOsTrackSyncSucceeded = true;

      this.nativeWebOsAudioTracks = audioTracks;
      this.nativeWebOsSubtitleTracks = subtitleTracks;

      const selectedAudio = audioTracks.find((track) => track.selected);
      const selectedSubtitle = subtitleTracks.find((track) => track.selected);
      this.selectedNativeWebOsAudioTrackIndex = selectedAudio
        ? Number(selectedAudio.nativeTrackIndex)
        : (audioTracks.length ? Number(audioTracks[0].nativeTrackIndex) : -1);
      this.selectedNativeWebOsSubtitleTrackIndex = selectedSubtitle
        ? Number(selectedSubtitle.nativeTrackIndex)
        : -1;

      this.emitVideoEvent("webosnativetrackschanged", { playbackEngine: "native" });
      return audioTracks.length > 0 || subtitleTracks.length > 0;
    } catch (_) {
      // Ignore track-sync failures on devices/providers that do not expose track info.
      this.nativeWebOsTrackSyncSucceeded = false;
      return false;
    }
  },

  waitForMilliseconds(timeoutMs = 0) {
    const safeTimeout = Math.max(0, Number(timeoutMs || 0));
    return new Promise((resolve) => {
      setTimeout(resolve, safeTimeout);
    });
  },

  async syncNativeWebOsTrackInfoWithRetry({ attempts = 4, intervalMs = 220 } = {}) {
    const maxAttempts = Math.max(1, Math.floor(Number(attempts || 0)) || 1);
    const delayMs = Math.max(60, Number(intervalMs || 0));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (!this.isUsingNativePlayback()) {
        return false;
      }
      const hasTracks = await this.syncNativeWebOsTrackInfo();
      if (hasTracks || this.nativeWebOsAudioTracks.length > 0 || this.nativeWebOsSubtitleTracks.length > 0) {
        return true;
      }
      if (attempt < maxAttempts - 1) {
        await this.waitForMilliseconds(delayMs);
      }
    }
    return this.nativeWebOsAudioTracks.length > 0 || this.nativeWebOsSubtitleTracks.length > 0;
  },

  async maybeFallbackToAvPlayForDirectFileNoAudio(reason = "native_no_audio_tracks") {
    if (!this.isUsingNativePlayback() || !this.canUseAvPlay()) {
      return false;
    }

    const url = String(this.currentPlaybackUrl || this.video?.currentSrc || this.video?.src || "").trim();
    if (!url || !this.isLikelyDirectFileUrl(url)) {
      return false;
    }

    const htmlAudioTrackList = this.video?.audioTracks || this.video?.webkitAudioTracks || this.video?.mozAudioTracks;
    const htmlAudioTrackCount = Number(htmlAudioTrackList?.length || 0);
    if (htmlAudioTrackCount > 0) {
      return false;
    }

    if (this.canUseWebOsLunaMedia()) {
      const hadMediaIdAtStart = Boolean(this.getNativeMediaId());
      await this.syncNativeWebOsTrackInfoWithRetry({ attempts: 4, intervalMs: 260 });
      if (!this.isUsingNativePlayback()) {
        return false;
      }
      if (!this.nativeWebOsTrackSyncSucceeded) {
        return false;
      }
      if (this.nativeWebOsAudioTracks.length > 0) {
        return false;
      }
      const hasMediaIdNow = Boolean(this.getNativeMediaId());
      if (!hadMediaIdAtStart && !hasMediaIdNow) {
        return false;
      }
    }

    return this.forceAvPlayFallbackForCurrentSource(reason);
  },

  async setNativeWebOsAudioTrack(trackIndex) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }

    const mediaId = this.getNativeMediaId();
    const targetIndex = Number(trackIndex);
    if (!mediaId || !Number.isFinite(targetIndex) || targetIndex < 0) {
      return false;
    }

    try {
      await this.lunaMediaRequest("selectTrack", {
        mediaId,
        type: "audio",
        index: targetIndex
      });
      const audioTrackList = this.video?.audioTracks || this.video?.webkitAudioTracks || this.video?.mozAudioTracks;
      const audioTrackCount = Number(audioTrackList?.length || 0);
      for (let index = 0; index < audioTrackCount; index += 1) {
        const track = audioTrackList?.[index] || audioTrackList?.item?.(index) || null;
        if (!track) {
          continue;
        }
        try {
          track.enabled = index === targetIndex;
        } catch (_) {
          // Ignore readonly track-toggle failures.
        }
        try {
          if ("selected" in track) {
            track.selected = index === targetIndex;
          }
        } catch (_) {
          // Ignore readonly selected-flag failures.
        }
      }
      this.selectedNativeWebOsAudioTrackIndex = targetIndex;
      this.syncNativeWebOsTrackInfoWithRetry({ attempts: 2, intervalMs: 160 });
      this.emitVideoEvent("webosnativetrackschanged", { playbackEngine: "native" });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsSubtitleTrack(trackIndex) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }

    const mediaId = this.getNativeMediaId();
    const targetIndex = Number(trackIndex);
    if (!mediaId) {
      return false;
    }

    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      try {
        await this.lunaMediaRequest("setSubtitleEnable", { mediaId, enable: false });
        const textTrackList = this.video?.textTracks || this.video?.webkitTextTracks || this.video?.mozTextTracks;
        const textTrackCount = Number(textTrackList?.length || 0);
        for (let index = 0; index < textTrackCount; index += 1) {
          const track = textTrackList?.[index] || textTrackList?.item?.(index) || null;
          if (!track) {
            continue;
          }
          try {
            track.mode = "disabled";
          } catch (_) {
            // Ignore readonly subtitle mode updates.
          }
        }
        this.selectedNativeWebOsSubtitleTrackIndex = -1;
        this.syncNativeWebOsTrackInfoWithRetry({ attempts: 2, intervalMs: 160 });
        this.emitVideoEvent("webosnativetrackschanged", { playbackEngine: "native" });
        return true;
      } catch (_) {
        return false;
      }
    }

    try {
      await this.lunaMediaRequest("setSubtitleEnable", { mediaId, enable: true });
      await this.lunaMediaRequest("selectTrack", {
        mediaId,
        type: "text",
        index: targetIndex
      });
      const textTrackList = this.video?.textTracks || this.video?.webkitTextTracks || this.video?.mozTextTracks;
      const textTrackCount = Number(textTrackList?.length || 0);
      for (let index = 0; index < textTrackCount; index += 1) {
        const track = textTrackList?.[index] || textTrackList?.item?.(index) || null;
        if (!track) {
          continue;
        }
        try {
          track.mode = index === targetIndex ? "showing" : "disabled";
        } catch (_) {
          // Ignore readonly subtitle mode updates.
        }
      }
      this.selectedNativeWebOsSubtitleTrackIndex = targetIndex;
      this.syncNativeWebOsTrackInfoWithRetry({ attempts: 2, intervalMs: 160 });
      this.emitVideoEvent("webosnativetrackschanged", { playbackEngine: "native" });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsSubtitleOffset(offsetPercent) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    if (!mediaId) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setSubtitlePosition", {
        mediaId,
        position: mapSubtitleOffsetToWebOs(offsetPercent)
      });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsSubtitleSize(sizePercent) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    if (!mediaId) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setSubtitleFontSize", {
        mediaId,
        fontSize: mapSubtitleSizeToWebOs(sizePercent)
      });
      return true;
    } catch (_) {
      return false;
    }
  },

  mapCssColorToWebOs(colorValue) {
    const raw = String(colorValue || "").trim();
    if (!raw) {
      return null;
    }
    const mapped = WEBOS_SUBTITLE_COLOR_MAP[raw] || WEBOS_SUBTITLE_COLOR_MAP[raw.toUpperCase()] || null;
    if (mapped && WEBOS_SUBTITLE_COLORS.has(mapped)) {
      return mapped;
    }
    const lowered = raw.toLowerCase();
    if (WEBOS_SUBTITLE_COLORS.has(lowered)) {
      return lowered;
    }
    return null;
  },

  async setNativeWebOsSubtitleTextColor(colorValue) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    const charColor = this.mapCssColorToWebOs(colorValue);
    if (!mediaId || !charColor) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setSubtitleCharacterColor", { mediaId, charColor });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsSubtitleBackgroundColor(colorValue) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    const bgColor = this.mapCssColorToWebOs(colorValue);
    if (!mediaId || !bgColor) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setSubtitleBackgroundColor", {
        mediaId,
        bgColor: bgColor === "none" ? "black" : bgColor
      });
      await this.lunaMediaRequest("setSubtitleBackgroundOpacity", {
        mediaId,
        bgOpacity: bgColor === "none" ? 0 : 255
      });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsSubtitleOpacity(opacityPercent) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    const safePercent = Math.max(0, Math.min(100, Number(opacityPercent || 0)));
    if (!mediaId || !Number.isFinite(safePercent)) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setSubtitleCharacterOpacity", {
        mediaId,
        charOpacity: Math.floor((safePercent / 100) * 255)
      });
      return true;
    } catch (_) {
      return false;
    }
  },

  async setNativeWebOsPlaybackRate(playbackRate = 1) {
    if (!this.isUsingNativePlayback() || !this.canUseWebOsLunaMedia()) {
      return false;
    }
    const mediaId = this.getNativeMediaId();
    const rate = Number(playbackRate);
    if (!mediaId || !Number.isFinite(rate) || rate <= 0) {
      return false;
    }
    try {
      await this.lunaMediaRequest("setPlayRate", {
        mediaId,
        playRate: rate,
        audioOutput: true
      });
      return true;
    } catch (_) {
      return false;
    }
  },

  getDirectFileExtension(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return "";
    }

    const probes = [raw];
    try {
      probes.push(decodeURIComponent(raw));
    } catch (_) {
      // Ignore decode failures.
    }

    for (const value of probes) {
      const match = String(value || "").match(/\.(mkv|mp4|m4v|mov|webm|avi|ts|m2ts)(?=($|[/?#&]))/i);
      if (match && match[1]) {
        return String(match[1]).toLowerCase();
      }
    }
    return "";
  },

  isLikelyDirectFileUrl(url) {
    return Boolean(this.getDirectFileExtension(url));
  },

  isAvPlayPreferredDirectFile(url) {
    const extension = this.getDirectFileExtension(url);
    return extension === "mkv"
      || extension === "avi"
      || extension === "ts"
      || extension === "m2ts";
  },

  resolveSourceTypeHint(mediaSourceType, url) {
    const explicitHint = String(mediaSourceType || "").trim();
    const guessedHint = String(this.guessMediaMimeType(url) || "").trim();

    if (this.isLikelyHlsMimeType(explicitHint) || this.isLikelyDashMimeType(explicitHint)) {
      return explicitHint;
    }
    if (guessedHint) {
      return guessedHint;
    }
    return explicitHint || null;
  },

  isUsingAvPlay() {
    return this.playbackEngine === "avplay" && this.avplayActive;
  },

  emitVideoEvent(eventName, detail = null) {
    if (!this.video || !eventName) {
      return;
    }

    try {
      const event = typeof CustomEvent === "function"
        ? new CustomEvent(eventName, { detail: detail || null })
        : (() => {
          const legacyEvent = document.createEvent("CustomEvent");
          legacyEvent.initCustomEvent(eventName, false, false, detail || null);
          return legacyEvent;
        })();
      this.video.dispatchEvent(event);
    } catch (_) {
      // Ignore synthetic event failures.
    }
  },

  stopAvPlayTickTimer() {
    if (this.avplayTickTimer) {
      clearInterval(this.avplayTickTimer);
      this.avplayTickTimer = null;
    }
  },

  startAvPlayTickTimer() {
    this.stopAvPlayTickTimer();
    this.avplayTickTimer = setInterval(() => {
      if (!this.isUsingAvPlay()) {
        return;
      }
      this.refreshAvPlayTimeline();
      this.emitVideoEvent("timeupdate", { playbackEngine: "avplay" });
    }, 1000);
  },

  refreshAvPlayTimeline() {
    if (!this.isUsingAvPlay()) {
      return;
    }
    const avplay = this.getAvPlay();
    if (!avplay) {
      return;
    }
    try {
      const currentMs = Number(avplay.getCurrentTime?.() || 0);
      if (Number.isFinite(currentMs) && currentMs >= 0) {
        this.avplayCurrentTimeMs = currentMs;
      }
    } catch (_) {
      // Ignore current-time polling failures.
    }
    try {
      const durationMs = Number(avplay.getDuration?.() || 0);
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        this.avplayDurationMs = durationMs;
      }
    } catch (_) {
      // Ignore duration polling failures.
    }
  },

  parseAvPlayExtraInfo(extraInfoValue) {
    if (!extraInfoValue) {
      return null;
    }
    if (typeof extraInfoValue === "object") {
      return extraInfoValue;
    }
    try {
      return JSON.parse(String(extraInfoValue));
    } catch (_) {
      return null;
    }
  },

  normalizeAvPlayTrackType(typeValue) {
    const type = String(typeValue || "").trim().toUpperCase();
    if (type === "AUDIO" || type === "TEXT" || type === "SUBTITLE" || type === "VIDEO") {
      return type;
    }
    if (type.includes("AUDIO")) {
      return "AUDIO";
    }
    if (type.includes("TEXT") || type.includes("SUBTITLE")) {
      return "TEXT";
    }
    if (type.includes("VIDEO")) {
      return "VIDEO";
    }
    return type;
  },

  pickAvPlayTrackLabel(track = {}, trackIndex = 0, prefix = "Track") {
    const extraInfo = this.parseAvPlayExtraInfo(track.extra_info || track.extraInfo || null) || {};
    return String(
      track.name
      || track.label
      || extraInfo.name
      || extraInfo.label
      || extraInfo.track_lang
      || extraInfo.language
      || `${prefix} ${trackIndex + 1}`
    ).trim();
  },

  pickAvPlayTrackLanguage(track = {}) {
    const extraInfo = this.parseAvPlayExtraInfo(track.extra_info || track.extraInfo || null) || {};
    return String(
      track.language
      || track.lang
      || extraInfo.track_lang
      || extraInfo.language
      || ""
    ).trim();
  },

  syncAvPlayTrackInfo() {
    if (!this.isUsingAvPlay()) {
      this.avplayAudioTracks = [];
      this.avplaySubtitleTracks = [];
      this.selectedAvPlayAudioTrackIndex = -1;
      this.selectedAvPlaySubtitleTrackIndex = -1;
      return;
    }

    const avplay = this.getAvPlay();
    if (!avplay) {
      return;
    }

    const totalTracks = (() => {
      try {
        const value = avplay.getTotalTrackInfo?.();
        return Array.isArray(value) ? value : [];
      } catch (_) {
        return [];
      }
    })();

    const currentTracks = (() => {
      try {
        const value = avplay.getCurrentStreamInfo?.();
        return Array.isArray(value) ? value : [];
      } catch (_) {
        return [];
      }
    })();

    const currentAudio = currentTracks.find((track) => this.normalizeAvPlayTrackType(track?.type) === "AUDIO");
    const currentText = currentTracks.find((track) => this.normalizeAvPlayTrackType(track?.type) === "TEXT");
    const selectedAudioIndex = Number(currentAudio?.index);
    const selectedTextIndex = Number(currentText?.index);

    this.avplayAudioTracks = totalTracks
      .filter((track) => this.normalizeAvPlayTrackType(track?.type) === "AUDIO")
      .map((track, index) => {
        const trackIndex = Number(track?.index);
        const normalizedTrackIndex = Number.isFinite(trackIndex) ? trackIndex : index;
        return {
          id: `avplay-audio-${normalizedTrackIndex}`,
          label: this.pickAvPlayTrackLabel(track, index, "Track"),
          language: this.pickAvPlayTrackLanguage(track),
          avplayTrackIndex: normalizedTrackIndex
        };
      });

    this.avplaySubtitleTracks = totalTracks
      .filter((track) => this.normalizeAvPlayTrackType(track?.type) === "TEXT")
      .map((track, index) => {
        const trackIndex = Number(track?.index);
        const normalizedTrackIndex = Number.isFinite(trackIndex) ? trackIndex : index;
        return {
          id: `avplay-sub-${normalizedTrackIndex}`,
          label: this.pickAvPlayTrackLabel(track, index, "Subtitle"),
          language: this.pickAvPlayTrackLanguage(track),
          avplayTrackIndex: normalizedTrackIndex
        };
      });

    if (Number.isFinite(selectedAudioIndex)) {
      this.selectedAvPlayAudioTrackIndex = selectedAudioIndex;
    } else if (this.avplayAudioTracks.length && this.selectedAvPlayAudioTrackIndex < 0) {
      this.selectedAvPlayAudioTrackIndex = this.avplayAudioTracks[0].avplayTrackIndex;
    } else if (!this.avplayAudioTracks.length) {
      this.selectedAvPlayAudioTrackIndex = -1;
    }

    if (Number.isFinite(selectedTextIndex)) {
      this.selectedAvPlaySubtitleTrackIndex = selectedTextIndex;
    } else if (!this.avplaySubtitleTracks.length) {
      this.selectedAvPlaySubtitleTrackIndex = -1;
    }
  },

  getAvPlayAudioTracks() {
    return this.avplayAudioTracks.slice();
  },

  getAvPlaySubtitleTracks() {
    return this.avplaySubtitleTracks.slice();
  },

  getSelectedAvPlayAudioTrackIndex() {
    return Number.isFinite(this.selectedAvPlayAudioTrackIndex) ? this.selectedAvPlayAudioTrackIndex : -1;
  },

  getSelectedAvPlaySubtitleTrackIndex() {
    return Number.isFinite(this.selectedAvPlaySubtitleTrackIndex) ? this.selectedAvPlaySubtitleTrackIndex : -1;
  },

  setAvPlayAudioTrack(trackIndex) {
    if (!this.isUsingAvPlay()) {
      return false;
    }
    const targetIndex = Number(trackIndex);
    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      return false;
    }

    const available = this.getAvPlayAudioTracks();
    if (!available.some((track) => Number(track?.avplayTrackIndex) === targetIndex)) {
      return false;
    }

    const avplay = this.getAvPlay();
    if (!avplay || typeof avplay.setSelectTrack !== "function") {
      return false;
    }

    try {
      avplay.setSelectTrack("AUDIO", targetIndex);
      this.selectedAvPlayAudioTrackIndex = targetIndex;
      this.syncAvPlayTrackInfo();
      this.emitVideoEvent("avplaytrackschanged", { playbackEngine: "avplay" });
      return true;
    } catch (_) {
      return false;
    }
  },

  setAvPlaySubtitleTrack(trackIndex) {
    if (!this.isUsingAvPlay()) {
      return false;
    }

    const avplay = this.getAvPlay();
    if (!avplay) {
      return false;
    }

    const targetIndex = Number(trackIndex);
    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      try {
        avplay.setSilentSubtitle?.(true);
      } catch (_) {
        // Ignore subtitle mute failures.
      }
      this.selectedAvPlaySubtitleTrackIndex = -1;
      this.emitVideoEvent("avplaytrackschanged", { playbackEngine: "avplay" });
      return true;
    }

    const available = this.getAvPlaySubtitleTracks();
    if (!available.some((track) => Number(track?.avplayTrackIndex) === targetIndex)) {
      return false;
    }

    try {
      avplay.setSilentSubtitle?.(false);
    } catch (_) {
      // Ignore subtitle unmute failures.
    }

    try {
      avplay.setSelectTrack?.("TEXT", targetIndex);
    } catch (_) {
      try {
        avplay.setSelectTrack?.("SUBTITLE", targetIndex);
      } catch (_) {
        return false;
      }
    }

    this.selectedAvPlaySubtitleTrackIndex = targetIndex;
    this.syncAvPlayTrackInfo();
    this.emitVideoEvent("avplaytrackschanged", { playbackEngine: "avplay" });
    return true;
  },

  setAvPlayExternalSubtitle(subtitleUrl) {
    if (!this.isUsingAvPlay()) {
      return false;
    }

    const avplay = this.getAvPlay();
    if (!avplay || typeof avplay.setExternalSubtitlePath !== "function") {
      return false;
    }

    const path = String(subtitleUrl || "").trim();
    try {
      avplay.setExternalSubtitlePath(path);
      try {
        avplay.setSilentSubtitle?.(!path);
      } catch (_) {
        // Ignore subtitle mute/unmute failures.
      }
      this.selectedAvPlaySubtitleTrackIndex = -1;
      this.emitVideoEvent("avplaytrackschanged", { playbackEngine: "avplay" });
      return true;
    } catch (_) {
      return false;
    }
  },

  mapAvPlayErrorToMediaCode(errorValue) {
    const errorText = String(errorValue || "").toLowerCase();
    if (!errorText) {
      return 4;
    }
    if (errorText.includes("network") || errorText.includes("connection") || errorText.includes("timeout")) {
      return 2;
    }
    if (errorText.includes("decode")) {
      return 3;
    }
    return 4;
  },

  setAvPlayDisplayRect() {
    const avplay = this.getAvPlay();
    if (!avplay) {
      return;
    }
    const width = Math.max(1, Math.round(Number(window.innerWidth || 1920)));
    const height = Math.max(1, Math.round(Number(window.innerHeight || 1080)));
    try {
      avplay.setDisplayRect?.(0, 0, width, height);
    } catch (_) {
      // Ignore display-rect failures.
    }
    try {
      avplay.setDisplayMethod?.("PLAYER_DISPLAY_MODE_FULL_SCREEN");
    } catch (_) {
      // Ignore display-method failures.
    }
  },

  teardownAvPlay() {
    const avplay = this.getAvPlay();

    this.stopAvPlayTickTimer();
    if (avplay) {
      try {
        avplay.setListener?.({});
      } catch (_) {
        // Ignore listener reset failures.
      }
      try {
        const state = String(avplay.getState?.() || "").toUpperCase();
        if (state && state !== "NONE" && state !== "IDLE") {
          avplay.stop?.();
        }
      } catch (_) {
        // Ignore stop failures.
      }
      try {
        avplay.close?.();
      } catch (_) {
        // Ignore close failures.
      }
    }

    this.avplayActive = false;
    this.avplayUrl = "";
    this.avplayAudioTracks = [];
    this.avplaySubtitleTracks = [];
    this.selectedAvPlayAudioTrackIndex = -1;
    this.selectedAvPlaySubtitleTrackIndex = -1;
    this.avplayReady = false;
    this.avplayEnded = false;
    this.avplayCurrentTimeMs = 0;
    this.avplayDurationMs = 0;
  },

  playWithAvPlay(url) {
    if (!this.canUseAvPlay()) {
      return false;
    }

    const avplay = this.getAvPlay();
    if (!avplay) {
      return false;
    }

    this.teardownAvPlay();
    this.resetNativeWebOsTrackState();

    this.avplayActive = true;
    this.avplayUrl = String(url || "");
    this.avplayReady = false;
    this.avplayEnded = false;
    this.avplayCurrentTimeMs = 0;
    this.avplayDurationMs = 0;
    this.lastPlaybackErrorCode = 0;
    this.playbackEngine = "avplay";

    this.emitVideoEvent("waiting", { playbackEngine: "avplay" });

    try {
      avplay.open(this.avplayUrl);
    } catch (error) {
      this.lastPlaybackErrorCode = this.mapAvPlayErrorToMediaCode(error?.name || error?.message || error);
      this.teardownAvPlay();
      this.playbackEngine = "none";
      return false;
    }

    this.setAvPlayDisplayRect();

    try {
      avplay.setListener?.({
        onbufferingstart: () => {
          this.avplayReady = false;
          this.emitVideoEvent("waiting", { playbackEngine: "avplay" });
        },
        onbufferingcomplete: () => {
          this.avplayReady = true;
          this.emitVideoEvent("canplay", { playbackEngine: "avplay" });
        },
        oncurrentplaytime: (currentTimeMs) => {
          const value = Number(currentTimeMs || 0);
          if (Number.isFinite(value) && value >= 0) {
            this.avplayCurrentTimeMs = value;
          }
        },
        onstreamcompleted: () => {
          this.avplayEnded = true;
          this.isPlaying = false;
          this.stopAvPlayTickTimer();
          try {
            avplay.stop?.();
          } catch (_) {
            // Ignore stream-complete stop failures.
          }
          this.emitVideoEvent("ended", { playbackEngine: "avplay" });
        },
        onerror: (errorValue) => {
          this.avplayReady = false;
          this.isPlaying = false;
          this.lastPlaybackErrorCode = this.mapAvPlayErrorToMediaCode(errorValue);
          this.stopAvPlayTickTimer();
          this.emitVideoEvent("error", {
            playbackEngine: "avplay",
            mediaErrorCode: this.lastPlaybackErrorCode,
            avplayError: String(errorValue || "")
          });
        }
      });
    } catch (_) {
      // Ignore listener setup failures; prepareAsync/play may still work.
    }

    const onPrepared = () => {
      if (!this.isUsingAvPlay()) {
        return;
      }
      this.avplayReady = true;
      this.avplayEnded = false;
      this.refreshAvPlayTimeline();
      this.syncAvPlayTrackInfo();
      if (this.avplayAudioTracks.length && this.selectedAvPlayAudioTrackIndex < 0) {
        const fallbackAudioIndex = Number(this.avplayAudioTracks[0]?.avplayTrackIndex);
        if (Number.isFinite(fallbackAudioIndex) && fallbackAudioIndex >= 0) {
          try {
            avplay.setSelectTrack?.("AUDIO", fallbackAudioIndex);
            this.selectedAvPlayAudioTrackIndex = fallbackAudioIndex;
          } catch (_) {
            // Ignore initial audio-track selection failures.
          }
        }
      }
      this.emitVideoEvent("loadedmetadata", { playbackEngine: "avplay" });
      this.emitVideoEvent("loadeddata", { playbackEngine: "avplay" });
      this.emitVideoEvent("canplay", { playbackEngine: "avplay" });
      this.emitVideoEvent("avplaytrackschanged", { playbackEngine: "avplay" });
      try {
        avplay.play?.();
        this.isPlaying = true;
        this.startAvPlayTickTimer();
        this.emitVideoEvent("playing", { playbackEngine: "avplay" });
      } catch (error) {
        this.lastPlaybackErrorCode = this.mapAvPlayErrorToMediaCode(error?.name || error?.message || error);
        this.isPlaying = false;
        this.emitVideoEvent("error", {
          playbackEngine: "avplay",
          mediaErrorCode: this.lastPlaybackErrorCode
        });
      }
    };

    const onPrepareError = (errorValue) => {
      this.lastPlaybackErrorCode = this.mapAvPlayErrorToMediaCode(errorValue);
      this.isPlaying = false;
      this.teardownAvPlay();
      this.playbackEngine = "none";
      this.emitVideoEvent("error", {
        playbackEngine: "avplay",
        mediaErrorCode: this.lastPlaybackErrorCode,
        avplayError: String(errorValue || "")
      });
    };

    try {
      if (typeof avplay.prepareAsync === "function") {
        avplay.prepareAsync(onPrepared, onPrepareError);
      } else if (typeof avplay.prepare === "function") {
        avplay.prepare();
        onPrepared();
      } else {
        onPrepareError("prepare_not_supported");
      }
    } catch (error) {
      onPrepareError(error?.name || error?.message || error);
    }

    return true;
  },

  getCurrentTimeSeconds() {
    if (this.isUsingAvPlay()) {
      this.refreshAvPlayTimeline();
      return Math.max(0, Number(this.avplayCurrentTimeMs || 0) / 1000);
    }
    return Math.max(0, Number(this.video?.currentTime || 0));
  },

  getDurationSeconds() {
    if (this.isUsingAvPlay()) {
      this.refreshAvPlayTimeline();
      return Math.max(0, Number(this.avplayDurationMs || 0) / 1000);
    }
    return Math.max(0, Number(this.video?.duration || 0));
  },

  seekToSeconds(targetSeconds) {
    const seconds = Number(targetSeconds || 0);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return false;
    }

    if (!this.isUsingAvPlay()) {
      if (!this.video) {
        return false;
      }
      this.video.currentTime = seconds;
      return true;
    }

    const avplay = this.getAvPlay();
    if (!avplay) {
      return false;
    }

    const targetMs = Math.max(0, Math.floor(seconds * 1000));
    try {
      if (typeof avplay.seekTo === "function") {
        avplay.seekTo(targetMs);
      } else {
        const currentMs = Number(avplay.getCurrentTime?.() || 0);
        if (targetMs > currentMs) {
          avplay.jumpForward?.(targetMs - currentMs);
        } else if (targetMs < currentMs) {
          avplay.jumpBackward?.(currentMs - targetMs);
        }
      }
      this.avplayCurrentTimeMs = targetMs;
      this.emitVideoEvent("timeupdate", { playbackEngine: "avplay" });
      return true;
    } catch (_) {
      return false;
    }
  },

  isPlaybackEnded() {
    if (this.isUsingAvPlay()) {
      return Boolean(this.avplayEnded);
    }
    return Boolean(this.video?.ended);
  },

  getPlaybackReadyState() {
    if (this.isUsingAvPlay()) {
      return this.avplayReady ? 4 : 1;
    }
    return Number(this.video?.readyState || 0);
  },

  getLastPlaybackErrorCode() {
    return Number(this.lastPlaybackErrorCode || 0);
  },

  forceAvPlayFallbackForCurrentSource(reason = "fallback") {
    const url = String(this.currentPlaybackUrl || this.video?.currentSrc || this.video?.src || "").trim();
    if (!url || this.avplayFallbackAttempts.has(url) || !this.canUseAvPlay()) {
      return false;
    }

    this.avplayFallbackAttempts.add(url);
    console.warn("Forcing AVPlay fallback:", { reason, url });
    this.play(url, {
      itemId: this.currentItemId,
      itemType: this.currentItemType || "movie",
      videoId: this.currentVideoId,
      season: this.currentSeason,
      episode: this.currentEpisode,
      requestHeaders: { ...(this.currentPlaybackHeaders || {}) },
      mediaSourceType: this.currentPlaybackMediaSourceType || null,
      forceEngine: "avplay"
    });
    return true;
  },

  getPlaybackCapabilities() {
    const supports = (mimeType) => this.canPlayNatively(mimeType);
    const capabilities = {
      avplay: this.canUseAvPlay(),
      hls: supports("application/vnd.apple.mpegurl"),
      dash: supports("application/dash+xml"),
      mp4H264: supports('video/mp4; codecs="avc1.4d401f,mp4a.40.2"'),
      mp4Hevc: supports('video/mp4; codecs="hvc1.1.6.L93.B0,mp4a.40.2"') || supports('video/mp4; codecs="hev1.1.6.L93.B0,mp4a.40.2"'),
      mp4HevcMain10: supports('video/mp4; codecs="hvc1.2.4.L153.B0,mp4a.40.2"') || supports('video/mp4; codecs="hev1.2.4.L153.B0,mp4a.40.2"'),
      mp4Av1: supports('video/mp4; codecs="av01.0.08M.08,mp4a.40.2"'),
      webmVp9: supports('video/webm; codecs="vp9,opus"'),
      mkvH264: supports('video/x-matroska; codecs="avc1.4d401f,mp4a.40.2"') || supports("video/x-matroska"),
      audioAac: supports('audio/mp4; codecs="mp4a.40.2"'),
      audioAc3: supports('audio/mp4; codecs="ac-3"') || supports('audio/mp4; codecs="dac3"'),
      audioEac3: supports('audio/mp4; codecs="ec-3"') || supports('audio/mp4; codecs="dec3"'),
      dolbyVision: supports('video/mp4; codecs="dvh1.05.06,ec-3"') || supports('video/mp4; codecs="dvhe.05.06,ec-3"')
    };
    capabilities.hdrLikely = capabilities.mp4HevcMain10 || capabilities.mp4Av1;
    capabilities.atmosLikely = capabilities.audioEac3;
    return capabilities;
  },

  teardownHlsInstance() {
    if (!this.hlsInstance) {
      return;
    }
    try {
      this.hlsInstance.destroy();
    } catch (_) {
      // Ignore HLS cleanup failures.
    }
    this.hlsInstance = null;
  },

  teardownDashInstance() {
    if (!this.dashInstance) {
      return;
    }
    try {
      this.dashInstance.reset?.();
    } catch (_) {
      // Ignore DASH cleanup failures.
    }
    this.dashInstance = null;
  },

  teardownAdaptiveInstances() {
    this.teardownHlsInstance();
    this.teardownDashInstance();
    if (!this.isUsingAvPlay()) {
      this.playbackEngine = "none";
    }
  },

  applyNativeSource(url, mimeType = null) {
    if (!this.video) {
      return false;
    }
    this.resetNativeWebOsTrackState();
    this.video.removeAttribute("src");
    Array.from(this.video.querySelectorAll("source")).forEach((node) => node.remove());

    if (mimeType) {
      const sourceNode = document.createElement("source");
      sourceNode.src = url;
      sourceNode.type = mimeType;
      this.video.appendChild(sourceNode);
    } else {
      this.video.src = url;
    }

    this.playbackEngine = "native";
    this.video.load();
    return true;
  },

  shouldForwardHeaderToHls(name) {
    const lower = String(name || "").trim().toLowerCase();
    if (!lower) {
      return false;
    }
    if (lower === "range") {
      return false;
    }
    if (lower.startsWith("sec-")) {
      return false;
    }
    const forbidden = new Set([
      "host",
      "origin",
      "referer",
      "referrer",
      "user-agent",
      "content-length",
      "accept-encoding",
      "connection",
      "cookie"
    ]);
    return !forbidden.has(lower);
  },

  normalizePlaybackHeaders(headers) {
    if (!headers || typeof headers !== "object") {
      return {};
    }
    const entries = Object.entries(headers)
      .map(([key, value]) => [String(key || "").trim(), String(value ?? "").trim()])
      .filter(([key, value]) => key && value)
      .filter(([key]) => this.shouldForwardHeaderToHls(key));
    return Object.fromEntries(entries);
  },

  buildHlsConfig(requestHeaders = {}) {
    const forwardedHeaders = this.normalizePlaybackHeaders(requestHeaders);
    return {
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 30,
      xhrSetup: (xhr) => {
        Object.entries(forwardedHeaders).forEach(([headerName, headerValue]) => {
          try {
            xhr.setRequestHeader(headerName, headerValue);
          } catch (_) {
            // Ignore forbidden/unsupported browser headers.
          }
        });
      },
      fetchSetup: (context, initParams = {}) => {
        const headers = new Headers(initParams.headers || {});
        Object.entries(forwardedHeaders).forEach(([headerName, headerValue]) => {
          try {
            headers.set(headerName, headerValue);
          } catch (_) {
            // Ignore forbidden/unsupported browser headers.
          }
        });
        return new Request(context.url, {
          ...initParams,
          headers
        });
      }
    };
  },

  playWithHlsJs(url, requestHeaders = {}) {
    if (!this.video || !this.canUseHlsJs()) {
      return false;
    }

    const Hls = globalThis.Hls;
    this.teardownHlsInstance();
    this.teardownDashInstance();
    const hls = new Hls(this.buildHlsConfig(requestHeaders));
    this.hlsInstance = hls;
    this.playbackEngine = "hls.js";

    hls.on(Hls.Events.ERROR, (_, data = {}) => {
      if (!data?.fatal) {
        return;
      }
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        try {
          hls.startLoad();
          return;
        } catch (_) {
          // Fall through and destroy on unrecoverable load errors.
        }
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try {
          hls.recoverMediaError();
          return;
        } catch (_) {
          // Fall through and destroy on unrecoverable media errors.
        }
      }
      this.teardownHlsInstance();
    });

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      try {
        hls.loadSource(url);
      } catch (error) {
        console.warn("HLS source attach failed", error);
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const playPromise = this.video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          if (this.isExpectedPlayInterruption(error)) {
            return;
          }
          console.warn("HLS playback start rejected", error);
        });
      }
    });

    this.video.removeAttribute("src");
    hls.attachMedia(this.video);
    return true;
  },

  playWithDashJs(url) {
    if (!this.video || !this.canUseDashJs()) {
      return false;
    }

    const dashjs = globalThis.dashjs;
    this.teardownDashInstance();
    this.teardownHlsInstance();

    let player = null;
    try {
      player = dashjs.MediaPlayer().create();
      player.updateSettings?.({
        streaming: {
          fastSwitchEnabled: true
        }
      });
      player.initialize(this.video, url, true);
      const dashEvents = dashjs.MediaPlayer?.events || {};
      const emitTracksChanged = () => {
        this.emitVideoEvent("dashtrackschanged", { playbackEngine: "dash.js" });
      };
      try {
        player.on?.(dashEvents.STREAM_INITIALIZED, emitTracksChanged);
        player.on?.(dashEvents.TRACK_CHANGE_RENDERED, emitTracksChanged);
        player.on?.(dashEvents.TEXT_TRACKS_ADDED, emitTracksChanged);
        player.on?.(dashEvents.PERIOD_SWITCH_COMPLETED, emitTracksChanged);
      } catch (_) {
        // Ignore dash event binding issues.
      }
      this.dashInstance = player;
      this.playbackEngine = "dash.js";
      return true;
    } catch (error) {
      console.warn("DASH source attach failed", error);
      try {
        player?.reset?.();
      } catch (_) {
        // Ignore reset failures on partial init.
      }
      this.dashInstance = null;
      return false;
    }
  },

  getDashAudioTracks() {
    const tracks = this.dashInstance?.getTracksFor?.("audio");
    if (!Array.isArray(tracks)) {
      return [];
    }
    return tracks.filter(Boolean).map((track, index) => ({
      id: String(track?.id ?? `dash-audio-${index}`),
      index,
      label: String(track?.labels?.[0]?.text || track?.lang || `Track ${index + 1}`),
      language: String(track?.lang || ""),
      raw: track
    }));
  },

  getSelectedDashAudioTrackIndex() {
    const current = this.dashInstance?.getCurrentTrackFor?.("audio");
    const tracks = this.getDashAudioTracks();
    if (!current || !tracks.length) {
      return -1;
    }
    const exactMatch = tracks.findIndex((track) => track.raw === current);
    if (exactMatch >= 0) {
      return exactMatch;
    }
    const currentId = String(current?.id ?? "");
    const currentLang = String(current?.lang ?? "");
    return tracks.findIndex((track) => String(track?.id ?? "") === currentId && String(track?.language ?? "") === currentLang);
  },

  setDashAudioTrack(index) {
    const targetIndex = Number(index);
    const tracks = this.getDashAudioTracks();
    if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= tracks.length) {
      return false;
    }
    const target = tracks[targetIndex]?.raw || null;
    if (!target || typeof this.dashInstance?.setCurrentTrack !== "function") {
      return false;
    }
    try {
      this.dashInstance.setCurrentTrack(target);
      this.emitVideoEvent("dashtrackschanged", { playbackEngine: "dash.js" });
      return true;
    } catch (_) {
      return false;
    }
  },

  getDashTextTracks() {
    const tracks = this.dashInstance?.getTracksFor?.("text");
    if (!Array.isArray(tracks)) {
      return [];
    }
    return tracks.filter(Boolean).map((track, index) => ({
      id: String(track?.id ?? `dash-text-${index}`),
      index,
      textTrackIndex: Number(track?.index),
      label: String(track?.labels?.[0]?.text || track?.lang || `Subtitle ${index + 1}`),
      language: String(track?.lang || ""),
      raw: track
    }));
  },

  getSelectedDashTextTrackIndex() {
    const current = this.dashInstance?.getCurrentTrackFor?.("text");
    const tracks = this.getDashTextTracks();
    if (!current || !tracks.length) {
      return -1;
    }
    const exactMatch = tracks.findIndex((track) => track.raw === current);
    if (exactMatch >= 0) {
      return exactMatch;
    }
    const currentId = String(current?.id ?? "");
    const currentLang = String(current?.lang ?? "");
    return tracks.findIndex((track) => String(track?.id ?? "") === currentId && String(track?.language ?? "") === currentLang);
  },

  setDashTextTrack(index) {
    const targetIndex = Number(index);
    const player = this.dashInstance;
    if (!player) {
      return false;
    }

    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      try {
        player.setTextTrack?.(-1);
      } catch (_) {
        // Ignore disable-text failures.
      }
      try {
        player.enableText?.(false);
      } catch (_) {
        // Ignore text disable fallback failures.
      }
      this.emitVideoEvent("dashtrackschanged", { playbackEngine: "dash.js" });
      return true;
    }

    const tracks = this.getDashTextTracks();
    if (targetIndex >= tracks.length) {
      return false;
    }

    const target = tracks[targetIndex] || null;
    try {
      player.enableText?.(true);
    } catch (_) {
      // Ignore text enable failures.
    }
    try {
      if (Number.isFinite(target?.textTrackIndex) && typeof player.setTextTrack === "function") {
        player.setTextTrack(target.textTrackIndex);
      } else if (target?.raw && typeof player.setCurrentTrack === "function") {
        player.setCurrentTrack(target.raw);
      } else {
        return false;
      }
      this.emitVideoEvent("dashtrackschanged", { playbackEngine: "dash.js" });
      return true;
    } catch (_) {
      return false;
    }
  },

  getHlsAudioTracks() {
    const trackList = this.hlsInstance?.audioTracks;
    if (!trackList) {
      return [];
    }
    try {
      return Array.from(trackList).filter(Boolean);
    } catch (_) {
      return [];
    }
  },

  getSelectedHlsAudioTrackIndex() {
    const selectedIndex = Number(this.hlsInstance?.audioTrack);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 0) {
      return -1;
    }
    return selectedIndex;
  },

  setHlsAudioTrack(index) {
    const hls = this.hlsInstance;
    if (!hls) {
      return false;
    }

    const targetIndex = Number(index);
    const tracks = this.getHlsAudioTracks();
    if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= tracks.length) {
      return false;
    }

    try {
      hls.audioTrack = targetIndex;
      return true;
    } catch (_) {
      return false;
    }
  },

  attemptVideoPlay({ warningLabel = "Playback start rejected", onRejected = null } = {}) {
    if (!this.video) {
      return;
    }
    const playPromise = this.video.play();
    if (!playPromise || typeof playPromise.catch !== "function") {
      return;
    }
    playPromise.catch((error) => {
      if (this.isExpectedPlayInterruption(error)) {
        return;
      }
      if (typeof onRejected === "function") {
        try {
          const handled = onRejected(error);
          if (handled) {
            return;
          }
        } catch (_) {
          // Ignore rejection handler failures and continue to warning output.
        }
      }
      this.isPlaying = false;
      console.warn(warningLabel, error);
    });
  },

  choosePlaybackEngine(url, sourceType) {
    const mimeType = String(sourceType || "").toLowerCase();
    if (this.isLikelyHlsMimeType(mimeType)) {
      if (this.canPlayNatively("application/vnd.apple.mpegurl")) {
        return "native-hls";
      }
      if (this.canUseHlsJs()) {
        return "hls.js";
      }
      return "native-hls";
    }

    if (this.isLikelyDashMimeType(mimeType)) {
      if (this.canUseDashJs()) {
        return "dash.js";
      }
      if (this.canPlayNatively("application/dash+xml")) {
        return "native-dash";
      }
      return "native-dash";
    }

    return "native-file";
  },

  init() {
    this.video = document.getElementById("videoPlayer");
    WebOSPlayerExtensions.apply(this.video);
    this.video.muted = false;
    this.video.defaultMuted = false;
    this.video.volume = 1;
    console.log("Runtime probe:", {
      hasWebOS: Boolean(globalThis.webOS),
      hasPalmSystem: Boolean(globalThis.PalmSystem),
      hasWebOSSystem: Boolean(globalThis.webOSSystem),
      hasWebApisGlobal: Boolean(globalThis.webapis),
      hasAvPlayObject: Boolean(globalThis.webapis?.avplay || globalThis.webapis?.avPlay || globalThis.avplay),
      canUseAvPlay: this.canUseAvPlay()
    });
    console.log("Playback capabilities:", this.getPlaybackCapabilities());

    this.video.addEventListener("ended", () => {
      console.log("Playback ended");
      this.isPlaying = false;
      const context = this.createProgressContext();
      this.flushProgress(0, 0, true, context);
    });

    this.video.addEventListener("error", (e) => {
      const customErrorCode = Number(e?.detail?.mediaErrorCode || 0);
      const nativeErrorCode = Number(this.video?.error?.code || 0);
      const mediaErrorCode = customErrorCode || nativeErrorCode || this.getLastPlaybackErrorCode();
      console.error("Video error:", {
        event: e?.type || "error",
        mediaErrorCode,
        avplayError: e?.detail?.avplayError || "",
        currentSrc: this.video?.currentSrc || this.video?.src || "",
        playbackEngine: this.playbackEngine
      });
    });

    this.video.addEventListener("waiting", () => {
      console.log("Buffering...");
    });

    this.video.addEventListener("playing", () => {
      console.log("Playing");
      if (this.playbackEngine === "native") {
        this.syncNativeWebOsTrackInfoWithRetry({ attempts: 4, intervalMs: 220 });
      }
      const audioTrackList = this.video?.audioTracks || this.video?.webkitAudioTracks || this.video?.mozAudioTracks;
      const audioTrackCount = Number(audioTrackList?.length || 0);
      const probeUrl = String(this.currentPlaybackUrl || this.video?.currentSrc || this.video?.src || "").trim();
      const isDirectFile = this.isLikelyDirectFileUrl(probeUrl);
      if (
        this.playbackEngine === "native"
        && isDirectFile
        && audioTrackCount <= 0
        && this.canUseAvPlay()
      ) {
        this.maybeFallbackToAvPlayForDirectFileNoAudio("native_playing_no_audio_tracks");
      }
    });

    this.video.addEventListener("loadedmetadata", () => {
      if (this.playbackEngine === "native") {
        this.syncNativeWebOsTrackInfoWithRetry({ attempts: 5, intervalMs: 240 });
      }
      const audioTrackList = this.video?.audioTracks || this.video?.webkitAudioTracks || this.video?.mozAudioTracks;
      const textTrackList = this.video?.textTracks || this.video?.webkitTextTracks || this.video?.mozTextTracks;
      const audioTrackCount = Number(audioTrackList?.length || 0);
      const textTrackCount = Number(textTrackList?.length || 0);
      const probeUrl = String(this.currentPlaybackUrl || this.video?.currentSrc || this.video?.src || "").trim();
      const isDirectFile = this.isLikelyDirectFileUrl(probeUrl);
      const fallbackTried = this.avplayFallbackAttempts.has(probeUrl);
      console.log("Playback metadata:", {
        playbackEngine: this.playbackEngine,
        duration: Number(this.getDurationSeconds() || 0),
        audioTrackCount,
        textTrackCount,
        currentSrc: this.video?.currentSrc || this.video?.src || "",
        canUseAvPlay: this.canUseAvPlay(),
        directFileHint: isDirectFile,
        avplayFallbackTried: fallbackTried
      });
      if (
        this.playbackEngine === "native"
        && isDirectFile
        && audioTrackCount <= 0
        && this.canUseAvPlay()
      ) {
        this.maybeFallbackToAvPlayForDirectFileNoAudio("native_no_audio_tracks");
      }
    });

    if (!this.lifecycleBound) {
      this.lifecycleBound = true;
        this.lifecycleFlushHandler = () => {
          const context = this.createProgressContext();
          if (!context.itemId) {
            return;
          }
          this.flushProgress(
            Math.floor(this.getCurrentTimeSeconds() * 1000),
            Math.floor(this.getDurationSeconds() * 1000),
            false,
            context
          ).finally(() => {
            this.pushProgressIfDue(true);
          });
      };
      this.visibilityFlushHandler = () => {
        if (document.visibilityState === "hidden") {
          this.lifecycleFlushHandler?.();
        }
      };
      window.addEventListener("pagehide", this.lifecycleFlushHandler);
      window.addEventListener("beforeunload", this.lifecycleFlushHandler);
      document.addEventListener("visibilitychange", this.visibilityFlushHandler);
    }
  },

  play(url, { itemId = null, itemType = "movie", videoId = null, season = null, episode = null, requestHeaders = {}, mediaSourceType = null, forceEngine = null } = {}) {
    if (!this.video) return;

    try {
      this.video.muted = false;
      this.video.defaultMuted = false;
      if (!Number.isFinite(Number(this.video.volume)) || Number(this.video.volume) <= 0) {
        this.video.volume = 1;
      }
    } catch (_) {
      // Ignore unsupported volume/mute operations.
    }

    this.currentItemId = itemId;
    this.currentItemType = itemType;
    this.currentVideoId = videoId;
    this.currentSeason = season == null ? null : Number(season);
    this.currentEpisode = episode == null ? null : Number(episode);
    this.currentPlaybackUrl = String(url || "").trim();
    this.currentPlaybackHeaders = { ...(requestHeaders || {}) };
    this.currentPlaybackMediaSourceType = mediaSourceType || null;
    this.lastPlaybackErrorCode = 0;
    this.resetNativeWebOsTrackState();

    const sourceType = this.resolveSourceTypeHint(mediaSourceType, url);
    const preferredEngine = forceEngine || this.choosePlaybackEngine(url, sourceType);
    console.log("Playback engine selected:", {
      engine: preferredEngine,
      sourceType,
      directFileHint: this.isLikelyDirectFileUrl(url),
      canUseAvPlay: this.canUseAvPlay(),
      forceEngine: forceEngine || "",
      url
    });

    this.teardownAdaptiveInstances();
    this.teardownAvPlay();
    Array.from(this.video.querySelectorAll("source")).forEach((node) => node.remove());
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();

    if (preferredEngine === "avplay") {
      const avplayStarted = this.playWithAvPlay(url);
      console.log("AVPlay start:", avplayStarted ? "ok" : "failed");
      if (!avplayStarted) {
        this.applyNativeSource(url, null);
        this.attemptVideoPlay({
          warningLabel: "Playback start rejected",
          onRejected: (error) => {
            if (!this.isUnsupportedSourceError(error) || !this.canUseAvPlay()) {
              return false;
            }
            const fallbackStarted = this.playWithAvPlay(url);
            if (fallbackStarted) {
              this.isPlaying = true;
            }
            return fallbackStarted;
          }
        });
      }
    } else if (preferredEngine === "hls.js") {
      const hlsStarted = this.playWithHlsJs(url, requestHeaders);
      if (!hlsStarted) {
        this.applyNativeSource(url, sourceType || null);
        this.attemptVideoPlay({ warningLabel: "Playback start rejected" });
      }
    } else if (preferredEngine === "dash.js") {
      const dashStarted = this.playWithDashJs(url);
      if (!dashStarted) {
        this.applyNativeSource(url, sourceType || "application/dash+xml");
      }
      this.attemptVideoPlay({ warningLabel: "DASH playback start rejected" });
    } else if (preferredEngine === "native-hls") {
      this.applyNativeSource(url, sourceType || "application/vnd.apple.mpegurl");
      this.attemptVideoPlay({
        warningLabel: "Native HLS playback start rejected",
        onRejected: (error) => {
          if (!this.isUnsupportedSourceError(error)) {
            return false;
          }
          const fallbackStarted = this.playWithHlsJs(url, requestHeaders);
          if (fallbackStarted) {
            this.isPlaying = true;
          }
          return fallbackStarted;
        }
      });
    } else if (preferredEngine === "native-dash") {
      this.applyNativeSource(url, sourceType || "application/dash+xml");
      this.attemptVideoPlay({ warningLabel: "Native DASH playback start rejected" });
    } else {
      this.applyNativeSource(url, null);
      this.attemptVideoPlay({
        warningLabel: "Playback start rejected",
        onRejected: (error) => {
          if (!this.canUseAvPlay() || !this.isLikelyDirectFileUrl(url)) {
            return false;
          }
          const fallbackStarted = this.playWithAvPlay(url);
          if (fallbackStarted) {
            this.isPlaying = true;
          }
          return fallbackStarted;
        }
      });
    }

    this.isPlaying = true;

    if (this.progressSaveTimer) {
      clearInterval(this.progressSaveTimer);
    }

    this.progressSaveTimer = setInterval(() => {
      const context = this.createProgressContext();
      this.flushProgress(
        Math.floor(this.getCurrentTimeSeconds() * 1000),
        Math.floor(this.getDurationSeconds() * 1000),
        false,
        context
      );
    }, 5000);
  },

  pause() {
    if (!this.video) return;

    if (this.isUsingAvPlay()) {
      const avplay = this.getAvPlay();
      if (!avplay) {
        return;
      }
      try {
        avplay.pause?.();
        this.isPlaying = false;
        this.stopAvPlayTickTimer();
        this.emitVideoEvent("pause", { playbackEngine: "avplay" });
      } catch (_) {
        // Ignore AVPlay pause failures.
      }
      return;
    }

    this.video.pause();
  },

  resume() {
    if (!this.video) return;

    if (this.isUsingAvPlay()) {
      const avplay = this.getAvPlay();
      if (!avplay) {
        return;
      }
      try {
        avplay.play?.();
        this.isPlaying = true;
        this.startAvPlayTickTimer();
        this.emitVideoEvent("playing", { playbackEngine: "avplay" });
      } catch (error) {
        this.lastPlaybackErrorCode = this.mapAvPlayErrorToMediaCode(error?.name || error?.message || error);
        console.warn("Playback resume rejected", error);
      }
      return;
    }

    const playPromise = this.video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        if (this.isExpectedPlayInterruption(error)) {
          return;
        }
        console.warn("Playback resume rejected", error);
      });
    }
  },

  stop() {
    if (!this.video) return;

    const context = this.createProgressContext();
    this.flushProgress(
      Math.floor(this.getCurrentTimeSeconds() * 1000),
      Math.floor(this.getDurationSeconds() * 1000),
      false,
      context
    ).finally(() => {
      this.pushProgressIfDue(true);
    });

    this.video.pause();
    this.teardownAdaptiveInstances();
    this.teardownAvPlay();
    this.resetNativeWebOsTrackState();
    this.video.removeAttribute("src");
    Array.from(this.video.querySelectorAll("source")).forEach((node) => node.remove());
    this.video.load();

    this.isPlaying = false;
    this.currentItemId = null;
    this.currentItemType = null;
    this.currentVideoId = null;
    this.currentSeason = null;
    this.currentEpisode = null;
    this.currentPlaybackUrl = "";
    this.currentPlaybackHeaders = {};
    this.currentPlaybackMediaSourceType = null;
    this.playbackEngine = "none";
    this.lastPlaybackErrorCode = 0;

    if (this.progressSaveTimer) {
      clearInterval(this.progressSaveTimer);
      this.progressSaveTimer = null;
    }
  },

  createProgressContext() {
    return {
      itemId: this.currentItemId,
      itemType: this.currentItemType || "movie",
      videoId: this.currentVideoId || null,
      season: Number.isFinite(this.currentSeason) ? this.currentSeason : null,
      episode: Number.isFinite(this.currentEpisode) ? this.currentEpisode : null
    };
  },

  isSeriesType(itemType) {
    const value = String(itemType || "").toLowerCase();
    return value === "series" || value === "tv";
  },

  async markEpisodeAsWatchedIfCompleted(context) {
    const active = context || this.createProgressContext();
    if (!active?.itemId || !this.isSeriesType(active.itemType)) {
      return;
    }
    const season = Number(active.season);
    const episode = Number(active.episode);
    if (!Number.isFinite(season) || !Number.isFinite(episode) || season <= 0 || episode <= 0) {
      return;
    }
    await watchedItemsRepository.mark({
      contentId: active.itemId,
      contentType: active.itemType || "series",
      title: `S${season}E${episode}`,
      season,
      episode,
      watchedAt: Date.now()
    });
  },

  async flushProgress(positionMs, durationMs, clear = false, context = null) {
    const active = context || this.createProgressContext();
    if (!active?.itemId) {
      return;
    }

    const safePosition = Number(positionMs || 0);
    const safeDuration = Number(durationMs || 0);
    const hasFiniteDuration = Number.isFinite(safeDuration) && safeDuration > 0;

    if (clear || (hasFiniteDuration && safePosition / safeDuration > 0.95)) {
      await this.markEpisodeAsWatchedIfCompleted(active);
      await watchProgressRepository.removeProgress(active.itemId, active.videoId || null);
      this.pushProgressIfDue(true);
      return;
    }

    if (!Number.isFinite(safePosition) || safePosition <= 0) {
      return;
    }

    await watchProgressRepository.saveProgress({
      contentId: active.itemId,
      contentType: active.itemType || "movie",
      videoId: active.videoId || null,
      season: active.season,
      episode: active.episode,
      positionMs: Math.max(0, Math.trunc(safePosition)),
      durationMs: hasFiniteDuration ? Math.max(0, Math.trunc(safeDuration)) : 0
    });
    this.pushProgressIfDue(false);
  },

  pushProgressIfDue(force = false) {
    const now = Date.now();
    if (!force && (now - Number(this.lastProgressPushAt || 0)) < 30000) {
      return;
    }
    this.lastProgressPushAt = now;
    WatchProgressSyncService.push().catch((error) => {
      console.warn("Watch progress auto push failed", error);
    });
  }

};
