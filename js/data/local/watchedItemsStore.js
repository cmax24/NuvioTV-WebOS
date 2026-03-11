import { LocalStore } from "../../core/storage/localStore.js";

const WATCHED_ITEMS_KEY = "watchedItems";

function normalizeItem(item = {}, profileId) {
  return {
    profileId: String(profileId || 1),
    contentId: String(item.contentId || ""),
    contentType: String(item.contentType || "movie"),
    title: String(item.title || ""),
    season: item.season == null ? null : Number(item.season),
    episode: item.episode == null ? null : Number(item.episode),
    watchedAt: Number(item.watchedAt || Date.now())
  };
}

function watchedItemKey(item = {}) {
  const profileId = String(item.profileId || "1");
  const contentId = String(item.contentId || "").trim();
  const season = item.season == null ? "" : String(Number(item.season));
  const episode = item.episode == null ? "" : String(Number(item.episode));
  return `${profileId}::${contentId}::${season}::${episode}`;
}

function dedupeItems(items = []) {
  const byKey = new Map();
  (Array.isArray(items) ? items : []).forEach((raw) => {
    const normalized = normalizeItem(raw, raw?.profileId || "1");
    if (!normalized.contentId) {
      return;
    }
    const key = watchedItemKey(normalized);
    const existing = byKey.get(key);
    if (!existing || Number(normalized.watchedAt || 0) > Number(existing.watchedAt || 0)) {
      byKey.set(key, normalized);
    }
  });
  return Array.from(byKey.values())
    .sort((left, right) => Number(right.watchedAt || 0) - Number(left.watchedAt || 0));
}

export const WatchedItemsStore = {

  listAll() {
    const raw = LocalStore.get(WATCHED_ITEMS_KEY, []);
    return dedupeItems(raw);
  },

  listForProfile(profileId) {
    const pid = String(profileId || 1);
    return this.listAll().filter((item) => String(item.profileId || "1") === pid);
  },

  upsert(item, profileId) {
    const pid = String(profileId || 1);
    const normalized = normalizeItem(item, pid);
    if (!normalized.contentId) {
      return;
    }
    const normalizedKey = watchedItemKey(normalized);
    const next = [
      normalized,
      ...this.listAll().filter((entry) => watchedItemKey(entry) !== normalizedKey)
    ].slice(0, 5000);
    LocalStore.set(WATCHED_ITEMS_KEY, next);
  },

  remove(contentId, profileId) {
    const pid = String(profileId || 1);
    const next = this.listAll().filter((entry) => !(String(entry.profileId || "1") === pid && entry.contentId === String(contentId || "")));
    LocalStore.set(WATCHED_ITEMS_KEY, next);
  },

  replaceForProfile(profileId, items = []) {
    const pid = String(profileId || 1);
    const keepOtherProfiles = this.listAll().filter((entry) => String(entry.profileId || "1") !== pid);
    const normalized = (Array.isArray(items) ? items : [])
      .map((item) => normalizeItem(item, pid))
      .filter((item) => Boolean(item.contentId));
    LocalStore.set(WATCHED_ITEMS_KEY, dedupeItems([...normalized, ...keepOtherProfiles]));
  }

};
