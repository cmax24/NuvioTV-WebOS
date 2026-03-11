import { Router } from "../../navigation/router.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { addonRepository } from "../../../data/repository/addonRepository.js";
import { catalogRepository } from "../../../data/repository/catalogRepository.js";
import { watchProgressRepository } from "../../../data/repository/watchProgressRepository.js";
import { LayoutPreferences } from "../../../data/local/layoutPreferences.js";
import { HomeCatalogStore } from "../../../data/local/homeCatalogStore.js";
import { metaRepository } from "../../../data/repository/metaRepository.js";
import { ProfileManager } from "../../../core/profile/profileManager.js";
import { loadWatchedIdSet, watchedBadgeHtml } from "../../utils/watchedBadge.js";
import { I18n } from "../../../core/i18n/i18n.js";

function isSearchOnlyCatalog(catalog) {
  return (catalog.extra || []).some((extra) => extra.name === "search" && extra.isRequired);
}

function catalogKey(catalog) {
  return `${catalog.addonId}|${catalog.type}|${catalog.catalogId}|${catalog.catalogName}`;
}

function toTitleCase(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCatalogRowTitle(catalogName, addonName, type) {
  const typeLabel = I18n.formatContentType(type || "movie") || I18n.t("type.movie");
  let base = String(catalogName || "").trim();
  if (!base) {
    return typeLabel;
  }
  const addon = String(addonName || "").trim();
  const cleanedAddon = addon.replace(/\baddon\b/i, "").trim();
  const cleanupTerms = [
    addon,
    cleanedAddon,
    "The Movie Database Addon",
    "TMDB Addon",
    "Addon"
  ].filter(Boolean);
  cleanupTerms.forEach((term) => {
    const regex = new RegExp(`\\s*-?\\s*${escapeRegExp(term)}\\s*`, "ig");
    base = base.replace(regex, " ");
  });
  base = base.replace(/\s{2,}/g, " ").trim();
  if (!base) {
    return typeLabel;
  }
  const endsWithType = new RegExp(`\\b${escapeRegExp(typeLabel)}$`, "i").test(base);
  if (endsWithType) {
    return base;
  }
  return `${base} - ${typeLabel}`;
}

function prettyId(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return I18n.t("common.untitled");
  }
  if (raw.includes(":")) {
    return raw.split(":").pop() || raw;
  }
  return raw;
}

function profileInitial(name) {
  const raw = String(name || "").trim();
  const first = raw.charAt(0);
  return first ? first.toUpperCase() : "P";
}

function resolveMetaRating(meta = {}) {
  const candidates = [
    meta?.imdbRating,
    meta?.imdb_score,
    meta?.ratings?.imdb,
    meta?.mdbListRatings?.imdb,
    meta?.tmdbRating,
    meta?.ratings?.tmdb
  ];
  for (const candidate of candidates) {
    const raw = String(candidate ?? "").trim();
    if (!raw) {
      continue;
    }
    const normalized = raw.replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value)) {
      return value.toFixed(1);
    }
    return raw;
  }
  return "";
}

function extractReleaseYear(value = "") {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

async function withTimeout(promise, ms, fallbackValue) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallbackValue), ms);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function navIconSvg(action) {
  const iconByAction = {
    gotoHome: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    gotoSearch: "M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8L20 22l2-2-6.5-6.5zM6.5 11A4.5 4.5 0 1 1 11 15.5 4.5 4.5 0 0 1 6.5 11z",
    gotoLibrary: "M5 4h14a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z",
    gotoPlugin: "M19 11h-1V9a2 2 0 0 0-2-2h-2V5a2 2 0 0 0-4 0v2H8a2 2 0 0 0-2 2v2H5a2 2 0 0 0 0 4h1v2a2 2 0 0 0 2 2h2v1a2 2 0 0 0 4 0v-1h2a2 2 0 0 0 2-2v-2h1a2 2 0 0 0 0-4z",
    gotoSettings: "M19.1 12.9c.1-.3.1-.6.1-.9s0-.6-.1-.9l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7 7 0 0 0-1.6-.9l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7 7 0 0 0-1.6.9l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6l2.1 1.6c-.1.3-.1.6-.1.9s0 .6.1.9L2.3 14.5a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1c.5.4 1 .7 1.6.9l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6c.6-.2 1.1-.5 1.6-.9l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6l-2.1-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z",
    gotoAccount: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2-8 4.5V21h16v-2.5C20 16 16.4 14 12 14z",
    toggleLayout: "M3 5h8v6H3zm10 0h8v6h-8zM3 13h8v6H3zm10 0h8v6h-8z"
  };
  const path = iconByAction[action] || iconByAction.gotoHome;
  return `
    <svg viewBox="0 0 24 24" class="home-nav-icon" aria-hidden="true" focusable="false">
      <path d="${path}" fill="currentColor"></path>
    </svg>
  `;
}

