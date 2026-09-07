/* ==========================================================================
   Krumme Dinger — Scrollwerk
   Eine rAF-Schleife, alles über transform/opacity. Kein Framework.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  var NANA = '<svg class="nana" aria-hidden="true"><use href="#nana"/></svg>';

  /* ----- Zustand -------------------------------------------------------- */
  var lastY = window.scrollY;
  var vel = 0;
  var I = 1;                 /* Effektstärke */
  var calm = false, turbo = false;
  var mqOff = [0, 0];

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- Elemente ------------------------------------------------------- */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var tapeFill  = $("#tapeFill");
  var tapeRider = $("#tapeRider");
  var heroNana  = $("#heroNana");
  var heroEl    = $("#hero");
  var tunnel    = $("#anlieferung");
  var crateBox  = $("#crates");
  var belt      = $("#sortierband");
  var beltTrack = $("#beltTrack");
  var ruler     = $("#ruler");
  var ripen     = $("#reifegrad");
  var ripenNana = $("#ripenNana");
  var ripenScale= $("#ripenScale");
  var finale    = $("#finale");
  var rain      = $("#rain");
  var swoops    = $$("[data-swoop]");
  var mqs       = $$(".mq-inner");

  /* ==========================================================================
     Aufbau: Kisten, Laufschrift, Regen, Reifeskala
     ========================================================================== */

  var CRATES = [
    ["Cavendish", "Ecuador · Guayas", "18,14 kg"],
    ["Klasse Extra", "Kaliber 44 mm", "Partie 92B"],
    ["Cavendish", "Costa Rica · Limón", "18,14 kg"],
    ["Reifegrad 1", "13,5 °C", "nicht stapeln"],
    ["Kochbanane", "Kolumbien · Urabá", "22,7 kg"],
    ["Klasse I", "Kaliber 39 mm", "Partie 92B"],
    ["Cavendish", "Panama · Bocas", "18,14 kg"],
    ["Reifekammer", "Ethylen C₂H₄", "Zone 4"],
    ["Klasse Extra", "Kaliber 46 mm", "oben lagern"],
    ["Cavendish", "Elfenbeinküste", "18,14 kg"],
    ["Klasse I", "Kaliber 41 mm", "Partie 92B"],
    ["Blaue Java", "Philippinen · Davao", "14,0 kg"],
    ["Cavendish", "Guatemala · Izabal", "18,14 kg"],
    ["Reifegrad 3", "Ethylen C\u2082H\u2084", "Zone 7"],
    ["Rote Dacca", "Ecuador · El Oro", "12,5 kg"],
    ["Klasse Extra", "Kaliber 42 mm", "oben lagern"]
  ];

  (function buildCrates() {
    if (!crateBox) return;
    var html = "";
    for (var i = 0; i < CRATES.length; i++) {
      var c = CRATES[i];
      var x = (((i * 41 + 7) % 100) - 50) * 1.6;   /* -80 .. 78 vw-Anteil */
      var y = (((i * 67 + 23) % 100) - 50) * 1.1;
      var r = ((i * 29) % 26) - 13;
      html += '<div class="crate" data-crate data-phase="' + (i / CRATES.length).toFixed(3) +
              '" data-x="' + x.toFixed(1) + '" data-y="' + y.toFixed(1) + '" data-r="' + r + '">' +
              '<b>' + c[0] + '</b><i>' + c[1] + '</i><em>' + c[2] + '</em></div>';
    }
    crateBox.innerHTML = html;
  })();
  var crates = $$("[data-crate]");

  var MQ_TEXT = [
    ["Krumme Dinger", "Klasse Extra", "Kaliber 43 mm", "Reifegrad 7", "18,14 kg"],
    ["nach links", "nach rechts", "nach unten", "und nochmal"]
  ];

  function buildMarquee() {
    for (var m = 0; m < mqs.length; m++) {
      var el = mqs[m];
      var words = MQ_TEXT[m] || MQ_TEXT[0];
      var unit = "";
      for (var w = 0; w < words.length; w++) unit += "<span>" + words[w] + NANA + "</span>";
      el.innerHTML = unit;
      var unitW = el.scrollWidth || 600;
      var reps = Math.max(2, Math.ceil((window.innerWidth * 1.6) / unitW));
      var all = "";
      for (var k = 0; k < reps; k++) all += unit;
      el.innerHTML = all + all;
      el.dataset.half = String(el.scrollWidth / 2);
    }
  }

  function buildRain() {
    if (!rain) return;
    var n = 16, html = "";
    for (var i = 0; i < n; i++) {
      var left = (i * 6.25 + ((i * 17) % 6)).toFixed(1);
      var dur = (5.5 + ((i * 7) % 9) * 0.5).toFixed(1);
      var del = (-((i * 13) % 11) * 0.8).toFixed(1);
      var size = 26 + ((i * 11) % 30);
      html += '<svg class="nana" style="left:' + left + '%;width:' + size + 'px;height:' + size +
              'px;animation-duration:' + dur + 's;animation-delay:' + del + 's;color:' +
              (i % 4 === 0 ? "#c8d24a" : "#ffd21e") + '" aria-hidden="true"><use href="#nana"/></svg>';
    }
    rain.innerHTML = html;
  }

  /* Reifestufen — der Farbfächer des Handels ----------------------------- */
  var STAGES = [
    { c: "#2f6b1f", name: "Dunkelgrün",            starch: "20 %", sugar: "1 %",  where: "Reeferschiff, 13,5 °C",
      desc: "Erntezustand. Hart, stärkehaltig, geschmacklich nicht der Rede wert — genau so soll sie ins Schiff." },
    { c: "#4d7f20", name: "Grün mit gelbem Stich", starch: "18 %", sugar: "3 %",  where: "Reifekammer, Tag 1",
      desc: "Die Kammer wird geflutet: Ethylen startet die Reifung, die im Kühlcontainer bewusst angehalten wurde." },
    { c: "#88a72b", name: "Mehr grün als gelb",    starch: "14 %", sugar: "8 %",  where: "Reifekammer, Tag 2–3",
      desc: "Stärke kippt in Zucker. Die Schale verliert ihr Chlorophyll, das Gelb darunter lag schon immer da." },
    { c: "#c6bf2d", name: "Mehr gelb als grün",    starch: "9 %",  sugar: "13 %", where: "Auslieferung Handel",
      desc: "Die Verkaufsstufe. Ab hier läuft die Uhr, und zwar deutlich schneller als jedem Händler lieb ist." },
    { c: "#ffd21e", name: "Gelb mit grünen Spitzen", starch: "4 %", sugar: "18 %", where: "Regal",
      desc: "Der Zustand, den die meisten für „die Banane“ halten. Fest, süß, noch mit einem Rest Biss am Hals." },
    { c: "#ffcf12", name: "Voll gelb",             starch: "2 %",  sugar: "20 %", where: "Obstschale",
      desc: "Essreif nach Lehrbuch. Der Zucker ist am Anschlag, das Fleisch cremig, die Schale gibt leicht nach." },
    { c: "#efb60c", name: "Gelb mit braunen Punkten", starch: "1 %", sugar: "22 %", where: "Kuchenform",
      desc: "Aroma-Maximum. Die braunen Punkte sind kein Makel, sondern der Beleg dafür, dass alles fertig ist." }
  ];

  var rNum = $("#ripenNum"), rName = $("#ripenName"), rDesc = $("#ripenDesc"),
      rStarch = $("#ripenStarch"), rSugar = $("#ripenSugar"), rWhere = $("#ripenWhere");
  var lastStage = -1;

  (function buildScale() {
    if (!ripenScale) return;
    var html = "";
    for (var i = 0; i < STAGES.length; i++) html += '<i style="background:' + STAGES[i].c + '"></i>';
    ripenScale.innerHTML = html;
  })();
  var scaleBars = ripenScale ? $$("#ripenScale i") : [];

  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  var STAGE_RGB = STAGES.map(function (s) { return hex2rgb(s.c); });

  function peelAt(p) {
    var f = clamp(p, 0, 1) * (STAGE_RGB.length - 1);
    var i = Math.min(STAGE_RGB.length - 2, Math.floor(f));
    var t = f - i, a = STAGE_RGB[i], b = STAGE_RGB[i + 1];
    return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," +
                    Math.round(lerp(a[1], b[1], t)) + "," +
                    Math.round(lerp(a[2], b[2], t)) + ")";
  }

  /* ==========================================================================
     Messen (bei Start und Größenänderung)
     ========================================================================== */
  var beltMax = 0, beltCards = [], vh = window.innerHeight, vw = window.innerWidth;

  function measure() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    if (beltTrack) {
      beltTrack.style.transform = "none";
      beltMax = Math.max(0, beltTrack.offsetWidth - vw);
      beltCards = $$("#beltTrack .spec-card").map(function (el) {
        return { el: el, cx: el.offsetLeft + el.offsetWidth / 2 };
      });
    }
    buildMarquee();
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 180);
  }, { passive: true });

  /* ==========================================================================
     Fortschritt eines Elements durch das Fenster (0 → 1)
     ========================================================================== */
  function progThrough(el) {
    var r = el.getBoundingClientRect();
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }
  /* Fortschritt innerhalb eines angehefteten Abschnitts (0 → 1) */
  function progPinned(el) {
    var r = el.getBoundingClientRect();
    var span = r.height - vh;
    return span <= 0 ? 0 : clamp(-r.top / span, 0, 1);
  }
  function visible(el, pad) {
    var r = el.getBoundingClientRect();
    return r.bottom > -(pad || 0) && r.top < vh + (pad || 0);
  }

  /* ==========================================================================
     Maus-Neigung im Kopfbereich
     ========================================================================== */
  var tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0;
  if (heroEl) {
    heroEl.addEventListener("pointermove", function (e) {
      var r = heroEl.getBoundingClientRect();
      tiltTX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tiltTY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });
    heroEl.addEventListener("pointerleave", function () { tiltTX = 0; tiltTY = 0; }, { passive: true });
  }

  /* ==========================================================================
     Die Schleife
     ========================================================================== */
  function frame() {
    var y = window.scrollY;
    var raw = clamp(y - lastY, -120, 120);
    lastY = y;
    vel = lerp(vel, raw, 0.16);
    if (Math.abs(vel) < 0.02) vel = 0;

    var av = Math.abs(vel);
    root.style.setProperty("--vel", vel.toFixed(2));
    root.style.setProperty("--avel", av.toFixed(2));

    /* Fortschrittsband ------------------------------------------------- */
    var docH = document.documentElement.scrollHeight - vh;
    var gp = docH > 0 ? clamp(y / docH, 0, 1) : 0;
    if (tapeFill) tapeFill.style.width = (gp * 100).toFixed(2) + "%";
    if (tapeRider) tapeRider.style.transform =
      "translateX(" + (gp * vw - 15).toFixed(1) + "px) rotate(" + (-18 + gp * 720 * I).toFixed(1) + "deg)";

    /* Kopfbereich ------------------------------------------------------- */
    tiltX = lerp(tiltX, tiltTX, 0.08);
    tiltY = lerp(tiltY, tiltTY, 0.08);
    if (heroNana && visible(heroEl, 200)) {
      heroNana.style.transform =
        "rotateY(" + (tiltX * 26 + y * 0.28 * I).toFixed(2) + "deg)" +
        "rotateX(" + (-tiltY * 20).toFixed(2) + "deg)" +
        "rotate(" + (Math.sin(y * 0.004) * 8 * I).toFixed(2) + "deg)" +
        "scale(" + (1 - Math.min(y / 2600, 0.28)).toFixed(3) + ")";
    }

    /* Laufschrift — Richtung und Tempo folgen dem Scrollen --------------- */
    for (var m = 0; m < mqs.length; m++) {
      var el = mqs[m];
      var dir = parseFloat(el.dataset.dir) || 1;
      var half = parseFloat(el.dataset.half) || 1;
      mqOff[m] += (0.55 + av * 0.55 * I) * dir + vel * 0.9 * I * dir;
      var o = ((mqOff[m] % half) + half) % half;
      el.style.transform = "translate3d(" + (-o).toFixed(1) + "px,0,0)";
    }

    /* 01 · Kisten fliegen entgegen -------------------------------------- */
    if (tunnel && visible(tunnel, 0)) {
      var tp = progPinned(tunnel);
      for (var i = 0; i < crates.length; i++) {
        var c = crates[i];
        var ph = parseFloat(c.dataset.phase);
        var t = ((tp * 2.4 + ph) % 1 + 1) % 1;
        var z = -3000 + t * 3400;
        var o2 = smooth(-2900, -2000, z) * (1 - smooth(120, 395, z));
        c.style.opacity = o2.toFixed(3);
        c.style.transform =
          "translate3d(" + c.dataset.x + "vw," + c.dataset.y + "vh," + z.toFixed(0) + "px)" +
          "rotate(" + (parseFloat(c.dataset.r) + t * 40 * I).toFixed(1) + "deg)";
      }
    }

    /* 02 · Sichtung — links rein, rechts rein --------------------------- */
    for (var s = 0; s < swoops.length; s++) {
      var el2 = swoops[s];
      if (!visible(el2, 260)) continue;
      var p = progThrough(el2);
      var side = el2.dataset.swoop === "left" ? -1 : 1;
      var inN = smooth(0.02, 0.44, p);
      var outN = smooth(0.60, 1.0, p);
      var x = side * (1 - inN) * 64 - side * outN * 42;
      var ry = side * (1 - inN) * 58 - side * outN * 40;
      var rz = side * (1 - inN) * 9 - side * outN * 6;
      var z2 = (1 - inN) * -460 - outN * 300;
      el2.style.transform =
        "translate3d(" + (x * I).toFixed(2) + "vw,0," + (z2 * I).toFixed(0) + "px)" +
        "rotateY(" + (ry * I).toFixed(2) + "deg)" +
        "rotate(" + (rz * I).toFixed(2) + "deg)" +
        "skewY(" + (vel * 0.045 * I).toFixed(2) + "deg)";
    }

    /* 03 · Sortierband — runter scrollen, seitwärts fahren --------------- */
    if (belt && visible(belt, 0)) {
      var bp = progPinned(belt);
      var tx = -beltMax * bp;
      if (beltTrack) beltTrack.style.transform = "translate3d(" + tx.toFixed(1) + "px,0,0)";
      if (ruler) ruler.style.transform = "translate3d(" + (tx * 0.55).toFixed(1) + "px,0,0)";
      for (var b = 0; b < beltCards.length; b++) {
        var card = beltCards[b];
        var d = (card.cx + tx - vw / 2) / vw;              /* -1 … 1 */
        card.el.style.transform =
          "rotateY(" + (-d * 44 * I).toFixed(2) + "deg)" +
          "translateZ(" + (-Math.abs(d) * 190 * I).toFixed(0) + "px)" +
          "rotate(" + (d * 3.5 * I).toFixed(2) + "deg)" +
          "scale(" + (1 - Math.min(Math.abs(d) * 0.12, 0.2)).toFixed(3) + ")";
      }
    }

    /* 04 · Reifegrad ----------------------------------------------------- */
    if (ripen && visible(ripen, 0)) {
      var rp = progPinned(ripen);
      var col = peelAt(rp);
      var spot = smooth(0.84, 1.0, rp);
      if (ripenNana) {
        ripenNana.style.color = col;
        ripenNana.style.setProperty("--spot", spot.toFixed(3));
        ripenNana.style.transform =
          "rotate(" + (-14 + rp * 28).toFixed(2) + "deg)" +
          "rotateY(" + (Math.sin(rp * Math.PI * 3) * 26 * I).toFixed(1) + "deg)" +
          "scale(" + (0.9 + rp * 0.18).toFixed(3) + ")";
      }
      var st = clamp(Math.floor(rp * STAGES.length), 0, STAGES.length - 1);
      if (st !== lastStage) {
        lastStage = st;
        var S = STAGES[st];
        if (rNum) rNum.textContent = String(st + 1);
        if (rName) rName.textContent = S.name;
        if (rDesc) rDesc.textContent = S.desc;
        if (rStarch) rStarch.textContent = S.starch;
        if (rSugar) rSugar.textContent = S.sugar;
        if (rWhere) rWhere.textContent = S.where;
        for (var q = 0; q < scaleBars.length; q++) scaleBars[q].classList.toggle("on", q === st);
      }
    }

    requestAnimationFrame(frame);
  }

  /* ==========================================================================
     Bedienung: Turbo und Ruhe
     ========================================================================== */
  var btnTurbo = $("#turbo"), btnRuhe = $("#ruhe");

  function applyMode() {
    I = calm ? 0.16 : (turbo ? 2.15 : 1);
    root.style.setProperty("--I", String(I));
    body.classList.toggle("calm", calm);
    body.classList.toggle("turbo", turbo && !calm);
    if (btnTurbo) btnTurbo.setAttribute("aria-pressed", String(turbo && !calm));
    if (btnRuhe) btnRuhe.setAttribute("aria-pressed", String(calm));
  }

  if (btnTurbo) btnTurbo.addEventListener("click", function () {
    turbo = !turbo; if (turbo) calm = false; applyMode();
  });
  if (btnRuhe) btnRuhe.addEventListener("click", function () {
    calm = !calm; if (calm) turbo = false; applyMode();
  });

  /* ==========================================================================
     Bananenwurf
     ========================================================================== */
  function burst(x, y, count) {
    if (calm) return;
    var n = count || 14;
    for (var i = 0; i < n; i++) {
      var el = document.createElement("div");
      el.className = "burst";
      el.innerHTML = NANA;
      el.style.left = (x - 17) + "px";
      el.style.top = (y - 17) + "px";
      el.firstChild.style.color = i % 3 === 0 ? "#c8d24a" : "#ffd21e";
      document.body.appendChild(el);

      var a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      var dist = 140 + Math.random() * 260 * I;
      var dx = Math.cos(a) * dist;
      var dy = Math.sin(a) * dist - 120;
      var anim = el.animate([
        { transform: "translate3d(0,0,0) rotate(0deg) scale(.4)", opacity: 1 },
        { transform: "translate3d(" + dx.toFixed(0) + "px," + dy.toFixed(0) + "px,0) rotate(" +
                     (Math.random() * 720 - 360).toFixed(0) + "deg) scale(1)", opacity: 1, offset: 0.45 },
        { transform: "translate3d(" + (dx * 1.15).toFixed(0) + "px," + (dy + 460).toFixed(0) +
                     "px,0) rotate(" + (Math.random() * 900 - 450).toFixed(0) + "deg) scale(.7)", opacity: 0 }
      ], { duration: 1000 + Math.random() * 700, easing: "cubic-bezier(.18,.7,.35,1)" });
      anim.onfinish = (function (node) { return function () { node.remove(); }; })(el);
    }
  }

  var bigBtn = $("#bigNanaBtn");
  if (bigBtn) bigBtn.addEventListener("click", function (e) {
    var r = bigBtn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 22);
    e.preventDefault();
  });
  var heroFruit = $("#heroFruit");
  if (heroFruit) heroFruit.addEventListener("click", function (e) {
    burst(e.clientX, e.clientY, 12);
  });

  /* ==========================================================================
     Bananenspur im Kopfbereich
     ========================================================================== */
  var lastTrail = 0;
  if (heroEl) heroEl.addEventListener("pointermove", function (e) {
    if (calm || e.pointerType !== "mouse") return;
    var now = performance.now();
    if (now - lastTrail < 70 / Math.max(I, 0.5)) return;
    lastTrail = now;

    var el = document.createElement("div");
    el.className = "burst";
    el.innerHTML = NANA;
    el.style.left = (e.clientX - 12) + "px";
    el.style.top = (e.clientY - 12) + "px";
    el.style.width = "24px";
    el.style.height = "24px";
    document.body.appendChild(el);
    var anim = el.animate([
      { transform: "scale(1) rotate(0deg)", opacity: .85 },
      { transform: "scale(.3) rotate(" + (Math.random() * 260 - 130).toFixed(0) + "deg) translateY(34px)", opacity: 0 }
    ], { duration: 620, easing: "ease-out" });
    anim.onfinish = function () { el.remove(); };
  }, { passive: true });

  /* ==========================================================================
     Start
     ========================================================================== */
  buildRain();
  measure();
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  calm = reduce;
  applyMode();
  requestAnimationFrame(frame);
})();
