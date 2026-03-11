import { watchedItemsRepository } from "../../data/repository/watchedItemsRepository.js";
import { watchProgressRepository } from "../../data/repository/watchProgressRepository.js";
import { I18n } from "../../core/i18n/i18n.js";

const COMPLETION_THRESHOLD = 0.95;

function normalizeContentId(value) {
  return String(value || "").trim();
}

function hasEpisodeCoordinates(item = {}) {
  const season = Number(item?.season);
  const episode = Number(item?.episode);
  return (Number.isFinite(season) && season > 0) || (Number.isFinite(episode) && episode > 0);
}

function isCompletedProgress(item = {}) {
  const durationMs = Number(item.durationMs || 0);
  const positionMs = Number(item.positionMs || 0);
  if (!Number.isFinite(durationMs) || !Number.isFinite(positionMs) || durationMs <= 0) {
    return false;
  }
  return (positionMs / durationMs) >= COMPLETION_THRESHOLD;
}

export async function loadWatchedIdSet(limit = 5000) {
  const [watchedItems, progressItems] = await Promise.all([
    watchedItemsRepository.getAll(limit),
    watchProgressRepository.getAll()
  ]);

  const watchedIds = new Set();

  (watchedItems || []).forEach((item) => {
    const contentId = normalizeContentId(item?.contentId);
    if (hasEpisodeCoordinates(item)) {
      return;
    }
    if (contentId) {
      watchedIds.add(contentId);
    }
  });

  (progressItems || []).forEach((item) => {
    if (hasEpisodeCoordinates(item)) {
      return;
    }
    if (!isCompletedProgress(item)) {
      return;
    }
    const contentId = normalizeContentId(item?.contentId);
    if (contentId) {
      watchedIds.add(contentId);
    }
  });

  return watchedIds;
}

export function watchedBadgeHtml(watchedSet, contentId) {
  const id = normalizeContentId(contentId);
  if (!id || !(watchedSet instanceof Set) || !watchedSet.has(id)) {
    return "";
  }
  const label = I18n.t("watched.badge");
  return `<span class="content-watched-badge" aria-label="${label}" title="${label}">&#10003;</span>`;
}
