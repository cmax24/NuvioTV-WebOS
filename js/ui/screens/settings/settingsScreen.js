import { Router } from "../../navigation/router.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { ThemeSettings } from "./themeSettings.js";
import { PlaybackSettings } from "./playbackSettings.js";
import { addonRepository } from "../../../data/repository/addonRepository.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { TmdbSettingsStore } from "../../../data/local/tmdbSettingsStore.js";
import { HomeCatalogStore } from "../../../data/local/homeCatalogStore.js";
import { ProfileManager } from "../../../core/profile/profileManager.js";
import { ProfileSyncService } from "../../../core/profile/profileSyncService.js";
import { PluginSyncService } from "../../../core/profile/pluginSyncService.js";
import { LibrarySyncService } from "../../../core/profile/librarySyncService.js";
import { SavedLibrarySyncService } from "../../../core/profile/savedLibrarySyncService.js";
import { WatchedItemsSyncService } from "../../../core/profile/watchedItemsSyncService.js";
import { WatchProgressSyncService } from "../../../core/profile/watchProgressSyncService.js";
import { AuthManager } from "../../../core/auth/authManager.js";
import { I18n } from "../../../core/i18n/i18n.js";

const ROTATED_DPAD_KEY = "rotatedDpadMapping";
const STRICT_DPAD_GRID_KEY = "strictDpadGridNavigation";

const SECTION_META = [
  { id: "account", labelKey: "settings.section.account.label", subtitleKey: "settings.section.account.subtitle" },
  { id: "profiles", labelKey: "settings.section.profiles.label", subtitleKey: "settings.section.profiles.subtitle" },
  { id: "appearance", labelKey: "settings.section.appearance.label", subtitleKey: "settings.section.appearance.subtitle" },
  { id: "layout", labelKey: "settings.section.layout.label", subtitleKey: "settings.section.layout.subtitle" },
  { id: "plugins", labelKey: "settings.section.plugins.label", subtitleKey: "settings.section.plugins.subtitle" },
  { id: "integration", labelKey: "settings.section.integration.label", subtitleKey: "settings.section.integration.subtitle" },
  { id: "playback", labelKey: "settings.section.playback.label", subtitleKey: "settings.section.playback.subtitle" },
  { id: "trakt", labelKey: "settings.section.trakt.label", subtitleKey: "settings.section.trakt.subtitle" },
  { id: "about", labelKey: "settings.section.about.label", subtitleKey: "settings.section.about.subtitle" }
];

