/* =====================================================================
   TASTE ENGINE  —  recommends dishes based on the guest's home cuisine.
   Deterministic, transparent scoring (no AI, no data leaves the phone):
     score = Σ taste weights of the dish's tags
           + "like home" bonus (dish resembles a dish from their country)
           − penalty if the dish is spicier than their typical tolerance
   ===================================================================== */
(function () {
  /* Regional taste profiles. likes: tag -> weight (negative = usually avoided).
     spice: typical comfortable chilli level 0..3 */
  var PROFILES = {
    ee:   { spice: 1, likes: { soup: 3, dumpling: 3, potato: 2.5, dairy: 2, herb: 2, bread: 1.5, fish: 1.5, pork: 1.5, chicken: 1, beef: 1, grill: 1, sweet: 1.5, tea: 2, comfort: 1.5, pasta: 0.5 } },
    cau:  { spice: 1, likes: { grill: 3, lamb: 2.5, herb: 2, bread: 2, cheese: 2, dumpling: 2, beans: 1.5, tomato: 1, tea: 1.5, sweet: 1 } },
    cas:  { spice: 1, likes: { lamb: 3, rice: 2.5, grill: 2.5, dumpling: 2.5, noodle: 2, bread: 2, tea: 2.5, soup: 1.5, beef: 1, dairy: 1 } },
    we:   { spice: 1, likes: { grill: 2, potato: 2, cheese: 2, bread: 1.5, beef: 1.5, fish: 1.5, sweet: 1.5, coffee: 2, salad: 1.5, pasta: 1.5, comfort: 1 } },
    med:  { spice: 1, likes: { tomato: 3, pasta: 2.5, seafood: 2.5, fish: 2, herb: 2, cheese: 2, grill: 2, salad: 1.5, bread: 1.5, coffee: 2 } },
    nor:  { spice: 0, likes: { fish: 3, potato: 2, dairy: 2, herb: 2, bread: 1.5, coffee: 2.5, sweet: 1.5, light: 1 } },
    na:   { spice: 1, likes: { grill: 2.5, beef: 2.5, chicken: 2, cheese: 2, fried: 2, pasta: 1.5, bread: 1.5, sweet: 2, salad: 1, coffee: 1.5, comfort: 1.5 } },
    la:   { spice: 2, likes: { beans: 2.5, rice: 2, grill: 2.5, beef: 2.5, chicken: 2, tomato: 2, sour: 1.5, spicy: 1, coffee: 2, fruit: 1.5 } },
    car:  { spice: 2, likes: { chicken: 2, rice: 2, beans: 2, seafood: 2, fish: 1.5, coconut: 1.5, fried: 1.5, spicy: 1.5, fruit: 1.5 } },
    mena: { spice: 1, likes: { lamb: 3, grill: 3, rice: 2.5, chicken: 2, beans: 2, bread: 2.5, herb: 1.5, sweet: 2, tea: 2, coffee: 1.5, pork: -3 } },
    sa:   { spice: 3, likes: { curry: 3, rice: 2.5, spicy: 2, bread: 2, chicken: 2, lamb: 1.5, beans: 1.5, dairy: 1, tea: 2.5, sweet: 1.5 } },
    cn:   { spice: 2, likes: { noodle: 3, rice: 2.5, dumpling: 3, umami: 2, soy: 2, pork: 2.5, sour: 1.5, soup: 1.5, steamed: 1.5, tea: 3, cheese: -1 } },
    jp:   { spice: 1, likes: { rice: 3, fish: 3, seafood: 2.5, umami: 3, soup: 2, noodle: 2.5, grill: 2, fried: 1.5, soy: 2, tea: 3, light: 1 } },
    kr:   { spice: 3, likes: { spicy: 3, rice: 2.5, grill: 3, pork: 2.5, beef: 2, fermented: 2.5, noodle: 2, soup: 2.5, umami: 1.5 } },
    sea:  { spice: 2, likes: { rice: 3, noodle: 2.5, coconut: 2.5, herb: 2.5, sour: 2, spicy: 2, seafood: 2, chicken: 2, soup: 2, umami: 1.5, fruit: 1.5 } },
    ssa:  { spice: 2, likes: { rice: 2, chicken: 2.5, grill: 2.5, beans: 2, spicy: 2, lamb: 1.5, fried: 1.5, tomato: 1.5, fish: 1.5 } },
    oce:  { spice: 1, likes: { grill: 2.5, seafood: 2.5, fish: 2, beef: 2, fried: 1.5, coffee: 2.5, salad: 1.5, potato: 1.5 } },
    gen:  { spice: 1, likes: { grill: 1, chicken: 1, rice: 1, bread: 1, sweet: 1 } }
  };

  /* Country-level adjustments on top of the regional profile. */
  var COUNTRY_TWEAKS = {
    IN: { spice: 3, likes: { beef: -4, curry: 3, rice: 2.5, dairy: 1.5, fermented: 1.5, coconut: 1.5 } },
    NP: { spice: 2, likes: { beef: -4, dumpling: 3 } },
    PK: { likes: { lamb: 2.5, grill: 2.5, pork: -3 } },
    BD: { likes: { fish: 2.5, pork: -3 } },
    LK: { likes: { coconut: 2.5, fish: 2 } },
    GB: { spice: 2, likes: { curry: 2, fried: 2, tea: 2.5, potato: 2.5 } },
    IE: { likes: { potato: 3 } },
    IT: { likes: { pasta: 3, tomato: 3, cheese: 2.5 } },
    FR: { likes: { cheese: 2.5, bread: 2, dairy: 2 } },
    DE: { likes: { pork: 2, potato: 2.5, bread: 2 } },
    US: { spice: 1, likes: { salad: 2.5, coffee: 2.5, fried: 2 } },
    CA: { likes: { coffee: 2.5, salad: 2 } },
    MX: { spice: 3, likes: { spicy: 2.5, beans: 3, sour: 2 } },
    AR: { spice: 0, likes: { beef: 3.5, grill: 3.5 } },
    UY: { spice: 0, likes: { beef: 3.5, grill: 3.5 } },
    BR: { spice: 1, likes: { beef: 3, grill: 3, beans: 2.5, rice: 2.5 } },
    CL: { spice: 1 },
    PE: { likes: { sour: 2.5, seafood: 2.5, fish: 2 } },
    TH: { spice: 3, likes: { spicy: 2.5, coconut: 3, herb: 3 } },
    VN: { spice: 1, likes: { soup: 3, herb: 3, noodle: 3 } },
    PH: { spice: 1, likes: { pork: 2.5, sour: 2, sweet: 2 } },
    ID: { spice: 3, likes: { pork: -3 } },
    MY: { spice: 3, likes: { pork: -3 } },
    BN: { likes: { pork: -3 } },
    SG: { likes: { noodle: 3, rice: 3 } },
    MN: { likes: { pork: 0.5, beef: 2, dumpling: 3, dairy: 2 } },
    CN: { spice: 2 },
    HK: { spice: 1, likes: { steamed: 2.5, dumpling: 3 } },
    TW: { spice: 1 },
    TR: { likes: { grill: 3.5, lamb: 3, bread: 3, dairy: 2 } },
    IR: { likes: { rice: 3.5, grill: 3, herb: 2.5 } },
    IL: { likes: { beans: 3, salad: 2, herb: 2, pork: -1 } },
    LB: { likes: { herb: 3, beans: 3, salad: 2, pork: -1 } },
    ET: { spice: 3, likes: { spicy: 2.5, bread: 2, beans: 2 } },
    NG: { spice: 3, likes: { rice: 3, spicy: 2.5 } },
    ZA: { spice: 2, likes: { grill: 3, beef: 2.5 } },
    KE: { likes: { grill: 3 } },
    AU: { likes: { coffee: 3 } }, NZ: { likes: { coffee: 3 } },
    GE: { likes: { dumpling: 3, cheese: 3 } },
    SE: { likes: { fish: 3, coffee: 3 } }, NO: { likes: { fish: 3.5 } }, FI: { likes: { coffee: 3.5 } },
    PL: { likes: { dumpling: 3, soup: 3, pork: 2 } },
    UA: { likes: { soup: 3, dumpling: 3, pork: 2 } },
    RU: { likes: { soup: 3, dumpling: 3, dairy: 2.5, herb: 2.5, tea: 2.5 } }
  };

  /* "Just like home" — dish resembles a dish the guest knows.
     Keys: country code (wins) or profile id. */
  var LIKE_HOME = {
    "beetroot-soup": { RU: "Just like borscht at home", UA: "Just like borscht at home", BY: "Just like borscht at home", PL: "Similar to Polish barszcz", LT: "Similar to cold or warm beet soup from home", ee: "Similar to borscht" },
    "veg-momos": { RU: "Similar to pelmeni", UA: "Similar to varenyky", PL: "Similar to pierogi", ee: "Similar to pelmeni", cas: "Similar to manti", cau: "Similar to khinkali", cn: "Similar to jiaozi dumplings", jp: "Similar to gyoza", kr: "Similar to mandu", NP: "Momos, just like home", BT: "Similar to momos from home", MN: "Similar to buuz" },
    "chicken-momos": { RU: "Similar to pelmeni", UA: "Similar to varenyky", PL: "Similar to pierogi", ee: "Similar to pelmeni", cas: "Similar to manti", cau: "Similar to khinkali", cn: "Similar to jiaozi dumplings", jp: "Similar to gyoza", kr: "Similar to mandu", NP: "Momos, just like home", BT: "Similar to momos from home", MN: "Similar to buuz" },
    "chicken-shawarma": { mena: "Like shawarma from home", TR: "Similar to döner kebab", GR: "Similar to gyros", DE: "Similar to döner kebab" },
    "chicken-biryani": { cas: "Close to plov", mena: "Close to kabsa and mandi", AF: "Close to Kabuli pulao", IR: "Close to Persian polo", PK: "Just like biryani at home", BD: "Like kacchi biryani", IN: "A favourite Indian classic", MY: "Similar to nasi briyani", SG: "Similar to nasi briyani" },
    "seekh-kebab": { mena: "Like kofta kebab", TR: "Similar to Adana kebab", IR: "Like kabab koobideh", cau: "Similar to lula kebab", cas: "Similar to shashlik", RU: "Similar to lyulya kebab" },
    "hakka-noodles": { cn: "Similar to chow mein", sea: "Similar to stir-fried noodles from home" },
    "veg-fried-rice": { cn: "Like Chinese fried rice", ID: "Similar to nasi goreng", MY: "Similar to nasi goreng", TH: "Similar to khao pad", JP: "Similar to chahan" },
    "thai-green-curry": { TH: "Thai classic: gaeng kiao wan", sea: "A Southeast Asian classic" },
    "teriyaki-bowl": { JP: "Like a teriyaki don at home" },
    "margherita-pizza": { IT: "Classic Neapolitan-style margherita", US: "An American favourite" },
    "penne-arrabbiata": { IT: "A Roman classic" },
    "mushroom-alfredo": { US: "An American-Italian favourite" },
    "burrito-bowl": { MX: "Mexican flavours: rice, beans and salsa", la: "Rice, beans and salsa — Latin American flavours" },
    "beef-steak": { AR: "Like a parrilla steak", UY: "Like a parrilla steak", BR: "Like churrasco", US: "A classic steakhouse cut", AU: "Like a steak from home" },
    "grilled-salmon": { nor: "Nordic-style salmon with dill", NO: "Like Norwegian salmon with dill" },
    "fish-and-chips": { GB: "A British classic", IE: "A classic from home", AU: "A classic from home", NZ: "A classic from home" },
    "honey-cake": { RU: "Similar to medovik", UA: "Similar to medovik", BY: "Similar to medovik", ee: "Similar to medovik", cau: "Similar to honey cake from home" },
    "cheesecake": { US: "A New York classic" },
    "caesar-salad": { US: "An American classic", CA: "A North American classic", MX: "Created in Tijuana, Mexico" },
    "butter-chicken": { IN: "A North Indian favourite", PK: "Like murgh makhani at home", GB: "A British curry-house favourite" },
    "hummus": { mena: "Just like hummus at home", IL: "Just like hummus at home" },
    "masala-dosa": { IN: "A South Indian classic", LK: "Similar to thosai" },
    "green-tea": { cn: "Like green tea at home", jp: "Like green tea at home" },
    "masala-chai": { sa: "Like chai at home", GB: "Like milky tea, with spices", cas: "Similar to tea with milk at home" },
    "cappuccino": { IT: "The Italian coffee classic" },
    "hot-sour-soup": { cn: "Similar to suan la tang" },
    "pork-ribs": { cn: "Similar to sweet char siu pork", KR: "Similar to sweet galbi", US: "BBQ ribs, American style" },
    "fish-curry": { LK: "Like Sri Lankan fish curry", sea: "Coconut fish curry, like home" },
    "calamari": { med: "Like calamari fritti" },
    "mango-lassi": { sa: "Like lassi at home" },
    "chicken-clear-soup": { jp: "A light, clear broth" }
  };

  /* Short English reasons for each taste tag (translated at runtime). */
  var TAG_REASONS = {
    soup: "Warm, comforting soup", dumpling: "Dumplings, a familiar favourite", noodle: "Noodles",
    pasta: "Classic pasta", rice: "A satisfying rice dish", bread: "Served with fresh bread",
    grill: "Grilled for a smoky flavour", fried: "Crispy and golden", curry: "Rich, flavourful curry",
    salad: "Fresh and light", steamed: "Steamed and light", seafood: "Fresh seafood", fish: "Fish",
    chicken: "Tender chicken", lamb: "Tender lamb", beef: "Prime beef", pork: "Pork",
    cheese: "Cheesy", dairy: "Creamy and rich", potato: "With potatoes", beans: "Hearty beans and lentils",
    tomato: "Tomato-based", coconut: "Made with coconut", herb: "Fresh herbs", sour: "Tangy and refreshing",
    sweet: "Sweet", umami: "Savoury umami flavour", fermented: "Naturally fermented", spicy: "Bold and spicy",
    light: "Light and easy", comfort: "Comfort food", tea: "Freshly brewed tea", coffee: "Freshly brewed coffee",
    fruit: "Fresh fruit", soy: "Seasoned with soy"
  };

  function merge(base, tweak) {
    var out = { spice: base.spice, likes: {} };
    var k;
    for (k in base.likes) out.likes[k] = base.likes[k];
    if (tweak) {
      if (typeof tweak.spice === "number") out.spice = tweak.spice;
      for (k in tweak.likes) out.likes[k] = tweak.likes[k];
    }
    return out;
  }

  function profileFor(country) {
    var pid = (country && country.profile) || "gen";
    var base = PROFILES[pid] || PROFILES.gen;
    var p = merge(base, country ? COUNTRY_TWEAKS[country.code] : null);
    p.id = pid;
    return p;
  }

  function likeHome(dishId, country, pid) {
    var m = LIKE_HOME[dishId];
    if (!m) return null;
    if (country && m[country.code]) return m[country.code];
    return m[pid] || null;
  }

  /* Score one dish. Returns { score, reasons:[english strings] } */
  function scoreDish(dish, profile, country) {
    var score = 0;
    var hits = [];
    dish.tags.forEach(function (t) {
      var w = profile.likes[t];
      if (typeof w === "number") {
        score += w;
        if (w > 0) hits.push({ tag: t, w: w });
      }
    });
    var home = likeHome(dish.id, country, profile.id);
    if (home) score += 4;

    var over = dish.spice - profile.spice;
    if (over > 0) score -= 2.5 * over;
    else if (dish.spice >= 2 && profile.spice >= 2) score += 1;

    hits.sort(function (a, b) { return b.w - a.w; });
    var reasons = [];
    if (home) reasons.push(home);
    hits.slice(0, home ? 1 : 2).forEach(function (h) {
      if (TAG_REASONS[h.tag]) reasons.push(TAG_REASONS[h.tag]);
    });
    return { score: score, reasons: reasons, home: !!home };
  }

  var COURSES = [
    { id: "start",   name: "To start",  cats: ["soups", "starters"] },
    { id: "main",    name: "Main course", cats: ["indian", "global", "asian"] },
    { id: "dessert", name: "Dessert",   cats: ["desserts"] },
    { id: "drink",   name: "Drink",     cats: ["drinks"] }
  ];

  /* Rank the (already diet-filtered) dishes for a guest. */
  function recommend(dishes, country) {
    var profile = profileFor(country);
    var ranked = dishes.map(function (d) {
      var s = scoreDish(d, profile, country);
      return { dish: d, score: s.score, reasons: s.reasons, home: s.home };
    }).sort(function (a, b) { return b.score - a.score || a.dish.price - b.dish.price; });

    var meal = [];
    COURSES.forEach(function (c) {
      for (var i = 0; i < ranked.length; i++) {
        if (c.cats.indexOf(ranked[i].dish.cat) !== -1) {
          meal.push({ course: c, item: ranked[i] });
          break;
        }
      }
    });

    var used = {};
    meal.forEach(function (m) { used[m.item.dish.id] = true; });
    var more = ranked.filter(function (r) {
      return !used[r.dish.id] && r.score > 0 && r.dish.cat !== "drinks";
    }).slice(0, 6);

    return { profile: profile, meal: meal, more: more, ranked: ranked };
  }

  /* All English strings this module may show (so they can be pre-translated). */
  function allStrings() {
    var s = [];
    var k, c;
    for (k in TAG_REASONS) s.push(TAG_REASONS[k]);
    for (k in LIKE_HOME) for (c in LIKE_HOME[k]) s.push(LIKE_HOME[k][c]);
    COURSES.forEach(function (x) { s.push(x.name); });
    s.push("Not spicy");
    return s;
  }

  window.Taste = { recommend: recommend, profileFor: profileFor, allStrings: allStrings, PROFILES: PROFILES };
})();
