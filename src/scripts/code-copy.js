/* global document, window */

function ensureIframeControls(wrapper, iframe) {
  const originalSource =
    wrapper.dataset.iframeSource || iframe.getAttribute("src") || iframe.src;
  wrapper.dataset.iframeSource = originalSource;

  let toolbar = wrapper.querySelector(".iframe-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "iframe-toolbar";
    wrapper.insertAdjacentElement("afterbegin", toolbar);
  }

  let title = toolbar.querySelector(".iframe-title");
  if (!title) {
    title = document.createElement("span");
    title.className = "iframe-title";
    toolbar.appendChild(title);
  }
  const iframeTitle = iframe.getAttribute("title") || "Embedded preview";
  title.textContent = iframeTitle;

  let actions = toolbar.querySelector(".iframe-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "iframe-actions";
    toolbar.appendChild(actions);
  }

  let refreshButton = actions.querySelector("[data-iframe-refresh]");
  if (!refreshButton) {
    refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.dataset.iframeRefresh = "";
    refreshButton.textContent = "Refresh";
    actions.appendChild(refreshButton);
  }
  refreshButton.setAttribute("aria-label", `Refresh ${iframeTitle}`);

  let openLink = actions.querySelector("[data-iframe-open]");
  if (!openLink) {
    openLink = document.createElement("a");
    openLink.dataset.iframeOpen = "";
    openLink.textContent = "Open New Tab";
    actions.appendChild(openLink);
  }
  openLink.href = originalSource;
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.setAttribute("aria-label", `Open ${iframeTitle} in a new tab`);

  if (refreshButton.dataset.refreshReady === "true") return;
  refreshButton.dataset.refreshReady = "true";
  refreshButton.addEventListener("click", () => {
    refreshButton.textContent = "Refreshing";
    iframe.setAttribute("aria-busy", "true");

    const finishRefresh = () => {
      iframe.removeAttribute("aria-busy");
      refreshButton.textContent = "Refresh";
    };
    iframe.addEventListener("load", finishRefresh, { once: true });
    iframe.setAttribute("src", originalSource);
    window.setTimeout(finishRefresh, 4000);
  });
}

function enhanceIframes(root = document) {
  const iframes = root.querySelectorAll("iframe");

  for (const iframe of iframes) {
    let wrapper = iframe.closest(".iframe-wrap");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "iframe-wrap";

      const frame = document.createElement("div");
      frame.className = "iframe-frame";
      iframe.parentNode?.insertBefore(wrapper, iframe);
      frame.appendChild(iframe);
      wrapper.appendChild(frame);
    } else if (!iframe.closest(".iframe-frame")) {
      const frame = document.createElement("div");
      frame.className = "iframe-frame";
      iframe.parentNode?.insertBefore(frame, iframe);
      frame.appendChild(iframe);
    }

    ensureIframeControls(wrapper, iframe);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => enhanceIframes());
} else {
  enhanceIframes();
}
