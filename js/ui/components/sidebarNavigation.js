import { I18n } from "../../core/i18n/i18n.js";

export function createSidebarNavigation(items = []) {
  const node = document.createElement("div");
  node.className = "row";
  node.innerHTML = `<h2>${I18n.t("sidebar.navigation_title")}</h2>`;
  items.forEach((item) => {
    const btn = document.createElement("div");
    btn.className = "card";
    btn.textContent = item.label || item.id || I18n.t("sidebar.item");
    node.appendChild(btn);
  });
  return node;
}
