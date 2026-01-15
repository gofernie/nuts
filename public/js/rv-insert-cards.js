(function () {
  // ---- CONFIG ----
  var CARD_ANCHOR_SELECTOR = ".rv-block a.rv-listingCard";

  function parseJSON(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function getCardAnchors(root) {
    return Array.prototype.slice.call(root.querySelectorAll(CARD_ANCHOR_SELECTOR));
  }

  function getGridItemForAnchor(a) {
    // RV usually wraps the <a> in a div grid-item
    return (a && a.parentElement) ? a.parentElement : a;
  }

  function getGridItems(root) {
    return getCardAnchors(root).map(getGridItemForAnchor).filter(Boolean);
  }

  function cloneTemplate(templateId) {
    var t = document.getElementById(templateId);
    if (!t || !t.content) return null;

    var frag = document.importNode(t.content, true);

    // grab first element node (skip whitespace/comments)
    var el = null;
    for (var i = 0; i < frag.childNodes.length; i++) {
      var n = frag.childNodes[i];
      if (n && n.nodeType === 1) { el = n; break; }
    }

    // fallback if template has multiple roots
    if (!el) {
      var wrap = document.createElement("div");
      wrap.appendChild(frag);
      el = wrap;
    }

    return el;
  }

  function insertAfter(node, newNode) {
    if (!node || !node.parentNode || !newNode) return;
    node.parentNode.insertBefore(newNode, node.nextSibling);
  }

  function alreadyInserted(root, key) {
    return !!root.querySelector('[data-rv-insert="' + key + '"]');
  }

  function markInserted(el, key) {
    el.setAttribute("data-rv-insert", key);
  }

  function apply(root) {
    var plan = parseJSON(root.getAttribute("data-insert-plan"), []);
    if (!Array.isArray(plan) || plan.length === 0) return false;

    // ✅ Insert higher indexes first so lower inserts don't shift later positions
    plan = plan.slice().sort(function (a, b) {
      return Number(b && b.after) - Number(a && a.after);
    });

    var items = getGridItems(root);
    if (!items || items.length < 6) return false;

    var insertedAny = false;

    for (var i = 0; i < plan.length; i++) {
      var item = plan[i];
      var after = Number(item && item.after);
      var templateId = item && item.templateId;
      var key = (templateId || "card") + "-after-" + after;

      if (!after || !templateId) continue;
      if (alreadyInserted(root, key)) continue;

      // ✅ Recompute each time (RV can re-render / pagination / filters)
      items = getGridItems(root);
      if (!items || items.length < after) continue;

      var anchorItem = items[after - 1];
      if (!anchorItem) continue;

      var node = cloneTemplate(templateId);
      if (!node) continue;

      node.classList.add("rv-insertCard--gridItem");
      node.style.display = "block";
      node.style.height = "auto";
      node.style.minHeight = "0";
      node.style.alignSelf = "start";

      markInserted(node, key);
      insertAfter(anchorItem, node);

      insertedAny = true;
    }

    return insertedAny;
  }

  function boot() {
    var roots = document.querySelectorAll("[data-rv-insert-root]");
    if (!roots.length) return;

    roots.forEach(function (root) {
      // Try immediately
      apply(root);

      // Keep trying as RV changes (filters/sort/paging)
      var obs = new MutationObserver(function () {
        apply(root);
      });

      obs.observe(root, { childList: true, subtree: true });

      // Safety stop after 60s
      setTimeout(function () { obs.disconnect(); }, 60000);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