const RAIL_ITEMS = [
  { id: "home", action: () => Router.navigate("home") },
  { id: "search", action: () => Router.navigate("search") },
  { id: "library", action: () => Router.navigate("library") },
  { id: "plugin", action: () => Router.navigate("plugin") },
  { id: "settings", action: () => {} }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function railIconPath(actionId) {
  if (actionId === "home") return "assets/icons/sidebar_home.svg";
  if (actionId === "search") return "assets/icons/sidebar_search.svg";
  if (actionId === "library") return "assets/icons/sidebar_library.svg";
  if (actionId === "plugin") return "assets/icons/sidebar_plugin.svg";
  return "assets/icons/sidebar_settings.svg";
}

export const SettingsScreen = {

  async mount() {
    this.container = document.getElementById("settings");
    ScreenUtils.show(this.container);
    this.activeSection = this.activeSection || "account";
    this.focusZone = this.focusZone || "nav";
    this.railIndex = Number.isFinite(this.railIndex) ? this.railIndex : RAIL_ITEMS.findIndex((item) => item.id === "settings");
    if (this.railIndex < 0) {
      this.railIndex = 0;
    }
    this.navIndex = Number.isFinite(this.navIndex) ? this.navIndex : SECTION_META.findIndex((s) => s.id === this.activeSection);
    if (this.navIndex < 0) {
      this.navIndex = 0;
      this.activeSection = SECTION_META[0].id;
    }
    this.panelIndex = Number.isFinite(this.panelIndex) ? this.panelIndex : 0;
    await this.render();
  },

  async collectModel() {
    const addons = await addonRepository.getInstalledAddons();
    const profiles = await ProfileManager.getProfiles();
    const tmdbSettings = TmdbSettingsStore.get();
    const rotatedDpad = Boolean(LocalStore.get(ROTATED_DPAD_KEY, true));
    const strictDpadGrid = Boolean(LocalStore.get(STRICT_DPAD_GRID_KEY, true));
    const themeItems = ThemeSettings.getItems();
    const playbackItems = PlaybackSettings.getItems();

    return {
      addons,
      profiles,
      tmdbSettings,
      rotatedDpad,
      strictDpadGrid,
      themeItems,
      playbackItems,
      authState: AuthManager.getAuthState()
    };
  },

  buildSectionItems(sectionId, model) {
    const items = [];

    const addItem = (label, description, action) => {
      const id = `action_${Math.random().toString(36).slice(2, 9)}`;
      this.actionMap.set(id, action);
      items.push({ id, label, description });
    };

    if (sectionId === "account") {
      const signedIn = model.authState === "authenticated";
      addItem(
        signedIn ? I18n.t("settings.account.signed_in") : I18n.t("settings.account.not_signed_in"),
        signedIn ? I18n.t("settings.account.signed_in_desc") : I18n.t("settings.account.not_signed_in_desc"),
        () => Router.navigate(signedIn ? "account" : "authQrSignIn")
      );
      addItem(I18n.t("settings.account.open_account"), I18n.t("settings.account.open_account_desc"), () => Router.navigate("account"));
      if (signedIn) {
        addItem(I18n.t("settings.account.sign_out"), I18n.t("settings.account.sign_out_desc"), async () => {
          await AuthManager.signOut();
          Router.navigate("authQrSignIn");
        });
      }
      return items;
    }

    if (sectionId === "profiles") {
      model.profiles.forEach((profile) => {
        addItem(
          `${profile.name}${String(profile.id) === String(ProfileManager.getActiveProfileId()) ? I18n.t("settings.profiles.active_suffix") : ""}`,
          profile.isPrimary ? I18n.t("settings.profiles.primary") : I18n.t("settings.profiles.secondary"),
          async () => {
            await ProfileManager.setActiveProfile(profile.id);
            await ProfileSyncService.pull();
          }
        );
      });
      addItem(I18n.t("settings.profiles.open_selection"), I18n.t("settings.profiles.open_selection_desc"), () => Router.navigate("profileSelection"));
      return items;
    }

    if (sectionId === "appearance") {
      model.themeItems.forEach((item) => addItem(item.label, item.description, item.action));
      const currentLanguage = I18n.getLanguage();
      const availableLanguages = I18n.getSupportedLanguages();
      const currentIndex = Math.max(0, availableLanguages.findIndex((entry) => entry.code === currentLanguage));
      const nextLanguage = availableLanguages[(currentIndex + 1) % availableLanguages.length] || availableLanguages[0];
      const applyLanguage = (code) => {
        I18n.setLanguage(code);
        TmdbSettingsStore.set({ language: code === "it" ? "it-IT" : "en-US" });
      };
      addItem(
        I18n.t("settings.language.current", { language: I18n.getLanguageLabel(currentLanguage) }),
        I18n.t("settings.language.current_desc"),
        () => {
          if (nextLanguage?.code) {
            applyLanguage(nextLanguage.code);
          }
        }
      );
      availableLanguages.forEach((entry) => {
        addItem(
          I18n.t("settings.language.switch", { language: entry.label }),
          entry.code === currentLanguage
            ? I18n.t("settings.language.already_selected")
            : I18n.t("settings.language.switch_desc"),
          () => applyLanguage(entry.code)
        );
      });
      return items;
    }

    if (sectionId === "layout") {
      addItem(I18n.t("settings.layout.reset_home_catalog_prefs"), I18n.t("settings.layout.reset_home_catalog_prefs_desc"), () => {
        HomeCatalogStore.reset();
      });
      addItem(
        I18n.t("settings.layout.remote_dpad", {
          mode: model.rotatedDpad
            ? I18n.t("settings.layout.remote_dpad_rotated")
            : I18n.t("settings.layout.remote_dpad_standard")
        }),
        I18n.t("settings.layout.remote_dpad_desc"),
        () => {
          LocalStore.set(ROTATED_DPAD_KEY, !Boolean(LocalStore.get(ROTATED_DPAD_KEY, true)));
        }
      );
      addItem(
        I18n.t("settings.layout.remote_grid", {
          mode: model.strictDpadGrid
            ? I18n.t("settings.layout.remote_grid_strict")
            : I18n.t("settings.layout.remote_grid_flexible")
        }),
        I18n.t("settings.layout.remote_grid_desc"),
        () => {
          LocalStore.set(STRICT_DPAD_GRID_KEY, !Boolean(LocalStore.get(STRICT_DPAD_GRID_KEY, true)));
        }
      );
      return items;
    }

    if (sectionId === "plugins") {
      addItem(I18n.t("settings.plugins.open_manager"), I18n.t("settings.plugins.open_manager_desc"), () => Router.navigate("plugin"));
      addItem(I18n.t("settings.plugins.sync_pull"), I18n.t("settings.plugins.sync_pull_desc"), () => PluginSyncService.pull());
      addItem(I18n.t("settings.plugins.sync_push"), I18n.t("settings.plugins.sync_push_desc"), () => PluginSyncService.push());
      return items;
    }

    if (sectionId === "integration") {
      addItem(
        I18n.t("settings.integration.tmdb_enrichment", { state: I18n.formatOnOff(model.tmdbSettings.enabled) }),
        I18n.t("settings.integration.tmdb_enrichment_desc"),
        () => TmdbSettingsStore.set({ enabled: !TmdbSettingsStore.get().enabled })
      );
      addItem(
        I18n.t("settings.integration.tmdb_artwork", { state: I18n.formatOnOff(model.tmdbSettings.useArtwork) }),
        I18n.t("settings.integration.tmdb_artwork_desc"),
        () => TmdbSettingsStore.set({ useArtwork: !TmdbSettingsStore.get().useArtwork })
      );
      addItem(
        I18n.t("settings.integration.tmdb_key"),
        model.tmdbSettings.apiKey
          ? I18n.t("settings.integration.tmdb_key_configured")
          : I18n.t("settings.integration.tmdb_key_missing"),
        () => {
          const value = window.prompt(I18n.t("settings.integration.tmdb_key_prompt"), TmdbSettingsStore.get().apiKey || "");
          if (value !== null) {
            TmdbSettingsStore.set({ apiKey: String(value).trim() });
          }
        }
      );
      addItem(I18n.t("settings.integration.sync_pull_all"), I18n.t("settings.integration.sync_pull_all_desc"), async () => {
        await ProfileSyncService.pull();
        await PluginSyncService.pull();
        await LibrarySyncService.pull();
        await SavedLibrarySyncService.pull();
        await WatchedItemsSyncService.pull();
        await WatchProgressSyncService.pull();
      });
      addItem(I18n.t("settings.integration.sync_push_all"), I18n.t("settings.integration.sync_push_all_desc"), async () => {
        await ProfileSyncService.push();
        await PluginSyncService.push();
        await LibrarySyncService.push();
        await SavedLibrarySyncService.push();
        await WatchedItemsSyncService.push();
        await WatchProgressSyncService.push();
      });
      return items;
    }

    if (sectionId === "playback") {
      model.playbackItems.forEach((item) => addItem(item.label, item.description, item.action));
      return items;
    }

    if (sectionId === "trakt") {
      addItem(I18n.t("settings.trakt.open_account"), I18n.t("settings.trakt.open_account_desc"), () => Router.navigate("account"));
      return items;
    }

    if (sectionId === "about") {
      addItem(I18n.t("settings.about.build"), I18n.t("settings.about.build_desc"), () => {});
      addItem(I18n.t("settings.about.privacy"), I18n.t("settings.about.privacy_desc"), () => {
        window.open?.("https://nuvioapp.space/privacy", "_blank");
      });
      return items;
    }

    return items;
  },

  async render() {
    this.model = await this.collectModel();
    this.actionMap = new Map();

    const section = SECTION_META.find((item) => item.id === this.activeSection) || SECTION_META[0];
    const panelItems = this.buildSectionItems(section.id, this.model);
    this.panelIndex = clamp(this.panelIndex, 0, Math.max(panelItems.length - 1, 0));
    this.navIndex = clamp(this.navIndex, 0, SECTION_META.length - 1);

    const navHtml = SECTION_META.map((item, index) => `
      <button class="settings-nav-item focusable${this.activeSection === item.id ? " selected" : ""}"
              data-zone="nav"
              data-nav-index="${index}"
              data-section="${item.id}">
        <span class="settings-nav-label">${I18n.t(item.labelKey)}</span>
        <span class="settings-nav-chevron">›</span>
      </button>
    `).join("");

    const panelHtml = panelItems.length
      ? panelItems.map((item, index) => `
          <button class="settings-panel-item focusable"
                  data-zone="panel"
                  data-panel-index="${index}"
                  data-action-id="${item.id}">
            <span class="settings-panel-title">${item.label}</span>
            <span class="settings-panel-subtitle">${item.description || ""}</span>
            <span class="settings-panel-chevron">›</span>
          </button>
        `).join("")
      : `<div class="settings-panel-empty">${I18n.t("settings.empty_section")}</div>`;

    const railHtml = RAIL_ITEMS.map((item, index) => `
      <button class="settings-rail-item focusable${item.id === "settings" ? " selected" : ""}"
              data-zone="rail"
              data-rail-index="${index}"
              data-rail-action="${item.id}">
        <img class="settings-rail-icon" src="${railIconPath(item.id)}" alt="" aria-hidden="true" />
      </button>
    `).join("");

    this.container.innerHTML = `
      <div class="settings-shell">
        <aside class="settings-rail">
          ${railHtml}
        </aside>
        <aside class="settings-sidebar">
          ${navHtml}
        </aside>
        <section class="settings-content">
          <h2 class="settings-title">${I18n.t(section.labelKey)}</h2>
          <p class="settings-subtitle">${I18n.t(section.subtitleKey)}</p>
          <div class="settings-panel">
            ${panelHtml}
          </div>
        </section>
      </div>
    `;

    ScreenUtils.indexFocusables(this.container);
    this.applyFocus();
  },

  applyFocus() {
    const current = this.container.querySelector(".focusable.focused");
    current?.classList.remove("focused");

    if (this.focusZone === "panel") {
      const panel = Array.from(this.container.querySelectorAll('.settings-panel-item.focusable'));
      const target = panel[this.panelIndex] || panel[0];
      if (target) {
        target.classList.add("focused");
        target.focus();
        return;
      }
      this.focusZone = "nav";
    }

    if (this.focusZone === "rail") {
      const rail = Array.from(this.container.querySelectorAll('.settings-rail-item.focusable'));
      const target = rail[this.railIndex] || rail[0];
      if (target) {
        target.classList.add("focused");
        target.focus();
        return;
      }
      this.focusZone = "nav";
    }

    const nav = Array.from(this.container.querySelectorAll('.settings-nav-item.focusable'));
    const target = nav[this.navIndex] || nav[0];
    if (target) {
      target.classList.add("focused");
      target.focus();
    }
  },

  async moveNav(delta) {
    const next = clamp(this.navIndex + delta, 0, SECTION_META.length - 1);
    if (next === this.navIndex) {
      return;
    }
    this.navIndex = next;
    this.activeSection = SECTION_META[next].id;
    this.panelIndex = 0;
    await this.render();
  },

  movePanel(delta) {
    const panel = Array.from(this.container.querySelectorAll('.settings-panel-item.focusable'));
    if (!panel.length) {
      return;
    }
    this.panelIndex = clamp(this.panelIndex + delta, 0, panel.length - 1);
    this.applyFocus();
  },

  moveRail(delta) {
    this.railIndex = clamp(this.railIndex + delta, 0, RAIL_ITEMS.length - 1);
    this.applyFocus();
  },

  async onKeyDown(event) {
    const code = Number(event?.keyCode || 0);

    if (code === 38 || code === 40 || code === 37 || code === 39) {
      if (typeof event?.preventDefault === "function") {
        event.preventDefault();
      }

      if (this.focusZone === "rail") {
        if (code === 38) {
          this.moveRail(-1);
          return;
        }
        if (code === 40) {
          this.moveRail(1);
          return;
        }
        if (code === 39) {
          this.focusZone = "nav";
          this.applyFocus();
          return;
        }
      } else if (this.focusZone === "nav") {
        if (code === 38) {
          await this.moveNav(-1);
          return;
        }
        if (code === 40) {
          await this.moveNav(1);
          return;
        }
        if (code === 39) {
          const panel = this.container.querySelectorAll('.settings-panel-item.focusable');
          if (panel.length) {
            this.focusZone = "panel";
            this.panelIndex = clamp(this.panelIndex, 0, panel.length - 1);
            this.applyFocus();
          }
          return;
        }
        if (code === 37) {
          this.focusZone = "rail";
          this.applyFocus();
          return;
        }
      } else {
        if (code === 38) {
          this.movePanel(-1);
          return;
        }
        if (code === 40) {
          this.movePanel(1);
          return;
        }
        if (code === 37) {
          this.focusZone = "nav";
          this.applyFocus();
          return;
        }
      }
      return;
    }

    if (code !== 13) {
      return;
    }

    const current = this.container.querySelector('.focusable.focused');
    if (!current) {
      return;
    }

    const zone = String(current.dataset.zone || "");

    if (zone === "rail") {
      const actionId = String(current.dataset.railAction || "");
      const action = RAIL_ITEMS.find((item) => item.id === actionId)?.action;
      if (action) {
        await action();
      }
      return;
    }

    if (zone === "nav") {
      const sectionId = current.dataset.section;
      const index = Number(current.dataset.navIndex || 0);
      if (sectionId && this.activeSection !== sectionId) {
        this.activeSection = sectionId;
        this.navIndex = clamp(index, 0, SECTION_META.length - 1);
        this.panelIndex = 0;
        await this.render();
      }
      return;
    }

    const actionId = current.dataset.actionId;
    const action = this.actionMap.get(actionId);
    if (!action) {
      return;
    }

    await action();
    if (Router.getCurrent() === "settings") {
      await this.render();
      this.focusZone = "panel";
      this.applyFocus();
    }
  },

  cleanup() {
    ScreenUtils.hide(this.container);
  }

};