export const HomeScreen = {
  setSidebarExpanded(expanded) {
    const sidebar = this.container?.querySelector(".home-sidebar");
    if (!sidebar) {
      return;
    }
    sidebar.classList.toggle("expanded", Boolean(expanded));
  },

  isSidebarNode(node) {
    return String(node?.dataset?.navZone || "") === "sidebar";
  },

  isMainNode(node) {
    return String(node?.dataset?.navZone || "") === "main";
  },

  isHeroNode(node) {
    return String(node?.dataset?.navZone || "") === "hero";
  },

  focusWithoutAutoScroll(target) {
    if (!target || typeof target.focus !== "function") {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      target.focus();
    }
  },

  ensureMainVerticalVisibilityAfterExpand(target) {
    if (!target || !this.isMainNode(target)) {
      return;
    }
    if (this.homePostFocusAdjustTimer) {
      clearTimeout(this.homePostFocusAdjustTimer);
      this.homePostFocusAdjustTimer = null;
    }
    this.homePostFocusAdjustTimer = setTimeout(() => {
      if (Router.getCurrent() !== "home") {
        return;
      }
      const focused = this.container?.querySelector(".home-main .focusable.focused");
      if (!focused || focused !== target || !this.isMainNode(focused)) {
        return;
      }
      this.ensureMainVerticalVisibility(focused);
    }, 220);
  },

  ensureMainVerticalVisibility(target) {
    const main = this.container?.querySelector(".home-main");
    if (!main || !target || !main.contains(target)) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const topPad = 14;
    const bottomPad = target.classList.contains("home-poster-card") ? 86 : 20;
    let topLimit = mainRect.top + topPad;
    const contextPanel = main.querySelector(".home-context-panel");
    if (contextPanel) {
      const panelRect = contextPanel.getBoundingClientRect();
      const panelVisible = panelRect.bottom > mainRect.top && panelRect.top < mainRect.bottom;
      if (panelVisible) {
        const panelClearance = panelRect.bottom + 10;
        topLimit = Math.max(topLimit, Math.min(mainRect.bottom - topPad, panelClearance));
      }
    }
    if (rect.bottom > mainRect.bottom - bottomPad) {
      main.scrollTop += Math.ceil(rect.bottom - mainRect.bottom + bottomPad);
    } else if (rect.top < topLimit) {
      main.scrollTop -= Math.ceil(topLimit - rect.top);
    }
  },

  ensureTrackHorizontalVisibility(target, direction = null) {
    const track = target?.closest?.(".home-track");
    if (!track) {
      return;
    }
    const targetLeft = target.offsetLeft;
    const isPosterCard = target.classList.contains("home-poster-card");
    const expansionRight = isPosterCard ? Math.round(track.clientWidth * 0.18) : 0;
    const targetRight = targetLeft + target.offsetWidth + expansionRight;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;
    const step = target.offsetWidth + 18;

    if (targetRight > viewRight) {
      const overshoot = targetRight - viewRight;
      const delta = direction === "right"
        ? Math.max(step, overshoot)
        : overshoot;
      track.scrollLeft = Math.min(track.scrollWidth - track.clientWidth, viewLeft + delta);
      return;
    }

    if (targetLeft < viewLeft) {
      const overshoot = viewLeft - targetLeft;
      const delta = direction === "left"
        ? Math.max(step, overshoot)
        : overshoot;
      track.scrollLeft = Math.max(0, viewLeft - delta);
    }
  },

  contextKeyFor(type, id) {
    const safeType = String(type || "movie").trim().toLowerCase() || "movie";
    const safeId = String(id || "").trim();
    if (!safeId) {
      return "";
    }
    return `${safeType}:${safeId}`;
  },

  buildContextFromMeta(meta = {}, defaults = {}) {
    const releaseInfo = String(meta?.releaseInfo || defaults?.releaseInfo || "").trim();
    const rating = resolveMetaRating(meta) || String(defaults?.rating || "").trim();
    const genres = Array.isArray(meta?.genres) && meta.genres.length
      ? meta.genres.slice(0, 3)
      : (Array.isArray(defaults?.genres) ? defaults.genres.slice(0, 3) : []);

    return {
      id: String(meta?.id || defaults?.id || "").trim(),
      type: String(meta?.type || defaults?.type || "movie").trim().toLowerCase() || "movie",
      title: String(meta?.name || defaults?.title || I18n.t("common.untitled")).trim() || I18n.t("common.untitled"),
      description: String(meta?.description || defaults?.description || "").trim(),
      rating,
      year: extractReleaseYear(releaseInfo),
      releaseInfo,
      genres,
      poster: meta?.poster || defaults?.poster || "",
      background: meta?.background || defaults?.background || "",
      rowLabel: String(defaults?.rowLabel || "").trim()
    };
  },

  registerItemContext(context = {}) {
    const key = this.contextKeyFor(context.type, context.id);
    if (!key) {
      return;
    }
    const existing = this.homeItemContextMap.get(key) || {};
    this.homeItemContextMap.set(key, {
      ...existing,
      ...context
    });
  },

  buildCarouselContexts() {
    const contexts = [];
    const seen = new Set();
    const maxItems = 14;
    (this.rows || []).forEach((rowData) => {
      if (contexts.length >= maxItems) {
        return;
      }
      const items = Array.isArray(rowData?.result?.data?.items) ? rowData.result.data.items : [];
      const rowLabel = formatCatalogRowTitle(rowData.catalogName, rowData.addonName, rowData.type);
      items.slice(0, 8).forEach((item) => {
        if (contexts.length >= maxItems) {
          return;
        }
        const context = this.buildContextFromMeta(item, {
          id: item.id,
          type: rowData.type || item.type || "movie",
          title: item.name || I18n.t("common.untitled"),
          description: item.description || "",
          releaseInfo: item.releaseInfo || "",
          genres: Array.isArray(item.genres) ? item.genres : [],
          poster: item.poster || "",
          background: item.background || "",
          rowLabel
        });
        const key = this.contextKeyFor(context.type, context.id);
        if (!key || seen.has(key)) {
          return;
        }
        seen.add(key);
        contexts.push(context);
        this.registerItemContext(context);
      });
    });
    return contexts;
  },

  animateHomeContextPanel() {
    const panel = this.container?.querySelector(".home-context-panel");
    if (!panel) {
      return;
    }
    panel.classList.remove("home-context-animate");
    void panel.offsetWidth;
    panel.classList.add("home-context-animate");
  },

  applyCarouselContext(context, { hydrate = true, animate = false } = {}) {
    if (!context) {
      return;
    }
    this.currentContext = {
      ...context
    };
    this.renderHomeContext(this.currentContext, { animate });
    if (!hydrate || !this.currentContext.id) {
      return;
    }
    const requestToken = (this.homeCarouselRequestToken || 0) + 1;
    this.homeCarouselRequestToken = requestToken;
    this.fetchContextMeta(this.currentContext).then((contextMeta) => {
      if (requestToken !== this.homeCarouselRequestToken || Router.getCurrent() !== "home") {
        return;
      }
      const merged = {
        ...this.currentContext,
        ...contextMeta
      };
      this.currentContext = merged;
      this.registerItemContext(merged);
      this.renderHomeContext(merged, { animate: false });
    }).catch(() => {
      // Ignore carousel hydration failures.
    });
  },

  stopCarouselRotation() {
    if (this.homeCarouselTimer) {
      clearInterval(this.homeCarouselTimer);
      this.homeCarouselTimer = null;
    }
  },

  startCarouselRotation() {
    this.stopCarouselRotation();
    const contexts = Array.isArray(this.carouselContexts) ? this.carouselContexts : [];
    if (contexts.length <= 1) {
      return;
    }
    this.homeCarouselTimer = setInterval(() => {
      if (Router.getCurrent() !== "home") {
        return;
      }
      const pool = Array.isArray(this.carouselContexts) ? this.carouselContexts : [];
      if (!pool.length) {
        return;
      }
      this.carouselIndex = (Number(this.carouselIndex || 0) + 1) % pool.length;
      this.applyCarouselContext(pool[this.carouselIndex], { hydrate: true, animate: true });
    }, 8600);
  },

  formatContextMetaLine(context = {}) {
    const safe = context || {};
    const parts = [];
    const typeLabel = I18n.formatContentType(safe.type || "movie");
    if (typeLabel) {
      parts.push(typeLabel);
    }
    const primaryGenre = Array.isArray(safe.genres) && safe.genres.length ? String(safe.genres[0] || "").trim() : "";
    if (primaryGenre) {
      parts.push(primaryGenre);
    }
    if (safe.year) {
      parts.push(String(safe.year));
    }
    const rating = String(safe.rating || "").trim();
    if (rating && rating.toUpperCase() !== "N/A") {
      parts.push(rating);
    }
    return parts.filter(Boolean).join("  |  ");
  },

  renderHomeContext(context = this.currentContext, { animate = false } = {}) {
    const panel = this.container?.querySelector(".home-context-panel");
    if (!panel) {
      return;
    }
    const safe = context || {};
    const titleNode = panel.querySelector(".home-context-title");
    if (titleNode) {
      titleNode.textContent = safe.title || I18n.t("home.context_select_title");
    }
    const descNode = panel.querySelector(".home-context-description");
    if (descNode) {
      descNode.textContent = safe.description || I18n.t("home.context_pick_something");
    }
    const metaNode = panel.querySelector(".home-context-meta");
    if (metaNode) {
      metaNode.textContent = this.formatContextMetaLine(safe) || (safe.releaseInfo || I18n.t("home.context_row_home"));
    }
    const rowNode = panel.querySelector(".home-context-rowlabel");
    if (rowNode) {
      rowNode.textContent = safe.rowLabel || I18n.t("home.context_row_home");
    }
    const artNode = panel.querySelector(".home-context-art");
    if (artNode) {
      const image = safe.background || safe.poster || "";
      if (image) {
        artNode.style.backgroundImage = `url('${image}')`;
        artNode.classList.remove("empty");
      } else {
        artNode.style.backgroundImage = "";
        artNode.classList.add("empty");
      }
    }
    if (animate) {
      this.animateHomeContextPanel();
    }
  },

  async fetchContextMeta(context = {}) {
    const key = this.contextKeyFor(context.type, context.id);
    if (!key) {
      return context;
    }

    if (this.homeContextMetaCache.has(key)) {
      return this.homeContextMetaCache.get(key);
    }
    if (this.homeContextMetaInFlight.has(key)) {
      return this.homeContextMetaInFlight.get(key);
    }

    const loader = (async () => {
      const result = await withTimeout(
        metaRepository.getMetaFromAllAddons(context.type || "movie", context.id),
        2600,
        { status: "error", data: null }
      );
      if (result?.status !== "success" || !result?.data) {
        return context;
      }
      const merged = this.buildContextFromMeta(result.data, context);
      this.homeContextMetaCache.set(key, merged);
      return merged;
    })().catch(() => context).finally(() => {
      this.homeContextMetaInFlight.delete(key);
    });

    this.homeContextMetaInFlight.set(key, loader);
    return loader;
  },

  updateContextFromFocusedNode(node, { hydrate = true } = {}) {
    if (!node) {
      return;
    }

    const action = String(node.dataset.action || "");
    const rowLabel = String(node.dataset.rowLabel || "").trim();
    if (action === "openCatalogSeeAll") {
      this.currentContext = {
        id: "",
        type: "catalog",
        title: rowLabel ? I18n.t("home.see_all_in", { row: rowLabel }) : I18n.t("home.see_all_titles"),
        description: I18n.t("home.see_all_desc"),
        rating: "",
        year: "",
        releaseInfo: "",
        genres: [],
        poster: "",
        background: "",
        rowLabel
      };
      this.renderHomeContext(this.currentContext);
      return;
    }

    const itemId = String(node.dataset.itemId || "").trim();
    const itemType = String(node.dataset.itemType || "movie").trim().toLowerCase() || "movie";
    const key = this.contextKeyFor(itemType, itemId);
    const fallbackTitle = String(node.dataset.itemTitle || I18n.t("common.untitled")).trim() || I18n.t("common.untitled");
    const base = key
      ? (this.homeItemContextMap.get(key) || null)
      : null;

    this.currentContext = {
      id: itemId,
      type: itemType,
      title: base?.title || fallbackTitle,
      description: base?.description || "",
      rating: base?.rating || "",
      year: base?.year || "",
      releaseInfo: base?.releaseInfo || "",
      genres: base?.genres || [],
      poster: base?.poster || "",
      background: base?.background || "",
      rowLabel: base?.rowLabel || rowLabel
    };
    this.renderHomeContext(this.currentContext);

    if (!hydrate || !itemId) {
      return;
    }

    const requestToken = (this.homeContextRequestToken || 0) + 1;
    this.homeContextRequestToken = requestToken;
    this.fetchContextMeta(this.currentContext).then((contextMeta) => {
      if (requestToken !== this.homeContextRequestToken) {
        return;
      }
      const latestFocused = this.container?.querySelector(".home-main .focusable.focused");
      if (!latestFocused || String(latestFocused.dataset.itemId || "").trim() !== itemId) {
        return;
      }
      this.currentContext = {
        ...this.currentContext,
        ...contextMeta
      };
      this.registerItemContext(this.currentContext);
      this.renderHomeContext(this.currentContext);
    }).catch(() => {
      // Ignore context hydration failures.
    });
  },

  focusNode(current, target, direction = null) {
    if (!current || !target || current === target) {
      return false;
    }
    current.classList.remove("focused");
    target.classList.add("focused");
    this.focusWithoutAutoScroll(target);
    this.setSidebarExpanded(this.isSidebarNode(target));
    if (this.isHeroNode(target)) {
      const currentCol = Number(current?.dataset?.navCol);
      if (Number.isInteger(currentCol) && currentCol >= 0) {
        this.heroReturnCol = currentCol;
      }
      const main = this.container?.querySelector(".home-main");
      if (main) {
        main.scrollTop = 0;
      }
    }
    if (this.isMainNode(target)) {
      this.lastMainFocus = target;
      this.ensureTrackHorizontalVisibility(target, direction);
      this.ensureMainVerticalVisibility(target);
      this.ensureMainVerticalVisibilityAfterExpand(target);
    }
    return true;
  },

  buildNavigationModel() {
    const sidebar = Array.from(this.container?.querySelectorAll(".home-sidebar .focusable") || []);
    const rows = [];
    const heroNode = this.container?.querySelector(".home-main .home-context-panel.focusable") || null;
    if (heroNode) {
      rows.push([heroNode]);
    }

    const trackSections = Array.from(this.container?.querySelectorAll(".home-main .home-row") || []);
    trackSections.forEach((section) => {
      const track = section.querySelector(".home-track");
      if (!track) {
        return;
      }
      const cards = Array.from(track.querySelectorAll(".home-content-card.focusable"));
      if (cards.length) {
        rows.push(cards);
      }
    });

    sidebar.forEach((node, index) => {
      node.dataset.navZone = "sidebar";
      node.dataset.navIndex = String(index);
    });

    rows.forEach((rowNodes, rowIndex) => {
      rowNodes.forEach((node, colIndex) => {
        node.dataset.navZone = node.classList.contains("home-context-panel") ? "hero" : "main";
        node.dataset.navRow = String(rowIndex);
        node.dataset.navCol = String(colIndex);
      });
    });

    this.navModel = { sidebar, rows };
    const firstMainFocus = rows
      .flat()
      .find((node) => String(node?.dataset?.navZone || "") === "main") || null;
    if (!this.lastMainFocus || !this.container?.contains?.(this.lastMainFocus) || !this.isMainNode(this.lastMainFocus)) {
      this.lastMainFocus = firstMainFocus;
    }
  },

  handleHomeDpad(event) {
    const keyCode = Number(event?.keyCode || 0);
    const direction = keyCode === 38 ? "up"
      : keyCode === 40 ? "down"
        : keyCode === 37 ? "left"
          : keyCode === 39 ? "right"
            : null;
    if (!direction) {
      return false;
    }

    const nav = this.navModel;
    if (!nav) {
      return false;
    }
    const all = Array.from(this.container?.querySelectorAll(".focusable") || []);
    const current = this.container.querySelector(".focusable.focused") || all[0];
    if (!current) {
      return false;
    }
    const isSidebar = this.isSidebarNode(current);
    const isHero = this.isHeroNode(current);

    if (typeof event?.preventDefault === "function") {
      event.preventDefault();
    }

    if (isSidebar) {
      const sidebarIndex = Number(current.dataset.navIndex || 0);
      if (direction === "up") {
        const target = nav.sidebar[Math.max(0, sidebarIndex - 1)] || current;
        return this.focusNode(current, target, direction) || true;
      }
      if (direction === "down") {
        const target = nav.sidebar[Math.min(nav.sidebar.length - 1, sidebarIndex + 1)] || current;
        return this.focusNode(current, target, direction) || true;
      }
      if (direction === "right") {
        const target = (this.lastMainFocus && this.isMainNode(this.lastMainFocus))
          ? this.lastMainFocus
          : (nav.rows[0]?.[0] || null);
        return this.focusNode(current, target, direction) || true;
      }
      return true;
    }

    if (isHero) {
      const heroRow = Number(current.dataset.navRow || 0);
      if (direction === "left") {
        const sidebarFallback = nav.sidebar[0] || null;
        return this.focusNode(current, sidebarFallback, direction) || true;
      }
      if (direction === "down") {
        const targetRowNodes = nav.rows[heroRow + 1] || null;
        if (!targetRowNodes || !targetRowNodes.length) {
          return true;
        }
        const preferredCol = Number.isInteger(this.heroReturnCol) ? this.heroReturnCol : 0;
        const safeCol = Math.max(0, Math.min(preferredCol, targetRowNodes.length - 1));
        const target = targetRowNodes[safeCol] || targetRowNodes[0];
        return this.focusNode(current, target, direction) || true;
      }
      if (direction === "up") {
        const main = this.container?.querySelector(".home-main");
        if (main) {
          main.scrollTop = 0;
        }
        return true;
      }
      return true;
    }

    const row = Number(current.dataset.navRow || 0);
    const col = Number(current.dataset.navCol || 0);
    const rowNodes = nav.rows[row] || [];

    if (direction === "left") {
      const targetInRow = rowNodes[col - 1] || null;
      if (this.focusNode(current, targetInRow, direction)) {
        return true;
      }
      const heroOffset = (nav.rows[0] || []).some((node) => this.isHeroNode(node)) ? 1 : 0;
      const sidebarIndex = Math.max(0, Math.min(nav.sidebar.length - 1, row - heroOffset));
      const sidebarFallback = nav.sidebar[sidebarIndex] || nav.sidebar[0] || null;
      return this.focusNode(current, sidebarFallback, direction) || true;
    }

    if (direction === "right") {
      const target = rowNodes[col + 1] || null;
      return this.focusNode(current, target, direction) || true;
    }

    if (direction === "up" || direction === "down") {
      const delta = direction === "up" ? -1 : 1;
      const targetRow = row + delta;
      const targetRowNodes = nav.rows[targetRow] || null;
      if (!targetRowNodes || !targetRowNodes.length) {
        if (direction === "up" && row === 0) {
          const main = this.container?.querySelector(".home-main");
          if (main) {
            main.scrollTop = 0;
          }
        }
        return true;
      }
      const target = targetRowNodes[Math.min(col, targetRowNodes.length - 1)] || targetRowNodes[0];
      return this.focusNode(current, target, direction) || true;
    }

    return false;
  },

  async mount() {
    this.container = document.getElementById("home");
    ScreenUtils.show(this.container);
    const activeProfileId = String(ProfileManager.getActiveProfileId() || "");
    const profileChanged = activeProfileId !== String(this.loadedProfileId || "");
    if (profileChanged) {
      this.hasLoadedOnce = false;
    }

    if (this.hasLoadedOnce && Array.isArray(this.rows) && this.rows.length) {
      this.homeLoadToken = (this.homeLoadToken || 0) + 1;
      this.watchedIds = await loadWatchedIdSet();
      this.render();
      this.loadData({ background: true }).catch((error) => {
        console.warn("Home background refresh failed", error);
      });
      return;
    }

    this.homeLoadToken = (this.homeLoadToken || 0) + 1;
    this.container.innerHTML = `
      <div class="home-boot">
        <img src="assets/brand/app_logo_wordmark.png" class="home-boot-logo" alt="Nuvio" />
        <div class="home-boot-shimmer"></div>
      </div>
    `;
    await this.loadData({ background: false });
  },

  async loadData(options = {}) {
    const background = Boolean(options?.background);
    const token = this.homeLoadToken;
    const prefs = LayoutPreferences.get();
    this.layoutMode = prefs.homeLayout || "classic";

    const addons = await addonRepository.getInstalledAddons();
    const catalogDescriptors = [];

    addons.forEach((addon) => {
      addon.catalogs
        .filter((catalog) => !isSearchOnlyCatalog(catalog))
        .forEach((catalog) => {
          catalogDescriptors.push({
            addonBaseUrl: addon.baseUrl,
            addonId: addon.id,
            addonName: addon.displayName,
            catalogId: catalog.id,
            catalogName: catalog.name,
            type: catalog.apiType
          });
        });
    });

    const initialDescriptors = catalogDescriptors.slice(0, 8);
    const deferredDescriptors = catalogDescriptors.slice(8);

    const initialRows = await this.fetchCatalogRows(initialDescriptors);
    if (token !== this.homeLoadToken) {
      return;
    }
    this.rows = this.sortAndFilterRows(initialRows);
    const [progressItems, watchedIds] = await Promise.all([
      watchProgressRepository.getRecent(10),
      loadWatchedIdSet()
    ]);
    this.continueWatching = progressItems || [];
    this.watchedIds = watchedIds || new Set();
    if (token !== this.homeLoadToken) {
      return;
    }
    this.continueWatchingDisplay = this.continueWatching.map((item) => ({
      ...item,
      title: prettyId(item.contentId),
      poster: null
    }));
    this.loadedProfileId = String(ProfileManager.getActiveProfileId() || "");
    const profiles = await ProfileManager.getProfiles();
    const activeProfile = profiles.find((profile) => String(profile.id || profile.profileIndex || "1") === this.loadedProfileId)
      || profiles[0]
      || null;
    this.activeProfileName = String(activeProfile?.name || I18n.t("common.profile")).trim() || I18n.t("common.profile");
    this.activeProfileInitial = profileInitial(this.activeProfileName);
    this.hasLoadedOnce = true;
    if (!background) {
      this.render();
    }

    const deferredRowsPromise = deferredDescriptors.length
      ? this.fetchCatalogRows(deferredDescriptors).then((extraRows) => {
        if (token !== this.homeLoadToken || Router.getCurrent() !== "home") {
          return false;
        }
        const combinedByKey = new Map();
        [...this.rows, ...extraRows].forEach((row) => {
          combinedByKey.set(row.homeCatalogKey, row);
        });
        this.rows = this.sortAndFilterRows(Array.from(combinedByKey.values()));
        return true;
      }).catch((error) => {
        console.warn("Deferred home rows load failed", error);
        return false;
      })
      : Promise.resolve(false);

    const continueWatchingPromise = this.enrichContinueWatching(this.continueWatching).then((enriched) => {
      if (token !== this.homeLoadToken || Router.getCurrent() !== "home") {
        return false;
      }
      this.continueWatchingDisplay = enriched;
      return true;
    }).catch((error) => {
      console.warn("Continue watching async enrichment failed", error);
      return false;
    });

    const [deferredRowsUpdated, continueWatchingUpdated] = await Promise.all([
      deferredRowsPromise,
      continueWatchingPromise
    ]);
    if (token !== this.homeLoadToken || Router.getCurrent() !== "home") {
      return;
    }
    if (background || deferredRowsUpdated || continueWatchingUpdated) {
      this.render();
    }
  },

  async fetchCatalogRows(descriptors = []) {
    const rowResults = await Promise.all((descriptors || []).map(async (catalog) => {
      const result = await withTimeout(catalogRepository.getCatalog({
        addonBaseUrl: catalog.addonBaseUrl,
        addonId: catalog.addonId,
        addonName: catalog.addonName,
        catalogId: catalog.catalogId,
        catalogName: catalog.catalogName,
        type: catalog.type,
        skip: 0,
        supportsSkip: true
      }), 3500, { status: "error", message: "timeout" });
      return { ...catalog, result };
    }));
    return rowResults
      .filter((row) => row.result.status === "success")
      .map((row) => ({
        ...row,
        homeCatalogKey: catalogKey(row)
      }));
  },

  sortAndFilterRows(rows = []) {
    const allKeys = rows.map((row) => row.homeCatalogKey);
    const orderedKeys = HomeCatalogStore.ensureOrderKeys(allKeys);
    const enabledRows = rows.filter((row) => !HomeCatalogStore.isDisabled(row.homeCatalogKey));
    const orderIndex = new Map(orderedKeys.map((key, index) => [key, index]));
    enabledRows.sort((left, right) => {
      const l = orderIndex.has(left.homeCatalogKey) ? orderIndex.get(left.homeCatalogKey) : Number.MAX_SAFE_INTEGER;
      const r = orderIndex.has(right.homeCatalogKey) ? orderIndex.get(right.homeCatalogKey) : Number.MAX_SAFE_INTEGER;
      return l - r;
    });
    return enabledRows;
  },

  render() {
    this.homeItemContextMap = new Map();
    this.homeContextMetaCache = this.homeContextMetaCache || new Map();
    this.homeContextMetaInFlight = this.homeContextMetaInFlight || new Map();

    const firstRow = this.rows.find((row) => Array.isArray(row?.result?.data?.items) && row.result.data.items.length);
    const firstItem = firstRow?.result?.data?.items?.[0] || null;
    const defaultContext = firstItem
      ? this.buildContextFromMeta(firstItem, {
        id: firstItem.id,
        type: firstRow?.type || firstItem.type || "movie",
        title: firstItem.name || I18n.t("common.untitled"),
        description: firstItem.description || "",
        releaseInfo: firstItem.releaseInfo || "",
        genres: firstItem.genres || [],
        poster: firstItem.poster || "",
        background: firstItem.background || "",
        rowLabel: formatCatalogRowTitle(firstRow.catalogName, firstRow.addonName, firstRow.type)
      })
      : {
        id: "",
        type: "movie",
        title: I18n.t("home.context_select_title"),
        description: I18n.t("home.context_pick_something"),
        rating: "",
        year: "",
        releaseInfo: "",
        genres: [],
        poster: "",
        background: "",
        rowLabel: I18n.t("home.context_row_home")
      };
    this.currentContext = this.currentContext || defaultContext;
    this.carouselContexts = this.buildCarouselContexts();
    if (!this.carouselContexts.length) {
      this.carouselContexts = [defaultContext];
    }
    const currentKey = this.contextKeyFor(this.currentContext?.type, this.currentContext?.id);
    const currentIndex = this.carouselContexts.findIndex((context) => this.contextKeyFor(context.type, context.id) === currentKey);
    this.carouselIndex = currentIndex >= 0 ? currentIndex : 0;
    this.currentContext = this.carouselContexts[this.carouselIndex] || defaultContext;

    const progressHtml = this.renderContinueWatching(this.continueWatchingDisplay || []);

    this.container.innerHTML = `
      <div class="home-shell home-enter">
        <aside class="home-sidebar">
          <div class="home-brand-wrap">
            <img src="assets/brand/app_logo_wordmark.png" class="home-brand-logo-main" alt="Nuvio" />
          </div>
          <div class="home-nav-list">
            <button class="home-nav-item focusable" data-action="gotoHome" aria-label="${I18n.t("nav.home")}"><span class="home-nav-icon-wrap">${navIconSvg("gotoHome")}</span><span class="home-nav-label">${I18n.t("nav.home")}</span></button>
            <button class="home-nav-item focusable" data-action="gotoSearch" aria-label="${I18n.t("nav.search")}"><span class="home-nav-icon-wrap">${navIconSvg("gotoSearch")}</span><span class="home-nav-label">${I18n.t("nav.search")}</span></button>
            <button class="home-nav-item focusable" data-action="gotoLibrary" aria-label="${I18n.t("nav.library")}"><span class="home-nav-icon-wrap">${navIconSvg("gotoLibrary")}</span><span class="home-nav-label">${I18n.t("nav.library")}</span></button>
            <button class="home-nav-item focusable" data-action="gotoPlugin" aria-label="${I18n.t("nav.addons")}"><span class="home-nav-icon-wrap">${navIconSvg("gotoPlugin")}</span><span class="home-nav-label">${I18n.t("nav.addons")}</span></button>
            <button class="home-nav-item focusable" data-action="gotoSettings" aria-label="${I18n.t("nav.settings")}"><span class="home-nav-icon-wrap">${navIconSvg("gotoSettings")}</span><span class="home-nav-label">${I18n.t("nav.settings")}</span></button>
          </div>
          <button class="home-profile-pill focusable" data-action="gotoAccount" aria-label="${I18n.t("nav.account")}">
            <span class="home-profile-avatar">${this.activeProfileInitial || "P"}</span>
            <span class="home-profile-name">${this.activeProfileName || I18n.t("common.profile")}</span>
          </button>
        </aside>

        <main class="home-main">
          <section class="home-context-panel focusable" aria-live="polite">
            <div class="home-context-art${(this.currentContext?.background || this.currentContext?.poster) ? "" : " empty"}"${(this.currentContext?.background || this.currentContext?.poster) ? ` style="background-image:url('${this.currentContext.background || this.currentContext.poster}')"` : ""}>
              <div class="home-context-art-overlay">
                <div class="home-context-rowlabel">${this.currentContext?.rowLabel || I18n.t("home.context_row_home")}</div>
                <h1 class="home-context-title">${this.currentContext?.title || I18n.t("home.context_select_title")}</h1>
              </div>
            </div>
            <div class="home-context-meta">${this.formatContextMetaLine(this.currentContext) || (this.currentContext?.releaseInfo || I18n.t("home.context_row_home"))}</div>
            <p class="home-context-description">${this.currentContext?.description || I18n.t("home.context_pick_something")}</p>
          </section>

          ${progressHtml}

          <section class="home-catalogs" id="homeCatalogRows"></section>
        </main>
      </div>
    `;

    const rowsContainer = this.container.querySelector("#homeCatalogRows");
    if (rowsContainer) {
      this.catalogSeeAllMap = new Map();
      this.rows.forEach((rowData) => {
        const rowLabel = formatCatalogRowTitle(rowData.catalogName, rowData.addonName, rowData.type);
        const seeAllId = `${rowData.addonId || "addon"}_${rowData.catalogId || "catalog"}_${rowData.type || "movie"}`;
        this.catalogSeeAllMap.set(seeAllId, {
          addonBaseUrl: rowData.addonBaseUrl || "",
          addonId: rowData.addonId || "",
          addonName: rowData.addonName || "",
          catalogId: rowData.catalogId || "",
          catalogName: rowData.catalogName || "",
          type: rowData.type || "movie",
          initialItems: Array.isArray(rowData?.result?.data?.items) ? rowData.result.data.items : []
        });
        const section = document.createElement("section");
        section.className = "home-row home-row-enter";
        section.style.animationDelay = `${Math.min(460, (rowsContainer.children.length + 1) * 42)}ms`;
        section.innerHTML = `
          <div class="home-row-head">
            <h3 class="home-row-title">${rowLabel}</h3>
          </div>
        `;

        const track = document.createElement("div");
        track.className = "home-track home-track-catalog";

        rowData.result.data.items.forEach((item) => {
          const card = document.createElement("article");
          card.className = "home-content-card home-poster-card focusable";
          card.dataset.action = "openDetail";
          card.dataset.itemId = item.id;
          card.dataset.itemType = rowData.type;
          card.dataset.itemTitle = item.name;
          card.dataset.rowLabel = rowLabel;
          const cardContext = this.buildContextFromMeta(item, {
            id: item.id,
            type: rowData.type,
            title: item.name || I18n.t("common.untitled"),
            description: item.description || "",
            releaseInfo: item.releaseInfo || "",
            genres: Array.isArray(item.genres) ? item.genres : [],
            poster: item.poster || "",
            background: item.background || "",
            rowLabel
          });
          const cardMeta = this.formatContextMetaLine(cardContext) || (cardContext.releaseInfo || "");
          const cardDescription = cardContext.description || I18n.t("home.context_pick_something");
          const cardBackdrop = cardContext.background || cardContext.poster || item.poster || "";
          card.innerHTML = `
            <div class="home-card-collapsed">
              <div class="home-card-poster-wrap">
                ${item.poster ? `<img class="content-poster" src="${item.poster}" alt="${item.name || I18n.t("common.content")}" />` : `<div class="content-poster placeholder"></div>`}
                ${watchedBadgeHtml(this.watchedIds, item.id)}
              </div>
            </div>
            <div class="home-card-expanded-view">
              <div class="home-card-backdrop${cardBackdrop ? "" : " empty"}"${cardBackdrop ? ` style="background-image:url('${cardBackdrop}')"` : ""}></div>
              <div class="home-card-expanded">
                <div class="home-card-expanded-title">${cardContext.title}</div>
                <div class="home-card-expanded-meta">${cardMeta}</div>
                <div class="home-card-expanded-description">${cardDescription}</div>
              </div>
            </div>
          `;
          this.registerItemContext(cardContext);
          card.addEventListener("click", () => {
            this.openDetailFromNode(card);
          });
          track.appendChild(card);
        });

        const seeAllCard = document.createElement("article");
        seeAllCard.className = "home-content-card home-seeall-card focusable";
        seeAllCard.dataset.action = "openCatalogSeeAll";
        seeAllCard.dataset.seeAllId = seeAllId;
        seeAllCard.dataset.addonBaseUrl = rowData.addonBaseUrl || "";
        seeAllCard.dataset.addonId = rowData.addonId || "";
        seeAllCard.dataset.addonName = rowData.addonName || "";
        seeAllCard.dataset.catalogId = rowData.catalogId || "";
        seeAllCard.dataset.catalogName = rowData.catalogName || "";
        seeAllCard.dataset.catalogType = rowData.type || "";
        seeAllCard.dataset.rowLabel = rowLabel;
        seeAllCard.innerHTML = `
            <div class="home-seeall-card-inner">
              <div class="home-seeall-arrow" aria-hidden="true">&#8594;</div>
              <div class="home-seeall-label">${I18n.t("home.see_all")}</div>
            </div>
          `;
        seeAllCard.addEventListener("click", () => {
          this.openCatalogSeeAllFromNode(seeAllCard);
        });
        track.appendChild(seeAllCard);

        section.appendChild(track);
        rowsContainer.appendChild(section);
      });
    }

    this.container.querySelectorAll(".home-sidebar .focusable").forEach((item) => {
      item.addEventListener("focus", () => {
        this.setSidebarExpanded(true);
      });
      item.addEventListener("click", () => {
        const action = item.dataset.action;
        if (action === "gotoHome") return;
        if (action === "gotoLibrary") Router.navigate("library");
        if (action === "gotoSearch") Router.navigate("search");
        if (action === "gotoPlugin") Router.navigate("plugin");
        if (action === "gotoSettings") Router.navigate("settings");
        if (action === "gotoAccount") Router.navigate("profileSelection");
      });
    });

    ScreenUtils.indexFocusables(this.container);
    this.buildNavigationModel();
    ScreenUtils.setInitialFocus(this.container, ".home-main .home-row .focusable");
    const current = this.container.querySelector(".home-main .focusable.focused");
    if (current && this.isMainNode(current)) {
      this.lastMainFocus = current;
    }
    this.applyCarouselContext(this.carouselContexts[this.carouselIndex], { hydrate: true, animate: false });
    this.startCarouselRotation();
    this.setSidebarExpanded(false);
  },

  renderContinueWatching(items) {
    if (!items.length) {
      return "";
    }

    const cards = items.map((item) => {
      const positionMs = Number(item.positionMs || 0);
      const durationMs = Number(item.durationMs || 0);
      const positionMin = Math.floor(positionMs / 60000);
      const durationMin = Math.floor(durationMs / 60000);
      const remaining = Math.max(0, durationMin - positionMin);
      const hasDuration = durationMs > 0;
      const progress = hasDuration ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;
      const leftText = hasDuration ? I18n.t("home.minutes_left", { value: remaining }) : I18n.t("home.continue");
      const progressText = hasDuration ? `${positionMin}m / ${durationMin || "?"}m` : I18n.t("home.minutes_watched", { value: positionMin });
      this.registerItemContext(this.buildContextFromMeta(item, {
        id: item.contentId,
        type: item.contentType || "movie",
        title: item.title || prettyId(item.contentId),
        description: "",
        releaseInfo: "",
        genres: [],
        poster: item.poster || "",
        background: item.background || item.poster || "",
        rowLabel: I18n.t("home.continue_watching")
      }));
      return `
        <article class="home-content-card home-progress-card focusable" data-action="resumeProgress"
             data-item-id="${item.contentId}"
             data-item-type="${item.contentType || "movie"}"
             data-item-title="${item.title || prettyId(item.contentId)}"
             data-row-label="${I18n.t("home.continue_watching")}">
          <div class="home-progress-poster"${item.poster ? ` style="background-image:url('${item.poster}')"` : ""}>
            <span class="home-progress-left">${leftText}</span>
            ${watchedBadgeHtml(this.watchedIds, item.contentId)}
          </div>
          <div class="home-progress-meta">
            <div class="home-content-title">${item.title || prettyId(item.contentId)}</div>
            <div class="home-content-type">${progressText}</div>
            <div class="home-progress-track">
              <div class="home-progress-fill" style="width:${Math.round(progress * 100)}%"></div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    return `
      <section class="home-row">
        <h3 class="home-row-title">${I18n.t("home.continue_watching")}</h3>
        <div class="home-track">${cards}</div>
      </section>
    `;
  },

  async enrichContinueWatching(items = []) {
    const enriched = await Promise.all((items || []).map(async (item) => {
      try {
        const result = await withTimeout(
          metaRepository.getMetaFromAllAddons(item.contentType || "movie", item.contentId),
          1800,
          { status: "error", message: "timeout" }
        );
        if (result?.status === "success" && result?.data) {
          return {
            ...item,
            title: result.data.name || prettyId(item.contentId),
            poster: result.data.poster || result.data.background || null
          };
        }
      } catch (error) {
        console.warn("Continue watching enrichment failed", error);
      }
      return {
        ...item,
        title: prettyId(item.contentId),
        poster: null
      };
    }));
    return enriched;
  },

  openDetailFromNode(node) {
    const itemId = node.dataset.itemId;
    if (!itemId) {
      return;
    }
    Router.navigate("detail", {
      itemId,
      itemType: node.dataset.itemType || "movie",
      fallbackTitle: node.dataset.itemTitle || I18n.t("common.untitled")
    });
  },

  openCatalogSeeAllFromNode(node) {
    if (!node) {
      return;
    }
    const seeAllId = String(node.dataset.seeAllId || "");
    const mapped = this.catalogSeeAllMap?.get?.(seeAllId) || null;
    if (mapped) {
      Router.navigate("catalogSeeAll", mapped);
      return;
    }
    Router.navigate("catalogSeeAll", {
      addonBaseUrl: node.dataset.addonBaseUrl || "",
      addonId: node.dataset.addonId || "",
      addonName: node.dataset.addonName || "",
      catalogId: node.dataset.catalogId || "",
      catalogName: node.dataset.catalogName || "",
      type: node.dataset.catalogType || "movie",
      initialItems: []
    });
  },

  onKeyDown(event) {
    if (this.handleHomeDpad(event)) {
      return;
    }
    if (event.keyCode === 76) {
      this.layoutMode = this.layoutMode === "grid" ? "classic" : "grid";
      LayoutPreferences.set({ homeLayout: this.layoutMode });
      this.render();
      return;
    }
    if (event.keyCode !== 13) {
      return;
    }

    const current = this.container.querySelector(".focusable.focused");
    if (!current) {
      return;
    }
    const action = current.dataset.action;
    if (action === "gotoHome") return;
    if (action === "gotoLibrary") Router.navigate("library");
    if (action === "gotoSearch") Router.navigate("search");
    if (action === "gotoPlugin") Router.navigate("plugin");
    if (action === "gotoSettings") Router.navigate("settings");
    if (action === "gotoAccount") Router.navigate("profileSelection");
    if (action === "openDetail") this.openDetailFromNode(current);
    if (action === "openCatalogSeeAll") this.openCatalogSeeAllFromNode(current);
    if (action === "resumeProgress") {
      Router.navigate("detail", {
        itemId: current.dataset.itemId,
        itemType: current.dataset.itemType || "movie",
        fallbackTitle: current.dataset.itemTitle || current.dataset.itemId || I18n.t("common.untitled")
      });
    }
  },

  cleanup() {
    this.stopCarouselRotation();
    this.homeCarouselRequestToken = (this.homeCarouselRequestToken || 0) + 1;
    this.homeLoadToken = (this.homeLoadToken || 0) + 1;
    if (this.homePostFocusAdjustTimer) {
      clearTimeout(this.homePostFocusAdjustTimer);
      this.homePostFocusAdjustTimer = null;
    }
    ScreenUtils.hide(this.container);
  }

};

