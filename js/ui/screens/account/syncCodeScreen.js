import { Router } from "../../navigation/router.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { I18n } from "../../../core/i18n/i18n.js";

const KEY = "manualSyncCode";

export const SyncCodeScreen = {

  async mount() {
    this.container = document.getElementById("account");
    ScreenUtils.show(this.container);
    this.render();
  },

  render() {
    const value = LocalStore.get(KEY, "");
    this.container.innerHTML = `
      <div class="row">
        <h2>${I18n.t("sync_code.title")}</h2>
        <p>${I18n.t("sync_code.current", { value: value || I18n.t("sync_code.empty") })}</p>
      </div>
      <div class="row">
        <div class="card focusable" data-action="setCode">${I18n.t("sync_code.set")}</div>
        <div class="card focusable" data-action="clearCode">${I18n.t("sync_code.clear")}</div>
        <div class="card focusable" data-action="back">${I18n.t("common.back")}</div>
      </div>
    `;
    ScreenUtils.indexFocusables(this.container);
    ScreenUtils.setInitialFocus(this.container);
  },

  onKeyDown(event) {
    if (ScreenUtils.handleDpadNavigation(event, this.container)) {
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
    if (action === "setCode") {
      const value = window.prompt(I18n.t("sync_code.prompt"), LocalStore.get(KEY, ""));
      if (value !== null) {
        LocalStore.set(KEY, String(value).trim());
        this.render();
      }
      return;
    }
    if (action === "clearCode") {
      LocalStore.remove(KEY);
      this.render();
      return;
    }
    if (action === "back") {
      Router.back();
    }
  },

  cleanup() {
    ScreenUtils.hide(this.container);
  }

};
