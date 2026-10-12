/* =====================================================================
   GUEST MENU APP
   Flow: language → home country → translated menu with personal picks.
   No framework, no build step, no tracking. Everything renders with
   textContent (safe against injected HTML from any source).
   ===================================================================== */
(function () {
  "use strict";

  var MENU = window.MENU;
  var T = window.Translator;
  var Taste = window.Taste;
  var STATE_KEY = "qrm.state.v1";
  var ORDER_KEY = "qrm.order.v1";
  var FX_KEY = "qrm.fx.v1.";
  var FX_TTL = 12 * 3600 * 1000;

  /* ---------------- English UI strings (translated at runtime) ---------------- */
  var U = {
    chooseLanguage: "Choose your language",
    searchLanguage: "Search language",
    suggested: "Suggested",
    allLanguages: "All languages",
    whereFrom: "Where are you from?",
    whereFromSub: "We will suggest dishes that match the taste of your home country.",
    searchCountry: "Search country",
    allCountries: "All countries",
    skip: "Skip",
    forYou: "For you",
    popularPicks: "Popular picks",
    yourMeal: "A perfect meal for you",
    moreForYou: "More dishes you may like",
    table: "Table",
    add: "Add",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    nonveg: "Non-vegetarian",
    spice0: "Not spicy",
    spice1: "Mild",
    spice2: "Medium spicy",
    spice3: "Very spicy",
    contains: "Contains",
    approx: "approx.",
    filtersPreset: "Some filters were pre-set for your country. Tap to change.",
    noDishes: "No dishes match your filters.",
    clearFilters: "Clear filters",
    yourOrder: "Your order",
    viewOrder: "View order",
    total: "Total",
    showWaiter: "Show this screen to your waiter to place the order.",
    forStaff: "For restaurant staff",
    clearOrder: "Clear order",
    close: "Close",
    emptyOrder: "Your order is empty.",
    disclaimer: "This menu was translated automatically. Please tell your waiter about any allergies before ordering.",
    changeLanguage: "Change language",
    changeCountry: "Change country",
    numerals: "Numerals",
    likeHome: "Like home",
    remove: "Remove",
    increase: "Add one more",
    decrease: "Remove one",
    translateFailed: "Some text could not be translated right now and is shown in English.",
    retry: "Try again"
  };

  var FILTERS = [
    { id: "vegetarian", label: "Vegetarian", test: function (d) { return d.diet !== "nonveg"; } },
    { id: "vegan", label: "Vegan", test: function (d) { return d.diet === "vegan"; } },
    { id: "noPork", label: "No pork", test: function (d) { return d.tags.indexOf("pork") === -1; } },
    { id: "noBeef", label: "No beef", test: function (d) { return d.tags.indexOf("beef") === -1; } },
    { id: "noSeafood", label: "No fish or seafood", test: function (d) {
      return d.tags.indexOf("fish") === -1 && d.tags.indexOf("seafood") === -1 &&
        d.allergens.indexOf("fish") === -1 && d.allergens.indexOf("shellfish") === -1; } },
    { id: "noEgg", label: "No egg", test: function (d) { return d.allergens.indexOf("egg") === -1; } },
    { id: "noNuts", label: "No nuts", test: function (d) { return d.allergens.indexOf("nuts") === -1; } },
    { id: "noGluten", label: "No gluten", test: function (d) { return d.allergens.indexOf("gluten") === -1; } },
    { id: "noDairy", label: "No dairy", test: function (d) { return d.allergens.indexOf("dairy") === -1; } },
    { id: "mild", label: "Mild only", test: function (d) { return d.spice <= 1; } }
  ];

  var ALLERGENS = {
    gluten: "Gluten", dairy: "Milk", egg: "Egg", nuts: "Nuts", fish: "Fish",
    shellfish: "Shellfish", soy: "Soy", sesame: "Sesame"
  };

  var WELCOME = ["Welcome", "स्वागत है", "Добро пожаловать", "أهلاً وسهلاً", "欢迎", "ようこそ",
    "Bienvenue", "Bienvenido", "Willkommen", "환영합니다", "Benvenuti", "Bem-vindo", "Hoş geldiniz"];

  /* ---------------- State ---------------- */
  var LANGS = window.LANGUAGES.map(function (r) { return { mt: r[0], bcp: r[1], en: r[2], native: r[3] }; });
  var LANG_BY_MT = {};
  LANGS.forEach(function (l) { LANG_BY_MT[l.mt] = l; });
  var COUNTRY_BY_CODE = {};
  window.COUNTRIES.forEach(function (c) { COUNTRY_BY_CODE[c.code] = c; });
  var DISH_BY_ID = {};
  MENU.dishes.forEach(function (d) { DISH_BY_ID[d.id] = d; });

  var state = {
    lang: null,          // language object
    country: null,       // country object or null
    nativeDigits: true,
    filters: {},
    presetFilters: false,
    order: {},           // dishId -> qty
    table: "",
    translateFailed: false,
    fxRates: null
  };

  var $app = document.getElementById("app");
  var qtyHosts = {};     // dishId -> [elements hosting the qty control]

  /* ---------------- Utilities ---------------- */
  function storeGet(store, key) {
    try { var v = window[store].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function storeSet(store, key, val) {
    try { window[store].setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function h(tag, props, kids) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      });
    }
    if (kids !== undefined && kids !== null) {
      (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
      });
    }
    return el;
  }

  function lt() { return state.lang ? state.lang.mt : "en"; }
  function t(key) { return T.tr(lt(), U[key] || key); }
  function tx(english) { return T.tr(lt(), english); }

  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  }

  function safeLocale(tag) {
    try { return Intl.NumberFormat.supportedLocalesOf([tag]).length ? tag : "en"; } catch (e) { return "en"; }
  }

  var nativeSupportCache = {};
  function nativeNu() {
    var nu = state.lang && window.NATIVE_DIGITS[state.lang.mt];
    if (!nu) return null;
    var key = state.lang.bcp + nu;
    if (!(key in nativeSupportCache)) {
      var ok = false;
      try {
        ok = new Intl.NumberFormat(state.lang.bcp + "-u-nu-" + nu).resolvedOptions().numberingSystem === nu;
      } catch (e) { ok = false; }
      nativeSupportCache[key] = ok;
    }
    return nativeSupportCache[key] ? nu : null;
  }

  function numLocale() {
    var base = state.lang ? safeLocale(state.lang.bcp) : "en";
    var nu = nativeNu();
    var system = state.nativeDigits && nu ? nu : "latn";
    try { new Intl.NumberFormat(base + "-u-nu-" + system); return base + "-u-nu-" + system; }
    catch (e) { return base; }
  }

  function fmtNum(n) {
    try { return new Intl.NumberFormat(numLocale()).format(n); } catch (e) { return String(n); }
  }

  function fmtMoney(n, currency, approx) {
    var opts = { style: "currency", currency: currency };
    if (!approx) { opts.maximumFractionDigits = 0; opts.minimumFractionDigits = 0; }
    else if (n >= 100) { opts.maximumFractionDigits = 0; opts.minimumFractionDigits = 0; }
    try { return new Intl.NumberFormat(numLocale(), opts).format(n); }
    catch (e) {
      try { return new Intl.NumberFormat("en", opts).format(n); } catch (e2) { return currency + " " + n; }
    }
  }

  function countryName(code, inLang) {
    var tags = [];
    if (inLang && state.lang) tags.push(safeLocale(state.lang.bcp));
    tags.push("en");
    try {
      var name = new Intl.DisplayNames(tags, { type: "region" }).of(code);
      return name && name !== code ? name : code;
    } catch (e) { return code; }
  }

  function isRTL() {
    return !!(state.lang && window.RTL_LANGS.indexOf(state.lang.mt) !== -1);
  }

  function applyDocLang() {
    var html = document.documentElement;
    html.lang = state.lang ? state.lang.bcp : "en";
    html.dir = isRTL() ? "rtl" : "ltr";
  }

  function saveState() {
    storeSet("localStorage", STATE_KEY, {
      lang: state.lang ? state.lang.mt : null,
      country: state.country ? state.country.code : null,
      nativeDigits: state.nativeDigits,
      filters: state.filters,
      presetFilters: state.presetFilters
    });
  }
  function saveOrder() {
    storeSet("sessionStorage", ORDER_KEY, { table: state.table, order: state.order });
  }

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  /* ---------------- Strings needed for each phase ---------------- */
  function baseStrings() {
    var s = [];
    Object.keys(U).forEach(function (k) { s.push(U[k]); });
    FILTERS.forEach(function (f) { s.push(f.label); });
    Object.keys(ALLERGENS).forEach(function (k) { s.push(ALLERGENS[k]); });
    MENU.categories.forEach(function (c) { s.push(c.name); });
    MENU.dishes.forEach(function (d) { s.push(d.name, d.desc); });
    s.push(MENU.restaurant.tagline);
    ["To start", "Main course", "Dessert", "Drink", "Not spicy"].forEach(function (x) { s.push(x); });
    return s;
  }

  function recStrings() {
    var rec = currentRecs();
    var s = [picksTitleEnglish()];
    rec.meal.forEach(function (m) { s = s.concat(m.item.reasons, [m.course.name]); });
    rec.more.forEach(function (r) { s = s.concat(r.reasons); });
    return s;
  }

  function picksTitleEnglish() {
    if (!state.country) return "Popular picks";
    return "Top picks for guests from " + countryName(state.country.code, false);
  }

  /* ---------------- Recommendations ---------------- */
  function filteredDishes() {
    var active = FILTERS.filter(function (f) { return state.filters[f.id]; });
    return MENU.dishes.filter(function (d) {
      return active.every(function (f) { return f.test(d); });
    });
  }
  function currentRecs() {
    return Taste.recommend(filteredDishes(), state.country);
  }

  /* ---------------- Currency ---------------- */
  function loadFx() {
    var base = MENU.restaurant.currency;
    var cached = storeGet("localStorage", FX_KEY + base);
    if (cached && cached.t && Date.now() - cached.t < FX_TTL && cached.rates) {
      state.fxRates = cached.rates;
      return Promise.resolve();
    }
    var urls = ["/api/fx/" + encodeURIComponent(base), "https://open.er-api.com/v6/latest/" + encodeURIComponent(base)];
    function attempt(i) {
      if (i >= urls.length) return Promise.resolve();
      return fetch(urls[i], { credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { if (!r.ok) throw new Error("fx " + r.status); return r.json(); })
        .then(function (j) {
          if (!j || !j.rates || typeof j.rates !== "object") throw new Error("fx shape");
          var rates = {};
          Object.keys(j.rates).forEach(function (k) {
            if (/^[A-Z]{3}$/.test(k) && typeof j.rates[k] === "number" && isFinite(j.rates[k])) rates[k] = j.rates[k];
          });
          state.fxRates = rates;
          storeSet("localStorage", FX_KEY + base, { t: Date.now(), rates: rates });
        })
        .catch(function () { return attempt(i + 1); });
    }
    return attempt(0);
  }

  function approxPrice(amount) {
    if (!state.country || !state.fxRates) return null;
    var cur = state.country.currency;
    if (!cur || cur === MENU.restaurant.currency) return null;
    var rate = state.fxRates[cur];
    if (typeof rate !== "number" || rate <= 0) return null;
    return "≈ " + fmtMoney(amount * rate, cur, true);
  }

  /* ---------------- Views ---------------- */
  function clear() {
    qtyHosts = {};
    if (orderBar) { orderBar.hidden = true; document.body.classList.remove("has-order"); }
    while ($app.firstChild) $app.removeChild($app.firstChild);
    window.scrollTo(0, 0);
  }

  function langButton(l) {
    var isR = window.RTL_LANGS.indexOf(l.mt) !== -1;
    return h("button", { class: "lang-btn", type: "button", onclick: function () { chooseLanguage(l); } }, [
      h("span", { class: "lang-native", lang: l.bcp, dir: isR ? "rtl" : "ltr", text: l.native }),
      l.native !== l.en ? h("span", { class: "lang-en", lang: "en", dir: "ltr", text: l.en }) : null
    ]);
  }

  function browserLangs() {
    var out = [];
    var prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    prefs.forEach(function (p) {
      var low = String(p).toLowerCase();
      var match = null;
      if (low.indexOf("zh") === 0) match = /tw|hk|mo|hant/.test(low) ? LANG_BY_MT["zh-TW"] : LANG_BY_MT["zh-CN"];
      else if (low.indexOf("he") === 0) match = LANG_BY_MT.iw;
      else if (low.indexOf("fil") === 0) match = LANG_BY_MT.tl;
      else if (low.indexOf("nb") === 0 || low.indexOf("nn") === 0) match = LANG_BY_MT.no;
      else if (low.indexOf("jv") === 0) match = LANG_BY_MT.jw;
      else match = LANG_BY_MT[low.split("-")[0]];
      if (match && out.indexOf(match) === -1) out.push(match);
    });
    if (out.indexOf(LANG_BY_MT.en) === -1) out.push(LANG_BY_MT.en);
    return out;
  }

  function renderLanguage() {
    clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";

    var welcome = h("p", { class: "welcome", "aria-live": "off" }, WELCOME[0]);
    var wi = 0;
    var timer = setInterval(function () {
      if (!document.body.contains(welcome)) { clearInterval(timer); return; }
      wi = (wi + 1) % WELCOME.length;
      welcome.textContent = WELCOME[wi];
    }, 1600);

    var list = h("div", { class: "lang-grid", role: "list" });
    var suggestedWrap = h("div", { class: "lang-grid" });
    browserLangs().forEach(function (l) { suggestedWrap.appendChild(langButton(l)); });

    var sorted = LANGS.slice().sort(function (a, b) { return a.en.localeCompare(b.en, "en"); });
    function fill(q) {
      while (list.firstChild) list.removeChild(list.firstChild);
      var nq = normalize(q);
      var shown = 0;
      sorted.forEach(function (l) {
        if (!nq || normalize(l.en).indexOf(nq) !== -1 || normalize(l.native).indexOf(nq) !== -1 || l.mt.toLowerCase() === nq) {
          list.appendChild(langButton(l)); shown++;
        }
      });
      if (!shown) list.appendChild(h("p", { class: "muted", text: "No match / —" }));
    }
    fill("");

    var search = h("input", {
      class: "search", type: "search", placeholder: "🔍  Search · Поиск · بحث · 搜索 · खोजें",
      "aria-label": "Search language", autocomplete: "off", spellcheck: "false", maxlength: "40"
    });
    search.addEventListener("input", function () { fill(search.value); });

    $app.appendChild(h("section", { class: "view view-lang" }, [
      h("header", { class: "hero" }, [
        h("div", { class: "brand-mark", "aria-hidden": "true", text: "🌐" }),
        welcome,
        h("h1", { text: MENU.restaurant.name }),
        h("p", { class: "hero-sub", text: "Choose your language · Выберите язык · اختر لغتك · 选择语言 · भाषा चुनें" })
      ]),
      search,
      h("h2", { class: "section-label", text: "★ Suggested" }),
      suggestedWrap,
      h("h2", { class: "section-label", text: "A–Z · " + fmtPlain(LANGS.length) }),
      list
    ]));
  }

  function fmtPlain(n) { return String(n); }

  function renderLoading(msg) {
    clear();
    var bar = h("div", { class: "progress-bar" });
    var pct = h("p", { class: "muted small", text: "" });
    $app.appendChild(h("section", { class: "view view-loading", "aria-busy": "true" }, [
      h("div", { class: "spinner", "aria-hidden": "true" }),
      h("p", { class: "loading-title", lang: state.lang ? state.lang.bcp : "en", text: state.lang ? state.lang.native : "" }),
      h("p", { class: "muted", text: msg || "Translating the menu…" }),
      h("div", { class: "progress" }, bar),
      pct
    ]));
    return function (done, total) {
      var p = total ? Math.round(done / total * 100) : 100;
      bar.style.width = p + "%";
      pct.textContent = p + "%";
    };
  }

  function chooseLanguage(l) {
    state.lang = l;
    applyDocLang();
    saveState();
    var progress = renderLoading();
    T.ensure(l.mt, baseStrings(), progress).then(function (res) {
      state.translateFailed = !res.ok;
      if (state.country) goMenu();
      else renderCountry();
    });
  }

  function countryButton(c) {
    var local = countryName(c.code, true);
    var en = countryName(c.code, false);
    return h("button", { class: "country-btn", type: "button", onclick: function () { chooseCountry(c); } }, [
      h("span", { class: "flag", "aria-hidden": "true", text: flag(c.code) }),
      h("span", { class: "country-names" }, [
        h("span", { class: "country-local", text: local }),
        local !== en ? h("span", { class: "country-en", lang: "en", dir: "ltr", text: en }) : null
      ])
    ]);
  }

  function suggestedCountries() {
    var codes = (window.LANG_COUNTRIES[state.lang.mt] || []).slice();
    try {
      // Trust the phone's region only if the phone is set to the chosen language.
      var parts = String(navigator.language || "").split("-");
      var sameLang = parts[0].toLowerCase() === state.lang.bcp.split("-")[0].toLowerCase() ||
        parts[0].toLowerCase() === state.lang.mt.split("-")[0].toLowerCase();
      var reg = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
      if (sameLang && /^[A-Z]{2}$/.test(reg) && COUNTRY_BY_CODE[reg]) {
        var i = codes.indexOf(reg);
        if (i > 0) codes.splice(i, 1);
        if (i !== 0) codes.unshift(reg);
      }
    } catch (e) { /* ignore */ }
    return codes.map(function (c) { return COUNTRY_BY_CODE[c]; }).filter(Boolean).slice(0, 12);
  }

  function renderCountry() {
    clear();
    applyDocLang();
    var loc = safeLocale(state.lang.bcp);
    var all = window.COUNTRIES.map(function (c) { return { c: c, local: countryName(c.code, true), en: countryName(c.code, false) }; })
      .sort(function (a, b) { try { return a.local.localeCompare(b.local, loc); } catch (e) { return a.local < b.local ? -1 : 1; } });

    var list = h("div", { class: "country-grid" });
    function fill(q) {
      while (list.firstChild) list.removeChild(list.firstChild);
      var nq = normalize(q);
      all.forEach(function (x) {
        if (!nq || normalize(x.local).indexOf(nq) !== -1 || normalize(x.en).indexOf(nq) !== -1 || x.c.code.toLowerCase() === nq) {
          list.appendChild(countryButton(x.c));
        }
      });
    }
    fill("");
    var search = h("input", { class: "search", type: "search", placeholder: "🔍  " + t("searchCountry"),
      "aria-label": t("searchCountry"), autocomplete: "off", spellcheck: "false", maxlength: "40" });
    search.addEventListener("input", function () { fill(search.value); });

    var sug = suggestedCountries();
    var sugWrap = h("div", { class: "country-grid" });
    sug.forEach(function (c) { sugWrap.appendChild(countryButton(c)); });

    $app.appendChild(h("section", { class: "view view-country" }, [
      h("div", { class: "toolbar" }, [
        h("button", { class: "chip", type: "button", onclick: renderLanguage }, ["🌐 ", state.lang.native]),
        h("button", { class: "chip ghost", type: "button", onclick: function () { chooseCountry(null); }, text: t("skip") })
      ]),
      h("header", { class: "hero compact" }, [
        h("h1", { text: t("whereFrom") }),
        h("p", { class: "hero-sub", text: t("whereFromSub") })
      ]),
      search,
      sug.length ? h("h2", { class: "section-label", text: t("suggested") }) : null,
      sug.length ? sugWrap : null,
      h("h2", { class: "section-label", text: t("allCountries") }),
      list
    ]));
    if (state.translateFailed) $app.firstChild.insertBefore(failBanner(), $app.firstChild.children[1]);
  }

  function chooseCountry(c) {
    var changed = (state.country && state.country.code) !== (c && c.code);
    state.country = c;
    if (changed) {
      state.filters = {};
      state.presetFilters = false;
      if (c && window.DEFAULT_NO_PORK.indexOf(c.code) !== -1) {
        state.filters.noPork = true;
        state.presetFilters = true;
      }
    }
    saveState();
    goMenu();
  }

  function goMenu() {
    var progress = renderLoading();
    var fx = loadFx();
    var tr = T.ensure(lt(), baseStrings().concat(recStrings()), progress);
    Promise.all([tr, fx]).then(function (r) {
      state.translateFailed = !r[0].ok;
      renderMenu();
    });
  }

  function failBanner() {
    return h("div", { class: "banner warn", role: "status" }, [
      h("span", { lang: "en", dir: "ltr", text: "⚠️ " + U.translateFailed + " " }),
      h("button", { class: "link-btn", type: "button", lang: "en", text: U.retry, onclick: function () {
        if (state.lang) chooseLanguage(state.lang);
      } })
    ]);
  }

  /* ---------- Dish card ---------- */
  function spiceLabel(level) {
    return "🌶️".repeat(Math.max(0, level)) + (level ? " " : "") + t("spice" + level);
  }

  function dietBadge(d) {
    var cls = d.diet === "nonveg" ? "diet nonveg" : "diet veg";
    var label = d.diet === "vegan" ? t("vegan") : d.diet === "veg" ? t("vegetarian") : t("nonveg");
    return h("span", { class: cls }, [h("span", { class: "diet-dot", "aria-hidden": "true" }), label]);
  }

  function qtyControl(dishId) {
    var host = h("div", { class: "qty-host" });
    (qtyHosts[dishId] = qtyHosts[dishId] || []).push(host);
    paintQty(host, dishId);
    return host;
  }

  function paintQty(host, dishId) {
    while (host.firstChild) host.removeChild(host.firstChild);
    var q = state.order[dishId] || 0;
    if (!q) {
      host.appendChild(h("button", { class: "btn add", type: "button", onclick: function () { setQty(dishId, 1); } }, ["+ ", t("add")]));
    } else {
      host.appendChild(h("div", { class: "stepper" }, [
        h("button", { type: "button", "aria-label": t("decrease"), onclick: function () { setQty(dishId, q - 1); }, text: "−" }),
        h("span", { class: "qty", "aria-live": "polite", text: fmtNum(q) }),
        h("button", { type: "button", "aria-label": t("increase"), onclick: function () { setQty(dishId, q + 1); }, text: "+" })
      ]));
    }
  }

  function setQty(id, q) {
    if (!DISH_BY_ID[id]) return;
    q = Math.max(0, Math.min(99, q | 0));
    if (q) state.order[id] = q; else delete state.order[id];
    saveOrder();
    (qtyHosts[id] || []).forEach(function (host) { if (document.body.contains(host)) paintQty(host, id); });
    paintOrderBar();
    if (orderDialog && orderDialog.open) paintOrderDialog();
  }

  function dishCard(d, opts) {
    opts = opts || {};
    var name = tx(d.name);
    var approx = approxPrice(d.price);
    var allergens = d.allergens.map(function (a) { return tx(ALLERGENS[a] || a); });
    return h("article", { class: "dish" + (opts.highlight ? " highlight" : ""), "data-id": d.id }, [
      h("div", { class: "dish-emoji", "aria-hidden": "true", text: d.emoji }),
      h("div", { class: "dish-body" }, [
        opts.course ? h("p", { class: "course", text: tx(opts.course) }) : null,
        h("h3", { class: "dish-name", text: name }),
        name !== d.name ? h("p", { class: "dish-original", lang: "en", dir: "ltr", text: d.name }) : null,
        h("p", { class: "dish-desc", text: tx(d.desc) }),
        opts.reasons && opts.reasons.length ? h("ul", { class: "reasons" }, opts.reasons.map(function (r, i) {
          return h("li", { class: i === 0 && opts.home ? "reason home" : "reason", text: (i === 0 && opts.home ? "🏠 " : "✓ ") + tx(r) });
        })) : null,
        h("div", { class: "dish-meta" }, [
          dietBadge(d),
          h("span", { class: "spice", text: spiceLabel(d.spice) })
        ]),
        allergens.length ? h("p", { class: "allergens", text: t("contains") + ": " + allergens.join(", ") }) : null,
        h("div", { class: "dish-foot" }, [
          h("div", { class: "price-box" }, [
            h("span", { class: "price", text: fmtMoney(d.price, MENU.restaurant.currency, false) }),
            approx ? h("span", { class: "approx", title: t("approx"), text: approx }) : null
          ]),
          qtyControl(d.id)
        ])
      ])
    ]);
  }

  /* ---------- Menu view ---------- */
  function renderMenu() {
    clear();
    applyDocLang();
    var rec = currentRecs();
    var dishes = filteredDishes();

    // Top bar
    var nu = nativeNu();
    var topbar = h("header", { class: "topbar" }, [
      h("div", { class: "brand" }, [
        h("p", { class: "brand-name" }, [
          MENU.restaurant.name,
          state.table ? h("span", { class: "table-badge", title: t("table"), "aria-label": t("table") + " " + state.table,
            text: "🍽️ " + (/^\d+$/.test(state.table) ? fmtNum(Number(state.table)) : state.table) }) : null
        ]),
        h("p", { class: "brand-tag", text: tx(MENU.restaurant.tagline) })
      ]),
      h("div", { class: "top-actions" }, [
        h("button", { class: "chip", type: "button", title: t("changeLanguage"), "aria-label": t("changeLanguage"), onclick: renderLanguage }, ["🌐 ", state.lang.native]),
        h("button", { class: "chip", type: "button", title: t("changeCountry"), "aria-label": t("changeCountry"), onclick: renderCountry },
          state.country ? flag(state.country.code) : "🏳️"),
        nu ? h("button", { class: "chip", type: "button", title: t("numerals"), "aria-label": t("numerals"),
          onclick: function () { state.nativeDigits = !state.nativeDigits; saveState(); renderMenu(); },
          text: state.nativeDigits ? "123" : new Intl.NumberFormat(state.lang.bcp + "-u-nu-" + nu).format(123) }) : null
      ])
    ]);

    // Category nav
    var nav = h("nav", { class: "cat-nav", "aria-label": "Menu" });
    nav.appendChild(h("a", { class: "cat-link", href: "#sec-foryou" }, ["⭐ ", t("forYou")]));
    MENU.categories.forEach(function (c) {
      if (dishes.some(function (d) { return d.cat === c.id; })) {
        nav.appendChild(h("a", { class: "cat-link", href: "#sec-" + c.id }, [c.emoji + " ", tx(c.name)]));
      }
    });
    nav.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });

    // Filters
    var chips = h("div", { class: "filters", role: "group", "aria-label": "Filters" });
    FILTERS.forEach(function (f) {
      var on = !!state.filters[f.id];
      chips.appendChild(h("button", { class: "filter" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false",
        onclick: function () {
          if (state.filters[f.id]) delete state.filters[f.id]; else state.filters[f.id] = true;
          state.presetFilters = false;
          saveState();
          refreshAfterFilter();
        } }, [on ? "✓ " : "", tx(f.label)]));
    });

    var main = h("main", { class: "menu" });
    main.appendChild(h("p", { class: "banner info", text: "ℹ️ " + t("disclaimer") }));
    if (state.translateFailed) main.appendChild(failBanner());
    main.appendChild(chips);
    if (state.presetFilters) main.appendChild(h("p", { class: "muted small preset-note", text: t("filtersPreset") }));

    if (!dishes.length) {
      main.appendChild(h("div", { class: "empty" }, [
        h("p", { text: t("noDishes") }),
        h("button", { class: "btn", type: "button", onclick: function () { state.filters = {}; state.presetFilters = false; saveState(); refreshAfterFilter(); }, text: t("clearFilters") })
      ]));
    } else {
      // For you
      var forYou = h("section", { class: "menu-section foryou", id: "sec-foryou" }, [
        h("h2", { class: "section-title" }, [state.country ? flag(state.country.code) + " " : "⭐ ", tx(picksTitleEnglish())]),
        h("h3", { class: "sub-title", text: t("yourMeal") })
      ]);
      var mealGrid = h("div", { class: "dish-grid" });
      rec.meal.forEach(function (m) {
        mealGrid.appendChild(dishCard(m.item.dish, { highlight: true, course: m.course.name, reasons: m.item.reasons, home: m.item.home }));
      });
      forYou.appendChild(mealGrid);
      if (rec.more.length) {
        forYou.appendChild(h("h3", { class: "sub-title", text: t("moreForYou") }));
        var moreGrid = h("div", { class: "dish-grid" });
        rec.more.forEach(function (r) {
          moreGrid.appendChild(dishCard(r.dish, { reasons: r.reasons, home: r.home }));
        });
        forYou.appendChild(moreGrid);
      }
      main.appendChild(forYou);

      // Categories
      MENU.categories.forEach(function (c) {
        var items = dishes.filter(function (d) { return d.cat === c.id; });
        if (!items.length) return;
        var grid = h("div", { class: "dish-grid" });
        items.forEach(function (d) { grid.appendChild(dishCard(d)); });
        main.appendChild(h("section", { class: "menu-section", id: "sec-" + c.id }, [
          h("h2", { class: "section-title" }, [c.emoji + " ", tx(c.name)]),
          grid
        ]));
      });
    }

    $app.appendChild(h("div", { class: "view view-menu" }, [h("div", { class: "sticky-head" }, [topbar, nav]), main]));
    paintOrderBar();
  }

  function refreshAfterFilter() {
    var y = window.scrollY;
    var progressNeeded = recStrings().some(function (s) { return T.tr(lt(), s) === s && lt() !== "en"; });
    if (!progressNeeded) { renderMenu(); window.scrollTo(0, y); return; }
    T.ensure(lt(), recStrings()).then(function () { renderMenu(); window.scrollTo(0, y); });
  }

  /* ---------- Order bar & dialog ---------- */
  var orderBar = null;
  var orderDialog = null;

  function orderTotals() {
    var count = 0, total = 0;
    Object.keys(state.order).forEach(function (id) {
      var d = DISH_BY_ID[id];
      if (!d) return;
      count += state.order[id];
      total += state.order[id] * d.price;
    });
    return { count: count, total: total };
  }

  function paintOrderBar() {
    if (!orderBar) {
      orderBar = h("div", { class: "order-bar", role: "region", "aria-label": "Order" });
      document.body.appendChild(orderBar);
    }
    while (orderBar.firstChild) orderBar.removeChild(orderBar.firstChild);
    var tot = orderTotals();
    var inMenu = !!document.querySelector(".view-menu");
    if (!tot.count || !inMenu) { orderBar.hidden = true; document.body.classList.remove("has-order"); return; }
    orderBar.hidden = false;
    document.body.classList.add("has-order");
    orderBar.appendChild(h("button", { class: "order-btn", type: "button", onclick: openOrder }, [
      h("span", { class: "order-count", text: "🧾 " + fmtNum(tot.count) }),
      h("span", { class: "order-label", text: t("viewOrder") }),
      h("span", { class: "order-total", text: fmtMoney(tot.total, MENU.restaurant.currency, false) })
    ]));
  }

  function openOrder() {
    if (!orderDialog) {
      orderDialog = h("dialog", { class: "order-dialog", "aria-labelledby": "order-title" });
      orderDialog.addEventListener("click", function (e) { if (e.target === orderDialog) orderDialog.close(); });
      document.body.appendChild(orderDialog);
    }
    paintOrderDialog();
    if (typeof orderDialog.showModal === "function") orderDialog.showModal();
    else orderDialog.setAttribute("open", "");
  }

  function paintOrderDialog() {
    var dlg = orderDialog;
    while (dlg.firstChild) dlg.removeChild(dlg.firstChild);
    var tot = orderTotals();
    var ids = Object.keys(state.order).filter(function (id) { return DISH_BY_ID[id]; });

    var closeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), text: "✕",
      onclick: function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); } });

    var body = h("div", { class: "order-body" });
    if (!ids.length) {
      body.appendChild(h("p", { class: "muted", text: t("emptyOrder") }));
    } else {
      var ul = h("ul", { class: "order-list" });
      ids.forEach(function (id) {
        var d = DISH_BY_ID[id];
        var q = state.order[id];
        ul.appendChild(h("li", { class: "order-item" }, [
          h("span", { class: "oi-emoji", "aria-hidden": "true", text: d.emoji }),
          h("span", { class: "oi-name" }, [
            h("span", { text: tx(d.name) }),
            h("span", { class: "oi-sub", text: fmtMoney(d.price * q, MENU.restaurant.currency, false) })
          ]),
          h("div", { class: "stepper small" }, [
            h("button", { type: "button", "aria-label": t("decrease"), text: "−", onclick: function () { setQty(id, q - 1); } }),
            h("span", { class: "qty", text: fmtNum(q) }),
            h("button", { type: "button", "aria-label": t("increase"), text: "+", onclick: function () { setQty(id, q + 1); } })
          ])
        ]));
      });
      body.appendChild(ul);
      var approx = approxPrice(tot.total);
      body.appendChild(h("div", { class: "order-total-row" }, [
        h("span", { text: t("total") }),
        h("span", { class: "order-total-val" }, [
          h("strong", { text: fmtMoney(tot.total, MENU.restaurant.currency, false) }),
          approx ? h("span", { class: "approx", text: approx }) : null
        ])
      ]));
      body.appendChild(h("p", { class: "banner info", text: "👉 " + t("showWaiter") }));

      // Staff view, always in the hotel language with Western digits.
      var staff = h("div", { class: "staff", lang: "en", dir: "ltr" }, [
        h("p", { class: "staff-title", text: "🧑‍🍳 " + U.forStaff }),
        state.table ? h("p", { class: "staff-table", text: "Table " + state.table }) : null,
        h("p", { class: "staff-lang", text: "Guest language: " + state.lang.en +
          (state.country ? " · From: " + countryName(state.country.code, false) : "") })
      ]);
      var sul = h("ul", { class: "staff-list" });
      ids.forEach(function (id) {
        var d = DISH_BY_ID[id];
        sul.appendChild(h("li", {}, [h("strong", { text: state.order[id] + " × " }), d.name]));
      });
      staff.appendChild(sul);
      var enTotal;
      try { enTotal = new Intl.NumberFormat("en-IN", { style: "currency", currency: MENU.restaurant.currency, maximumFractionDigits: 0 }).format(tot.total); }
      catch (e) { enTotal = MENU.restaurant.currency + " " + tot.total; }
      staff.appendChild(h("p", { class: "staff-total", text: "Total: " + enTotal }));
      body.appendChild(staff);
      body.appendChild(h("button", { class: "btn ghost danger", type: "button", text: t("clearOrder"), onclick: function () {
        state.order = {}; saveOrder();
        Object.keys(qtyHosts).forEach(function (id) { qtyHosts[id].forEach(function (host) { paintQty(host, id); }); });
        paintOrderBar(); paintOrderDialog();
      } }));
    }

    dlg.appendChild(h("div", { class: "order-head" }, [h("h2", { id: "order-title", text: t("yourOrder") }), closeBtn]));
    dlg.appendChild(body);
  }

  /* ---------- Desktop helper: QR so guests can open this page on their phone ---------- */
  function desktopQR() {
    try {
      if (!window.qrcode) return;
      var desktop = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches;
      if (!desktop) return;
      var url = location.origin + location.pathname + (state.table ? "?t=" + encodeURIComponent(state.table) : "");
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      var img = h("img", { src: qr.createDataURL(4, 2), alt: "QR code", width: "132", height: "132" });
      var box = h("aside", { class: "desk-qr", "aria-label": "Open on your phone" }, [
        img,
        h("p", { lang: "en", text: "📱 Scan to open on your phone" }),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Close", text: "✕", onclick: function () { box.remove(); } })
      ]);
      document.body.appendChild(box);
    } catch (e) { /* non-essential */ }
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
    var saved = storeGet("localStorage", STATE_KEY) || {};
    var savedOrder = storeGet("sessionStorage", ORDER_KEY) || {};

    var table = params ? (params.get("t") || params.get("table") || "") : "";
    table = String(table).replace(/[^0-9A-Za-z-]/g, "").slice(0, 8);
    state.table = table || (typeof savedOrder.table === "string" ? savedOrder.table.replace(/[^0-9A-Za-z-]/g, "").slice(0, 8) : "");

    if (savedOrder.order && typeof savedOrder.order === "object") {
      Object.keys(savedOrder.order).forEach(function (id) {
        var q = savedOrder.order[id];
        if (DISH_BY_ID[id] && typeof q === "number" && q > 0 && q < 100) state.order[id] = Math.floor(q);
      });
    }
    if (typeof saved.nativeDigits === "boolean") state.nativeDigits = saved.nativeDigits;
    if (saved.filters && typeof saved.filters === "object") {
      FILTERS.forEach(function (f) { if (saved.filters[f.id] === true) state.filters[f.id] = true; });
    }
    state.presetFilters = saved.presetFilters === true;
    if (typeof saved.country === "string" && COUNTRY_BY_CODE[saved.country]) state.country = COUNTRY_BY_CODE[saved.country];

    var urlLang = params ? params.get("lang") : null;
    var lang = (urlLang && LANG_BY_MT[urlLang]) || (typeof saved.lang === "string" && LANG_BY_MT[saved.lang]) || null;

    desktopQR();
    if (lang) {
      state.lang = lang;
      applyDocLang();
      var progress = renderLoading();
      T.ensure(lang.mt, baseStrings(), progress).then(function (res) {
        state.translateFailed = !res.ok;
        if (state.country || saved.country === null && saved.lang) goMenu();
        else renderCountry();
      });
    } else {
      renderLanguage();
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && orderDialog && orderDialog.open && !orderDialog.close) orderDialog.removeAttribute("open");
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
