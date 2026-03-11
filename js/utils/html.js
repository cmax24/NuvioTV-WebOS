const INNER_HTML_DESCRIPTOR = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
const nativeGetInnerHTML = INNER_HTML_DESCRIPTOR?.get;
const nativeSetInnerHTML = INNER_HTML_DESCRIPTOR?.set;

const DANGEROUS_TAGS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "APPLET",
  "META",
  "BASE"
]);

function normalizeString(value) {
  return String(value ?? "");
}

export function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeUrl(value, options = {}) {
  const allowDataImage = options.allowDataImage !== false;
  const text = normalizeString(value).trim();
  if (!text) {
    return "";
  }

  if (/[\u0000-\u001F\u007F]/.test(text)) {
    return "";
  }

  if (text.startsWith("#")) {
    return text;
  }

  if (text.startsWith("/") || text.startsWith("./") || text.startsWith("../")) {
    return text;
  }

  if (/^blob:/i.test(text)) {
    return text;
  }

  if (/^data:/i.test(text)) {
    if (allowDataImage && /^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/i.test(text)) {
      return text;
    }
    return "";
  }

  try {
    const parsed = new URL(text, "https://nuvio.local");
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return text;
    }
  } catch {
    return "";
  }

  return "";
}

function sanitizeStyleValue(value) {
  const raw = normalizeString(value);
  if (!raw.trim()) {
    return "";
  }

  const declarations = raw.split(";");
  const safeDeclarations = [];

  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (!trimmed) {
      continue;
    }

    if (/expression\s*\(/i.test(trimmed) || /-moz-binding/i.test(trimmed) || /behavior\s*:/i.test(trimmed)) {
      continue;
    }

    const urlMatches = [...trimmed.matchAll(/url\(([^)]+)\)/gi)];
    let safeDeclaration = trimmed;
    let isUnsafe = false;

    for (const match of urlMatches) {
      const fullMatch = String(match[0] || "");
      const inner = String(match[1] || "").trim().replace(/^['"]|['"]$/g, "");
      const safeUrl = sanitizeUrl(inner);
      if (!safeUrl) {
        isUnsafe = true;
        break;
      }
      const escapedUrl = safeUrl.replace(/'/g, "%27");
      safeDeclaration = safeDeclaration.replace(fullMatch, `url('${escapedUrl}')`);
    }

    if (!isUnsafe) {
      safeDeclarations.push(safeDeclaration);
    }
  }

  return safeDeclarations.join("; ");
}

function sanitizeAttribute(element, attribute) {
  const name = String(attribute?.name || "").toLowerCase();
  const value = attribute?.value;
  if (!name) {
    return;
  }

  if (name.startsWith("on")) {
    element.removeAttribute(attribute.name);
    return;
  }

  if (name === "style") {
    const safeStyle = sanitizeStyleValue(value);
    if (!safeStyle) {
      element.removeAttribute("style");
      return;
    }
    element.setAttribute("style", safeStyle);
    return;
  }

  if (name === "src" || name === "href" || name === "poster" || name === "xlink:href") {
    const safeUrl = sanitizeUrl(value);
    if (!safeUrl) {
      element.removeAttribute(attribute.name);
      return;
    }
    element.setAttribute(attribute.name, safeUrl);
  }
}

function sanitizeTree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];

  while (walker.nextNode()) {
    const element = walker.currentNode;
    const tagName = String(element?.tagName || "").toUpperCase();

    if (DANGEROUS_TAGS.has(tagName)) {
      toRemove.push(element);
      continue;
    }

    [...element.attributes].forEach((attribute) => {
      sanitizeAttribute(element, attribute);
    });
  }

  toRemove.forEach((element) => {
    element.remove();
  });
}

export function sanitizeHtml(html) {
  if (!nativeSetInnerHTML) {
    return normalizeString(html);
  }

  const template = document.createElement("template");
  nativeSetInnerHTML.call(template, normalizeString(html));
  sanitizeTree(template.content);
  return template.innerHTML;
}

export function setSafeInnerHTML(element, html) {
  if (!element || !nativeSetInnerHTML) {
    return;
  }
  nativeSetInnerHTML.call(element, sanitizeHtml(html));
}

export function installGlobalInnerHtmlSanitizer() {
  if (!nativeSetInnerHTML || !nativeGetInnerHTML) {
    return;
  }
  if (globalThis.__NUVIO_INNER_HTML_SANITIZER_INSTALLED__) {
    return;
  }

  Object.defineProperty(Element.prototype, "innerHTML", {
    configurable: true,
    enumerable: INNER_HTML_DESCRIPTOR?.enumerable ?? false,
    get() {
      return nativeGetInnerHTML.call(this);
    },
    set(value) {
      const html = sanitizeHtml(value);
      nativeSetInnerHTML.call(this, html);
    }
  });

  globalThis.__NUVIO_INNER_HTML_SANITIZER_INSTALLED__ = true;
}
