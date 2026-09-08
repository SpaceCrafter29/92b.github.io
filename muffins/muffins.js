/* ==========================================================================
   Ofentrieb — Muffins werden gezeichnet, nicht fotografiert.
   Jeder Muffin entsteht prozedural auf einem Canvas: Papierfalten,
   Krume mit Poren, aufgerissene Kruste, Belag. Danach nur noch
   transform/opacity in einer rAF-Schleife.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement, body = document.body;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  var TAU = Math.PI * 2;

  /* deterministischer Zufall — derselbe Muffin sieht immer gleich aus */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Farbrechnen ---------------------------------------------------------- */
  function hx(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(c1, c2, t) {
    var a = hx(c1), b = hx(c2);
    return "#" + [0, 1, 2].map(function (i) {
      return clamp(Math.round(a[i] + (b[i] - a[i]) * t), 0, 255).toString(16).padStart(2, "0");
    }).join("");
  }
  function rgba(c, al) { var x = hx(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + al + ")"; }
  var light = function (c, t) { return mix(c, "#ffffff", t); };
  var dark = function (c, t) { return mix(c, "#1a1008", t); };

  /* ==========================================================================
     Die Sorten — Farbrezepte für den Zeichner
     ========================================================================== */
  var VARIANTS = {
    schoko: {
      seed: 1109, raw: "#6d4d30",
      crust: ["#8d5623", "#6b3c14", "#431f07"],
      inner: "#6e4222", pore: "#2e1607", speck: "#c99458",
      liner: ["#9a7452", "#6d4b30", "#442d1b"],
      kind: "chips", chip: { n: 18, a: "#3a1c0c", b: "#1d0d06", hi: "#94663a" }
    },
    blaubeere: {
      seed: 2237, raw: "#e8d9b4",
      crust: ["#e3bc7c", "#c39152", "#8f612b"],
      inner: "#dcbc85", pore: "#8a6335", speck: "#fff3d6",
      liner: ["#e4ebf3", "#bcc9db", "#8e9eb8"],
      kind: "berries", berry: { n: 12, a: "#454a80", b: "#191c3d", hi: "#9ba0cd", bleed: "#5b4f95" }
    },
    zitrone: {
      seed: 3371, raw: "#f2e5b8",
      crust: ["#f1d48d", "#dcb45f", "#b28434"],
      inner: "#eed99f", pore: "#a8813c", speck: "#fffbe9",
      liner: ["#f8ecb2", "#e3cd78", "#c0a94d"],
      kind: "glaze", poppy: 240, glaze: "#fdfaf2"
    },
    streusel: {
      seed: 5303, raw: "#eddcb6",
      crust: ["#dcb073", "#b98942", "#8a5d1e"],
      inner: "#ddb87c", pore: "#96682c", speck: "#fff2d4",
      liner: ["#ece0c9", "#cdb896", "#a48a63"],
      kind: "streusel", streusel: { n: 96, a: "#d9ab68", b: "#a9743a", c: "#7d4f1c" }
    },
    karotte: {
      seed: 7127, raw: "#e4c48c",
      crust: ["#d0954f", "#ac6d2c", "#7b4712"],
      inner: "#c68d48", pore: "#7a4818", speck: "#ffbe73",
      liner: ["#d3ddbe", "#a9b78c", "#7f8d64"],
      kind: "frost", frost: "#fbf6ea"
    }
  };

  /* ==========================================================================
     Der Marmor unter allem
     ========================================================================== */
  var bg = document.getElementById("bg");

  function paintMarble() {
    if (!bg) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = window.innerWidth, h = window.innerHeight;
    bg.width = Math.round(w * dpr); bg.height = Math.round(h * dpr);
    var c = bg.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var rnd = mulberry32(90210);

    /* Grundton mit Licht von oben links */
    var g = c.createLinearGradient(0, 0, w * .9, h);
    g.addColorStop(0, "#f0eae0"); g.addColorStop(.45, "#e6dfd3"); g.addColorStop(1, "#d8d0c2");
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    /* Adern */
    c.lineCap = "round";
    for (var v = 0; v < 26; v++) {
      var x = rnd() * w * 1.2 - w * .1, y = rnd() * h;
      var ang = -0.9 + rnd() * 0.7, len = 90 + rnd() * 260;
      var wid = 0.4 + rnd() * 2.6;
      c.strokeStyle = rgba(rnd() > .35 ? "#b9ae9c" : "#8d8272", .10 + rnd() * .16);
      c.lineWidth = wid;
      c.beginPath(); c.moveTo(x, y);
      for (var s = 0; s < 9; s++) {
        ang += (rnd() - .5) * .8;
        x += Math.cos(ang) * len / 9; y += Math.sin(ang) * len / 9;
        c.lineTo(x, y);
      }
      c.stroke();
    }

    /* Korn */
    var n = Math.round(w * h / 260);
    for (var i = 0; i < n; i++) {
      var px = rnd() * w, py = rnd() * h, t = rnd();
      c.fillStyle = t > .5 ? "rgba(255,255,255,.30)" : "rgba(120,108,92,.16)";
      c.fillRect(px, py, 1, 1);
    }

    /* Mehlstaub */
    for (var f = 0; f < 220; f++) {
      var fx = rnd() * w, fy = rnd() * h, fr = 2 + rnd() * 22;
      var fg = c.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, "rgba(255,255,255," + (.10 + rnd() * .28).toFixed(3) + ")");
      fg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = fg; c.beginPath(); c.arc(fx, fy, fr, 0, TAU); c.fill();
    }

    /* Ecken abdunkeln */
    var vg = c.createRadialGradient(w * .38, h * .28, Math.min(w, h) * .2, w * .5, h * .5, Math.max(w, h) * .82);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,48,34,.20)");
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }

  /* ==========================================================================
     Der Muffin selbst — alles in einem 1000 x 1000 grossen Raum.
     Die Kuppel ist eine Superellipse: breiter als hoch, steile Flanken,
     ueberhaengender Rand. Genau das macht die Pilzform aus.
     ========================================================================== */
  var GEO = { baseY: 628, linT: 606, linB: 886, wT: 250, wB: 188 };

  function domeSize(rise) {
    return { rx: 210 + 132 * rise, ry: 24 + 238 * rise };
  }

  function shadowUnder(ctx, spread) {
    ctx.save();
    ctx.translate(500, 892); ctx.scale(1, .145);
    var g = ctx.createRadialGradient(0, 0, 20, 0, 0, spread);
    g.addColorStop(0, "rgba(48,36,24,.44)");
    g.addColorStop(.5, "rgba(48,36,24,.20)");
    g.addColorStop(1, "rgba(48,36,24,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, spread, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function linerPath(ctx) {
    var G = GEO;
    ctx.beginPath();
    ctx.moveTo(500 - G.wT, G.linT);
    ctx.lineTo(500 - G.wB, G.linB);
    ctx.quadraticCurveTo(500, G.linB + 26, 500 + G.wB, G.linB);
    ctx.lineTo(500 + G.wT, G.linT);
    ctx.closePath();
  }

  function drawLiner(ctx, V) {
    var G = GEO, N = 17, i;
    ctx.save();
    linerPath(ctx); ctx.clip();

    for (i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1) / N;
      var xT0 = 500 - G.wT + 2 * G.wT * t0, xT1 = 500 - G.wT + 2 * G.wT * t1;
      var xB0 = 500 - G.wB + 2 * G.wB * t0, xB1 = 500 - G.wB + 2 * G.wB * t1;
      var g = ctx.createLinearGradient(xT0, 0, xT1, 0);
      g.addColorStop(0, V.liner[2]);
      g.addColorStop(.26, V.liner[1]);
      g.addColorStop(.56, V.liner[0]);
      g.addColorStop(.84, V.liner[1]);
      g.addColorStop(1, V.liner[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(xT0, G.linT - 8); ctx.lineTo(xT1, G.linT - 8);
      ctx.lineTo(xB1, G.linB + 30); ctx.lineTo(xB0, G.linB + 30);
      ctx.closePath(); ctx.fill();
    }

    var cg = ctx.createLinearGradient(500 - G.wT, 0, 500 + G.wT, 0);
    cg.addColorStop(0, "rgba(0,0,0,.34)");
    cg.addColorStop(.15, "rgba(0,0,0,.04)");
    cg.addColorStop(.36, "rgba(255,255,255,.26)");
    cg.addColorStop(.62, "rgba(255,255,255,.04)");
    cg.addColorStop(.85, "rgba(0,0,0,.14)");
    cg.addColorStop(1, "rgba(0,0,0,.40)");
    ctx.fillStyle = cg; ctx.fillRect(0, G.linT - 12, 1000, G.linB - G.linT + 50);

    var bgd = ctx.createLinearGradient(0, G.linB - 120, 0, G.linB + 26);
    bgd.addColorStop(0, "rgba(0,0,0,0)"); bgd.addColorStop(1, "rgba(30,20,10,.30)");
    ctx.fillStyle = bgd; ctx.fillRect(0, G.linB - 120, 1000, 160);

    /* Schatten, den die ueberhaengende Kuppel auf das Papier wirft */
    var sh = ctx.createLinearGradient(0, G.linT - 6, 0, G.linT + 74);
    sh.addColorStop(0, "rgba(20,12,4,.50)"); sh.addColorStop(1, "rgba(20,12,4,0)");
    ctx.fillStyle = sh; ctx.fillRect(0, G.linT - 6, 1000, 80);
    ctx.restore();
  }

  /* Superellipsen-Kuppel mit aufmodulierten Beulen ------------------------- */
  function domePath(ctx, L, rise) {
    var G = GEO, N = 132, S = domeSize(rise), n = 2 / 2.15, i, t, a, w, ca, sa, x, y;
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      t = i / N; a = Math.PI - t * Math.PI;
      w = 1 + (L[0] * Math.sin(t * 5.3 + L[3]) + L[1] * Math.sin(t * 11.7 + L[4]) +
               L[2] * Math.sin(t * 23.1 + L[5])) * rise;
      ca = Math.cos(a); sa = Math.sin(a);
      x = 500 + (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), n) * S.rx * w;
      y = G.baseY - Math.pow(Math.abs(sa), n) * S.ry * w;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    /* Schuerze: der Rand haengt ueber den Foermchenrand */
    var skirt = 20 + 30 * rise;
    for (i = N; i >= 0; i--) {
      t = i / N;
      x = 500 + (t * 2 - 1) * S.rx * .997;
      y = G.baseY + skirt * (.30 + .70 * Math.sin(Math.PI * t)) * (.70 + .30 * Math.sin(t * 9.6 + L[6]));
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    return S;
  }

  function drawDome(ctx, V, rnd, rise, brown) {
    var G = GEO, i, x, y, r;
    var L = [.055, .030, .013, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU];
    var c0 = mix(V.raw, V.crust[0], brown);
    var c1 = mix(V.raw, V.crust[1], brown);
    var c2 = mix(V.raw, V.crust[2], brown);

    var d = domePath(ctx, L, rise);
    ctx.save();
    ctx.clip();

    /* Grundlicht */
    var g = ctx.createRadialGradient(
      500 - d.rx * .38, G.baseY - d.ry * .82, d.ry * .05,
      500 - d.rx * .08, G.baseY - d.ry * .26, d.rx * 1.42);
    g.addColorStop(0, light(c0, .26));
    g.addColorStop(.30, c0);
    g.addColorStop(.64, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);

    /* grosse weiche Woelbungen brechen den glatten Verlauf auf */
    for (i = 0; i < 26; i++) {
      x = 500 + (rnd() * 2 - 1) * d.rx * .95;
      y = G.baseY + 30 - rnd() * d.ry * 1.1;
      r = d.rx * (.10 + rnd() * .26);
      var bg2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      var up = rnd() > .5;
      bg2.addColorStop(0, rgba(up ? light(c0, .30) : dark(c2, .20), .16 + rnd() * .16));
      bg2.addColorStop(1, rgba(up ? light(c0, .30) : dark(c2, .20), 0));
      ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    /* Poren */
    for (i = 0; i < 300; i++) {
      x = 500 + (rnd() * 2 - 1) * d.rx;
      y = G.baseY + 40 - rnd() * (d.ry * 1.14);
      r = 2.5 + rnd() * rnd() * 15;
      ctx.globalAlpha = .07 + rnd() * .22;
      ctx.fillStyle = V.pore;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (.5 + rnd() * .8), rnd() * 3, 0, TAU); ctx.fill();
      /* Lichtkante am oberen Rand jeder Pore */
      ctx.globalAlpha *= .7; ctx.fillStyle = V.speck;
      ctx.beginPath(); ctx.ellipse(x - r * .12, y - r * .5, r * .7, r * .28, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = V.pore;
    }
    /* Kruemelspitzen */
    for (i = 0; i < 210; i++) {
      x = 500 + (rnd() * 2 - 1) * d.rx;
      y = G.baseY + 30 - rnd() * (d.ry * 1.1);
      r = 1.6 + rnd() * rnd() * 7;
      ctx.globalAlpha = .06 + rnd() * .24;
      ctx.fillStyle = V.speck;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (.55 + rnd() * .7), rnd() * 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Risse in der Kruste */
    if (rise > .38) {
      var open = smooth(.38, .90, rise);
      var fill = light(c0, .15);
      var edge = dark(c2, .42);
      var angs = [-2.70, -2.05, -1.42, -0.86, -0.30];
      for (i = 0; i < angs.length; i++) {
        crack(ctx, rnd,
          500 + (rnd() - .5) * 110, G.baseY - d.ry * (.62 + rnd() * .30),
          angs[i] + (rnd() - .5) * .28,
          d.rx * (.40 + rnd() * .34), (11 + rnd() * 17) * open,
          fill, edge);
      }
    }

    /* Raender abdunkeln */
    var eg = ctx.createRadialGradient(500, G.baseY - d.ry * .40, d.rx * .26, 500, G.baseY - d.ry * .32, d.rx * 1.04);
    eg.addColorStop(0, "rgba(0,0,0,0)"); eg.addColorStop(1, rgba(dark(c2, .34), .58));
    ctx.fillStyle = eg; ctx.fillRect(0, 0, 1000, 1000);
    var ug = ctx.createLinearGradient(0, G.baseY - 46, 0, G.baseY + 56);
    ug.addColorStop(0, "rgba(0,0,0,0)"); ug.addColorStop(1, "rgba(22,13,5,.58)");
    ctx.fillStyle = ug; ctx.fillRect(0, G.baseY - 46, 1000, 110);
    ctx.restore();

    /* Lichtkante */
    ctx.save();
    domePath(ctx, L, rise); ctx.clip();
    ctx.strokeStyle = rgba(light(c0, .60), .5); ctx.lineWidth = 8;
    domePath(ctx, L, rise); ctx.stroke();
    ctx.restore();

    return { d: d, L: L, c0: c0, c1: c1, c2: c2 };
  }

  /* ein Riss: getapertes Polygon plus Schattenkante */
  function crack(ctx, rnd, cx, cy, ang, len, w0, colFill, colDark) {
    if (w0 < .8) return;
    var pts = [], x = cx, y = cy, a = ang, N = 8, i;
    for (i = 0; i <= N; i++) {
      pts.push([x, y]);
      a += (rnd() - .5) * .55;
      x += Math.cos(a) * len / N; y += Math.sin(a) * len / N;
    }
    var up = [], dn = [];
    for (i = 0; i < pts.length; i++) {
      var t = i / (pts.length - 1), w = w0 * (1 - t * .85);
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      var dd = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + Math.PI / 2;
      up.push([pts[i][0] + Math.cos(dd) * w, pts[i][1] + Math.sin(dd) * w]);
      dn.push([pts[i][0] - Math.cos(dd) * w, pts[i][1] - Math.sin(dd) * w]);
    }
    /* dunkler Spalt zuerst, etwas breiter */
    ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
    for (i = 1; i < up.length; i++) ctx.lineTo(up[i][0], up[i][1]);
    for (i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
    ctx.closePath();
    ctx.fillStyle = colDark; ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
    /* aufgerissene, hellere Kante darueber, leicht versetzt */
    ctx.save(); ctx.translate(-1.5, -3.5);
    ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
    for (i = 1; i < up.length; i++) ctx.lineTo(up[i][0], up[i][1]);
    for (i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.globalAlpha = .72; ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  /* ==========================================================================
     Belag
     ========================================================================== */
  function blob(ctx, r, rnd, n) {
    var i, a, rr, x, y;
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      a = i / n * TAU; rr = r * (.76 + rnd() * .46);
      x = Math.cos(a) * rr; y = Math.sin(a) * rr * .78;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  /* Schokostueck: flach, halb im Teig, mit Teigwulst an der Unterkante */
  function chunk(ctx, rnd, x, y, r, C) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - .5) * .9);
    ctx.fillStyle = "rgba(26,13,4,.42)";
    ctx.beginPath(); ctx.ellipse(2, r * .34, r * 1.04, r * .5, 0, 0, TAU); ctx.fill();
    var g = ctx.createLinearGradient(-r, -r * .7, r, r * .7);
    g.addColorStop(0, light(C.a, .22)); g.addColorStop(.5, C.a); g.addColorStop(1, C.b);
    ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = r * .3; ctx.lineJoin = "round";
    blob(ctx, r * .84, rnd, 6); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = .45; ctx.fillStyle = C.hi;
    ctx.beginPath(); ctx.ellipse(-r * .26, -r * .3, r * .38, r * .13, -.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
  }

  function berry(ctx, rnd, x, y, r, C, sunk) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(26,13,4,.34)";
    ctx.beginPath(); ctx.ellipse(2, r * .38, r * 1.02, r * .5, 0, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(-r * .34, -r * .40, r * .06, 0, 0, r * 1.2);
    g.addColorStop(0, light(C.a, .26)); g.addColorStop(.48, C.a); g.addColorStop(1, C.b);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (sunk ? .5 : .84), (rnd() - .5) * .5, 0, TAU); ctx.fill();
    ctx.globalAlpha = .18; ctx.fillStyle = "#d3d8f0";
    ctx.beginPath(); ctx.ellipse(r * .16, r * .1, r * .7, r * .4, .35, 0, TAU); ctx.fill();
    if (!sunk) {
      ctx.globalAlpha = .55; ctx.fillStyle = C.b;
      ctx.beginPath(); ctx.arc(r * .04, -r * .04, r * .17, 0, TAU); ctx.fill();
      ctx.globalAlpha = .7; ctx.fillStyle = C.hi;
      ctx.beginPath(); ctx.ellipse(-r * .36, -r * .40, r * .2, r * .11, -.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  function drawTopping(ctx, V, rnd, rise, brown, I) {
    var G = GEO, d = I.d, i, x, y, r, a, rr;

    if (V.kind === "chips") {
      ctx.save(); domePath(ctx, I.L, rise); ctx.clip();
      for (i = 0; i < V.chip.n; i++) {
        a = Math.PI - rnd() * Math.PI; rr = Math.sqrt(rnd());
        x = 500 + Math.cos(a) * d.rx * .92 * rr;
        y = G.baseY - Math.abs(Math.sin(a)) * d.ry * .94 * rr + 12;
        chunk(ctx, rnd, x, y, 11 + rnd() * 12, V.chip);
      }
      ctx.restore();

    } else if (V.kind === "berries") {
      ctx.save(); domePath(ctx, I.L, rise); ctx.clip();
      for (i = 0; i < V.berry.n; i++) {
        a = Math.PI - rnd() * Math.PI; rr = Math.sqrt(rnd());
        x = 500 + Math.cos(a) * d.rx * .86 * rr;
        y = G.baseY - Math.abs(Math.sin(a)) * d.ry * .90 * rr + 14;
        r = 16 + rnd() * 11;
        var sunk = rnd() > .4;
        ctx.globalAlpha = sunk ? .26 : .14; ctx.fillStyle = V.berry.bleed;
        ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 1.5, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        berry(ctx, rnd, x, y, r, V.berry, sunk);
      }
      ctx.restore();

    } else if (V.kind === "glaze") {
      ctx.save(); domePath(ctx, I.L, rise); ctx.clip();
      ctx.fillStyle = "#2f2f3d";
      for (i = 0; i < V.poppy; i++) {
        x = 500 + (rnd() * 2 - 1) * d.rx * .96;
        y = G.baseY + 26 - rnd() * d.ry * 1.08;
        ctx.globalAlpha = .45 + rnd() * .5;
        ctx.beginPath(); ctx.ellipse(x, y, 2.4 + rnd() * 2, 1.6 + rnd() * 1.3, rnd() * 3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (rise > .75) {
        var yl = G.baseY - d.ry * .46;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(1000, 0); ctx.lineTo(1000, yl);
        for (i = 40; i >= 0; i--) {
          var t = i / 40;
          var dx = t * 1000;
          var s = Math.sin(t * 22 + 1.1);
          var drip = Math.max(0, Math.sin(t * 9.4 + .6));
          ctx.lineTo(dx, yl + s * 14 + drip * drip * drip * 96);
        }
        ctx.lineTo(0, yl); ctx.closePath();
        var gg = ctx.createLinearGradient(0, yl - d.ry * .7, 0, yl + 110);
        gg.addColorStop(0, "#ffffff"); gg.addColorStop(.5, V.glaze); gg.addColorStop(1, "#eadfc4");
        ctx.fillStyle = gg; ctx.fill();
        ctx.globalAlpha = .55; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(500 - d.rx * .46, yl - d.ry * .30);
        ctx.quadraticCurveTo(500 - d.rx * .06, yl - d.ry * .58, 500 + d.rx * .3, yl - d.ry * .34);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.restore();

    } else if (V.kind === "streusel") {
      var tones = [V.streusel.a, V.streusel.b, V.streusel.c];
      var n = Math.round(V.streusel.n * (rise > .5 ? 1.2 : .3));
      for (i = 0; i < n; i++) {
        a = Math.PI - rnd() * Math.PI; rr = Math.pow(rnd(), .6);
        x = 500 + Math.cos(a) * d.rx * .94 * rr;
        y = G.baseY - Math.abs(Math.sin(a)) * d.ry * .98 * rr - 4;
        r = 7 + rnd() * 9;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
        ctx.fillStyle = "rgba(56,34,12,.42)";
        ctx.save(); ctx.translate(2.5, 3.5); blob(ctx, r * .98, rnd, 6); ctx.fill(); ctx.restore();
        var tone = tones[i % 3];
        var sg = ctx.createLinearGradient(-r, -r, r, r);
        sg.addColorStop(0, light(tone, .34)); sg.addColorStop(.6, tone); sg.addColorStop(1, dark(tone, .22));
        ctx.fillStyle = sg; blob(ctx, r, rnd, 6); ctx.fill();
        ctx.restore();
      }

    } else if (V.kind === "frost" && rise > .75) {
      var cy = G.baseY - d.ry * .70;
      ctx.save();
      ctx.fillStyle = "rgba(58,38,18,.30)";
      ctx.beginPath(); ctx.ellipse(500, cy + d.ry * .46, d.rx * .84, d.ry * .26, 0, 0, TAU); ctx.fill();
      /* Grundhaube */
      var fg = ctx.createRadialGradient(500 - d.rx * .28, cy - d.ry * .22, d.rx * .06, 500, cy + d.ry * .1, d.rx * .95);
      fg.addColorStop(0, "#ffffff"); fg.addColorStop(.55, V.frost); fg.addColorStop(1, "#ded2b8");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.ellipse(500, cy + d.ry * .16, d.rx * .84, d.ry * .52, 0, 0, TAU); ctx.fill();
      /* Spritzwuelste am Rand */
      for (i = 0; i < 11; i++) {
        var pa = Math.PI + i / 10 * Math.PI;
        var px = 500 + Math.cos(pa) * d.rx * .76;
        var py = cy + d.ry * .18 + Math.sin(pa) * d.ry * .42;
        var pr = d.rx * .15;
        var pg = ctx.createRadialGradient(px - pr * .3, py - pr * .4, pr * .1, px, py, pr);
        pg.addColorStop(0, "#ffffff"); pg.addColorStop(.6, V.frost); pg.addColorStop(1, "#e2d6bd");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(px, py, pr, pr * .82, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = .5; ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(500 - d.rx * .24, cy - d.ry * .08, d.rx * .3, d.ry * .13, -.25, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      /* Walnusshaelfte */
      ctx.translate(500 + d.rx * .04, cy - d.ry * .12); ctx.rotate(-.2);
      ctx.fillStyle = "rgba(50,32,14,.35)";
      ctx.beginPath(); ctx.ellipse(3, 8, 48, 32, 0, 0, TAU); ctx.fill();
      var wg = ctx.createLinearGradient(-48, -32, 48, 32);
      wg.addColorStop(0, "#dcb689"); wg.addColorStop(.5, "#bb8d59"); wg.addColorStop(1, "#8b6237");
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.ellipse(0, 0, 48, 32, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(96,62,29,.7)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      for (i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 15, -27);
        ctx.quadraticCurveTo(i * 21 + 7, 0, i * 14, 27); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ==========================================================================
     Ein Muffin auf ein Canvas
     ========================================================================== */
  function paintMuffin(cv, key, size, opts) {
    var V = VARIANTS[key];
    if (!V || !cv) return;
    opts = opts || {};
    var rise = opts.rise == null ? 1 : opts.rise;
    var brown = opts.brown == null ? 1 : opts.brown;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var px = Math.max(64, Math.round(size * dpr));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    var ctx = cv.getContext("2d");
    ctx.setTransform(px / 1000, 0, 0, px / 1000, 0, 0);
    ctx.clearRect(0, 0, 1000, 1000);
    var rnd = mulberry32(V.seed + (opts.jitter || 0) * 977);
    shadowUnder(ctx, 180 + 150 * rise);
    drawLiner(ctx, V);
    var info = drawDome(ctx, V, rnd, rise, brown);
    drawTopping(ctx, V, rnd, rise, brown, info);
  }

  /* ==========================================================================
     Inhalte aufbauen
     ========================================================================== */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var ZUTATEN = [
    ["Mehl Type 405", "trocken", "250 g"],
    ["Zucker", "trocken", "100 g"],
    ["Backpulver", "trocken", "2 TL"],
    ["Salz", "trocken", "1 Prise"],
    ["Eier, Größe M", "nass", "2 Stück"],
    ["Milch", "nass", "200 ml"],
    ["Butter, flüssig", "nass", "80 g"],
    ["Vanille", "nass", "1 TL"]
  ];

  var MULDEN = [
    ["01", "schoko", "Schokolade", "24 mm", "20 min", "Riss quer über die Mitte"],
    ["02", "blaubeere", "Blaubeere", "21 mm", "19 min", "zwei Beeren durchgebrochen"],
    ["03", "zitrone", "Zitrone & Mohn", "22 mm", "18 min", "Guss noch feucht"],
    ["04", "streusel", "Apfel & Streusel", "19 mm", "22 min", "Decke hält, nichts abgerutscht"],
    ["05", "karotte", "Karotte", "23 mm", "20 min", "Haube erst nach dem Auskühlen"],
    ["06", "schoko", "Schokolade", "26 mm", "20 min", "höchste Kuppel im Blech"],
    ["07", "blaubeere", "Blaubeere", "17 mm", "19 min", "zu voll gefüllt, übergelaufen"],
    ["08", "streusel", "Apfel & Streusel", "20 mm", "22 min", "Randmulde, eine Minute länger"]
  ];

  var STUFEN = [
    { min: 0, temp: "200 °C", rise: .05, brown: 0, dome: "0 mm", core: "21 °C", state: "flüssig",
      name: "Teig eingefüllt", desc: "Die Mulden sind zu zwei Dritteln gefüllt, die Oberfläche ist noch nass und glänzt. Jetzt nichts mehr glattstreichen." },
    { min: 4, temp: "200 °C", rise: .22, brown: .05, dome: "3 mm", core: "48 °C", state: "Rand stockt",
      name: "Der Rand setzt", desc: "Von außen nach innen wird der Teig fest. In der Mitte ist er noch flüssig — deshalb kann die Kuppel dort später überhaupt erst hoch." },
    { min: 8, temp: "200 → 175 °C", rise: .58, brown: .16, dome: "14 mm", core: "72 °C", state: "steigt",
      name: "Ofentrieb", desc: "Das Backpulver gibt sein Kohlendioxid ab, der Dampf dehnt sich aus, die Kuppel schießt hoch. Jetzt die Temperatur zurücknehmen." },
    { min: 12, temp: "175 °C", rise: .80, brown: .38, dome: "20 mm", core: "86 °C", state: "reißt auf",
      name: "Der Riss öffnet", desc: "Die Kruste ist bereits fest, der Teig darunter drückt weiter nach — sie reißt auf. Genau diese Bruchkante will man sehen." },
    { min: 16, temp: "175 °C", rise: .92, brown: .66, dome: "23 mm", core: "93 °C", state: "bräunt",
      name: "Bräunung", desc: "Maillard-Reaktion: Zucker und Eiweiß reagieren miteinander, die Kuppel färbt von blass nach gold und fängt an zu duften." },
    { min: 19, temp: "175 °C", rise: .98, brown: .88, dome: "24 mm", core: "95 °C", state: "fast fertig",
      name: "Goldbraun", desc: "Die Stäbchenprobe holt noch feuchte Krümel heraus. Nassen Teig am Holz heißt: zwei Minuten weiter." },
    { min: 22, temp: "175 °C", rise: 1, brown: 1, dome: "24 mm", core: "96 °C", state: "durchgebacken",
      name: "Fertig", desc: "Kerntemperatur erreicht. Fünf Minuten im Blech ruhen lassen, dann sofort aufs Gitter — sonst weicht der Boden durch." }
  ];

  var MQ = [
    ["Ofentrieb", "zwei Drittel füllen", "zehn Sekunden rühren", "200 dann 175 Grad"],
    ["von links", "von rechts", "nach unten", "und quer durchs Blech"]
  ];

  /* Ring ------------------------------------------------------------------ */
  var ringTurn = $("#ringTurn");
  (function () {
    if (!ringTurn) return;
    var h = "";
    for (var i = 0; i < ZUTATEN.length; i++) {
      var z = ZUTATEN[i];
      h += '<div class="card" style="transform:rotateY(' + (i * 45) + 'deg) translateZ(250px)">' +
           '<b>' + z[0] + '</b><i>' + z[1] + '</i><em>' + z[2] + '</em></div>';
    }
    ringTurn.innerHTML = h;
  })();

  /* Blech ----------------------------------------------------------------- */
  var trayTrack = $("#trayTrack");
  (function () {
    if (!trayTrack) return;
    var h = "";
    for (var i = 0; i < MULDEN.length; i++) {
      var m = MULDEN[i];
      h += '<article class="well" data-tilt>' +
           '<canvas class="mf" data-muffin="' + m[1] + '" data-size="300" data-jitter="' + (i + 1) +
           '" role="img" aria-label="' + m[2] + '-Muffin, Mulde ' + m[0] + '"></canvas>' +
           '<div class="well-plate">' +
           '<p class="well-no">Mulde ' + m[0] + '</p>' +
           '<p class="well-name">' + m[2] + '</p>' +
           '<dl class="well-d">' +
           '<div><dt>Kuppel</dt><dd>' + m[3] + '</dd></div>' +
           '<div><dt>Backzeit</dt><dd>' + m[4] + '</dd></div>' +
           '</dl><p class="well-note">' + m[5] + '</p></div></article>';
    }
    trayTrack.innerHTML = h;
  })();

  /* Ofenfenster ----------------------------------------------------------- */
  var ovenWindow = $("#ovenWindow"), ovenScale = $("#ovenScale");
  (function () {
    if (!ovenWindow) return;
    var h = "", s = "";
    for (var i = 0; i < STUFEN.length; i++) {
      h += '<canvas class="mf" data-oven="' + i + '" aria-hidden="true"></canvas>';
      s += "<i></i>";
    }
    ovenWindow.innerHTML = h;
    if (ovenScale) ovenScale.innerHTML = s;
  })();
  var ovenCanvases = $$("#ovenWindow canvas");
  var ovenBars = $$("#ovenScale i");
  var oMin = $("#ovenMin"), oTemp = $("#ovenTemp"), oName = $("#ovenName"),
      oDesc = $("#ovenDesc"), oDome = $("#ovenDome"), oCore = $("#ovenCore"), oState = $("#ovenState");

  /* Mehlstaub im Kopfbereich ---------------------------------------------- */
  (function () {
    var dust = $("#dust");
    if (!dust) return;
    var h = "", rnd = mulberry32(4242);
    for (var i = 0; i < 20; i++) {
      h += '<i style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (55 + rnd() * 45).toFixed(1) +
           '%;animation-duration:' + (5 + rnd() * 7).toFixed(1) + 's;animation-delay:' +
           (-rnd() * 10).toFixed(1) + 's;width:' + (2 + rnd() * 4).toFixed(1) + 'px;height:' +
           (2 + rnd() * 4).toFixed(1) + 'px"></i>';
    }
    dust.innerHTML = h;
  })();

  /* Laufschrift ----------------------------------------------------------- */
  var mqs = $$(".mq-inner");
  function buildMarquee() {
    for (var m = 0; m < mqs.length; m++) {
      var el = mqs[m], words = MQ[m] || MQ[0], unit = "", w;
      for (w = 0; w < words.length; w++) unit += "<span>" + words[w] + "<b></b></span>";
      el.innerHTML = unit;
      var unitW = el.scrollWidth || 700;
      var reps = Math.max(2, Math.ceil((window.innerWidth * 1.6) / unitW)), all = "";
      for (var k = 0; k < reps; k++) all += unit;
      el.innerHTML = all + all;
      el.dataset.half = String(el.scrollWidth / 2);
    }
  }

  /* ==========================================================================
     Muffins malen, sobald sie in die Nähe kommen
     ========================================================================== */
  function paintEl(cv) {
    if (cv.dataset.done) return;
    cv.dataset.done = "1";
    paintMuffin(cv, cv.dataset.muffin, +cv.dataset.size || 380, { jitter: +cv.dataset.jitter || 0 });
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      if (es[i].isIntersecting) { paintEl(es[i].target); io.unobserve(es[i].target); }
    }
  }, { rootMargin: "600px 0px" }) : null;

  function registerMuffins() {
    var list = $$("canvas.mf[data-muffin]");
    for (var i = 0; i < list.length; i++) {
      if (io) io.observe(list[i]); else paintEl(list[i]);
    }
  }

  var ovenPainted = false;
  function paintOven() {
    if (ovenPainted || !ovenCanvases.length) return;
    ovenPainted = true;
    for (var i = 0; i < ovenCanvases.length; i++) {
      paintMuffin(ovenCanvases[i], "blaubeere", 400, { rise: STUFEN[i].rise, brown: STUFEN[i].brown });
    }
  }

  /* ==========================================================================
     Messen
     ========================================================================== */
  var vh = window.innerHeight, vw = window.innerWidth, trayMax = 0, wells = [];

  function measure() {
    vh = window.innerHeight; vw = window.innerWidth;
    if (trayTrack) {
      trayTrack.style.transform = "none";
      trayMax = Math.max(0, trayTrack.offsetWidth - vw);
      wells = $$("#trayTrack .well").map(function (el) {
        return { el: el, cx: el.offsetLeft + el.offsetWidth / 2 };
      });
    }
    buildMarquee();
  }
  var rt = null;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); paintMarble(); }, 200);
  }, { passive: true });

  function progThrough(el) {
    var r = el.getBoundingClientRect();
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }
  function progPinned(el) {
    var r = el.getBoundingClientRect(), span = r.height - vh;
    return span <= 0 ? 0 : clamp(-r.top / span, 0, 1);
  }
  function visible(el, pad) {
    var r = el.getBoundingClientRect();
    return r.bottom > -(pad || 0) && r.top < vh + (pad || 0);
  }

  /* ==========================================================================
     Schleife
     ========================================================================== */
  var railFill = $("#railFill"), railRider = $("#railRider");
  var heroEl = $("#hero"), heroMf = $("#heroMf");
  var teig = $("#teig"), sorten = $("#sorten"), blech = $("#blech"), ofen = $("#ofen");
  var swoops = $$("[data-swoop]");
  var lastY = window.scrollY, vel = 0, I = 1, calm = false, turbo = false;
  var mqOff = [0, 0], lastStage = -1;
  var tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0;

  if (heroEl) {
    heroEl.addEventListener("pointermove", function (e) {
      var r = heroEl.getBoundingClientRect();
      tiltTX = ((e.clientX - r.left) / r.width - .5) * 2;
      tiltTY = ((e.clientY - r.top) / r.height - .5) * 2;
    }, { passive: true });
    heroEl.addEventListener("pointerleave", function () { tiltTX = 0; tiltTY = 0; }, { passive: true });
  }

  function frame() {
    var y = window.scrollY;
    var raw = clamp(y - lastY, -120, 120);
    lastY = y;
    vel = lerp(vel, raw, .16);
    if (Math.abs(vel) < .02) vel = 0;
    var av = Math.abs(vel);
    root.style.setProperty("--vel", vel.toFixed(2));
    root.style.setProperty("--avel", av.toFixed(2));

    var docH = document.documentElement.scrollHeight - vh;
    var gp = docH > 0 ? clamp(y / docH, 0, 1) : 0;
    if (railFill) railFill.style.width = (gp * 100).toFixed(2) + "%";
    if (railRider) railRider.style.transform = "translateX(" + (gp * vw).toFixed(1) + "px) translateX(-50%)";

    /* Kopfbereich */
    tiltX = lerp(tiltX, tiltTX, .08); tiltY = lerp(tiltY, tiltTY, .08);
    if (heroMf && visible(heroEl, 200)) {
      heroMf.style.transform =
        "rotateY(" + (tiltX * 17).toFixed(2) + "deg)" +
        "rotateX(" + (-tiltY * 12).toFixed(2) + "deg)" +
        "rotate(" + (Math.sin(y * .004) * 4 * I).toFixed(2) + "deg)" +
        "translateY(" + (y * .06 * I).toFixed(1) + "px)" +
        "scale(" + (1 - Math.min(y / 3200, .2)).toFixed(3) + ")";
    }

    /* Laufschrift */
    for (var m = 0; m < mqs.length; m++) {
      var el = mqs[m];
      var dir = parseFloat(el.dataset.dir) || 1, half = parseFloat(el.dataset.half) || 1;
      mqOff[m] += (.5 + av * .5 * I) * dir + vel * .85 * I * dir;
      var o = ((mqOff[m] % half) + half) % half;
      el.style.transform = "translate3d(" + (-o).toFixed(1) + "px,0,0)";
    }

    /* 01 · Zutatenring */
    if (teig && ringTurn && visible(teig, 0)) {
      var tp = progPinned(teig);
      ringTurn.style.transform =
        "rotateX(-9deg) rotateY(" + (-tp * 360 - vel * 1.1 * I).toFixed(2) + "deg)";
    }

    /* 02 · von links, von rechts */
    for (var s = 0; s < swoops.length; s++) {
      var p2 = swoops[s];
      if (!visible(p2, 280)) continue;
      var p = progThrough(p2);
      var side = p2.dataset.swoop === "left" ? -1 : 1;
      var inN = smooth(.02, .44, p), outN = smooth(.60, 1, p);
      var x = side * (1 - inN) * 58 - side * outN * 38;
      var ry = side * (1 - inN) * 52 - side * outN * 36;
      var rz = side * (1 - inN) * 7 - side * outN * 5;
      var z = (1 - inN) * -400 - outN * 260;
      p2.style.transform =
        "translate3d(" + (x * I).toFixed(2) + "vw,0," + (z * I).toFixed(0) + "px)" +
        "rotateY(" + (ry * I).toFixed(2) + "deg)" +
        "rotate(" + (rz * I).toFixed(2) + "deg)" +
        "skewY(" + (vel * .038 * I).toFixed(2) + "deg)";
    }

    /* 03 · Blech fährt quer */
    if (blech && visible(blech, 0)) {
      var bp = progPinned(blech);
      var tx = -trayMax * bp;
      if (trayTrack) trayTrack.style.transform = "translate3d(" + tx.toFixed(1) + "px,0,0)";
      for (var b = 0; b < wells.length; b++) {
        var wl = wells[b], dd = (wl.cx + tx - vw / 2) / vw;
        wl.el.style.transform =
          "rotateY(" + (-dd * 38 * I).toFixed(2) + "deg)" +
          "translateZ(" + (-Math.abs(dd) * 170 * I).toFixed(0) + "px)" +
          "rotate(" + (dd * 2.6 * I).toFixed(2) + "deg)";
      }
    }

    /* 04 · Ofen */
    if (ofen && visible(ofen, 200)) {
      paintOven();
      var op = progPinned(ofen);
      var fi = op * (STUFEN.length - 1);
      for (var k = 0; k < ovenCanvases.length; k++) {
        ovenCanvases[k].style.opacity = Math.max(0, 1 - Math.abs(k - fi)).toFixed(3);
      }
      var st = clamp(Math.round(fi), 0, STUFEN.length - 1);
      if (st !== lastStage) {
        lastStage = st;
        var S = STUFEN[st];
        if (oMin) oMin.textContent = String(S.min);
        if (oTemp) oTemp.textContent = S.temp;
        if (oName) oName.textContent = S.name;
        if (oDesc) oDesc.textContent = S.desc;
        if (oDome) oDome.textContent = S.dome;
        if (oCore) oCore.textContent = S.core;
        if (oState) oState.textContent = S.state;
        for (var q = 0; q < ovenBars.length; q++) ovenBars[q].classList.toggle("on", q === st);
      }
    }

    requestAnimationFrame(frame);
  }

  /* ==========================================================================
     Bedienung
     ========================================================================== */
  var btnTurbo = $("#turbo"), btnRuhe = $("#ruhe");
  function applyMode() {
    I = calm ? .16 : (turbo ? 2.1 : 1);
    root.style.setProperty("--I", String(I));
    body.classList.toggle("calm", calm);
    body.classList.toggle("turbo", turbo && !calm);
    if (btnTurbo) btnTurbo.setAttribute("aria-pressed", String(turbo && !calm));
    if (btnRuhe) btnRuhe.setAttribute("aria-pressed", String(calm));
  }
  if (btnTurbo) btnTurbo.addEventListener("click", function () { turbo = !turbo; if (turbo) calm = false; applyMode(); });
  if (btnRuhe) btnRuhe.addEventListener("click", function () { calm = !calm; if (calm) turbo = false; applyMode(); });

  /* Krümel ---------------------------------------------------------------- */
  var CRUMB = ["#8d5623", "#6b3c14", "#c99458", "#431f07", "#a4622c"];
  function burst(x, y, n) {
    if (calm) return;
    for (var i = 0; i < n; i++) {
      var el = document.createElement("div");
      el.className = "crumb";
      var sz = 4 + Math.random() * 13;
      el.style.cssText = "left:" + (x - sz / 2) + "px;top:" + (y - sz / 2) + "px;width:" + sz +
        "px;height:" + sz * (.6 + Math.random() * .6) + "px;background:" + CRUMB[i % CRUMB.length];
      document.body.appendChild(el);
      var a = (i / n) * TAU + Math.random() * .6;
      var dist = 90 + Math.random() * 230 * I;
      var dx = Math.cos(a) * dist, dy = Math.sin(a) * dist - 110;
      var anim = el.animate([
        { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1 },
        { transform: "translate3d(" + dx.toFixed(0) + "px," + dy.toFixed(0) + "px,0) rotate(" +
          (Math.random() * 540 - 270).toFixed(0) + "deg)", opacity: 1, offset: .42 },
        { transform: "translate3d(" + (dx * 1.2).toFixed(0) + "px," + (dy + 480).toFixed(0) +
          "px,0) rotate(" + (Math.random() * 800 - 400).toFixed(0) + "deg)", opacity: 0 }
      ], { duration: 900 + Math.random() * 700, easing: "cubic-bezier(.2,.72,.35,1)" });
      anim.onfinish = (function (node) { return function () { node.remove(); }; })(el);
    }
  }
  var bigBtn = $("#bigBtn");
  if (bigBtn) bigBtn.addEventListener("click", function (e) {
    var r = bigBtn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * .45, 26);
    e.preventDefault();
  });
  var heroStage = $("#heroStage");
  if (heroStage) heroStage.addEventListener("click", function (e) { burst(e.clientX, e.clientY, 14); });

  /* ==========================================================================
     Start
     ========================================================================== */
  paintMarble();
  registerMuffins();
  measure();
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  applyMode();
  requestAnimationFrame(frame);
})();
