import { PlayerSettingsStore } from "../../../data/local/playerSettingsStore.js";
import { I18n } from "../../../core/i18n/i18n.js";

export const PlaybackSettings = {

  getItems() {
    const settings = PlayerSettingsStore.get();
    const quality = String(settings.preferredQuality || "auto");
    const qualityLabel = quality === "2160p"
      ? "2160p"
      : quality === "1080p"
        ? "1080p"
        : quality === "720p"
          ? "720p"
          : I18n.t("playback.quality_auto");

    return [
      {
        id: "playback_toggle_autoplay",
        label: I18n.t("playback.autoplay", { state: I18n.formatOnOff(settings.autoplayNextEpisode) }),
        description: I18n.t("playback.autoplay_desc"),
        action: () => {
          PlayerSettingsStore.set({
            autoplayNextEpisode: !PlayerSettingsStore.get().autoplayNextEpisode
          });
        }
      },
      {
        id: "playback_toggle_subtitles",
        label: I18n.t("playback.subtitles", { state: I18n.formatOnOff(settings.subtitlesEnabled) }),
        description: I18n.t("playback.subtitles_desc"),
        action: () => {
          PlayerSettingsStore.set({
            subtitlesEnabled: !PlayerSettingsStore.get().subtitlesEnabled
          });
        }
      },
      {
        id: "playback_quality_cycle",
        label: I18n.t("playback.quality", { quality: qualityLabel }),
        description: I18n.t("playback.quality_desc"),
        action: () => {
          const current = String(PlayerSettingsStore.get().preferredQuality || "auto");
          const next = current === "auto"
            ? "2160p"
            : current === "2160p"
              ? "1080p"
              : current === "1080p"
                ? "720p"
                : "auto";
          PlayerSettingsStore.set({ preferredQuality: next });
        }
      }
    ];
  }

};
