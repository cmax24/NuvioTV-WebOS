const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
const OBSERVER_ROOT_MARGIN = "240px 0px";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(normalizeText(value));
}

function toCssUrl(value) {
  return `url('${String(value || "").replace(/'/g, "%27")}')`;
}

function extractBackgroundUrl(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  const match = /url\(([^)]+)\)/i.exec(text);
  if (!match) {
    return "";
  }
  return normalizeText(match[1]).replace(/^['"]|['"]$/g, "");
}

function ensureArray(input) {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

function processImageElement(image) {
  if (!(image instanceof HTMLImageElement)) {
    return null;
  }
  if (image.dataset.lazyMediaReady === "1") {
    return null;
  }

  const source = normalizeText(image.getAttribute("src"));
  if (!isRemoteHttpUrl(source)) {
    image.dataset.lazyMediaReady = "1";
    return null;
  }

  image.dataset.lazySrc = source;
  image.dataset.lazyMediaReady = "1";
  image.decoding = "async";
  image.loading = "lazy";
  image.setAttribute("src", BLANK_PIXEL);
  return image;
}

function processBackgroundElement(element) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  if (element.dataset.lazyMediaReady === "1") {
    return null;
  }

  const inlineBackground = normalizeText(element.style.backgroundImage || "");
  const resolved = extractBackgroundUrl(inlineBackground);
  if (!isRemoteHttpUrl(resolved)) {
    return null;
  }

  element.dataset.lazyBg = resolved;
  element.dataset.lazyMediaReady = "1";
  element.classList.add("lazy-bg-pending");
  element.style.backgroundImage = "none";
  return element;
}

function collectLazyCandidates(root) {
  const candidates = [];
  const roots = ensureArray(root);
  roots.forEach((entry) => {
    if (!(entry instanceof Element) && !(entry instanceof Document)) {
      return;
    }

    if (entry instanceof HTMLImageElement) {
      const imageCandidate = processImageElement(entry);
      if (imageCandidate) {
        candidates.push(imageCandidate);
      }
    }
    if (entry instanceof HTMLElement) {
      const bgCandidate = processBackgroundElement(entry);
      if (bgCandidate) {
        candidates.push(bgCandidate);
      }
    }

    const imageNodes = entry.querySelectorAll?.("img[src]") || [];
    imageNodes.forEach((image) => {
      const candidate = processImageElement(image);
      if (candidate) {
        candidates.push(candidate);
      }
    });

    const styledNodes = entry.querySelectorAll?.("[style*='background-image']") || [];
    styledNodes.forEach((node) => {
      const candidate = processBackgroundElement(node);
      if (candidate) {
        candidates.push(candidate);
      }
    });
  });
  return candidates;
}

function loadLazyElement(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const lazySrc = normalizeText(element.dataset.lazySrc);
  if (lazySrc && element instanceof HTMLImageElement) {
    element.setAttribute("src", lazySrc);
    element.removeAttribute("data-lazy-src");
    element.dataset.lazyMediaReady = "0";
  }

  const lazyBg = normalizeText(element.dataset.lazyBg);
  if (lazyBg) {
    element.style.backgroundImage = toCssUrl(lazyBg);
    element.removeAttribute("data-lazy-bg");
    element.classList.remove("lazy-bg-pending");
    element.dataset.lazyMediaReady = "0";
  }
}

function createObserver() {
  if (!("IntersectionObserver" in globalThis)) {
    return null;
  }

  return new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      const target = entry.target;
      loadLazyElement(target);
      observer.unobserve(target);
    });
  }, {
    root: null,
    rootMargin: OBSERVER_ROOT_MARGIN,
    threshold: 0.01
  });
}

export const LazyMedia = {
  observer: null,
  mutationObserver: null,
  installed: false,

  observeWithin(root) {
    const candidates = collectLazyCandidates(root);
    if (!candidates.length) {
      return;
    }

    if (!this.observer) {
      this.observer = createObserver();
    }

    if (!this.observer) {
      candidates.forEach((node) => loadLazyElement(node));
      return;
    }

    candidates.forEach((candidate) => {
      this.observer.observe(candidate);
    });
  },

  install(root = document.body) {
    if (!root || this.installed) {
      return;
    }

    this.installed = true;
    this.observeWithin(root);

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            this.observeWithin(node);
          }
        });
      });
    });

    this.mutationObserver.observe(root, {
      childList: true,
      subtree: true
    });
  }
};
