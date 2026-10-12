/* Staff page: generates printable table QR codes that open the guest menu. */
(function () {
  "use strict";

  var LINES = [
    ["en", "ltr", "Scan to see the menu in your language"],
    ["hi", "ltr", "अपनी भाषा में मेन्यू देखने के लिए स्कैन करें"],
    ["ru", "ltr", "Сканируйте, чтобы открыть меню на своём языке"],
    ["ar", "rtl", "امسح الرمز لعرض القائمة بلغتك"],
    ["zh", "ltr", "扫码，用您的语言查看菜单"],
    ["ja", "ltr", "スキャンしてあなたの言語でメニューを表示"],
    ["fr", "ltr", "Scannez pour voir le menu dans votre langue"],
    ["es", "ltr", "Escanea para ver el menú en tu idioma"],
    ["de", "ltr", "Scannen für die Speisekarte in Ihrer Sprache"],
    ["ko", "ltr", "스캔하여 모국어로 메뉴 보기"]
  ];

  var form = document.getElementById("qr-form");
  var urlIn = document.getElementById("qr-url");
  var fromIn = document.getElementById("qr-from");
  var toIn = document.getElementById("qr-to");
  var sheet = document.getElementById("qr-sheet");
  var msg = document.getElementById("qr-msg");
  var hotel = (window.MENU && window.MENU.restaurant && window.MENU.restaurant.name) || "Menu";

  urlIn.value = location.origin && location.origin.indexOf("http") === 0 ? location.origin : "";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function cleanBase(raw) {
    var u;
    try { u = new URL(String(raw).trim()); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin + u.pathname.replace(/\/(index\.html)?$/, "") + "/";
  }

  function card(link, table) {
    var qr = window.qrcode(0, "M");
    qr.addData(link);
    qr.make();
    var c = el("article", "qr-card");
    c.appendChild(el("p", "qr-hotel", hotel));
    if (table !== null) c.appendChild(el("p", "qr-table", "Table " + table));
    var img = document.createElement("img");
    img.src = qr.createDataURL(6, 2);
    img.alt = "QR code for " + link;
    img.width = 190; img.height = 190;
    c.appendChild(img);
    var lines = el("div", "qr-lines");
    LINES.forEach(function (l) {
      var p = el("p", null, l[2]);
      p.lang = l[0]; p.dir = l[1];
      lines.appendChild(p);
    });
    c.appendChild(lines);
    c.appendChild(el("p", "qr-url", link));
    return c;
  }

  function generate() {
    msg.textContent = "";
    while (sheet.firstChild) sheet.removeChild(sheet.firstChild);
    if (!window.qrcode) { msg.textContent = "QR library failed to load. Reload the page."; return; }
    var base = cleanBase(urlIn.value);
    if (!base) { msg.textContent = "Enter a valid website address starting with https://"; return; }

    var fromRaw = fromIn.value.trim(), toRaw = toIn.value.trim();
    if (!fromRaw && !toRaw) { sheet.appendChild(card(base, null)); return; }
    var a = parseInt(fromRaw || toRaw, 10), b = parseInt(toRaw || fromRaw, 10);
    if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0) { msg.textContent = "Table numbers must be 0 or more."; return; }
    if (b < a) { var tmp = a; a = b; b = tmp; }
    if (b - a >= 100) { msg.textContent = "Please generate at most 100 tables at a time."; return; }
    for (var n = a; n <= b; n++) sheet.appendChild(card(base + "?t=" + n, n));
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); generate(); });
  document.getElementById("qr-print").addEventListener("click", function () { window.print(); });
  generate();
})();
