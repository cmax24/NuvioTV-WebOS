import { Router } from "../../navigation/router.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { QrLoginService } from "../../../core/auth/qrLoginService.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { I18n } from "../../../core/i18n/i18n.js";

let pollInterval = null;
let countdownInterval = null;

export const AuthQrSignInScreen = {
  container: null,
  requestId: 0,

  async mount() {
    this.container = document.getElementById("account");
    ScreenUtils.show(this.container);
    this.render();
    this.bindEvents();

    await this.startQr();
  },

  render() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="qr-layout qr-layout-enter">
        <div class="qr-glow qr-glow-left"></div>
        <div class="qr-glow qr-glow-right"></div>

        <section class="qr-left">
          <img src="assets/brand/app_logo_wordmark.png" class="qr-logo" alt="Nuvio" />
          <span class="qr-kicker">${I18n.t("auth_qr.sign_in_title")}</span>
          <h1 class="qr-title">${I18n.t("auth_qr.account_login_title")}</h1>
          <p class="qr-description">${I18n.t("auth_qr.sign_in_desc")}</p>
        </section>

        <section class="qr-right">
          <div class="qr-main-block">
            <p class="qr-panel-copy">${I18n.t("auth_qr.account_login_desc")}</p>

            <div class="qr-code-shell">
              <div id="qr-container" class="qr-container"></div>
            </div>

            <div id="qr-code-text" class="qr-code-text"></div>
            <div id="qr-expiry" class="qr-expiry"></div>
            <div id="qr-status" class="qr-status"></div>
          </div>

          <div class="qr-buttons">
            <button id="qr-refresh-btn" class="focusable qr-action-btn qr-action-btn-refresh" data-action="refresh">
              <span class="qr-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 4a8 8 0 1 0 7.3 11.2 1 1 0 1 0-1.84-.8A6 6 0 1 1 12 6h2.6l-1.9 1.9a1 1 0 1 0 1.4 1.4l3.6-3.6a1 1 0 0 0 0-1.4l-3.6-3.6a1 1 0 0 0-1.4 1.4L14.6 4H12z"></path>
                </svg>
              </span>
              <span class="qr-action-label">${I18n.t("auth_qr.refresh")}</span>
            </button>
            <button id="qr-guest-btn" class="focusable qr-action-btn qr-action-btn-guest" data-action="guest">
              <span class="qr-action-label">${I18n.t("auth_qr.enter_as_guest")}</span>
            </button>
          </div>
        </section>
      </div>
    `;
  },

  bindEvents() {
    const refreshBtn = document.getElementById("qr-refresh-btn");
    const guestBtn = document.getElementById("qr-guest-btn");

    if (refreshBtn) {
      refreshBtn.onclick = () => {
        this.startQr();
      };
    }
    if (guestBtn) {
      guestBtn.onclick = () => {
        this.enterAsGuest();
      };
    }

    if (this.container) {
      ScreenUtils.indexFocusables(this.container);
      ScreenUtils.setInitialFocus(this.container, "#qr-refresh-btn");
    }
  },

  async startQr() {
    const currentRequestId = ++this.requestId;
    this.stopIntervals();
    this.setStatus("");
    this.setRefreshLoading(true);

    const result = await QrLoginService.start().catch(() => null);

    if (currentRequestId !== this.requestId) {
      return;
    }

    this.setRefreshLoading(false);

    if (!result) {
      const raw = QrLoginService.getLastError();
      this.setStatus(this.toFriendlyQrError(raw));
      return;
    }

    this.renderQr(result);
    this.startPolling(result.code, result.deviceNonce, result.pollIntervalSeconds || 3);
    this.startCountdown(result.expiresAt);
  },

  renderQr({ qrImageUrl, code }) {
    const qrContainer = document.getElementById("qr-container");
    const codeText = document.getElementById("qr-code-text");
    if (!qrContainer || !codeText) {
      return;
    }

    qrContainer.innerHTML = `
      <img src="${qrImageUrl}" class="qr-image"/>
    `;

    codeText.innerText = I18n.t("auth_qr.code", { code });
  },

  startCountdown(expiresAt) {
    const expiryEl = document.getElementById("qr-expiry");
    if (!expiryEl) {
      return;
    }

    countdownInterval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expiryEl.innerText = I18n.t("auth_qr.expired");
        clearInterval(countdownInterval);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      expiryEl.innerText = I18n.t("auth_qr.expires_in", { time });
    }, 1000);
  },

  startPolling(code, deviceNonce, pollIntervalSeconds = 3) {
    pollInterval = setInterval(async () => {
      const status = await QrLoginService.poll(code, deviceNonce);

      if (status === "approved") {
        this.setStatus(I18n.t("auth_qr.approved_finishing"));
        clearInterval(pollInterval);

        const exchange = await QrLoginService.exchange(code, deviceNonce);

        if (exchange) {
          LocalStore.set("hasSeenAuthQrOnFirstLaunch", true);
          Router.navigate("profileSelection");
        } else {
          this.setStatus(this.toFriendlyQrError(QrLoginService.getLastError()));
        }
      }

      if (status === "expired") {
        this.setStatus(I18n.t("auth_qr.qr_expired_retry"));
      }

    }, Math.max(2, Number(pollIntervalSeconds || 3)) * 1000);
  },

  enterAsGuest() {
    LocalStore.set("hasSeenAuthQrOnFirstLaunch", true);
    this.cleanup();
    Router.navigate("home");
  },

  toFriendlyQrError(rawError) {
    const message = String(rawError || "").toLowerCase();
    if (!message) {
      return I18n.t("auth_qr.error_unavailable");
    }
    if (message.includes("invalid tv login redirect base url")) {
      return I18n.t("auth_qr.error_invalid_redirect");
    }
    if (message.includes("start_tv_login_session") && message.includes("could not find the function")) {
      return I18n.t("auth_qr.error_missing_function");
    }
    if (message.includes("gen_random_bytes") && message.includes("does not exist")) {
      return I18n.t("auth_qr.error_missing_extension");
    }
    if (message.includes("invalid caller session") || (message.includes("caller") && message.includes("session"))) {
      return I18n.t("auth_qr.error_invalid_caller_session");
    }
    if (message.includes("network") || message.includes("failed to fetch")) {
      return I18n.t("auth_qr.error_network");
    }
    return I18n.t("auth_qr.error_with_reason", { reason: rawError });
  },

  setStatus(text) {
    const statusNode = document.getElementById("qr-status");
    if (!statusNode) {
      return;
    }
    statusNode.innerText = text;
  },

  setRefreshLoading(isLoading) {
    const refreshBtn = document.getElementById("qr-refresh-btn");
    if (!refreshBtn) {
      return;
    }
    if (isLoading) {
      refreshBtn.classList.add("is-loading");
    } else {
      refreshBtn.classList.remove("is-loading");
    }
  },

  stopIntervals() {
    if (pollInterval) clearInterval(pollInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    pollInterval = null;
    countdownInterval = null;
  },

  onKeyDown(event) {
    if (ScreenUtils.handleDpadNavigation(event, this.container)) {
      return;
    }
    if (event.keyCode !== 13) {
      return;
    }
    const current = this.container?.querySelector(".focusable.focused");
    current?.click();
  },

  cleanup() {
    this.requestId += 1;
    this.stopIntervals();
    this.setRefreshLoading(false);
    QrLoginService.cleanup();

    ScreenUtils.hide(this.container);
    this.container = null;
  }
};
