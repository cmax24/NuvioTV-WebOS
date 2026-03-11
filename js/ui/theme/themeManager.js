import { ThemeStore } from "../../data/local/themeStore.js";
import { ThemeColors } from "./themeColors.js";

const DEFAULT_FOCUS_COLOR = "#f5f8fc";

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalized)) {
    return null;
  }
  const expanded = normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized;
  const value = parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function toRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return `rgba(245, 249, 255, ${alpha})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export const ThemeManager = {

  apply() {
    const theme = ThemeStore.get();
    const mode = theme.mode || "dark";
    const colors = ThemeColors[mode] || ThemeColors.dark;
    document.documentElement.setAttribute("data-theme", mode);

    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    const accentColor = theme.accentColor || colors["--focus-color"] || DEFAULT_FOCUS_COLOR;
    document.documentElement.style.setProperty("--focus-color", accentColor);
    document.documentElement.style.setProperty(
      "--focus-ring",
      `0 0 0 3px ${toRgba(accentColor, 0.95)}, 0 0 0 6px ${toRgba(accentColor, 0.2)}`
    );
  }

};
