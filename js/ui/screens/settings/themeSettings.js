import { ThemeStore } from "../../../data/local/themeStore.js";
import { ThemeManager } from "../../theme/themeManager.js";
import { I18n } from "../../../core/i18n/i18n.js";

export const ThemeSettings = {

  getItems() {
    const theme = ThemeStore.get();
    const setAccent = (accentColor) => {
      ThemeStore.set({ accentColor });
      ThemeManager.apply();
    };
    return [
      {
        id: "theme_apply_dark",
        label: I18n.t("theme.apply_dark"),
        description: I18n.t("theme.apply_dark_desc", { accent: theme.accentColor }),
        action: () => {
          ThemeStore.set({ mode: "dark" });
          ThemeManager.apply();
        }
      },
      {
        id: "theme_apply_cinema",
        label: I18n.t("theme.apply_cinema"),
        description: I18n.t("theme.apply_cinema_desc"),
        action: () => {
          ThemeStore.set({ mode: "cinema" });
          ThemeManager.apply();
        }
      },
      {
        id: "theme_accent_white",
        label: I18n.t("theme.accent_white"),
        description: I18n.t("theme.accent_white_desc"),
        action: () => setAccent("#f5f8fc")
      },
      {
        id: "theme_accent_crimson",
        label: I18n.t("theme.accent_crimson"),
        description: I18n.t("theme.accent_crimson_desc"),
        action: () => setAccent("#ff4d4f")
      },
      {
        id: "theme_accent_ocean",
        label: I18n.t("theme.accent_ocean"),
        description: I18n.t("theme.accent_ocean_desc"),
        action: () => setAccent("#42a5f5")
      },
      {
        id: "theme_accent_violet",
        label: I18n.t("theme.accent_violet"),
        description: I18n.t("theme.accent_violet_desc"),
        action: () => setAccent("#ba68c8")
      },
      {
        id: "theme_accent_emerald",
        label: I18n.t("theme.accent_emerald"),
        description: I18n.t("theme.accent_emerald_desc"),
        action: () => setAccent("#66bb6a")
      },
      {
        id: "theme_accent_amber",
        label: I18n.t("theme.accent_amber"),
        description: I18n.t("theme.accent_amber_desc"),
        action: () => setAccent("#ffca28")
      },
    ];
  }

};
