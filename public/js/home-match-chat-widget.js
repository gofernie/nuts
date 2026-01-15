(function () {
  console.log("[HM CHAT] loaded");

  /* ---------- helpers ---------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function linkifyTextToHtml(text) {
    const escaped = escapeHtml(text).replace(/\n/g, "<br/>");
    return escaped.replace(
      /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      (u) => `<a href="${u}" rel="noopener noreferrer">${u}</a>`
    );
  }

  function typingHtml() {
    return '<span class="hm-typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
  }

  // Montane + fernie.homes link pattern -> make title the link and hide raw URL
  function renderAssistant(text) {
    const s = String(text || "").trim().replace(/\r\n/g, "\n");

    const blockRe =
      /(^|\n)([A-Za-z][^\n]{1,80})(?:\s*\n|\s+)(https?:\/\/(?:www\.)?fernie\.homes\/[^\s]+)\n?([\s\S]*?)(?=\n[A-Za-z][^\n]{1,80}(?:\s*\n|\s+)https?:\/\/(?:www\.)?fernie\.homes\/|$)/g;

    const matches = Array.from(s.matchAll(blockRe));
    if (!matches.length) {
      return `<p>${linkifyTextToHtml(s)}</p>`;
    }

    function renderParas(chunk) {
      const t = String(chunk || "").trim();
      if (!t) return "";
      return t
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${linkifyTextToHtml(p)}</p>`)
        .join("");
    }

    let html = "";
    let lastIndex = 0;
    blockRe.lastIndex = 0;
    let m;

    while ((m = blockRe.exec(s)) !== null) {
      html += renderParas(s.slice(lastIndex, m.index));

      const title = escapeHtml(m[2].trim());
      const url = escapeHtml(m[3].trim());
      const copy = String(m[4] || "").trim();

      html += `
        <div class="hm-block">
          <a class="hm-hdr" href="${url}" rel="noopener noreferrer">${title}</a>
          ${renderParas(copy)}
        </div>
      `;

      lastIndex = blockRe.lastIndex;
    }

    html += renderParas(s.slice(lastIndex));
    return html.trim();
  }

  function initOne(root) {
    const launcher = root.querySelector("[data-hm-launcher]");
    const drawer = root.querySelector("[data-hm-drawer]");
    const overlay = root.querySelector("[data-hm-overlay]");
    const closeBtn = root.querySelector("[data-hm-close]");
    const form = root.querySelector("[data-hm-form]");
    const msgs = root.querySelector("[data-hm-msgs]");
    const chips = root.querySelector("[data-hm-chips]");
    const body = root.querySelector("[data-hm-body]") || msgs;

    if (!launcher || !drawer || !overlay || !form || !msgs) {
      console.log("[HM CHAT] missing elements", { launcher, drawer, overlay, form, msgs });
      return;
    }

    // avoid double-binding if Astro reuses DOM
    if (launcher.dataset.hmBound === "true") return;
    launcher.dataset.hmBound = "true";

    const endpoint = root.getAttribute("data-endpoint") || "/api/homematch-chat";

    // Persist across pages
    const storageKey = "hm_chat_history_v1";
    const openNextKey = "hm_chat_open_next_v1";

    function scrollToBottom() {
      body.scrollTop = body.scrollHeight + 9999;
    }

    function setOpen(isOpen) {
      drawer.dataset.open = String(isOpen);
      overlay.dataset.open = String(isOpen);
      launcher.setAttribute("aria-expanded", String(isOpen));
      overlay.setAttribute("aria-hidden", String(!isOpen));
      if (isOpen) setTimeout(() => { scrollToBottom(); form.message?.focus?.(); }, 50);
    }

    function addMsg(role, text) {
      const el = document.createElement("div");
      el.className = "hm-msg " + role;

      if (role === "assistant") el.innerHTML = renderAssistant(text);
      else el.textContent = text;

      msgs.appendChild(el);
      scrollToBottom();
      return el;
    }

    function loadHistory() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(-20) : [];
      } catch {
        return [];
      }
    }

    function saveHistory(history) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history.slice(-20)));
      } catch {}
    }

    // ✅ KEY BIT: when user clicks a link inside the chat, tell next page to auto-open chat.
    function markOpenOnNextPage() {
      try { localStorage.setItem(openNextKey, "1"); } catch {}
    }

    // Capture click INSIDE drawer links
    // - We DO NOT preventDefault
    // - We DO NOT open new tabs
    // - We just set the flag, then let navigation happen normally
    drawer.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;

      // Only for left-click normal nav
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      markOpenOnNextPage();
      // allow default navigation in same tab
    }, true);

    // Load + render history
    let history = loadHistory();
    if (history.length) {
      msgs.innerHTML = "";
      for (const m of history) addMsg(m.role, m.content);
      scrollToBottom();
    }

    // If last click said "open on next page", do it now.
    try {
      if (localStorage.getItem(openNextKey) === "1") {
        localStorage.removeItem(openNextKey);
        setOpen(true);
      }
    } catch {}

    launcher.addEventListener("click", function () {
      setOpen(drawer.dataset.open !== "true");
    });

    closeBtn && closeBtn.addEventListener("click", function () { setOpen(false); });
    overlay.addEventListener("click", function () { setOpen(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    if (chips) {
      chips.addEventListener("click", function (e) {
        const btn = e.target && e.target.closest ? e.target.closest("button[data-q]") : null;
        if (!btn) return;
        const q = btn.getAttribute("data-q");
        if (!q) return;
        form.message.value = q;
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const text = (form.message.value || "").trim();
      if (!text) return;

      addMsg("user", text);
      history.push({ role: "user", content: text });
      saveHistory(history);

      form.message.value = "";

      const typingEl = document.createElement("div");
      typingEl.className = "hm-msg assistant";
      typingEl.innerHTML = typingHtml();
      msgs.appendChild(typingEl);
      scrollToBottom();

      try {
        const payload = {
          message: text,
          history: history,
          context: { url: location.href, path: location.pathname, title: document.title }
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        const reply = data && data.reply ? String(data.reply) : "Sorry - I hit a snag. Try again.";

        typingEl.innerHTML = renderAssistant(reply);
        scrollToBottom();

        history.push({ role: "assistant", content: reply });
        saveHistory(history);
      } catch (err) {
        typingEl.textContent = "Sorry - something failed sending that. Try again.";
        scrollToBottom();
      }
    });

    console.log("[HM CHAT] bound");
  }

  function initAll() {
    const roots = document.querySelectorAll("[data-hm-root]");
    if (!roots.length) console.log("[HM CHAT] no roots found");
    roots.forEach(initOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("astro:page-load", initAll);
})();
