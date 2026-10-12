/* =====================================================================
   COUNTRIES  —  every ISO 3166 country/territory.
   Format "CODE:CURRENCY:TASTE_PROFILE". Country names are shown in the
   guest's chosen language by the browser (Intl.DisplayNames).
   Taste profiles are defined in taste.js.
   ===================================================================== */
(function () {
  var RAW =
    "AD:EUR:med AE:AED:mena AF:AFN:cas AG:XCD:car AI:XCD:car AL:ALL:med AM:AMD:cau AO:AOA:ssa " +
    "AR:ARS:la AS:USD:oce AT:EUR:we AU:AUD:oce AW:AWG:car AX:EUR:nor AZ:AZN:cau BA:BAM:ee " +
    "BB:BBD:car BD:BDT:sa BE:EUR:we BF:XOF:ssa BG:EUR:ee BH:BHD:mena BI:BIF:ssa BJ:XOF:ssa " +
    "BL:EUR:car BM:BMD:car BN:BND:sea BO:BOB:la BQ:USD:car BR:BRL:la BS:BSD:car BT:BTN:sa " +
    "BW:BWP:ssa BY:BYN:ee BZ:BZD:la CA:CAD:na CC:AUD:oce CD:CDF:ssa CF:XAF:ssa CG:XAF:ssa " +
    "CH:CHF:we CI:XOF:ssa CK:NZD:oce CL:CLP:la CM:XAF:ssa CN:CNY:cn CO:COP:la CR:CRC:la " +
    "CU:CUP:car CV:CVE:ssa CW:XCG:car CX:AUD:oce CY:EUR:med CZ:CZK:ee DE:EUR:we DJ:DJF:mena " +
    "DK:DKK:nor DM:XCD:car DO:DOP:car DZ:DZD:mena EC:USD:la EE:EUR:ee EG:EGP:mena EH:MAD:mena " +
    "ER:ERN:ssa ES:EUR:med ET:ETB:ssa FI:EUR:nor FJ:FJD:oce FK:FKP:we FM:USD:oce FO:DKK:nor " +
    "FR:EUR:we GA:XAF:ssa GB:GBP:we GD:XCD:car GE:GEL:cau GF:EUR:la GG:GBP:we GH:GHS:ssa " +
    "GI:GIP:med GL:DKK:nor GM:GMD:ssa GN:GNF:ssa GP:EUR:car GQ:XAF:ssa GR:EUR:med GT:GTQ:la " +
    "GU:USD:oce GW:XOF:ssa GY:GYD:car HK:HKD:cn HN:HNL:la HR:EUR:ee HT:HTG:car HU:HUF:ee " +
    "ID:IDR:sea IE:EUR:we IL:ILS:mena IM:GBP:we IN:INR:sa IQ:IQD:mena IR:IRR:mena IS:ISK:nor " +
    "IT:EUR:med JE:GBP:we JM:JMD:car JO:JOD:mena JP:JPY:jp KE:KES:ssa KG:KGS:cas KH:KHR:sea " +
    "KI:AUD:oce KM:KMF:ssa KN:XCD:car KP:KPW:kr KR:KRW:kr KW:KWD:mena KY:KYD:car KZ:KZT:cas " +
    "LA:LAK:sea LB:LBP:mena LC:XCD:car LI:CHF:we LK:LKR:sa LR:LRD:ssa LS:LSL:ssa LT:EUR:ee " +
    "LU:EUR:we LV:EUR:ee LY:LYD:mena MA:MAD:mena MC:EUR:med MD:MDL:ee ME:EUR:ee MF:EUR:car " +
    "MG:MGA:ssa MH:USD:oce MK:MKD:ee ML:XOF:ssa MM:MMK:sea MN:MNT:cas MO:MOP:cn MP:USD:oce " +
    "MQ:EUR:car MR:MRU:mena MS:XCD:car MT:EUR:med MU:MUR:ssa MV:MVR:sa MW:MWK:ssa MX:MXN:la " +
    "MY:MYR:sea MZ:MZN:ssa NA:NAD:ssa NC:XPF:oce NE:XOF:ssa NF:AUD:oce NG:NGN:ssa NI:NIO:la " +
    "NL:EUR:we NO:NOK:nor NP:NPR:sa NR:AUD:oce NU:NZD:oce NZ:NZD:oce OM:OMR:mena PA:USD:la " +
    "PE:PEN:la PF:XPF:oce PG:PGK:oce PH:PHP:sea PK:PKR:sa PL:PLN:ee PM:EUR:na PN:NZD:oce " +
    "PR:USD:car PS:ILS:mena PT:EUR:med PW:USD:oce PY:PYG:la QA:QAR:mena RE:EUR:ssa RO:RON:ee " +
    "RS:RSD:ee RU:RUB:ee RW:RWF:ssa SA:SAR:mena SB:SBD:oce SC:SCR:ssa SD:SDG:mena SE:SEK:nor " +
    "SG:SGD:sea SH:SHP:we SI:EUR:ee SJ:NOK:nor SK:EUR:ee SL:SLE:ssa SM:EUR:med SN:XOF:ssa " +
    "SO:SOS:ssa SR:SRD:la SS:SSP:ssa ST:STN:ssa SV:USD:la SX:XCG:car SY:SYP:mena SZ:SZL:ssa " +
    "TC:USD:car TD:XAF:ssa TG:XOF:ssa TH:THB:sea TJ:TJS:cas TK:NZD:oce TL:USD:sea TM:TMT:cas " +
    "TN:TND:mena TO:TOP:oce TR:TRY:mena TT:TTD:car TV:AUD:oce TW:TWD:cn TZ:TZS:ssa UA:UAH:ee " +
    "UG:UGX:ssa US:USD:na UY:UYU:la UZ:UZS:cas VA:EUR:med VC:XCD:car VE:VES:la VG:USD:car " +
    "VI:USD:car VN:VND:sea VU:VUV:oce WF:XPF:oce WS:WST:oce XK:EUR:ee YE:YER:mena YT:EUR:ssa " +
    "ZA:ZAR:ssa ZM:ZMW:ssa ZW:ZWG:ssa";

  var list = [];
  RAW.split(" ").forEach(function (row) {
    var p = row.split(":");
    if (p.length === 3) list.push({ code: p[0], currency: p[1], profile: p[2] });
  });
  window.COUNTRIES = list;

  /* Countries where "No pork" is pre-selected (guest can switch it off). */
  window.DEFAULT_NO_PORK = ("AE AF AZ BD BH BN DJ DZ EG EH GM GN ID IQ IR JO KG KM KW KZ LY " +
    "MA ML MR MV MY NE OM PK PS QA SA SD SN SO SY TJ TM TN TR UZ YE").split(" ");

  /* Suggested countries for each language (first one is the default guess). */
  window.LANG_COUNTRIES = {
    "en": ["US", "GB", "AU", "CA", "IE", "NZ", "SG", "ZA", "NG", "IN"],
    "ar": ["SA", "AE", "EG", "QA", "KW", "OM", "BH", "JO", "LB", "IQ", "SY", "MA", "DZ", "TN", "LY", "YE", "SD", "PS"],
    "es": ["ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "UY", "PY", "CR", "PA", "US"],
    "fr": ["FR", "BE", "CH", "CA", "LU", "MC", "SN", "CI", "CM", "MA", "TN", "DZ", "HT", "MG"],
    "de": ["DE", "AT", "CH", "LI", "LU"],
    "pt": ["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"],
    "ru": ["RU", "BY", "KZ", "KG", "UZ", "UA", "TJ", "TM", "AZ", "AM", "GE", "MD"],
    "zh-CN": ["CN", "SG", "MY"], "zh-TW": ["TW", "HK", "MO"], "yue": ["HK", "MO", "CN"],
    "ja": ["JP"], "ko": ["KR"], "hi": ["IN"], "bn": ["BD", "IN"], "ur": ["PK", "IN"],
    "ta": ["IN", "LK", "SG", "MY"], "te": ["IN"], "kn": ["IN"], "ml": ["IN"], "mr": ["IN"],
    "gu": ["IN"], "pa": ["IN", "PK"], "or": ["IN"], "as": ["IN"], "ne": ["NP", "IN"],
    "si": ["LK"], "dv": ["MV"], "dz": ["BT"], "bo": ["CN", "IN", "NP"],
    "it": ["IT", "CH", "SM", "VA"], "nl": ["NL", "BE", "SR"], "pl": ["PL"], "uk": ["UA"],
    "tr": ["TR", "CY"], "fa": ["IR"], "fa-AF": ["AF"], "ps": ["AF", "PK"], "iw": ["IL"],
    "el": ["GR", "CY"], "sv": ["SE", "FI"], "no": ["NO"], "da": ["DK"], "fi": ["FI"],
    "is": ["IS"], "cs": ["CZ"], "sk": ["SK"], "hu": ["HU"], "ro": ["RO", "MD"], "bg": ["BG"],
    "sr": ["RS", "BA", "ME"], "hr": ["HR", "BA"], "bs": ["BA"], "sl": ["SI"], "mk": ["MK"],
    "sq": ["AL", "XK"], "lt": ["LT"], "lv": ["LV"], "et": ["EE"], "be": ["BY"],
    "ka": ["GE"], "hy": ["AM"], "az": ["AZ"], "kk": ["KZ"], "uz": ["UZ"], "ky": ["KG"],
    "tg": ["TJ"], "tk": ["TM"], "mn": ["MN"], "th": ["TH"], "vi": ["VN"], "lo": ["LA"],
    "km": ["KH"], "my": ["MM"], "id": ["ID"], "ms": ["MY", "BN", "SG"], "jw": ["ID"],
    "su": ["ID"], "tl": ["PH"], "ceb": ["PH"], "ilo": ["PH"], "sw": ["TZ", "KE", "UG"],
    "am": ["ET"], "ti": ["ER", "ET"], "om": ["ET"], "so": ["SO", "DJ", "ET"], "ha": ["NG", "NE"],
    "yo": ["NG"], "ig": ["NG"], "zu": ["ZA"], "xh": ["ZA"], "af": ["ZA", "NA"],
    "st": ["LS", "ZA"], "tn": ["BW", "ZA"], "sn": ["ZW"], "ny": ["MW"], "rw": ["RW"],
    "mg": ["MG"], "ln": ["CD", "CG"], "wo": ["SN"], "ak": ["GH"], "ee": ["GH", "TG"],
    "ht": ["HT"], "qu": ["PE", "BO"], "ay": ["BO"], "gn": ["PY"], "mt": ["MT"],
    "ga": ["IE"], "cy": ["GB"], "gd": ["GB"], "eu": ["ES"], "ca": ["ES", "AD"], "gl": ["ES"],
    "lb": ["LU"], "mi": ["NZ"], "sm": ["WS"], "to": ["TO"], "fj": ["FJ"], "haw": ["US"],
    "ku": ["IQ", "TR"], "ckb": ["IQ"], "ug": ["CN"], "tt": ["RU"], "fo": ["FO"], "kl": ["GL"]
  };
})();
