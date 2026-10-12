/* =====================================================================
   TRANSLATOR  —  machine-translates English strings into the guest's
   language, in batches, with a per-language cache in the browser.

   Route order for every batch:
     1. /api/gt/...  same-origin proxy (vercel.json rewrite → Google)
     2. https://translate.googleapis.com/... directly from the phone
   If both fail, the original English text is used (never a blank menu).
   All output is treated as untrusted text and only ever rendered with
   textContent (never innerHTML).
   ===================================================================== */
(function () {
  var CACHE_PREFIX = "qrm.tr.v2.";
  var TIMEOUT_MS = 9000;
  var MAX_CHARS = 1800;           // source characters per request
  var MAX_STRING = 500;           // hard cap on any single string
  var BASES = ["/api/gt", "https://translate.googleapis.com/translate_a"];
  var deadBase = {};              // bases that failed at network level this session

  var memory = {};                // lang -> { english: translated }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* quota / private mode */ }
  }

  function loadCache(lang) {
    if (memory[lang]) return memory[lang];
    var obj = {};
    var raw = storageGet(CACHE_PREFIX + lang);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") obj = parsed;
      } catch (e) { obj = {}; }
    }
    memory[lang] = obj;
    return obj;
  }
  function saveCache(lang) {
    storageSet(CACHE_PREFIX + lang, JSON.stringify(memory[lang] || {}));
  }

  var ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };
  function clean(s) {
    if (typeof s !== "string") return "";
    s = s.replace(/&(amp|lt|gt|quot|nbsp|#39|#x27);/g, function (m) { return ENTITIES[m] || m; });
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    return s.trim().slice(0, MAX_STRING * 2);
  }

  function fetchJSON(url) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, {
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { var err = new Error("HTTP " + res.status); err.status = res.status; throw err; }
      return res.json();
    }, function (e) {
      clearTimeout(timer);
      var err = e instanceof Error ? e : new Error(String(e));
      err.network = !(err.name === "AbortError");   // timeouts may be transient
      throw err;
    });
  }

  /* Endpoint A: /t  — accepts many q= params, returns an array. */
  function viaMulti(base, tl, list) {
    var url = base + "/t?client=gtx&sl=en&tl=" + encodeURIComponent(tl) +
      list.map(function (s) { return "&q=" + encodeURIComponent(s); }).join("");
    return fetchJSON(url).then(function (data) {
      var arr;
      if (typeof data === "string") arr = [data];
      else if (Array.isArray(data)) {
        arr = data.map(function (x) {
          if (typeof x === "string") return x;
          if (Array.isArray(x) && typeof x[0] === "string") return x[0];
          return null;
        });
      }
      if (!arr || arr.length !== list.length || arr.some(function (x) { return x === null; })) {
        throw new Error("shape");
      }
      return arr.map(clean);
    });
  }

  /* Endpoint B: /single — one text; we join lines with \n and split back. */
  function viaSingle(base, tl, list) {
    var url = base + "/single?client=gtx&sl=en&tl=" + encodeURIComponent(tl) +
      "&dt=t&q=" + encodeURIComponent(list.join("\n"));
    return fetchJSON(url).then(function (data) {
      if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("shape");
      var text = data[0].map(function (seg) {
        return Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : "";
      }).join("");
      var lines = text.split(/\r?\n/);
      if (lines.length !== list.length) throw new Error("count");
      return lines.map(clean);
    });
  }

  /* A base is "dead" for this session if it is unreachable or not routed. */
  function isFatal(e) {
    return !!(e && (e.network || e.status === 404 || e.status === 405));
  }

  function tryChunk(tl, list) {
    var bi = 0;
    function nextBase(lastErr) {
      while (bi < BASES.length && deadBase[BASES[bi]]) bi++;
      if (bi >= BASES.length) return Promise.reject(lastErr || new Error("all routes failed"));
      var base = BASES[bi++];
      return viaMulti(base, tl, list)
        .catch(function (e) {
          if (isFatal(e)) throw e;               // don't retry an unreachable base
          return viaSingle(base, tl, list);
        })
        .catch(function (e) {
          if (isFatal(e)) deadBase[base] = true;
          return nextBase(e);
        });
    }
    return nextBase(null);
  }

  /* Split into chunks under MAX_CHARS. */
  function chunk(list) {
    var out = [], cur = [], size = 0;
    list.forEach(function (s) {
      if (cur.length && size + s.length > MAX_CHARS) { out.push(cur); cur = []; size = 0; }
      cur.push(s); size += s.length + 1;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /**
   * Make sure every string is translated into `tl`.
   * Resolves to { ok: boolean, failed: number } — never rejects.
   * onProgress(done, total) is optional.
   */
  function ensure(tl, strings, onProgress) {
    if (!tl || tl === "en") return Promise.resolve({ ok: true, failed: 0 });
    var cache = loadCache(tl);
    var seen = {};
    var missing = [];
    strings.forEach(function (s) {
      if (typeof s !== "string") return;
      s = s.slice(0, MAX_STRING);
      if (!s || seen[s] || Object.prototype.hasOwnProperty.call(cache, s)) return;
      seen[s] = true;
      if (/^[\d\s.,:;!?()+\-–—/%#*]+$/.test(s)) { cache[s] = s; return; }
      if (s.indexOf("\n") !== -1) return;
      missing.push(s);
    });
    if (!missing.length) return Promise.resolve({ ok: true, failed: 0 });

    var chunks = chunk(missing);
    var done = 0, failed = 0;
    var queue = chunks.slice();
    function worker() {
      var c = queue.shift();
      if (!c) return Promise.resolve();
      return tryChunk(tl, c).then(function (res) {
        c.forEach(function (src, idx) { if (res[idx]) cache[src] = res[idx]; });
      }, function () {
        failed += c.length;
      }).then(function () {
        done += c.length;
        if (onProgress) { try { onProgress(done, missing.length); } catch (e) { /* ignore */ } }
        return worker();
      });
    }
    var workers = [];
    for (var w = 0; w < Math.min(3, chunks.length); w++) workers.push(worker());
    return Promise.all(workers).then(function () {
      saveCache(tl);
      return { ok: failed === 0, failed: failed };
    });
  }

  /* Synchronous lookup; falls back to English. */
  function tr(tl, s) {
    if (!tl || tl === "en" || typeof s !== "string") return s;
    var cache = loadCache(tl);
    var v = cache[s.slice(0, MAX_STRING)];
    return typeof v === "string" && v ? v : s;
  }

  window.Translator = { ensure: ensure, tr: tr };
})();
