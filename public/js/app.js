(function () {
  "use strict";

  /* ──────────────────── CONFIG ──────────────────── */
  var API = "/api";
  var STORAGE = {
    SESSION: "re_v12_session",
    LABEL_TEMPLATES: "re_v12_label_templates",
    THEME: "re_v12_theme",
    STORE_CONFIG: "re_v12_store_config",
    PRODUCT_MAP: "re_v12_product_map",
    PRODUCT_SCALES: "re_v12_product_scales",
  };

  /* Default 3D store layout config */
  var DEFAULT_STORE_CONFIG = {
    numAisles: 2,
    unitsPerAisle: 3,
    shelfLevels: 5,
    unitWidth: 1.5,
    unitHeight: 3.0,
    aisleGap: 8,
    unitSpacing: 2.2,
    unitOverrides: {},
  };

  function loadStoreConfig() {
    try {
      var raw = localStorage.getItem(STORAGE.STORE_CONFIG);
      return raw ? Object.assign({}, DEFAULT_STORE_CONFIG, JSON.parse(raw)) : Object.assign({}, DEFAULT_STORE_CONFIG);
    } catch(e) { return Object.assign({}, DEFAULT_STORE_CONFIG); }
  }

  function saveStoreConfig(cfg) {
    localStorage.setItem(STORAGE.STORE_CONFIG, JSON.stringify(cfg));
  }

  function loadProductMap() {
    try {
      var raw = localStorage.getItem(STORAGE.PRODUCT_MAP);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveProductMap(map) {
    localStorage.setItem(STORAGE.PRODUCT_MAP, JSON.stringify(map));
  }

  function loadProductScales() {
    try { var raw = localStorage.getItem(STORAGE.PRODUCT_SCALES); return raw ? JSON.parse(raw) : {}; }
    catch(e) { return {}; }
  }
  function saveProductScales(s) { localStorage.setItem(STORAGE.PRODUCT_SCALES, JSON.stringify(s)); }

  /* ──────────────────── STATE ──────────────────── */
  var state = {
    products: [],
    audit: [],
    pendingManagers: [],
    inviteCode: "—",
    session: null,
  };

  var PAGE_FORMATS = {
    shelf: { w: 90, h: 55, className: "format-shelf" },
    a5:    { w: 148, h: 210, className: "format-a5" },
    a4:    { w: 210, h: 297, className: "format-a4" },
  };

  var designState = { selectedId: null };
  var TORCH_IDLE_MS = 10000;
  var LENS_CHECK_MS = 10000;
  var html5QrCode = null;
  var torchOn = false;
  var torchIdleTimer = null;
  var lensTimer = null;
  var scannerRunning = false;
  var availableCameras = [];
  var currentCamIndex = 0;
  var store3dInit = false;
  var store3dAutoRotate = true;
  var store3dAnimId = null;
  var store3dShelfGroups = {};       // { unitId: THREE.Group }
  var store3dShelfMeta = {};         // { unitId: { defaultX, defaultZ } }
  var store3dEditShelfMode = false;
  var store3dSelectedShelfId = null;
  var store3dProductScales = loadProductScales();
  var store3dSelectedProductMesh = null;

  /* ──────────────────── HELPERS ──────────────────── */
  function nowIso() { return new Date().toISOString(); }

  function finalPrice(base, discountPct) {
    var b = Number(base) || 0;
    var d = Math.min(100, Math.max(0, Number(discountPct) || 0));
    return Math.round(b * (1 - d / 100) * 100) / 100;
  }

  function isExpired(validUntil) {
    if (!validUntil) return false;
    return new Date(validUntil + "T23:59:59") < new Date();
  }

  function hasDiscount(p) { return (Number(p.discount_pct) || 0) > 0; }

  function formatMoney(n) { return (Number(n) || 0).toFixed(2) + " RON"; }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

  function toHexColor(c) {
    if (!c || c === "none") return "#000000";
    if (c[0] === "#" && c.length >= 7) return c.slice(0, 7);
    var ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = c;
    var s = ctx.fillStyle;
    return (typeof s === "string" && s[0] === "#") ? s.slice(0, 7) : "#000000";
  }

  function rectFillToColor(fill) {
    return (!fill || fill === "none") ? "#ffffff" : toHexColor(fill);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ──────────────────── THEME ──────────────────── */
  var currentTheme = localStorage.getItem(STORAGE.THEME) || "industrial";

  var THEMES = ["industrial", "retro", "christmas", "techno"];
  var THEME_META = { industrial:"#0d1117", retro:"#1a0a00", christmas:"#05100a", techno:"#06000f" };
  var THEME_LABELS = { industrial:"🏗 Industrial", retro:"👾 Retro", christmas:"🎄 Crăciun", techno:"⚡ Techno" };

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE.THEME, theme);
    var meta = document.querySelector("meta[name='theme-color']");
    if (meta) meta.setAttribute("content", THEME_META[theme] || "#0d1117");
    var nextIdx = (THEMES.indexOf(theme) + 1) % THEMES.length;
    var nextLabel = THEME_LABELS[THEMES[nextIdx]] || "Temă";
    ["btn-theme-auth","btn-theme-main"].forEach(function(id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.title = "Temă: " + THEME_LABELS[theme] + " → " + nextLabel;
      btn.setAttribute("data-theme-label", THEME_LABELS[theme]);
    });
    if (typeof store3dInit !== "undefined" && store3dInit) update3DTheme();
  }

  function toggleTheme() {
    var idx = THEMES.indexOf(currentTheme);
    var next = THEMES[(idx + 1) % THEMES.length];
    document.body.style.transition = "filter 0.3s";
    document.body.style.filter = "brightness(1.6)";
    setTimeout(function() {
      applyTheme(next);
      document.body.style.filter = "";
    }, 150);
  }

  applyTheme(currentTheme);

  var _btnThemeAuth = document.getElementById("btn-theme-auth");
  if (_btnThemeAuth) _btnThemeAuth.addEventListener("click", toggleTheme);
  var _btnThemeMain = document.getElementById("btn-theme-main");
  if (_btnThemeMain) _btnThemeMain.addEventListener("click", toggleTheme);

  /* ──────────────────── TECHNO BACKGROUND ──────────────────── */
  (function initTechnoBg() {
    var canvas = document.getElementById("techno-bg");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var nodes = [];
    var W, H;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function rand(min, max) { return min + Math.random() * (max - min); }

    function createNodes() {
      nodes = [];
      var count = Math.floor((W * H) / 14000);
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: rand(0, W), y: rand(0, H),
          vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15),
          r: rand(1.2, 2.8),
          pulse: rand(0, Math.PI * 2),
          pulseSpeed: rand(0.01, 0.03),
        });
      }
    }

    function draw() {
      if (currentTheme !== "techno") {
        requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, W, H);

      // Update nodes
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pulseSpeed;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      // Draw connections
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x;
          var dy = nodes[i].y - nodes[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            var alpha = (1 - dist / 140) * 0.18;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = "rgba(168,85,247," + alpha + ")";
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var pulse = (Math.sin(n.pulse) + 1) / 2;
        var alpha = 0.3 + pulse * 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(168,85,247," + alpha + ")";
        ctx.fill();
        // Pulse ring
        if (pulse > 0.85) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 4 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(168,85,247," + (0.08 * pulse) + ")";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Occasional diagonal streaks
      if (Math.random() < 0.008) {
        var sx = rand(0, W), sy = rand(0, H);
        var len = rand(60, 180);
        var angle = rand(-0.5, 0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
        ctx.strokeStyle = "rgba(168,85,247,0.12)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function() {
      resize();
      createNodes();
    });

    resize();
    createNodes();
    draw();
  })();

  /* ──────────────────── INDUSTRIAL BACKGROUND ──────────────────── */
  (function initIndustrialBg() {
    var canvas = document.getElementById("industrial-bg");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"); if (!ctx) return;
    var W, H, t = 0, workers = [], truck = { x:-220, active:false, timer:180 };
    function resize() {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
      workers = [
        { x:W*0.22, dir:1, phase:0, speed:0.42, type:"cart" },
        { x:W*0.55, dir:-1, phase:1.6, speed:0.30, type:"box" },
        { x:W*0.72, dir:1, phase:0.8, speed:0.28, type:"flower" },
      ];
    }
    function drawSky() {
      var g=ctx.createLinearGradient(0,0,0,H*0.65);
      g.addColorStop(0,"#5ba3d9"); g.addColorStop(1,"#c8e8f8");
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H*0.65);
    }
    function drawClouds() {
      ctx.fillStyle="rgba(255,255,255,0.88)";
      [{x:W*0.12,y:H*0.07},{x:W*0.48,y:H*0.04},{x:W*0.82,y:H*0.09}].forEach(function(c) {
        var cx=c.x+Math.sin(t*0.003+c.x)*10;
        [[0,0,28],[22,-9,20],[-22,-7,20],[40,2,16],[-38,2,16]].forEach(function(b){
          ctx.beginPath(); ctx.arc(cx+b[0],c.y+b[1],b[2],0,Math.PI*2); ctx.fill();
        });
      });
    }
    function drawBuilding() {
      var bx=W*0.06,bw=W*0.88,by=H*0.14,bh=H*0.58;
      ctx.fillStyle="#ddd5c0"; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle="#f97316"; ctx.fillRect(bx,by,bw,bh*0.2);
      ctx.fillStyle="#fff8"; ctx.fillRect(bx+bw*0.29,by+bh*0.05,bw*0.42,bh*0.1);
      ctx.fillStyle="#111"; ctx.font="bold "+Math.round(bh*0.075)+"px Rajdhani,sans-serif";
      ctx.textAlign="center"; ctx.fillText("BRICO DÉPÔT",W*0.5,by+bh*0.136);
      ctx.fillStyle="#b9c8d0";
      for (var wi=0;wi<6;wi++) {
        var wx=bx+bw*(0.06+wi*0.155),wy=by+bh*0.28,ww=bw*0.09,wh=bh*0.22;
        ctx.fillRect(wx,wy,ww,wh); ctx.strokeStyle="#aaa"; ctx.lineWidth=1.2;
        ctx.strokeRect(wx,wy,ww,wh);
        ctx.beginPath(); ctx.moveTo(wx+ww/2,wy); ctx.lineTo(wx+ww/2,wy+wh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx,wy+wh/2); ctx.lineTo(wx+ww,wy+wh/2); ctx.stroke();
      }
      ctx.fillStyle="#a8cfe0"; ctx.fillRect(W*0.5-bw*0.09,by+bh*0.56,bw*0.18,bh*0.44);
      ctx.strokeStyle="#777"; ctx.lineWidth=1.5; ctx.strokeRect(W*0.5-bw*0.09,by+bh*0.56,bw*0.18,bh*0.44);
      ctx.beginPath(); ctx.moveTo(W*0.5,by+bh*0.56); ctx.lineTo(W*0.5,by+bh); ctx.stroke();
      ctx.fillStyle="#f97316"; ctx.beginPath();
      ctx.moveTo(W*0.5-bw*0.13,by+bh*0.53); ctx.lineTo(W*0.5+bw*0.13,by+bh*0.53);
      ctx.lineTo(W*0.5+bw*0.16,by+bh*0.6); ctx.lineTo(W*0.5-bw*0.16,by+bh*0.6); ctx.fill();
    }
    function drawGround() {
      ctx.fillStyle="#c5bdb0"; ctx.fillRect(0,H*0.72,W,H*0.28);
      ctx.strokeStyle="#b5ad9e"; ctx.lineWidth=0.8;
      for (var x=0;x<W;x+=56){ctx.beginPath();ctx.moveTo(x,H*0.72);ctx.lineTo(x,H);ctx.stroke();}
      for (var y=H*0.72;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    }
    function drawFlowers() {
      var gy=H*0.72;
      [{x:W*0.20,c:"#ff6b6b"},{x:W*0.23,c:"#ffd93d"},{x:W*0.26,c:"#ff6b6b"},
       {x:W*0.72,c:"#a8e063"},{x:W*0.75,c:"#ff6b6b"},{x:W*0.78,c:"#ffd93d"}].forEach(function(p){
        ctx.fillStyle="#b8652e"; ctx.fillRect(p.x-6,gy-17,12,17);
        var bob=Math.sin(t*0.022+p.x)*3;
        ctx.fillStyle="#2a7a22"; ctx.fillRect(p.x-2,gy-30+bob,4,14);
        ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,gy-33+bob,6,0,Math.PI*2); ctx.fill();
      });
    }
    function drawWorker(w) {
      var gy=H*0.72,lx=w.x,walk=Math.sin(w.phase)*4;
      ctx.fillStyle="rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.ellipse(lx,gy-1,11,3.5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#1e3a5a"; ctx.lineWidth=3; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(lx,gy-13); ctx.lineTo(lx-5+walk,gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx,gy-13); ctx.lineTo(lx+5-walk,gy); ctx.stroke();
      ctx.fillStyle="#f97316"; ctx.fillRect(lx-7,gy-31,14,18);
      ctx.strokeStyle="#f5cba7"; ctx.lineWidth=3;
      if (w.type==="cart") {
        ctx.beginPath(); ctx.moveTo(lx+7*w.dir,gy-27); ctx.lineTo(lx+22*w.dir,gy-20); ctx.stroke();
        ctx.strokeStyle="#555"; ctx.lineWidth=2;
        ctx.strokeRect(lx+(w.dir>0?12:-32),gy-28,20,20);
      } else if (w.type==="box") {
        ctx.beginPath(); ctx.moveTo(lx-7,gy-27); ctx.lineTo(lx-11,gy-40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx+7,gy-27); ctx.lineTo(lx+11,gy-40); ctx.stroke();
        ctx.fillStyle="#8B4513"; ctx.fillRect(lx-13,gy-52,26,14);
      } else {
        ctx.beginPath(); ctx.moveTo(lx+7*w.dir,gy-25); ctx.lineTo(lx+20*w.dir,gy-19); ctx.stroke();
        ctx.fillStyle="#b8652e"; ctx.fillRect(lx+(w.dir>0?14:-24),gy-26,12,12);
      }
      ctx.fillStyle="#f5cba7"; ctx.beginPath(); ctx.arc(lx,gy-37,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ffe000"; ctx.beginPath(); ctx.ellipse(lx,gy-43,9,3.5,0,Math.PI,Math.PI*2); ctx.fill();
      ctx.fillRect(lx-10,gy-43,20,3);
    }
    function drawTruck() {
      if (!truck.active) { if (++truck.timer>450){truck.timer=0;truck.active=true;truck.x=-220;} return; }
      truck.x+=1.4; if (truck.x>W+220){truck.active=false;truck.timer=0;}
      var gy=H*0.72,tx=truck.x,ty=gy-58;
      ctx.fillStyle="#f97316"; ctx.fillRect(tx-165,ty,165,58);
      ctx.fillStyle="#cc5500"; ctx.fillRect(tx,ty+8,62,50);
      ctx.fillStyle="#a8d8f0"; ctx.fillRect(tx+7,ty+13,40,23);
      ctx.fillStyle="#fff"; ctx.font="bold 13px sans-serif"; ctx.textAlign="left";
      ctx.fillText("BRICO DÉPÔT",tx-150,ty+30);
      ctx.fillStyle="#222";
      [tx-120,tx-50,tx+42].forEach(function(wx){
        ctx.beginPath(); ctx.arc(wx,gy-5,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#888"; ctx.beginPath(); ctx.arc(wx,gy-5,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#222";
      });
    }
    function draw() {
      if (currentTheme!=="industrial"){requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,W,H); t++;
      drawSky(); drawClouds(); drawBuilding(); drawGround(); drawFlowers(); drawTruck();
      workers.forEach(function(w){
        w.phase+=0.06*w.speed; w.x+=w.dir*w.speed;
        if (w.x>W*0.9||w.x<W*0.1) w.dir*=-1;
        drawWorker(w);
      });
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize",resize); resize(); draw();
  })();

  /* ──────────────────── RETRO BACKGROUND (Arcade) ──────────────────── */
  (function initRetroBg() {
    var canvas = document.getElementById("retro-bg");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"); if (!ctx) return;
    var W, H, t = 0, machines = [], kids = [];
    function resize() {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
      machines = []; kids = [];
      var count = Math.max(3, Math.min(6, Math.floor(W/175)));
      var colors = ["#ff0066","#00ff88","#00ccff","#ff8800","#ff44cc","#44ffcc"];
      for (var i=0; i<count; i++) {
        machines.push({ x:(i+0.5)*(W/count), color:colors[i%colors.length],
          blink:Math.random()*Math.PI*2, game:i%3 });
      }
      machines.slice(0, Math.min(4, machines.length)).forEach(function(m, i) {
        kids.push({ x:m.x, side:(i%2===0)?-1:1, bounce:i*1.2 });
      });
    }
    function drawRoom() {
      var fl=ctx.createLinearGradient(0,H*0.55,0,H);
      fl.addColorStop(0,"#0d0800"); fl.addColorStop(1,"#1a1200");
      ctx.fillStyle=fl; ctx.fillRect(0,H*0.55,W,H*0.45);
      ctx.strokeStyle="rgba(255,140,0,0.1)"; ctx.lineWidth=1;
      for (var x=0;x<W;x+=55){
        ctx.beginPath(); ctx.moveTo(x,H*0.55); ctx.lineTo(W/2+(x-W/2)*2.8,H); ctx.stroke();
      }
      for (var j=0;j<5;j++){
        var py=H*0.55+(H*0.45)*Math.pow(j/5,1.6);
        ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(W,py); ctx.stroke();
      }
      ctx.fillStyle="#0a0500"; ctx.fillRect(0,0,W,H*0.18);
      ctx.shadowBlur=18; ctx.shadowColor="#ff8800"; ctx.fillStyle="#ff8800";
      ctx.font="bold "+Math.round(H*0.048)+"px 'Share Tech Mono',monospace";
      ctx.textAlign="center"; ctx.fillText("ARCADE",W*0.25,H*0.1);
      ctx.shadowColor="#00ff88"; ctx.fillStyle="#00ff88";
      ctx.fillText("GAME ZONE",W*0.75,H*0.1); ctx.shadowBlur=0;
    }
    function drawMachine(m) {
      var mw=Math.min(90,W*0.1), mh=mw*1.85;
      var mx=m.x-mw/2, my=H*0.55-mh;
      ctx.fillStyle="#111"; ctx.fillRect(mx,my,mw,mh);
      ctx.fillStyle="#1e1e1e"; ctx.fillRect(mx+2,my+2,mw-4,mh-4);
      var blink=(Math.sin(m.blink+t*0.025)+1)/2;
      ctx.shadowBlur=18+blink*14; ctx.shadowColor=m.color;
      var sx=mx+mw*0.1,sy=my+mh*0.1,sw=mw*0.8,sh=mh*0.44;
      ctx.fillStyle="#000"; ctx.fillRect(sx,sy,sw,sh);
      ctx.save(); ctx.beginPath(); ctx.rect(sx,sy,sw,sh); ctx.clip();
      if (m.game===0) {
        // Pong
        ctx.fillStyle="#0f0"; ctx.fillRect(sx+3,sy+sh/2-12+Math.sin(t*0.04)*18,5,24);
        ctx.fillRect(sx+sw-8,sy+sh/2+11-Math.sin(t*0.04)*18,5,24);
        var bx2=sx+sw/2+Math.sin(t*0.07)*sw*0.34, by2=sy+sh/2+Math.cos(t*0.055)*sh*0.36;
        ctx.fillStyle="#fff"; ctx.fillRect(bx2-3,by2-3,6,6);
      } else if (m.game===1) {
        // Space invaders
        ctx.fillStyle=m.color;
        for (var ri=0;ri<3;ri++) for (var ci=0;ci<5;ci++) {
          var ix=sx+10+ci*(sw/5.5)+Math.sin(t*0.03)*6, iy=sy+8+ri*12;
          ctx.fillRect(ix,iy,6,4); ctx.fillRect(ix-2,iy+2,2,2); ctx.fillRect(ix+6,iy+2,2,2);
        }
        ctx.fillStyle="#fff";
        var px2=sx+sw/2+Math.sin(t*0.05)*sw*0.3;
        ctx.fillRect(px2-6,sy+sh-12,12,7); ctx.fillRect(px2-2,sy+sh-16,4,4);
        if (t%55<28){ctx.fillStyle="#ff0";ctx.fillRect(px2-1,sy+sh-16-(t%55)*1.8,2,6);}
      } else {
        // Pacman
        var ang=(Math.sin(t*0.15)*0.25)+0.1;
        var pmx=sx+12+(t%100)*(sw-24)/100;
        ctx.fillStyle="#ffcc00"; ctx.beginPath(); ctx.moveTo(pmx,sy+sh/2);
        ctx.arc(pmx,sy+sh/2,10,ang,Math.PI*2-ang); ctx.fill();
        ctx.fillStyle="#ffcc00";
        for (var di=0;di<5;di++){
          var ddx=sx+sw*(di+1)/6;
          if (ddx>pmx+12){ctx.beginPath();ctx.arc(ddx,sy+sh/2,3,0,Math.PI*2);ctx.fill();}
        }
        var gx=sx+sw-14-Math.sin(t*0.04)*8;
        ctx.fillStyle="#ff88cc"; ctx.beginPath(); ctx.arc(gx,sy+sh/2-2,8,Math.PI,0);
        ctx.lineTo(gx+8,sy+sh/2+7); ctx.lineTo(gx+4,sy+sh/2+4);
        ctx.lineTo(gx,sy+sh/2+7); ctx.lineTo(gx-4,sy+sh/2+4); ctx.lineTo(gx-8,sy+sh/2+7); ctx.fill();
      }
      ctx.restore(); ctx.shadowBlur=0;
      ctx.fillStyle="#2a2a2a"; ctx.fillRect(mx+mw*0.05,my+mh*0.6,mw*0.9,mh*0.14);
      ctx.fillStyle="#555"; ctx.beginPath(); ctx.arc(mx+mw*0.3,my+mh*0.665,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=m.color; ctx.beginPath(); ctx.arc(mx+mw*0.3,my+mh*0.66,4,0,Math.PI*2); ctx.fill();
      ["#ff0044","#ffcc00"].forEach(function(c,bi){
        ctx.fillStyle=c; ctx.beginPath(); ctx.arc(mx+mw*(0.55+bi*0.16),my+mh*0.665,4,0,Math.PI*2); ctx.fill();
      });
      ctx.fillStyle="#666"; ctx.fillRect(mx+mw*0.35,my+mh*0.82,mw*0.3,3);
      ctx.fillStyle=m.color; ctx.fillRect(mx,my,mw,5);
      ctx.fillStyle="rgba(0,0,0,0.22)";
      for (var sl=sy; sl<sy+sh; sl+=3) ctx.fillRect(sx,sl,sw,1);
    }
    function drawKid(k) {
      var gy=H*0.55, bounce=Math.sin(k.bounce+t*0.09)*5;
      var kx=k.x+k.side*28, ky=gy+bounce;
      ctx.fillStyle="rgba(26,8,0,0.92)";
      ctx.beginPath(); ctx.arc(kx,ky-34,10,0,Math.PI*2); ctx.fill();
      ctx.fillRect(kx-9,ky-24,18,22);
      ctx.strokeStyle="rgba(26,8,0,0.92)"; ctx.lineWidth=5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(kx-8,ky-18); ctx.lineTo(kx-20,ky-6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(kx+8,ky-18); ctx.lineTo(kx+20,ky-6); ctx.stroke();
      if (Math.random()<0.018) {
        ctx.fillStyle="#ff8800"; ctx.font="11px sans-serif"; ctx.textAlign="center";
        ctx.fillText(["!","★","♪"][Math.floor(Math.random()*3)],kx+(Math.random()-0.5)*22,ky-52);
      }
    }
    function draw() {
      if (currentTheme!=="retro"){requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,W,H); t++;
      ctx.fillStyle="#0d0800"; ctx.fillRect(0,0,W,H);
      drawRoom();
      machines.forEach(function(m){m.blink+=0.018;drawMachine(m);});
      kids.forEach(function(k){drawKid(k);});
      ctx.fillStyle="rgba(0,0,0,0.042)";
      for (var sl=0;sl<H;sl+=2) ctx.fillRect(0,sl,W,1);
      var vgn=ctx.createRadialGradient(W/2,H/2,H*0.28,W/2,H/2,H*0.78);
      vgn.addColorStop(0,"transparent"); vgn.addColorStop(1,"rgba(0,0,0,0.52)");
      ctx.fillStyle=vgn; ctx.fillRect(0,0,W,H);
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize",resize); resize(); draw();
  })();

  /* ──────────────────── CHRISTMAS BACKGROUND ──────────────────── */
  (function initChristmasBg() {
    var canvas = document.getElementById("christmas-bg");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"); if (!ctx) return;
    var W, H, t = 0, flakes = [], stars = [], lights = [];
    var santa = { x:-320, y:0, active:false, timer:200, speed:2.5 };
    function resize() {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
      santa.y = H*0.12;
      flakes = [];
      for (var i=0; i<Math.floor(W*H/7500); i++)
        flakes.push({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*2.2+0.7,
          vx:(Math.random()-0.5)*0.35, vy:Math.random()*0.85+0.2, op:Math.random()*0.6+0.35 });
      stars = [];
      for (var j=0; j<90; j++)
        stars.push({ x:Math.random()*W, y:Math.random()*H*0.58, r:Math.random()*1.3+0.3,
          ph:Math.random()*Math.PI*2, sp:Math.random()*0.022+0.007 });
      initLights();
    }
    function initLights() {
      lights = [];
      var th=Math.min(H*0.5,420), cx=W/2, baseY=H*0.76, tipY=baseY-th;
      var lc=["#ff2222","#ffd700","#22ff88","#22ccff","#ff88cc","#ff8800"];
      for (var lv=0; lv<8; lv++) {
        var lw=(lv/8)*th*0.5, ly=tipY+th*(lv/8)*0.86+12, lct=Math.floor(lw/18)+2;
        for (var li=0; li<lct; li++)
          lights.push({ x:cx-lw+(li*(lw*2/lct))+Math.random()*7-3.5, y:ly+Math.random()*13,
            color:lc[Math.floor(Math.random()*lc.length)], ph:Math.random()*Math.PI*2 });
      }
    }
    function drawStar5(cx,cy,r) {
      ctx.beginPath();
      for (var i=0;i<10;i++) {
        var a=(i*Math.PI/5)-Math.PI/2, rd=i%2===0?r:r*0.4;
        if (i===0) ctx.moveTo(cx+rd*Math.cos(a),cy+rd*Math.sin(a));
        else ctx.lineTo(cx+rd*Math.cos(a),cy+rd*Math.sin(a));
      }
      ctx.closePath(); ctx.fill();
    }
    function draw() {
      if (currentTheme!=="christmas"){requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,W,H); t++;
      // Sky
      var g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,"#020d06"); g.addColorStop(0.55,"#061a0d"); g.addColorStop(1,"#0d2e18");
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      // Stars
      stars.forEach(function(s){
        s.ph+=s.sp; var al=0.35+Math.sin(s.ph)*0.38;
        ctx.fillStyle="rgba(240,248,210,"+al+")";
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });
      // Moon
      var mx=W*0.83, my=H*0.1, mr=Math.min(W,H)*0.055;
      ctx.shadowBlur=26; ctx.shadowColor="rgba(180,220,255,0.4)";
      ctx.fillStyle="#d8eeff"; ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#c2d8f2"; ctx.beginPath(); ctx.arc(mx+mr*0.28,my-mr*0.18,mr*0.82,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      // Tree
      var cx=W/2, th=Math.min(H*0.5,420), baseY=H*0.76, tipY=baseY-th;
      ctx.fillStyle="#4a2e0a"; ctx.fillRect(cx-11,baseY-42,22,42);
      for (var lay=0;lay<5;lay++) {
        var lw=th*0.47*((lay+1)/5), ly=tipY+th*(lay/5)*0.84+8, lh=th*0.28;
        ctx.fillStyle="#14421c"; ctx.beginPath();
        ctx.moveTo(cx,ly-4); ctx.lineTo(cx+lw*1.06,ly+lh); ctx.lineTo(cx-lw*1.06,ly+lh); ctx.fill();
        ctx.fillStyle="#1e6828"; ctx.beginPath();
        ctx.moveTo(cx,ly); ctx.lineTo(cx+lw,ly+lh-4); ctx.lineTo(cx-lw,ly+lh-4); ctx.fill();
        ctx.fillStyle="#2a8836"; ctx.beginPath();
        ctx.moveTo(cx,ly+4); ctx.lineTo(cx+lw*0.65,ly+lh*0.55); ctx.lineTo(cx,ly+lh*0.52); ctx.fill();
      }
      var sg=(Math.sin(t*0.05)+1)/2;
      ctx.shadowBlur=22+sg*18; ctx.shadowColor="#ffd700"; ctx.fillStyle="#ffd700";
      drawStar5(cx,tipY-4,13+sg*4); ctx.shadowBlur=0;
      // Tree lights
      lights.forEach(function(l){
        l.ph+=0.038; var on=Math.sin(l.ph)>0;
        ctx.shadowBlur=on?8:0; ctx.shadowColor=l.color;
        ctx.fillStyle=on?l.color:"rgba(70,70,70,0.5)";
        ctx.beginPath(); ctx.arc(l.x,l.y,3.5,0,Math.PI*2); ctx.fill();
      }); ctx.shadowBlur=0;
      // Snow ground
      var gy=H*0.76; ctx.fillStyle="#e8f5e8"; ctx.beginPath(); ctx.moveTo(0,gy);
      for (var x=0;x<=W;x+=18) ctx.lineTo(x,gy-Math.sin(x*0.028)*8+Math.sin(x*0.076)*4);
      ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.fill();
      ctx.fillStyle="rgba(200,240,215,0.22)";
      for (var sx=10;sx<W;sx+=38){ctx.beginPath();ctx.ellipse(sx,gy-2,14,3.5,0,0,Math.PI*2);ctx.fill();}
      // Santa
      if (!santa.active) {
        if (++santa.timer>520) { santa.timer=0; santa.active=true; santa.x=-320; santa.y=H*0.08+Math.random()*H*0.14; santa.speed=2+Math.random()*2; }
      } else {
        santa.x+=santa.speed; if (santa.x>W+360){santa.active=false;santa.timer=0;}
        var sx2=santa.x, sy2=santa.y+Math.sin(t*0.1)*5;
        ctx.fillStyle="#6a3a10";
        for (var ri=0;ri<3;ri++) {
          var rx=sx2-85-ri*44, ry=sy2+12;
          ctx.beginPath(); ctx.ellipse(rx,ry,15,7,0,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(rx+14,ry-2,5.5,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle="#5a3010"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(rx+16,ry-7); ctx.lineTo(rx+20,ry-16); ctx.lineTo(rx+17,ry-13); ctx.moveTo(rx+20,ry-16); ctx.lineTo(rx+24,ry-13); ctx.stroke();
          var ls=Math.sin(t*0.2+ri)*4;
          ctx.strokeStyle="#4a2a00"; ctx.lineWidth=1.8;
          ctx.beginPath(); ctx.moveTo(rx-6,ry+6); ctx.lineTo(rx-4,ry+17+ls); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(rx+6,ry+6); ctx.lineTo(rx+8,ry+17-ls); ctx.stroke();
        }
        ctx.strokeStyle="#8a6040"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(sx2-85-2*44-14,sy2+12); ctx.lineTo(sx2-18,sy2+6); ctx.stroke();
        // Sleigh
        ctx.fillStyle="#cc2200"; ctx.beginPath();
        ctx.moveTo(sx2-18,sy2-6); ctx.lineTo(sx2+30,sy2-6); ctx.lineTo(sx2+26,sy2+15); ctx.lineTo(sx2-24,sy2+15); ctx.fill();
        ctx.strokeStyle="#999"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(sx2-26,sy2+20); ctx.quadraticCurveTo(sx2,sy2+26,sx2+32,sy2+20); ctx.stroke();
        // Santa figure
        ctx.fillStyle="#cc2200"; ctx.fillRect(sx2+2,sy2-22,16,18);
        ctx.fillStyle="#fff"; ctx.fillRect(sx2+2,sy2-12,16,4);
        ctx.fillStyle="#f5cba7"; ctx.beginPath(); ctx.arc(sx2+10,sy2-28,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#cc2200"; ctx.beginPath();
        ctx.moveTo(sx2+4,sy2-33); ctx.lineTo(sx2+18,sy2-47); ctx.lineTo(sx2+20,sy2-33); ctx.fill();
        ctx.fillStyle="#fff"; ctx.fillRect(sx2+3,sy2-35,17,4);
        ctx.fillStyle="#7a3a00"; ctx.beginPath(); ctx.arc(sx2-2,sy2-20,9,0,Math.PI*2); ctx.fill();
        if (Math.random()<0.12) {
          ctx.fillStyle="#ffd700"; ctx.font="11px sans-serif"; ctx.textAlign="center";
          ctx.fillText("✨",sx2-55+Math.random()*18,sy2-2+Math.random()*18-9);
        }
      }
      // Snowflakes
      flakes.forEach(function(s){
        s.x+=s.vx+Math.sin(t*0.01+s.y*0.01)*0.28; s.y+=s.vy;
        if (s.y>H+8){s.y=-8;s.x=Math.random()*W;} if (s.x<-8) s.x=W+8; if (s.x>W+8) s.x=-8;
        ctx.fillStyle="rgba(235,252,242,"+s.op+")";
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize",resize); resize(); draw();
  })();

  /* ──────────────────── SESSION ──────────────────── */
  function getSession() { return state.session; }

  function setSession(obj) {
    state.session = obj;
    if (obj) sessionStorage.setItem(STORAGE.SESSION, JSON.stringify(obj));
    else sessionStorage.removeItem(STORAGE.SESSION);
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE.SESSION);
      state.session = raw ? JSON.parse(raw) : null;
    } catch(e) { state.session = null; }
    return state.session;
  }

  /* ──────────────────── API ──────────────────── */
  function authHeaders() {
    var sess = getSession();
    var headers = { "Content-Type": "application/json" };
    if (sess && sess.token) headers["Authorization"] = "Bearer " + sess.token;
    return headers;
  }

  function apiGet(path) {
    return fetch(API + path, { headers: authHeaders() }).then(handleResponse);
  }

  function apiPost(path, body) {
    return fetch(API + path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body || {}) }).then(handleResponse);
  }

  function apiPut(path, body) {
    return fetch(API + path, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body || {}) }).then(handleResponse);
  }

  function apiDelete(path) {
    return fetch(API + path, { method: "DELETE", headers: authHeaders() }).then(handleResponse);
  }

  function handleResponse(resp) {
    return resp.json().then(function(data) {
      if (resp.status === 401) {
        var hadSession = !!getSession();
        setSession(null);
        if (hadSession) showLoginView();
        return Promise.reject(new Error(data.error || "Session expired"));
      }
      if (!resp.ok) return Promise.reject(new Error(data.error || "API Error " + resp.status));
      return data;
    }).catch(function(e) {
      if (e instanceof SyntaxError) {
        if (resp.status === 401) { var hadSess = !!getSession(); setSession(null); if (hadSess) showLoginView(); }
        return Promise.reject(new Error(resp.status === 401 ? "Session expired" : "API Error " + resp.status));
      }
      return Promise.reject(e);
    });
  }

  function showLoading(v) {
    var ov = document.getElementById("loading-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "loading-overlay";
      ov.className = "loading-overlay";
      ov.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(ov);
    }
    ov.style.display = v ? "flex" : "none";
  }

  /* ──────────────────── DOM REFS ──────────────────── */
  var el = {
    viewAuth: document.getElementById("view-auth"),
    viewMain: document.getElementById("view-main"),
    authFirst: document.getElementById("auth-first"),
    authLogin: document.getElementById("auth-login"),
    authStaff: document.getElementById("auth-register-staff"),
    btnFirstRegister: document.getElementById("btn-first-register"),
    btnLogin: document.getElementById("btn-login"),
    linkRegisterStaff: document.getElementById("link-register-staff"),
    btnBackAuth: document.getElementById("btn-back-auth"),
    btnRegisterStaff: document.getElementById("btn-register-staff"),
    btnLogout: document.getElementById("btn-logout"),
    sessionUser: document.getElementById("session-user"),
    sessionRole: document.getElementById("session-role"),
    bnavTabs: document.querySelectorAll(".bnav-tab"),
    mgmtIconBtns: document.querySelectorAll(".icon-btn[data-mgmttab]"),
    panels: document.querySelectorAll(".panel"),
    productRows: document.getElementById("product-rows"),
    expiredRows: document.getElementById("expired-rows"),
    promoRows: document.getElementById("promo-rows"),
    productSearch: document.getElementById("product-search"),
    selectAll: document.getElementById("select-all"),
    btnAddProduct: document.getElementById("btn-add-product"),
    btnFabManual: document.getElementById("btn-fab-manual"),
    btnFabScan: document.getElementById("btn-fab-scan"),
    fabRow: document.getElementById("fab-row"),
    modal: document.getElementById("modal-product"),
    modalTitle: document.getElementById("modal-product-title"),
    editId: document.getElementById("edit-id"),
    pEan: document.getElementById("p-ean"),
    pName: document.getElementById("p-name"),
    pPrice: document.getElementById("p-price"),
    pDiscount: document.getElementById("p-discount"),
    pShelf: document.getElementById("p-shelf"),
    pUntil: document.getElementById("p-until"),
    btnSaveProduct: document.getElementById("btn-save-product"),
    btnCancelProduct: document.getElementById("btn-cancel-product"),
    reader: document.getElementById("reader"),
    btnStartScan: document.getElementById("btn-start-scan"),
    btnStopScan: document.getElementById("btn-stop-scan"),
    btnTorch: document.getElementById("btn-torch"),
    btnFlipCam: document.getElementById("btn-flip-cam"),
    scanStatus: document.getElementById("scan-status"),
    scanQuick: document.getElementById("scan-quick"),
    lastEan: document.getElementById("last-ean"),
    scanName: document.getElementById("scan-name"),
    scanPrice: document.getElementById("scan-price"),
    scanDiscount: document.getElementById("scan-discount"),
    scanShelf: document.getElementById("scan-shelf"),
    scanUntil: document.getElementById("scan-until"),
    btnSaveScanned: document.getElementById("btn-save-scanned"),
    manualEanInput: document.getElementById("manual-ean-input"),
    btnManualEanOk: document.getElementById("btn-manual-ean-ok"),
    lensPopup: document.getElementById("lens-popup"),
    btnLensOk: document.getElementById("btn-lens-ok"),
    printFormat: document.getElementById("print-format"),
    printTemplate: document.getElementById("print-template"),
    btnPreviewLabels: document.getElementById("btn-preview-labels"),
    btnPrintBatch: document.getElementById("btn-print-batch"),
    printPreviewArea: document.getElementById("print-preview-area"),
    toggleDesigner: document.getElementById("toggle-designer"),
    labelDesigner: document.getElementById("label-designer"),
    pageBgColor: document.getElementById("page-bg-color"),
    designerCanvasHost: document.getElementById("designer-canvas-host"),
    designerScaleInner: document.getElementById("designer-scale-inner"),
    designerCanvasOuter: document.getElementById("designer-canvas-outer"),
    btnAddText: document.getElementById("btn-add-text"),
    btnAddBarcode: document.getElementById("btn-add-barcode"),
    btnAddLine: document.getElementById("btn-add-line"),
    btnAddRect: document.getElementById("btn-add-rect"),
    btnAddCheck: document.getElementById("btn-add-check"),
    btnElUp: document.getElementById("btn-el-up"),
    btnElDown: document.getElementById("btn-el-down"),
    btnDuplicateEl: document.getElementById("btn-duplicate-el"),
    btnDeleteEl: document.getElementById("btn-delete-el"),
    btnApplyPresetLayout: document.getElementById("btn-apply-preset-layout"),
    btnResetTemplate: document.getElementById("btn-reset-template"),
    inspectorEmpty: document.getElementById("inspector-empty"),
    inspectorForm: document.getElementById("inspector-form"),
    designerElementPick: document.getElementById("designer-element-pick"),
    auditRows: document.getElementById("audit-rows"),
    auditFilter: document.getElementById("audit-filter"),
    inviteDisplay: document.getElementById("invite-display"),
    btnNewInvite: document.getElementById("btn-new-invite"),
    mgrUser: document.getElementById("mgr-user"),
    mgrPass: document.getElementById("mgr-pass"),
    btnAddMgrPending: document.getElementById("btn-add-mgr-pending"),
    pendingManagers: document.getElementById("pending-managers"),
    pendingList: document.getElementById("pending-list"),
    tabMgmt: document.querySelectorAll(".tab-mgmt"),
    ownerOnly: document.querySelectorAll(".owner-only"),
    countProducts: document.getElementById("count-products"),
    countExpired: document.getElementById("count-expired"),
    countPromo: document.getElementById("count-promo"),
    store3dCanvas: document.getElementById("store3d-canvas"),
    store3dInfo: document.getElementById("store3d-info"),
    btn3dReset: document.getElementById("btn-3d-reset"),
    btn3dAutorotate: document.getElementById("btn-3d-autorotate"),
  };

  /* ──────────────────── AUTH ──────────────────── */
  function initAuthView() {
    apiGet("/auth/users-empty").then(function(data) {
      if (data.empty) {
        el.authFirst.classList.remove("hidden");
        el.authLogin.classList.add("hidden");
      } else {
        el.authFirst.classList.add("hidden");
        el.authLogin.classList.remove("hidden");
      }
    }).catch(function() {
      el.authFirst.classList.add("hidden");
      el.authLogin.classList.remove("hidden");
    });
  }

  if (el.btnFirstRegister) el.btnFirstRegister.addEventListener("click", function() {
    var u = (document.getElementById("reg-user").value || "").trim();
    var p = document.getElementById("reg-pass").value;
    if (!u || !p) { alert("Completează toate câmpurile."); return; }
    showLoading(true);
    apiPost("/auth/register-owner", { username: u, password: p })
      .then(function(data) { setSession(data); showMain(); })
      .catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  });

  if (el.btnLogin) el.btnLogin.addEventListener("click", function() {
    var u = (document.getElementById("login-user").value || "").trim();
    var p = document.getElementById("login-pass").value;
    if (!u || !p) { alert("Completează câmpurile."); return; }
    showLoading(true);
    apiPost("/auth/login", { username: u, password: p })
      .then(function(data) { setSession(data); showMain(); })
      .catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  });

  // Login on Enter
  [document.getElementById("login-user"), document.getElementById("login-pass")].forEach(function(inp) {
    if (inp) inp.addEventListener("keydown", function(e) { if (e.key === "Enter") el.btnLogin.click(); });
  });

  if (el.linkRegisterStaff) el.linkRegisterStaff.addEventListener("click", function(e) {
    e.preventDefault();
    el.authLogin.classList.add("hidden");
    el.authStaff.classList.remove("hidden");
  });

  if (el.btnBackAuth) el.btnBackAuth.addEventListener("click", function() {
    el.authStaff.classList.add("hidden");
    el.authLogin.classList.remove("hidden");
  });

  if (el.btnRegisterStaff) el.btnRegisterStaff.addEventListener("click", function() {
    var code = (document.getElementById("invite-code").value || "").trim();
    var u = (document.getElementById("staff-user").value || "").trim();
    var p = document.getElementById("staff-pass").value;
    if (!code || !u || !p) { alert("Completează toate câmpurile."); return; }
    showLoading(true);
    apiPost("/auth/register-staff", { username: u, password: p, invite_code: code })
      .then(function(data) { setSession(data); showMain(); })
      .catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  });

  if (el.btnLogout) el.btnLogout.addEventListener("click", function() {
    apiPost("/auth/logout").finally(function() { setSession(null); showLoginView(); });
  });

  /* ──────────────────── VIEW SWITCHING ──────────────────── */
  function showLoginView() {
    el.viewMain.classList.add("hidden");
    el.viewAuth.classList.remove("hidden");
    initAuthView();
  }

  function showMain() {
    el.viewAuth.classList.add("hidden");
    el.viewMain.classList.remove("hidden");
    var s = getSession();
    if (!s) return;
    el.sessionUser.textContent = s.username;
    el.sessionRole.textContent = s.role;
    el.sessionRole.className = "badge role " + (s.role || "");
    var canMgmt = s.role === "owner" || s.role === "manager";
    el.tabMgmt.forEach(function(t) { t.classList.toggle("hidden", !canMgmt); });
    // Owner-only elements (3D store tab)
    el.ownerOnly.forEach(function(t) { t.classList.toggle("hidden", s.role !== "owner"); });
    switchPanel("products");
    loadProducts();
    if (canMgmt) { loadAudit(); loadFortress(); }
  }

  function switchPanel(name) {
    el.bnavTabs.forEach(function(t) { t.classList.toggle("active", t.getAttribute("data-panel") === name); });
    el.mgmtIconBtns.forEach(function(b) { b.classList.toggle("active", b.getAttribute("data-mgmttab") === name); });
    el.panels.forEach(function(p) { p.classList.toggle("active", p.id === "panel-" + name); });
    var showFab = ["products","expired","promo"].indexOf(name) >= 0;
    el.fabRow.style.display = showFab ? "flex" : "none";
    // Init 3D store on first show
    if (name === "store3d" && !store3dInit) {
      setTimeout(init3DStore, 100);
    }
    // Stop scanner when leaving scan panel
    if (name !== "scan" && scannerRunning) stopScanner();
  }

  if (el.bnavTabs && el.bnavTabs.forEach) {
    el.bnavTabs.forEach(function(tab) {
      tab.addEventListener("click", function() { switchPanel(tab.getAttribute("data-panel")); });
    });
  }

  if (el.mgmtIconBtns && el.mgmtIconBtns.forEach) {
    el.mgmtIconBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        var tab = btn.getAttribute("data-mgmttab");
        switchPanel(tab);
        if (tab === "audit") loadAudit();
      });
    });
  }

  if (el.btnFabManual) el.btnFabManual.addEventListener("click", function() {
    var s = getSession();
    if (s && s.role === "staff") { alert("Staff poate adăuga doar prin scanare."); return; }
    openProductModal(null);
  });

  if (el.btnFabScan) el.btnFabScan.addEventListener("click", function() {
    switchPanel("scan");
    setTimeout(startScanner, 200);
  });

  if (el.btnAddProduct) el.btnAddProduct.addEventListener("click", function() {
    var s = getSession();
    if (s && s.role === "staff") { alert("Staff poate adăuga doar prin scanare."); return; }
    openProductModal(null);
  });

  /* ──────────────────── PRODUCTS ──────────────────── */
  function loadProducts() {
    apiGet("/products").then(function(data) {
      state.products = data || [];
      renderProducts();
    }).catch(function() { renderProducts(); });
  }

  function renderProducts() {
    var session = getSession();
    var isStaff = session && session.role === "staff";
    var q = (el.productSearch.value || "").toLowerCase().trim();
    var all = state.products;
    var filtered = all.filter(function(p) {
      if (!q) return true;
      return String(p.ean).includes(q) || String(p.name||"").toLowerCase().includes(q) || String(p.shelf||"").toLowerCase().includes(q);
    });
    var expired = all.filter(function(p) { return isExpired(p.valid_until); });
    var promo = all.filter(function(p) { return hasDiscount(p) && !isExpired(p.valid_until); });
    updateCount(el.countProducts, all.length);
    updateCount(el.countExpired, expired.length);
    updateCount(el.countPromo, promo.length);
    renderProductTable(el.productRows, filtered, isStaff);
    renderExpiredTable(el.expiredRows, expired, isStaff);
    renderPromoTable(el.promoRows, promo, isStaff);
    el.selectAll.checked = false;
  }

  function updateCount(el, n) {
    if (!el) return;
    var old = el.textContent;
    el.textContent = n;
    el.style.display = n > 0 ? "inline-flex" : "none";
    if (String(old) !== String(n) && n > 0) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
    }
  }

  function renderProductTable(tbody, products, isStaff) {
    tbody.innerHTML = "";
    products.forEach(function(p) {
      var tr = document.createElement("tr");
      if (isExpired(p.valid_until)) tr.classList.add("expired");
      var expCell = isExpired(p.valid_until) ? '<span class="expiry-flag">Expirat</span>' : (p.valid_until || "—");
      var actionsCell = isStaff ? "<td>—</td>"
        : '<td><button type="button" class="btn-edit" data-id="' + escapeAttr(p.id) + '">Editează</button> ' +
          '<button type="button" class="btn-del" data-id="' + escapeAttr(p.id) + '">Șterge</button></td>';
      tr.innerHTML =
        '<td><input type="checkbox" class="sel-p" data-id="' + escapeAttr(p.id) + '" /></td>' +
        "<td>" + escapeHtml(p.ean) + "</td>" +
        "<td>" + escapeHtml(p.name) + "</td>" +
        "<td>" + formatMoney(p.base_price) + "</td>" +
        "<td>" + escapeHtml(String(p.discount_pct || 0)) + "%</td>" +
        "<td><strong>" + formatMoney(finalPrice(p.base_price, p.discount_pct)) + "</strong></td>" +
        "<td>" + escapeHtml(p.shelf || "—") + "</td>" +
        "<td>" + expCell + "</td>" + actionsCell;
      tbody.appendChild(tr);
    });
    if (!isStaff) {
      tbody.querySelectorAll(".btn-edit").forEach(function(b) {
        b.addEventListener("click", function() { openProductModal(b.getAttribute("data-id")); });
      });
      tbody.querySelectorAll(".btn-del").forEach(function(b) {
        b.addEventListener("click", function() {
          if (!confirm("Ștergi produsul?")) return;
          removeProduct(b.getAttribute("data-id"));
        });
      });
    }
  }

  function renderExpiredTable(tbody, products, isStaff) {
    tbody.innerHTML = "";
    products.forEach(function(p) {
      var tr = document.createElement("tr");
      tr.classList.add("expired");
      var actions = isStaff ? "<td>—</td>"
        : '<td><button type="button" class="btn-del" data-id="' + escapeAttr(p.id) + '">Șterge</button></td>';
      tr.innerHTML =
        "<td>" + escapeHtml(p.ean) + "</td>" +
        "<td>" + escapeHtml(p.name) + "</td>" +
        "<td><strong>" + formatMoney(finalPrice(p.base_price, p.discount_pct)) + "</strong></td>" +
        "<td>" + escapeHtml(p.shelf || "—") + "</td>" +
        '<td><span class="expiry-flag">' + escapeHtml(p.valid_until || "—") + "</span></td>" + actions;
      tbody.appendChild(tr);
    });
    if (!isStaff) {
      tbody.querySelectorAll(".btn-del").forEach(function(b) {
        b.addEventListener("click", function() {
          if (!confirm("Ștergi produsul expirat?")) return;
          removeProduct(b.getAttribute("data-id"));
        });
      });
    }
  }

  function renderPromoTable(tbody, products, isStaff) {
    tbody.innerHTML = "";
    products.forEach(function(p) {
      var tr = document.createElement("tr");
      var actions = isStaff ? "<td>—</td>"
        : '<td><button type="button" class="btn-edit" data-id="' + escapeAttr(p.id) + '">Editează</button></td>';
      tr.innerHTML =
        "<td>" + escapeHtml(p.ean) + "</td>" +
        "<td>" + escapeHtml(p.name) + "</td>" +
        '<td style="color:var(--accent);font-weight:700">' + escapeHtml(String(p.discount_pct)) + "%</td>" +
        "<td><strong>" + formatMoney(finalPrice(p.base_price, p.discount_pct)) + "</strong></td>" +
        "<td>" + escapeHtml(p.shelf || "—") + "</td>" +
        "<td>" + escapeHtml(p.valid_until || "—") + "</td>" + actions;
      tbody.appendChild(tr);
    });
    if (!isStaff) {
      tbody.querySelectorAll(".btn-edit").forEach(function(b) {
        b.addEventListener("click", function() { openProductModal(b.getAttribute("data-id")); });
      });
    }
  }

  function removeProduct(id) {
    var session = getSession();
    if (session && session.role === "staff") return;
    showLoading(true);
    apiDelete("/products/" + id).then(function() {
      state.products = state.products.filter(function(p) { return p.id !== id; });
      renderProducts();
    }).catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  }

  function openProductModal(id) {
    el.modal.classList.remove("hidden");
    el.modal.setAttribute("aria-hidden", "false");
    var titleSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:var(--accent)"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
    var titleEl = document.getElementById("modal-product-title");
    if (!id) {
      if (titleEl) titleEl.innerHTML = titleSvg + " ADĂUGARE MANUALĂ";
      el.editId.value = ""; el.pEan.value = ""; el.pName.value = "";
      el.pPrice.value = ""; el.pDiscount.value = "0"; el.pShelf.value = ""; el.pUntil.value = "";
    } else {
      var p = state.products.find(function(x) { return x.id === id; });
      if (!p) return;
      if (titleEl) titleEl.innerHTML = titleSvg + " EDITARE PRODUS";
      el.editId.value = p.id; el.pEan.value = p.ean; el.pName.value = p.name || "";
      el.pPrice.value = p.base_price; el.pDiscount.value = p.discount_pct || 0;
      el.pShelf.value = p.shelf || ""; el.pUntil.value = p.valid_until || "";
    }
  }

  function closeProductModal() {
    el.modal.classList.add("hidden");
    el.modal.setAttribute("aria-hidden", "true");
  }

  function saveProductFromModal() {
    var sess = getSession();
    var id = el.editId.value || "";
    var ean = (el.pEan.value || "").trim();
    var name = el.pName.value.trim();
    var base_price = parseFloat(el.pPrice.value) || 0;
    var discount_pct = parseFloat(el.pDiscount.value) || 0;
    var shelf = el.pShelf.value.trim();
    var valid_until = el.pUntil.value || "";
    if (!ean) { ean = String(Date.now()).slice(0, 13); while (ean.length < 13) ean = "0" + ean; }
    if (ean.length < 8) { alert("EAN invalid (minim 8 cifre)."); return; }
    if (!name) { alert("Completează denumirea."); return; }
    showLoading(true);
    var payload = { ean: ean, name: name, base_price: base_price, discount_pct: discount_pct, shelf: shelf, valid_until: valid_until };
    var call = id ? apiPut("/products/" + id, payload) : apiPost("/products", payload);
    call.then(function(saved) {
      if (id) {
        state.products = state.products.map(function(p) { return p.id === id ? saved : p; });
      } else {
        state.products.unshift(saved);
      }
      renderProducts();
      closeProductModal();
    }).catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  }

  if (el.btnSaveProduct) el.btnSaveProduct.addEventListener("click", saveProductFromModal);
  if (el.btnCancelProduct) el.btnCancelProduct.addEventListener("click", closeProductModal);
  if (el.modal && el.modal.querySelector) {
    var _mb = el.modal.querySelector(".modal-backdrop");
    if (_mb) _mb.addEventListener("click", closeProductModal);
  }
  if (el.productSearch) el.productSearch.addEventListener("input", renderProducts);
  if (el.selectAll) el.selectAll.addEventListener("change", function() {
    var c = el.selectAll.checked;
    document.querySelectorAll(".sel-p").forEach(function(x) { x.checked = c; });
  });

  /* ──────────────────── SCANNER ──────────────────── */
  function startScanner() {
    if (scannerRunning) return;
    el.scanStatus.textContent = "Inițializare cameră…";
    el.btnStartScan.disabled = true;
    Html5Qrcode.getCameras().then(function(devices) {
      availableCameras = devices || [];
      currentCamIndex = 0;
      for (var i = 0; i < availableCameras.length; i++) {
        if (availableCameras[i].label && /back|rear|environment/i.test(availableCameras[i].label)) {
          currentCamIndex = i; break;
        }
      }
      return startWithCamera(availableCameras[currentCamIndex] ? availableCameras[currentCamIndex].id : { facingMode: "environment" });
    }).catch(function(err) {
      el.scanStatus.textContent = "Eroare cameră: " + err;
      el.btnStartScan.disabled = false;
    });
  }

  function startWithCamera(cameraId) {
    html5QrCode = new Html5Qrcode("reader");
    return html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 240, height: 120 }, aspectRatio: 1.6 },
      onScanSuccess, null
    ).then(function() {
      scannerRunning = true;
      el.btnStopScan.disabled = false;
      el.btnTorch.disabled = false;
      el.scanStatus.textContent = "Cameră activă. Poziționează codul EAN în cadru.";
      // AUTO-TORCH: turn on torch automatically
      setTimeout(function() { applyTorch(true); }, 600);
      // Start lens check timer
      startLensTimer();
    }).catch(function(e) {
      el.scanStatus.textContent = "Eroare: " + e;
      el.btnStartScan.disabled = false;
    });
  }

  function stopScanner() {
    if (!html5QrCode || !scannerRunning) return;
    clearLensTimer();
    hideLensPopup();
    html5QrCode.stop().then(function() {
      scannerRunning = false;
      torchOn = false;
      el.btnTorch.style.color = "";
      el.btnTorch.style.filter = "";
      clearTimeout(torchIdleTimer);
      el.btnStartScan.disabled = false;
      el.btnStopScan.disabled = true;
      el.btnTorch.disabled = true;
      el.scanStatus.textContent = "Cameră oprită.";
    }).catch(function() {});
  }

  function onScanSuccess(ean) {
    clearLensTimer();
    hideLensPopup();
    stopScanner();
    el.lastEan.textContent = ean;
    el.scanQuick.classList.remove("hidden");
    el.scanDiscount.value = "0";
    el.scanName.value = ""; el.scanPrice.value = ""; el.scanShelf.value = ""; el.scanUntil.value = "";
    var existing = state.products.find(function(p) { return p.ean === ean; });
    if (existing) {
      el.scanName.value = existing.name;
      el.scanPrice.value = existing.base_price;
      el.scanDiscount.value = existing.discount_pct;
      el.scanShelf.value = existing.shelf || "";
      el.scanUntil.value = existing.valid_until || "";
    }
  }

  /* ── Lens popup ── */
  function startLensTimer() {
    clearLensTimer();
    lensTimer = setTimeout(function() {
      if (scannerRunning) showLensPopup();
    }, LENS_CHECK_MS);
  }

  function clearLensTimer() {
    if (lensTimer) { clearTimeout(lensTimer); lensTimer = null; }
  }

  function showLensPopup() {
    el.lensPopup.classList.remove("hidden");
  }

  function hideLensPopup() {
    el.lensPopup.classList.add("hidden");
  }

  if (el.btnLensOk) el.btnLensOk.addEventListener("click", function() {
    hideLensPopup();
    if (scannerRunning) startLensTimer();
  });

  /* ── Torch ── */
  function applyTorch(on) {
    if (!html5QrCode) return;
    try {
      var caps = html5QrCode.getRunningTrackCameraCapabilities ? html5QrCode.getRunningTrackCameraCapabilities() : null;
      if (caps && caps.torchFeature && caps.torchFeature().isSupported()) {
        caps.torchFeature().apply(on);
        torchOn = on;
        el.btnTorch.style.color = on ? "var(--accent)" : "";
        el.btnTorch.style.filter = on ? "drop-shadow(0 0 4px var(--accent))" : "";
      }
    } catch(e) {}
  }

  if (el.btnTorch) el.btnTorch.addEventListener("click", function() {
    applyTorch(!torchOn);
    clearTimeout(torchIdleTimer);
    torchIdleTimer = setTimeout(function() { if (torchOn) applyTorch(false); }, TORCH_IDLE_MS);
  });

  if (el.btnFlipCam) el.btnFlipCam.addEventListener("click", function() {
    if (!availableCameras.length || availableCameras.length < 2) return;
    stopScanner();
    currentCamIndex = (currentCamIndex + 1) % availableCameras.length;
    setTimeout(function() { startWithCamera(availableCameras[currentCamIndex].id); }, 400);
  });

  if (el.btnStartScan) el.btnStartScan.addEventListener("click", startScanner);
  if (el.btnStopScan) el.btnStopScan.addEventListener("click", stopScanner);

  if (el.manualEanInput) el.manualEanInput.addEventListener("keydown", function(e) { if (e.key === "Enter" && el.btnManualEanOk) el.btnManualEanOk.click(); });
  if (el.btnManualEanOk) el.btnManualEanOk.addEventListener("click", function() {
    var code = el.manualEanInput.value.trim();
    if (!code) return;
    onScanSuccess(code);
    el.manualEanInput.value = "";
  });

  if (el.btnSaveScanned) el.btnSaveScanned.addEventListener("click", function() {
    var ean = (el.lastEan.textContent || "").trim();
    var name = el.scanName.value.trim();
    var base_price = parseFloat(el.scanPrice.value) || 0;
    var discount_pct = parseFloat(el.scanDiscount.value) || 0;
    var shelf = el.scanShelf.value.trim();
    var valid_until = el.scanUntil.value || "";
    if (!ean) { alert("Niciun EAN citit."); return; }
    if (!name) { alert("Completează denumirea."); return; }
    showLoading(true);
    var existing = state.products.find(function(p) { return p.ean === ean; });
    var payload = { ean:ean, name:name, base_price:base_price, discount_pct:discount_pct, shelf:shelf, valid_until:valid_until };
    var call = existing ? apiPut("/products/" + existing.id, payload) : apiPost("/products", payload);
    call.then(function(saved) {
      if (existing) {
        var idx = state.products.findIndex(function(p) { return p.id === existing.id; });
        if (idx >= 0) state.products[idx] = saved;
      } else { state.products.unshift(saved); }
      renderProducts();
      el.scanQuick.classList.add("hidden");
      el.lastEan.textContent = "";
      switchPanel("products");
    }).catch(function(e) { alert(e.message); })
      .finally(function() { showLoading(false); });
  });

  /* ──────────────────── AUDIT ──────────────────── */
  function loadAudit() {
    apiGet("/audit?q=" + encodeURIComponent((el.auditFilter.value||"").trim())).then(function(data) {
      state.audit = data || [];
      renderAudit();
    }).catch(function(e) { console.warn(e); });
  }

  function renderAudit() {
    el.auditRows.innerHTML = "";
    state.audit.forEach(function(r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(r.ts) + "</td>" +
        "<td>" + escapeHtml(r.username) + "</td>" +
        "<td>" + escapeHtml(r.action) + "</td>" +
        "<td>" + escapeHtml(r.detail) + "</td>";
      el.auditRows.appendChild(tr);
    });
  }

  if (el.auditFilter) el.auditFilter.addEventListener("input", debounce(loadAudit, 300));

  /* ──────────────────── FORTRESS ──────────────────── */
  function loadFortress() {
    apiGet("/fortress/invite").then(function(data) {
      el.inviteDisplay.textContent = (data && data.code) ? data.code : "—";
    }).catch(function() {});
    apiGet("/fortress/pending").then(function(data) {
      state.pendingManagers = data || [];
      renderPendingManagers();
    }).catch(function() {});
  }

  function renderPendingManagers() {
    var list = state.pendingManagers;
    el.pendingManagers.classList.toggle("hidden", list.length === 0);
    el.pendingList.innerHTML = "";
    list.forEach(function(item) {
      var li = document.createElement("li");
      li.innerHTML = "<span>" + escapeHtml(item.username) + "</span>" +
        '<div style="display:flex;gap:.5rem">' +
        '<button type="button" class="btn-approve btn-sm" data-u="' + escapeAttr(item.username) + '">Aprobă</button>' +
        '<button type="button" class="btn-reject btn-sm btn-ghost" data-u="' + escapeAttr(item.username) + '">Respinge</button>' +
        "</div>";
      el.pendingList.appendChild(li);
    });
    el.pendingList.querySelectorAll(".btn-approve").forEach(function(b) {
      b.addEventListener("click", function() {
        apiPost("/fortress/approve/" + encodeURIComponent(b.getAttribute("data-u")))
          .then(loadFortress).catch(function(e) { alert(e.message); });
      });
    });
    el.pendingList.querySelectorAll(".btn-reject").forEach(function(b) {
      b.addEventListener("click", function() {
        apiPost("/fortress/reject/" + encodeURIComponent(b.getAttribute("data-u")))
          .then(loadFortress).catch(function(e) { alert(e.message); });
      });
    });
  }

  if (el.btnNewInvite) el.btnNewInvite.addEventListener("click", function() {
    apiPost("/fortress/invite").then(function(data) { el.inviteDisplay.textContent = data.code || "—"; })
      .catch(function(e) { alert(e.message); });
  });

  if (el.btnAddMgrPending) el.btnAddMgrPending.addEventListener("click", function() {
    var u = (el.mgrUser.value || "").trim();
    var p = el.mgrPass.value;
    if (!u || !p) { alert("Completează utilizator și parolă."); return; }
    apiPost("/fortress/add-manager", { username: u, password: p }).then(function() {
      el.mgrUser.value = ""; el.mgrPass.value = "";
      alert("Manager creat. Trebuie aprobat.");
      loadFortress();
    }).catch(function(e) { alert(e.message); });
  });

  /* ──────────────────── 3D STORE ──────────────────── */
  var store3dScene = null;
  var store3dRenderer = null;
  var store3dCamera = null;
  var store3dProductMeshes = [];
  var store3dSlotMeshes = [];
  var store3dAssignMode = false;
  var store3dSelectedSlot = null;
  var store3dConfig = loadStoreConfig();
  var store3dProductMap = loadProductMap();

  function init3DStore() {
    if (store3dInit || typeof THREE === "undefined") {
      if (typeof THREE === "undefined") {
        el.store3dInfo.innerHTML = "<span style='color:var(--danger)'>Three.js nu s-a încărcat.</span>";
      }
      return;
    }
    store3dInit = true;
    build3DScene();
    bind3DControls();
  }

  function build3DScene() {
    var canvas = el.store3dCanvas;
    var W = canvas.parentElement.clientWidth;
    var H = Math.min(Math.round(W * 0.65), 520);
    canvas.width = W; canvas.height = H;

    var cfg = store3dConfig;
    var isTechno = currentTheme === "techno";

    /* Scene */
    if (store3dRenderer) { store3dRenderer.dispose(); }
    var scene = new THREE.Scene();
    store3dScene = scene;
    scene.background = new THREE.Color(isTechno ? 0x06000f : 0x0d1117);
    scene.fog = new THREE.Fog(isTechno ? 0x06000f : 0x0d1117, 25, 55);

    var camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
    store3dCamera = camera;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    store3dRenderer = renderer;
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* Lighting */
    scene.add(new THREE.AmbientLight(0xffffff, isTechno ? 0.3 : 0.45));
    var dir = new THREE.DirectionalLight(0xffffff, isTechno ? 0.5 : 0.85);
    dir.position.set(8, 14, 8); dir.castShadow = true;
    scene.add(dir);
    if (isTechno) {
      var pl1 = new THREE.PointLight(0xa855f7, 1.4, 30); pl1.position.set(-8, 5, 0); scene.add(pl1);
      var pl2 = new THREE.PointLight(0x7c3aed, 1.1, 30); pl2.position.set(8, 5, 0); scene.add(pl2);
    } else {
      var wl = new THREE.PointLight(0xf59e0b, 0.55, 30); wl.position.set(0, 8, 0); scene.add(wl);
    }

    /* Floor */
    var floorSize = Math.max(40, cfg.numAisles * cfg.aisleGap + 20);
    var floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    var floorMat = new THREE.MeshLambertMaterial({ color: isTechno ? 0x0d0020 : 0x161b22 });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);
    var gridH = new THREE.GridHelper(floorSize, Math.round(floorSize / 1.5), isTechno ? 0x3d1a6e : 0x30363d, isTechno ? 0x1a0a3e : 0x1f2937);
    gridH.position.y = 0.01; scene.add(gridH);

    /* Materials */
    var shelfMat = new THREE.MeshLambertMaterial({ color: isTechno ? 0x1a0a3e : 0x2d3a4d });
    var backMat  = new THREE.MeshLambertMaterial({ color: isTechno ? 0x0d0020 : 0x1f2937 });
    var slotMat  = new THREE.MeshLambertMaterial({ color: 0x444444, transparent: true, opacity: 0.0 });
    var slotHoverMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 });

    store3dProductMeshes = [];
    store3dSlotMeshes = [];
    store3dShelfGroups = {};
    store3dShelfMeta = {};

    /* Dimensions from config */
    var UW = cfg.unitWidth;
    var UH = cfg.unitHeight;
    var UD = 1.0;
    var NL = cfg.shelfLevels;
    var shelfStep = UH / NL;
    var shelfYs = [];
    for (var li = 0; li < NL; li++) { shelfYs.push(shelfStep * (li + 0.7)); }
    var slotsPerShelf = Math.max(2, Math.round(UW / 0.28));
    var slotW = UW / slotsPerShelf;

    /* Aisle + unit positions */
    var aislePairs = [];
    for (var ai = 0; ai < cfg.numAisles; ai++) {
      var xOff = (ai - (cfg.numAisles - 1) / 2) * cfg.aisleGap;
      aislePairs.push({ left: xOff - cfg.aisleGap * 0.25, right: xOff + cfg.aisleGap * 0.25 });
    }
    var unitZs = [];
    var totalZ = (cfg.unitsPerAisle - 1) * cfg.unitSpacing;
    for (var ui2 = 0; ui2 < cfg.unitsPerAisle; ui2++) {
      unitZs.push(-totalZ / 2 + ui2 * cfg.unitSpacing);
    }

    /* ── Build shelf unit as a Group so it moves as one piece ── */
    function makeShelfUnit(defaultX, defaultZ, unitId) {
      var ov = cfg.unitOverrides && cfg.unitOverrides[unitId];
      var px = (ov && ov.x !== undefined) ? ov.x : defaultX;
      var pz = (ov && ov.z !== undefined) ? ov.z : defaultZ;
      var ry = (ov && ov.rotY !== undefined) ? ov.rotY : 0;
      var g = new THREE.Group();
      g.position.set(px, 0, pz);
      g.rotation.y = ry;
      /* Posts */
      var postGeo = new THREE.BoxGeometry(0.07, UH, 0.07);
      var halfW = UW/2-0.04, halfD = UD/2-0.04;
      [[-halfW,-halfD],[halfW,-halfD],[-halfW,halfD],[halfW,halfD]].forEach(function(p) {
        var post = new THREE.Mesh(postGeo, shelfMat);
        post.position.set(p[0], UH/2, p[1]);
        post.castShadow = true; g.add(post);
      });
      /* Shelf boards */
      var sGeo = new THREE.BoxGeometry(UW, 0.045, UD);
      shelfYs.forEach(function(y) {
        var s = new THREE.Mesh(sGeo, shelfMat);
        s.position.set(0, y - shelfStep*0.45, 0);
        s.castShadow = true; s.receiveShadow = true; g.add(s);
      });
      /* Back panel */
      var bkGeo = new THREE.BoxGeometry(UW, UH, 0.04);
      var back = new THREE.Mesh(bkGeo, backMat);
      back.position.set(0, UH/2, -UD/2+0.02); g.add(back);
      scene.add(g);
      store3dShelfGroups[unitId] = g;
      store3dShelfMeta[unitId] = { defaultX: defaultX, defaultZ: defaultZ };
      return g;
    }

    /* ── Build all shelves with slot meshes as group children ── */
    var slotGeo = new THREE.BoxGeometry(slotW * 0.88, shelfStep * 0.7, UD * 0.8);

    aislePairs.forEach(function(pair, ai) {
      [pair.left, pair.right].forEach(function(x, side) {
        unitZs.forEach(function(z, ui) {
          var unitId = "a"+ai+"_s"+side+"_u"+ui;
          var group = makeShelfUnit(x, z, unitId);
          shelfYs.forEach(function(sy, li) {
            for (var si = 0; si < slotsPerShelf; si++) {
              var localX = (si - (slotsPerShelf - 1) / 2) * slotW;
              var key = "a"+ai+"_s"+side+"_u"+ui+"_l"+li+"_p"+si;
              var sm = new THREE.Mesh(slotGeo, slotMat.clone());
              sm.position.set(localX, sy, 0);  // local to group
              sm.userData = { key: key, ai: ai, side: side, ui: ui, li: li, si: si, unitId: unitId };
              group.add(sm);  // child of shelf group → moves with it
              store3dSlotMeshes.push(sm);
            }
          });
        });
      });
    });

    /* ── Product boxes (children of shelf group) ── */
    store3dProductMap = loadProductMap();
    store3dProductScales = loadProductScales();
    var productColors = [0xef4444,0x3b82f6,0x22c55e,0xf59e0b,0xa855f7,0xec4899,0x06b6d4,0xf97316];
    store3dSlotMeshes.forEach(function(sm) {
      var key = sm.userData.key;
      var pid = store3dProductMap[key];
      if (!pid) return;
      var prod = state.products.find(function(p) { return p.id === pid; });
      if (!prod) return;
      var colorIdx = state.products.indexOf(prod) % productColors.length;
      var sc = store3dProductScales[key] || {};
      var bsw = sc.sw !== undefined ? sc.sw : 0.75;
      var bh  = sc.h  !== undefined ? sc.h  : (0.18 + (state.products.indexOf(prod)*0.037)%0.19 + 0.01);
      var bsd = sc.sd !== undefined ? sc.sd : 0.7;
      var bGeo2 = new THREE.BoxGeometry(slotW*bsw, bh, UD*bsd);
      var bMat = new THREE.MeshLambertMaterial({ color: productColors[colorIdx] });
      var box = new THREE.Mesh(bGeo2, bMat);
      box.position.set(sm.position.x, sm.position.y + bh/2, sm.position.z);
      box.castShadow = true;
      box.userData = { product: prod, slotKey: key, sw: bsw, bh: bh, sd: bsd };
      sm.parent.add(box);  // same group as slot
      store3dProductMeshes.push(box);
    });

    /* ── Raycaster ── */
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var dragOffset = new THREE.Vector3();
    var dragPt = new THREE.Vector3();

    function setMouseFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
    }

    /* ── Shelf selection helpers ── */
    function highlightShelf(selId) {
      Object.keys(store3dShelfGroups).forEach(function(id) {
        store3dShelfGroups[id].children.forEach(function(ch) {
          if (ch.material && ch.material.emissive) {
            ch.material.emissive.set(id === selId ? 0x223300 : 0x000000);
          }
        });
      });
    }

    function selectShelfById(shelfId) {
      store3dSelectedShelfId = shelfId;
      highlightShelf(shelfId);
      var group = store3dShelfGroups[shelfId];
      if (!group) return;
      var ov = cfg.unitOverrides && cfg.unitOverrides[shelfId];
      var cx = group.position.x, cz = group.position.z;
      var xs = document.getElementById("shelf-edit-x"), zs = document.getElementById("shelf-edit-z");
      var xv = document.getElementById("shelf-edit-x-val"), zv = document.getElementById("shelf-edit-z-val");
      if (xs) { xs.value = cx; if (xv) xv.textContent = cx.toFixed(1); }
      if (zs) { zs.value = cz; if (zv) zv.textContent = cz.toFixed(1); }
      var pnl = document.getElementById("store3d-shelf-panel");
      if (pnl) { pnl.classList.remove("hidden"); document.getElementById("shelf-edit-id").textContent = shelfId; }
      el.store3dInfo.innerHTML = "<strong style='color:var(--ok)'>✏ Raft selectat:</strong> " + shelfId +
        "<br><small style='color:var(--muted)'>Trage pe canvas sau folosește sliderele pentru a muta. ↺/↻ pentru rotire.</small>";
    }

    /* ── Click handler ── */
    canvas.addEventListener("click", function(e) {
      if (Math.abs(e.clientX - (window._3dDragStartX||0)) > 6) return;
      setMouseFromEvent(e);
      if (store3dEditShelfMode) {
        /* Pick any mesh in any shelf group */
        var allShelfChildren = [];
        Object.keys(store3dShelfGroups).forEach(function(id) {
          store3dShelfGroups[id].children.forEach(function(ch) { ch._shelfId = id; allShelfChildren.push(ch); });
        });
        var hits = raycaster.intersectObjects(allShelfChildren);
        if (hits.length > 0 && hits[0].object._shelfId) {
          selectShelfById(hits[0].object._shelfId);
        } else {
          store3dSelectedShelfId = null;
          highlightShelf(null);
          var pnl = document.getElementById("store3d-shelf-panel");
          if (pnl) pnl.classList.add("hidden");
          el.store3dInfo.innerHTML = "<span style='color:var(--muted)'>Click pe un raft pentru a-l selecta și muta.</span>";
        }
      } else if (store3dAssignMode) {
        var allMeshes = store3dSlotMeshes.concat(store3dProductMeshes);
        var hits2 = raycaster.intersectObjects(allMeshes);
        if (hits2.length > 0) {
          var hitObj = hits2[0].object;
          var key = hitObj.userData.key || hitObj.userData.slotKey;
          if (key) open3DProductPicker(key);
        }
      } else {
        var phits = raycaster.intersectObjects(store3dProductMeshes);
        if (phits.length > 0) {
          var pm = phits[0].object, pd = pm.userData.product;
          if (pd) {
            el.store3dInfo.innerHTML =
              "<strong style='color:var(--accent)'>" + escapeHtml(pd.name) + "</strong><br>" +
              "EAN: " + escapeHtml(pd.ean) + " | Raft: " + escapeHtml(pd.shelf||"—") + "<br>" +
              "Preț: <strong>" + formatMoney(finalPrice(pd.base_price, pd.discount_pct)) + "</strong>" +
              (Number(pd.discount_pct)>0 ? " <span style='color:var(--ok)'>(-"+pd.discount_pct+"%)</span>" : "");
            var origColor = pm.material.color.getHex();
            pm.material.color.set(0xffffff);
            setTimeout(function() { pm.material.color.set(origColor); }, 180);
            /* Show product dimension panel */
            var sc2 = pm.userData;
            var pwEl = document.getElementById("prod-edit-w"), phEl = document.getElementById("prod-edit-h"), pdEl = document.getElementById("prod-edit-d");
            var pwv = document.getElementById("prod-edit-w-val"), phv = document.getElementById("prod-edit-h-val"), pdv = document.getElementById("prod-edit-d-val");
            if (pwEl) { pwEl.value = sc2.sw; if (pwv) pwv.textContent = sc2.sw; }
            if (phEl) { phEl.value = sc2.bh; if (phv) phv.textContent = sc2.bh.toFixed(2); }
            if (pdEl) { pdEl.value = sc2.sd; if (pdv) pdv.textContent = sc2.sd; }
            document.getElementById("prod-edit-name").textContent = pd.name;
            var prodPnl = document.getElementById("store3d-prod-panel");
            if (prodPnl) prodPnl.classList.remove("hidden");
            store3dSelectedProductMesh = pm;
          }
        } else {
          var prodPnl2 = document.getElementById("store3d-prod-panel");
          if (prodPnl2) prodPnl2.classList.add("hidden");
          store3dSelectedProductMesh = null;
        }
      }
    });

    /* ── Hover highlight for assign mode ── */
    canvas.addEventListener("mousemove", function(e) {
      if (!store3dAssignMode) { canvas.style.cursor = store3dEditShelfMode ? "crosshair" : "grab"; return; }
      setMouseFromEvent(e);
      var hits = raycaster.intersectObjects(store3dSlotMeshes);
      store3dSlotMeshes.forEach(function(s) { s.material.opacity = 0; });
      if (hits.length > 0) {
        hits[0].object.material.color.set(0xf59e0b);
        hits[0].object.material.opacity = 0.4;
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "crosshair";
      }
    });

    /* ── Orbit + Shelf Drag ── */
    var theta = 0.3, phi = 1.05, radius = Math.max(16, cfg.numAisles * cfg.aisleGap + 6);
    var isDragging = false, isDraggingShelf = false, prevX = 0, prevY = 0;
    window._3dDragStartX = 0;

    function updateCamera() {
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, UH / 2, 0);
    }

    canvas.addEventListener("mousedown", function(e) {
      window._3dDragStartX = e.clientX;
      store3dAutoRotate = false; updateAutoRotateBtn3d();
      /* Try to initiate shelf drag when in edit mode with a selected shelf */
      if (store3dEditShelfMode && store3dSelectedShelfId) {
        setMouseFromEvent(e);
        var group = store3dShelfGroups[store3dSelectedShelfId];
        if (group) {
          var hits = raycaster.intersectObjects(group.children, true);
          if (hits.length > 0) {
            isDraggingShelf = true;
            raycaster.ray.intersectPlane(dragPlane, dragPt);
            dragOffset.set(group.position.x - dragPt.x, 0, group.position.z - dragPt.z);
            return;
          }
        }
      }
      isDragging = true; prevX = e.clientX; prevY = e.clientY;
    });

    window.addEventListener("mousemove", function(e) {
      if (isDraggingShelf && store3dSelectedShelfId) {
        setMouseFromEvent(e);
        raycaster.ray.intersectPlane(dragPlane, dragPt);
        var group = store3dShelfGroups[store3dSelectedShelfId];
        if (group) {
          group.position.x = Math.round((dragPt.x + dragOffset.x)*10)/10;
          group.position.z = Math.round((dragPt.z + dragOffset.z)*10)/10;
          var xs = document.getElementById("shelf-edit-x"), zs = document.getElementById("shelf-edit-z");
          var xv = document.getElementById("shelf-edit-x-val"), zv = document.getElementById("shelf-edit-z-val");
          if (xs) { xs.value = group.position.x; if (xv) xv.textContent = group.position.x.toFixed(1); }
          if (zs) { zs.value = group.position.z; if (zv) zv.textContent = group.position.z.toFixed(1); }
        }
        return;
      }
      if (!isDragging) return;
      theta -= (e.clientX - prevX) * 0.007;
      phi = Math.max(0.25, Math.min(1.45, phi + (e.clientY - prevY) * 0.007));
      prevX = e.clientX; prevY = e.clientY;
    });

    window.addEventListener("mouseup", function() {
      if (isDraggingShelf && store3dSelectedShelfId) {
        var group = store3dShelfGroups[store3dSelectedShelfId];
        if (group) {
          if (!cfg.unitOverrides) cfg.unitOverrides = {};
          var existing = cfg.unitOverrides[store3dSelectedShelfId] || {};
          cfg.unitOverrides[store3dSelectedShelfId] = Object.assign(existing, { x: group.position.x, z: group.position.z });
          saveStoreConfig(cfg);
        }
      }
      isDraggingShelf = false; isDragging = false;
    });

    canvas.addEventListener("touchstart", function(e) {
      isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
      store3dAutoRotate = false; updateAutoRotateBtn3d(); e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchmove", function(e) {
      if (!isDragging) return;
      theta -= (e.touches[0].clientX - prevX) * 0.007;
      phi = Math.max(0.25, Math.min(1.45, phi + (e.touches[0].clientY - prevY) * 0.007));
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchend", function() { isDragging = false; });

    canvas.addEventListener("wheel", function(e) {
      radius = Math.max(4, Math.min(40, radius + e.deltaY * 0.025));
      e.preventDefault();
    }, { passive: false });

    if (el.btn3dReset) el.btn3dReset.addEventListener("click", function() {
      theta = 0.3; phi = 1.05;
      radius = Math.max(16, cfg.numAisles * cfg.aisleGap + 6);
      store3dAutoRotate = true; updateAutoRotateBtn3d();
    });
    if (el.btn3dAutorotate) el.btn3dAutorotate.addEventListener("click", function() {
      store3dAutoRotate = !store3dAutoRotate; updateAutoRotateBtn3d();
    });

    function updateAutoRotateBtn3d() {
      el.btn3dAutorotate.textContent = "⟳ Auto-rotire: " + (store3dAutoRotate ? "ON" : "OFF");
    }

    window.update3DTheme = function() {
      var t = currentTheme === "techno";
      scene.background = new THREE.Color(t ? 0x06000f : 0x0d1117);
      scene.fog = new THREE.Fog(t ? 0x06000f : 0x0d1117, 25, 55);
      floorMat.color.set(t ? 0x0d0020 : 0x161b22);
    };

    /* Animation */
    function animate() {
      store3dAnimId = requestAnimationFrame(animate);
      if (store3dAutoRotate) theta += 0.004;
      updateCamera();
      renderer.render(scene, camera);
    }
    updateCamera();
    animate();

    /* Resize */
    window.addEventListener("resize", debounce(function() {
      var nW = canvas.parentElement.clientWidth;
      var nH = Math.min(Math.round(nW * 0.65), 520);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    }, 200));

    update3DConfigUI();
  }

  function rebuild3DScene() {
    /* Kill old animation frame */
    if (store3dAnimId) { cancelAnimationFrame(store3dAnimId); store3dAnimId = null; }
    store3dInit = false;
    store3dProductMeshes = [];
    store3dSlotMeshes = [];
    init3DStore();
  }

  /* ── Product Picker Modal for 3D Slots ── */
  function open3DProductPicker(slotKey) {
    var existing = store3dProductMap[slotKey];
    var modal = document.getElementById("modal-3d-picker");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-3d-picker";
      modal.className = "modal";
      modal.innerHTML =
        '<div class="modal-backdrop" onclick="document.getElementById(\'modal-3d-picker\').classList.add(\'hidden\')"></div>' +
        '<div class="modal-box">' +
          '<div class="modal-header">' +
            '<h3 style="font-family:var(--font-display);letter-spacing:.1em">📦 ASOCIAZĂ PRODUS</h3>' +
            '<button class="modal-close" onclick="document.getElementById(\'modal-3d-picker\').classList.add(\'hidden\')">✕</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p class="hint" style="margin-bottom:.75rem">Alege produsul pentru acest slot. Slot: <code id="picker-slot-key" style="color:var(--accent)"></code></p>' +
            '<input type="search" id="picker-search" placeholder="Caută produs…" style="width:100%;margin-bottom:.75rem;padding:.6rem .9rem;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font:inherit" />' +
            '<div id="picker-list" style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem"></div>' +
            '<button type="button" id="btn-picker-clear" style="width:100%;margin-top:.75rem;background:transparent;border:1px solid var(--danger);color:var(--danger);border-radius:10px;padding:.6rem">Elimină produs din slot</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    document.getElementById("picker-slot-key").textContent = slotKey;
    modal.classList.remove("hidden");
    store3dSelectedSlot = slotKey;

    function renderPickerList(q) {
      var list = document.getElementById("picker-list");
      list.innerHTML = "";
      var filtered = state.products.filter(function(p) {
        if (!q) return true;
        return (p.name||"").toLowerCase().includes(q.toLowerCase()) || String(p.ean).includes(q);
      }).slice(0, 40);
      filtered.forEach(function(p) {
        var btn = document.createElement("button");
        btn.type = "button";
        var isCurrent = store3dProductMap[slotKey] === p.id;
        btn.style.cssText = "text-align:left;padding:.55rem .85rem;border-radius:8px;border:1px solid " +
          (isCurrent ? "var(--accent)" : "var(--border)") +
          ";background:" + (isCurrent ? "rgba(245,158,11,.12)" : "var(--surface)") +
          ";color:var(--text);font:inherit;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:.5rem";
        btn.innerHTML = "<span><strong>" + escapeHtml(p.name) + "</strong><br>" +
          "<small style='color:var(--muted)'>EAN: " + escapeHtml(p.ean) + " | " + formatMoney(finalPrice(p.base_price, p.discount_pct)) + "</small></span>" +
          (isCurrent ? "<span style='color:var(--accent);font-size:.8rem'>✓ Curent</span>" : "");
        btn.addEventListener("click", function() {
          store3dProductMap[slotKey] = p.id;
          saveProductMap(store3dProductMap);
          modal.classList.add("hidden");
          rebuild3DScene();
          el.store3dInfo.innerHTML = "<strong style='color:var(--ok)'>✓ Produs asociat:</strong> " + escapeHtml(p.name);
        });
        list.appendChild(btn);
      });
      if (filtered.length === 0) {
        list.innerHTML = "<p class='hint' style='text-align:center;padding:1rem'>Niciun produs găsit</p>";
      }
    }

    renderPickerList("");
    var searchInp = document.getElementById("picker-search");
    searchInp.value = "";
    searchInp.oninput = function() { renderPickerList(searchInp.value); };
    searchInp.focus();

    document.getElementById("btn-picker-clear").onclick = function() {
      delete store3dProductMap[slotKey];
      saveProductMap(store3dProductMap);
      modal.classList.add("hidden");
      rebuild3DScene();
      el.store3dInfo.innerHTML = "<span style='color:var(--muted)'>Slot eliberat.</span>";
    };
  }

  /* ── 3D Config UI binding ── */
  function update3DConfigUI() {
    var cfg = store3dConfig;
    var fields = {
      "cfg-num-aisles":    { val: cfg.numAisles,    min:1, max:4, step:1 },
      "cfg-units-aisle":  { val: cfg.unitsPerAisle, min:1, max:6, step:1 },
      "cfg-shelf-levels": { val: cfg.shelfLevels,   min:2, max:8, step:1 },
      "cfg-unit-width":   { val: cfg.unitWidth,     min:1.0, max:3.0, step:0.1 },
      "cfg-unit-height":  { val: cfg.unitHeight,    min:1.5, max:5.0, step:0.1 },
      "cfg-aisle-gap":    { val: cfg.aisleGap,      min:4,   max:16,  step:0.5 },
      "cfg-unit-spacing": { val: cfg.unitSpacing,   min:1.5, max:4.0, step:0.1 },
    };
    Object.keys(fields).forEach(function(id) {
      var inp = document.getElementById(id);
      var lbl = document.getElementById(id + "-val");
      if (inp) {
        inp.min = fields[id].min; inp.max = fields[id].max; inp.step = fields[id].step;
        inp.value = fields[id].val;
        if (lbl) lbl.textContent = fields[id].val;
        inp.oninput = function() {
          if (lbl) lbl.textContent = Number(inp.value);
        };
      }
    });
  }

  function bind3DControls() {
    /* Config apply — preserve unitOverrides */
    var applyBtn = document.getElementById("btn-3d-apply-config");
    if (applyBtn) {
      applyBtn.addEventListener("click", function() {
        var prevOverrides = store3dConfig.unitOverrides || {};
        store3dConfig = {
          numAisles:    Number(document.getElementById("cfg-num-aisles").value),
          unitsPerAisle:Number(document.getElementById("cfg-units-aisle").value),
          shelfLevels:  Number(document.getElementById("cfg-shelf-levels").value),
          unitWidth:    Number(document.getElementById("cfg-unit-width").value),
          unitHeight:   Number(document.getElementById("cfg-unit-height").value),
          aisleGap:     Number(document.getElementById("cfg-aisle-gap").value),
          unitSpacing:  Number(document.getElementById("cfg-unit-spacing").value),
          unitOverrides: prevOverrides,
        };
        saveStoreConfig(store3dConfig);
        rebuild3DScene();
      });
    }

    /* Config reset — also clears overrides */
    var resetBtn = document.getElementById("btn-3d-reset-config");
    if (resetBtn) {
      resetBtn.addEventListener("click", function() {
        store3dConfig = Object.assign({}, DEFAULT_STORE_CONFIG);
        saveStoreConfig(store3dConfig);
        update3DConfigUI();
        rebuild3DScene();
      });
    }

    /* Edit shelf mode toggle */
    var editShelfBtn = document.getElementById("btn-3d-edit-shelf");
    if (editShelfBtn) {
      editShelfBtn.addEventListener("click", function() {
        store3dEditShelfMode = !store3dEditShelfMode;
        store3dAssignMode = false;
        var assignBtn2 = document.getElementById("btn-3d-assign");
        if (assignBtn2) { assignBtn2.textContent = "🎯 Mod alocare produse"; assignBtn2.style.cssText = ""; }
        store3dSlotMeshes.forEach(function(s) { s.material.opacity = 0; });
        editShelfBtn.textContent = store3dEditShelfMode ? "✅ Ieși din editare rafturi" : "✏ Editează rafturi";
        editShelfBtn.style.background = store3dEditShelfMode ? "rgba(34,197,94,.15)" : "";
        editShelfBtn.style.borderColor = store3dEditShelfMode ? "var(--ok)" : "";
        if (!store3dEditShelfMode) {
          store3dSelectedShelfId = null;
          var pnl = document.getElementById("store3d-shelf-panel");
          if (pnl) pnl.classList.add("hidden");
          el.store3dInfo.innerHTML = "Click pe un produs din raft pentru detalii.";
        } else {
          el.store3dInfo.innerHTML = "<span style='color:var(--ok)'>✏ Mod editare rafturi activ — click pe un raft pentru a-l selecta și trage.</span>";
          if (el.store3dCanvas) el.store3dCanvas.style.cursor = "crosshair";
        }
      });
    }

    /* Shelf X/Z sliders live update */
    ["shelf-edit-x","shelf-edit-z"].forEach(function(slId) {
      var sl = document.getElementById(slId);
      var vl = document.getElementById(slId+"-val");
      if (!sl) return;
      sl.addEventListener("input", function() {
        if (vl) vl.textContent = Number(sl.value).toFixed(1);
        if (!store3dSelectedShelfId) return;
        var group = store3dShelfGroups[store3dSelectedShelfId];
        if (!group) return;
        var xv = Number(document.getElementById("shelf-edit-x").value);
        var zv = Number(document.getElementById("shelf-edit-z").value);
        group.position.x = xv; group.position.z = zv;
      });
      sl.addEventListener("change", function() {
        if (!store3dSelectedShelfId) return;
        var group = store3dShelfGroups[store3dSelectedShelfId];
        if (!group) return;
        if (!store3dConfig.unitOverrides) store3dConfig.unitOverrides = {};
        var ov = store3dConfig.unitOverrides[store3dSelectedShelfId] || {};
        store3dConfig.unitOverrides[store3dSelectedShelfId] = Object.assign(ov, { x: group.position.x, z: group.position.z });
        saveStoreConfig(store3dConfig);
      });
    });

    /* Shelf rotation buttons */
    var rotL = document.getElementById("shelf-rotate-l");
    var rotR = document.getElementById("shelf-rotate-r");
    var rotReset = document.getElementById("shelf-reset-pos");
    if (rotL) rotL.addEventListener("click", function() { rotateSelectedShelf(-Math.PI/2); });
    if (rotR) rotR.addEventListener("click", function() { rotateSelectedShelf(Math.PI/2); });
    if (rotReset) rotReset.addEventListener("click", function() {
      if (!store3dSelectedShelfId) return;
      var meta = store3dShelfMeta[store3dSelectedShelfId];
      var group = store3dShelfGroups[store3dSelectedShelfId];
      if (group && meta) {
        group.position.x = meta.defaultX; group.position.z = meta.defaultZ; group.rotation.y = 0;
        if (store3dConfig.unitOverrides) delete store3dConfig.unitOverrides[store3dSelectedShelfId];
        saveStoreConfig(store3dConfig);
        var xs = document.getElementById("shelf-edit-x"), zs = document.getElementById("shelf-edit-z");
        if (xs) { xs.value = meta.defaultX; document.getElementById("shelf-edit-x-val").textContent = meta.defaultX.toFixed(1); }
        if (zs) { zs.value = meta.defaultZ; document.getElementById("shelf-edit-z-val").textContent = meta.defaultZ.toFixed(1); }
      }
    });

    function rotateSelectedShelf(angle) {
      if (!store3dSelectedShelfId) return;
      var group = store3dShelfGroups[store3dSelectedShelfId];
      if (!group) return;
      group.rotation.y += angle;
      if (!store3dConfig.unitOverrides) store3dConfig.unitOverrides = {};
      var ov = store3dConfig.unitOverrides[store3dSelectedShelfId] || {};
      store3dConfig.unitOverrides[store3dSelectedShelfId] = Object.assign(ov, { rotY: group.rotation.y });
      saveStoreConfig(store3dConfig);
    }

    /* Product dimension sliders */
    function bindProdSlider(slId, vlId, field) {
      var sl = document.getElementById(slId), vl = document.getElementById(vlId);
      if (!sl) return;
      sl.addEventListener("input", function() {
        var v = Number(sl.value); if (vl) vl.textContent = v.toFixed(2);
        if (!store3dSelectedProductMesh) return;
        var ud = store3dSelectedProductMesh.userData;
        ud[field] = v;
        /* Rescale geometry live */
        var newW = (field==="sw") ? slotWForMesh(store3dSelectedProductMesh)*v : store3dSelectedProductMesh.geometry.parameters.width;
        var newH = (field==="bh") ? v : store3dSelectedProductMesh.geometry.parameters.height;
        var newD = (field==="sd") ? slotDForMesh(store3dSelectedProductMesh)*v : store3dSelectedProductMesh.geometry.parameters.depth;
        store3dSelectedProductMesh.geometry.dispose();
        store3dSelectedProductMesh.geometry = new THREE.BoxGeometry(newW, newH, newD);
        store3dSelectedProductMesh.position.y = store3dSelectedProductMesh.position.y - (newH - store3dSelectedProductMesh.geometry.parameters.height)/2;
      });
      sl.addEventListener("change", function() {
        if (!store3dSelectedProductMesh) return;
        var ud = store3dSelectedProductMesh.userData;
        var key = ud.slotKey;
        var scales = store3dProductScales;
        scales[key] = { sw: ud.sw, h: ud.bh, sd: ud.sd };
        saveProductScales(scales);
      });
    }
    bindProdSlider("prod-edit-w","prod-edit-w-val","sw");
    bindProdSlider("prod-edit-h","prod-edit-h-val","bh");
    bindProdSlider("prod-edit-d","prod-edit-d-val","sd");

    function slotWForMesh(mesh) {
      return (mesh.userData.sw && mesh.userData.sw > 0) ? mesh.geometry.parameters.width / mesh.userData.sw : mesh.geometry.parameters.width;
    }
    function slotDForMesh(mesh) {
      return (mesh.userData.sd && mesh.userData.sd > 0) ? mesh.geometry.parameters.depth / mesh.userData.sd : mesh.geometry.parameters.depth;
    }

    /* Assign mode toggle */
    var assignBtn = document.getElementById("btn-3d-assign");
    if (assignBtn) {
      assignBtn.addEventListener("click", function() {
        store3dAssignMode = !store3dAssignMode;
        assignBtn.textContent = store3dAssignMode ? "🔴 Ieși din mod alocare" : "🎯 Mod alocare produse";
        assignBtn.style.background = store3dAssignMode ? "rgba(239,68,68,.15)" : "";
        assignBtn.style.borderColor = store3dAssignMode ? "var(--danger)" : "";
        assignBtn.style.color = store3dAssignMode ? "var(--danger)" : "";
        el.store3dInfo.innerHTML = store3dAssignMode
          ? "<span style='color:var(--accent)'>🎯 Mod alocare activ — Click pe un slot portocaliu pentru a asocia un produs.</span>"
          : "Click pe un produs din raft pentru detalii.";
        var canvas = el.store3dCanvas;
        canvas.style.cursor = store3dAssignMode ? "crosshair" : "grab";
        /* Make slots visible */
        store3dSlotMeshes.forEach(function(s) {
          s.material.opacity = store3dAssignMode ? 0.08 : 0;
        });
      });
    }

    /* Clear all mappings */
    var clearAllBtn = document.getElementById("btn-3d-clear-map");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", function() {
        if (!confirm("Ștergi toate asocierile produse ↔ rafturi?")) return;
        store3dProductMap = {};
        saveProductMap(store3dProductMap);
        rebuild3DScene();
        el.store3dInfo.innerHTML = "<span style='color:var(--muted)'>Toate asocierile au fost șterse.</span>";
      });
    }

    /* Config panel toggle */
    var cfgToggle = document.getElementById("btn-3d-config-toggle");
    var cfgPanel = document.getElementById("store3d-config-panel");
    if (cfgToggle && cfgPanel) {
      cfgToggle.addEventListener("click", function() {
        var hidden = cfgPanel.classList.toggle("hidden");
        cfgToggle.textContent = hidden ? "⚙ Editează magazin" : "⚙ Ascunde editare";
      });
    }
  }

  /* ──────────────────── PRINT / LABEL DESIGNER ──────────────────── */
  function loadTemplatesStore() {
    try { var raw = localStorage.getItem(STORAGE.LABEL_TEMPLATES); return raw ? JSON.parse(raw) : {}; }
    catch(e) { return {}; }
  }

  function saveTemplatesStore(store) { localStorage.setItem(STORAGE.LABEL_TEMPLATES, JSON.stringify(store)); }

  function getTemplateForFormat(format) {
    var store = loadTemplatesStore();
    if (store[format]) return store[format];
    return getDefaultTemplate(format, el.printTemplate ? el.printTemplate.value : "normal");
  }

  function saveTemplateForFormat(format, tpl) {
    var store = loadTemplatesStore();
    store[format] = tpl;
    saveTemplatesStore(store);
  }

  function getDefaultTemplate(format, preset) {
    var dim = PAGE_FORMATS[format] || PAGE_FORMATS.shelf;
    var colors = {
      normal:    { bg:"#ffffff", bar:"#e8231a", text:"#111111", price:"#111111" },
      promo:     { bg:"#ffffff", bar:"#e8231a", text:"#111111", price:"#e8231a" },
      bricopret: { bg:"#ffffff", bar:"#f5c200", text:"#111111", price:"#111111" },
    };
    var c = colors[preset] || colors.normal;

    /* ── Shelf label (90×55mm) — unchanged compact layout ── */
    if (format === "shelf") {
      return {
        pageBg: c.bg,
        elements: [
          { id:"el-top",     type:"rect",    x:0, y:0,  w:90, h:8,  fill:c.bar, stroke:"none", strokeWidth:0 },
          { id:"el-name",    type:"text",    x:4, y:10, w:82, fontSize:11, fontWeight:"700", color:c.text, align:"left", text:"{{name}}" },
          { id:"el-price",   type:"text",    x:4, y:24, w:60, fontSize:20, fontWeight:"700", color:c.price, align:"left", text:"{{price_final}}" },
          { id:"el-shelf",   type:"text",    x:4, y:44, w:50, fontSize:8,  fontWeight:"400", color:c.text, align:"left", text:"Raft: {{shelf}}" },
          { id:"el-barcode", type:"barcode", x:52, y:30, w:36, h:18, lineColor:c.text, displayValue:false },
        ],
      };
    }

    /* ── A5 (148×210mm) ── */
    if (format === "a5") {
      return {
        pageBg: c.bg,
        elements: [
          { id:"el-top",      type:"rect",    x:0,   y:0,    w:148, h:18,   fill:c.bar, stroke:"none", strokeWidth:0 },
          { id:"el-name",     type:"text",    x:74,  y:34,   w:140, fontSize:20, fontWeight:"400", color:c.text, align:"center", text:"{{name}}" },
          { id:"el-oldprice", type:"text",    x:98,  y:84,   w:48,  fontSize:30, fontWeight:"400", color:c.text, align:"center", text:"{{base}}" },
          { id:"el-line",     type:"line",    x1:66, y1:100, x2:132,y2:64,  stroke:c.text, strokeWidth:0.9 },
          { id:"el-price",    type:"text",    x:8,   y:143,  w:138, fontSize:55, fontWeight:"700", color:c.price, align:"left",   text:"{{price_final}}" },
          { id:"el-bot",      type:"rect",    x:0,   y:162,  w:148, h:18,   fill:c.bar, stroke:"none", strokeWidth:0 },
          { id:"el-barcode",  type:"barcode", x:8,   y:186,  w:132, h:18,   lineColor:c.text, displayValue:true },
          { id:"el-valid",    type:"text",    x:8,   y:206,  w:132, fontSize:8,  fontWeight:"400", color:c.text, align:"left",   text:"valabil de la {{valid_until}}" },
        ],
      };
    }

    /* ── A4 (210×297mm) ── */
    return {
      pageBg: c.bg,
      elements: [
        { id:"el-top",      type:"rect",    x:0,   y:0,    w:210, h:25,   fill:c.bar, stroke:"none", strokeWidth:0 },
        { id:"el-name",     type:"text",    x:105, y:44,   w:202, fontSize:28, fontWeight:"400", color:c.text, align:"center", text:"{{name}}" },
        { id:"el-oldprice", type:"text",    x:138, y:112,  w:68,  fontSize:42, fontWeight:"400", color:c.text, align:"center", text:"{{base}}" },
        { id:"el-line",     type:"line",    x1:94, y1:133, x2:186,y2:89,  stroke:c.text, strokeWidth:1.1 },
        { id:"el-price",    type:"text",    x:10,  y:198,  w:195, fontSize:78, fontWeight:"700", color:c.price, align:"left",   text:"{{price_final}}" },
        { id:"el-bot",      type:"rect",    x:0,   y:224,  w:210, h:25,   fill:c.bar, stroke:"none", strokeWidth:0 },
        { id:"el-barcode",  type:"barcode", x:10,  y:258,  w:185, h:26,   lineColor:c.text, displayValue:true },
        { id:"el-valid",    type:"text",    x:10,  y:289,  w:193, fontSize:11, fontWeight:"400", color:c.text, align:"left",   text:"valabil de la {{valid_until}}" },
      ],
    };
  }

  function substitutePlaceholders(str, product) {
    var price = finalPrice(product.base_price || product.basePrice, product.discount_pct || product.discountPct);
    var map = {
      name: product.name || "",
      ean: String(product.ean || ""),
      price_final: price.toFixed(2) + " RON",
      base: (Number(product.base_price || product.basePrice) || 0).toFixed(2),
      discount: String(product.discount_pct || product.discountPct || 0),
      shelf: product.shelf || "—",
      valid_until: product.valid_until || product.validUntil || "—",
    };
    return String(str || "").replace(/\{\{(\w+)\}\}/g, function(_, key) { return map[key] !== undefined ? map[key] : ""; });
  }

  function renderBarcodeInto(host, product, eldef) {
    host.innerHTML = "";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    host.appendChild(svg);
    try {
      JsBarcode(svg, String(product.ean), { format:"EAN13", displayValue:eldef.displayValue!==false, lineColor:eldef.lineColor||"#000000", margin:2 });
    } catch(e1) {
      try { JsBarcode(svg, String(product.ean), { format:"CODE128", displayValue:eldef.displayValue!==false, lineColor:eldef.lineColor||"#000000", margin:2 }); }
      catch(e2) { host.textContent = "EAN " + product.ean; return; }
    }
    var svgEl = host.querySelector("svg");
    if (svgEl) { svgEl.style.width="100%"; svgEl.style.height="auto"; svgEl.style.maxHeight="100%"; }
  }

  function mountElementsIntoSheet(sheet, product, format, tpl, mode) {
    var dim = PAGE_FORMATS[format] || PAGE_FORMATS.shelf;
    sheet.style.width = dim.w + "mm";
    sheet.style.height = dim.h + "mm";
    sheet.style.background = tpl.pageBg || "#fff";
    if (mode === "designer") sheet.className = "label-sheet label-sheet--custom " + dim.className;
    sheet.innerHTML = "";
    tpl.elements.forEach(function(def) {
      var node = createElementNode(def, product, format, dim, mode);
      if (node) sheet.appendChild(node);
    });
  }

  function createElementNode(def, product, format, dim, mode) {
    var isDesigner = mode === "designer";
    var wrap = document.createElement("div");
    wrap.className = "label-el label-el--" + def.type;
    wrap.setAttribute("data-el-id", def.id);
    if (isDesigner && designState.selectedId === def.id) wrap.classList.add("label-el--selected");
    if (def.type !== "line") {
      wrap.style.left = (def.x != null ? def.x : 0) + "mm";
      wrap.style.top = (def.y != null ? def.y : 0) + "mm";
    }
    if (def.type === "text") {
      wrap.classList.add("label-el-text");
      wrap.style.width = (def.w || dim.w - 4) + "mm";
      wrap.style.fontSize = (def.fontSize || 12) + "pt";
      wrap.style.color = def.color || "#111";
      wrap.style.fontWeight = def.fontWeight || "400";
      wrap.style.textAlign = def.align || "left";
      wrap.textContent = substitutePlaceholders(def.text || "", product);
      if (isDesigner) { wrap.style.minHeight = "1.2em"; wrap.style.border = "1px dashed rgba(128,128,128,0.35)"; }
    } else if (def.type === "barcode") {
      wrap.style.width = (def.w || 70) + "mm"; wrap.style.height = (def.h || 16) + "mm";
      var inner = document.createElement("div");
      inner.className = "label-el-barcode"; inner.style.width="100%"; inner.style.height="100%";
      wrap.appendChild(inner); renderBarcodeInto(inner, product, def);
    } else if (def.type === "line") {
      wrap.style.left="0"; wrap.style.top="0";
      wrap.style.width=dim.w+"mm"; wrap.style.height=dim.h+"mm"; wrap.style.pointerEvents="none";
      var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("width","100%"); svg.setAttribute("height","100%");
      svg.setAttribute("viewBox","0 0 "+dim.w+" "+dim.h); svg.setAttribute("preserveAspectRatio","none");
      var line=document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",String(def.x1!=null?def.x1:0)); line.setAttribute("y1",String(def.y1!=null?def.y1:0));
      line.setAttribute("x2",String(def.x2!=null?def.x2:dim.w)); line.setAttribute("y2",String(def.y2!=null?def.y2:def.y1||0));
      line.setAttribute("stroke",def.stroke||"#000"); line.setAttribute("stroke-width",String(def.strokeWidth!=null?def.strokeWidth:0.4));
      line.setAttribute("vector-effect","non-scaling-stroke");
      svg.appendChild(line); wrap.appendChild(svg); wrap.classList.add("label-el-line");
    } else if (def.type === "rect") {
      wrap.style.width=(def.w||10)+"mm"; wrap.style.height=(def.h||10)+"mm";
      wrap.style.left=def.x+"mm"; wrap.style.top=def.y+"mm";
      wrap.style.background=def.fill==="none"||!def.fill?"transparent":def.fill;
      wrap.style.border=(def.strokeWidth||0.3)+"mm solid "+(def.stroke||"#333");
      wrap.style.borderRadius=(def.rx||0)+"mm";
    } else if (def.type === "check") {
      var sz=def.size||6;
      wrap.style.width=sz+"mm"; wrap.style.height=sz+"mm";
      wrap.style.left=def.x+"mm"; wrap.style.top=def.y+"mm";
      var svg2=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg2.setAttribute("viewBox","0 0 32 32");
      var path=document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d","M6 16 L13 23 L26 8"); path.setAttribute("fill","none");
      path.setAttribute("stroke",def.color||"#000"); path.setAttribute("stroke-width",def.strokeWidth!=null?def.strokeWidth*3:3);
      path.setAttribute("stroke-linecap","round"); path.setAttribute("stroke-linejoin","round");
      svg2.appendChild(path); wrap.appendChild(svg2); wrap.classList.add("label-el-check");
    }
    if (isDesigner && def.type !== "line") {
      wrap.addEventListener("mousedown", function(e) {
        e.preventDefault(); e.stopPropagation();
        designState.selectedId = def.id;
        syncDesignerElementPick(); remountDesignerCanvasOnly(); refreshDesignerInspector();
        startDragDesigner(e, def, format);
      });
    }
    return wrap;
  }

  function sampleProduct() {
    var ids = getSelectedProductIds();
    if (ids.length) {
      var p = state.products.find(function(x) { return x.id === ids[0]; });
      if (p) return p;
    }
    return { id:"sample", ean:"5901234123457", name:"Produs exemplu", base_price:19.99, discount_pct:10, shelf:"A / 4", valid_until:"" };
  }

  function startDragDesigner(e, def, format) {
    var tpl = getTemplateForFormat(format);
    var dim = PAGE_FORMATS[format];
    var host = el.designerCanvasHost;
    var rect = host.getBoundingClientRect();
    var scale = rect.width / dim.w;
    var startX = e.clientX, startY = e.clientY;
    var orig = JSON.parse(JSON.stringify(def));
    function onMove(ev) {
      var dx=(ev.clientX-startX)/scale, dy=(ev.clientY-startY)/scale;
      var item=tpl.elements.find(function(x){return x.id===def.id;});
      if (!item) return;
      if (item.type==="line") {
        item.x1=round2((orig.x1!=null?orig.x1:0)+dx); item.x2=round2((orig.x2!=null?orig.x2:dim.w)+dx);
        item.y1=round2((orig.y1!=null?orig.y1:0)+dy); item.y2=round2((orig.y2!=null?orig.y2:0)+dy);
      } else { item.x=round2((orig.x!=null?orig.x:0)+dx); item.y=round2((orig.y!=null?orig.y:0)+dy); }
      remountDesignerCanvasOnly();
    }
    function onUp() {
      document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp);
      saveTemplateForFormat(format,tpl); remountDesignerCanvasOnly(); refreshDesignerInspector(); populateDesignerElementPick();
    }
    document.addEventListener("mousemove",onMove); document.addEventListener("mouseup",onUp);
  }

  function remountDesignerCanvasOnly() {
    var format=el.printFormat.value; applyDesignerScale(format);
    mountElementsIntoSheet(el.designerCanvasHost, sampleProduct(), format, getTemplateForFormat(format), "designer");
  }

  function applyDesignerScale(format) {
    var dim=PAGE_FORMATS[format];
    var maxW=Math.min(520,window.innerWidth-40);
    var scale=Math.min(1.15,(maxW/dim.w)/((96/25.4)*1));
    if (dim.w>120) scale=Math.min(scale,0.55);
    el.designerScaleInner.style.transform="scale("+scale.toFixed(3)+")";
    el.designerScaleInner.style.transformOrigin="top left";
  }

  function refreshDesignerCanvas() {
    var format=el.printFormat.value; applyDesignerScale(format);
    var tpl=getTemplateForFormat(format);
    if (el.pageBgColor) el.pageBgColor.value=tpl.pageBg||"#ffffff";
    mountElementsIntoSheet(el.designerCanvasHost, sampleProduct(), format, tpl, "designer");
    populateDesignerElementPick(); refreshDesignerInspector();
  }

  function populateDesignerElementPick() {
    if (!el.designerElementPick) return;
    var format=el.printFormat.value, tpl=getTemplateForFormat(format), sel=designState.selectedId;
    el.designerElementPick.innerHTML='<option value="">— alege element —</option>';
    tpl.elements.forEach(function(d) {
      var opt=document.createElement("option");
      opt.value=d.id; opt.textContent=d.type+" · "+d.id.slice(-6);
      if (d.id===sel) opt.selected=true;
      el.designerElementPick.appendChild(opt);
    });
  }

  function syncDesignerElementPick() {
    if (el.designerElementPick) el.designerElementPick.value=designState.selectedId||"";
  }

  function findElementDef(id) {
    var tpl=getTemplateForFormat(el.printFormat.value);
    return tpl.elements.find(function(x){return x.id===id;});
  }

  function refreshDesignerInspector() {
    if (!el.inspectorForm) return;
    var id=designState.selectedId;
    if (!id) { el.inspectorEmpty.classList.remove("hidden"); el.inspectorForm.classList.add("hidden"); el.inspectorForm.innerHTML=""; return; }
    var def=findElementDef(id);
    if (!def) { el.inspectorEmpty.classList.remove("hidden"); el.inspectorForm.classList.add("hidden"); el.inspectorForm.innerHTML=""; return; }
    el.inspectorEmpty.classList.add("hidden"); el.inspectorForm.classList.remove("hidden");
    var html="";
    if (def.type==="text") {
      html='<div class="inspector-row full"><label>Conținut<textarea id="in-text" rows="3">'+escapeHtml(def.text||"")+'</textarea></label></div>'+
        '<div class="inspector-row"><label>X (mm)<input type="number" step="0.1" id="in-x" value="'+def.x+'" /></label><label>Y (mm)<input type="number" step="0.1" id="in-y" value="'+def.y+'" /></label></div>'+
        '<div class="inspector-row"><label>Lățime (mm)<input type="number" step="0.1" id="in-w" value="'+(def.w||"")+'" /></label><label>Font (pt)<input type="number" step="0.5" id="in-fs" value="'+(def.fontSize||12)+'" /></label></div>'+
        '<div class="inspector-row"><label>Culoare<input type="color" id="in-color" value="'+toHexColor(def.color)+'" /></label><label>Grosime<select id="in-fw"><option value="400"'+(def.fontWeight==="400"?" selected":"")+'>Normal</option><option value="700"'+(def.fontWeight==="700"?" selected":"")+'>Bold</option></select></label></div>'+
        '<div class="inspector-row full"><label>Aliniere<select id="in-al"><option value="left">Stânga</option><option value="center"'+(def.align==="center"?" selected":"")+'>Centru</option><option value="right"'+(def.align==="right"?" selected":"")+'>Dreapta</option></select></label></div>';
    } else if (def.type==="barcode") {
      html='<div class="inspector-row"><label>X<input type="number" step="0.1" id="in-x" value="'+def.x+'" /></label><label>Y<input type="number" step="0.1" id="in-y" value="'+def.y+'" /></label></div>'+
        '<div class="inspector-row"><label>Lățime<input type="number" step="0.1" id="in-w" value="'+(def.w||70)+'" /></label><label>Înălțime<input type="number" step="0.1" id="in-h" value="'+(def.h||16)+'" /></label></div>'+
        '<div class="inspector-row"><label>Culoare<input type="color" id="in-lc" value="'+toHexColor(def.lineColor)+'" /></label><label>Afișează text<input type="checkbox" id="in-dv"'+(def.displayValue!==false?" checked":"")+' /></label></div>';
    } else if (def.type==="line") {
      html='<div class="inspector-row"><label>X1<input type="number" step="0.1" id="in-x1" value="'+def.x1+'" /></label><label>Y1<input type="number" step="0.1" id="in-y1" value="'+def.y1+'" /></label></div>'+
        '<div class="inspector-row"><label>X2<input type="number" step="0.1" id="in-x2" value="'+def.x2+'" /></label><label>Y2<input type="number" step="0.1" id="in-y2" value="'+def.y2+'" /></label></div>'+
        '<div class="inspector-row"><label>Culoare<input type="color" id="in-st" value="'+toHexColor(def.stroke)+'" /></label><label>Grosime<input type="number" step="0.05" id="in-sw" value="'+(def.strokeWidth||0.4)+'" /></label></div>';
    } else if (def.type==="rect") {
      html='<div class="inspector-row"><label>X<input type="number" step="0.1" id="in-x" value="'+def.x+'" /></label><label>Y<input type="number" step="0.1" id="in-y" value="'+def.y+'" /></label></div>'+
        '<div class="inspector-row"><label>Lățime<input type="number" step="0.1" id="in-w" value="'+def.w+'" /></label><label>Înălțime<input type="number" step="0.1" id="in-h" value="'+def.h+'" /></label></div>'+
        '<div class="inspector-row"><label>Umple<input type="color" id="in-fill" value="'+rectFillToColor(def.fill)+'" /></label><label>Contur<input type="color" id="in-stk" value="'+toHexColor(def.stroke)+'" /></label></div>'+
        '<div class="inspector-row"><label>Grosime<input type="number" step="0.05" id="in-sw" value="'+(def.strokeWidth||0.3)+'" /></label><label>Colțuri<input type="number" step="0.1" id="in-rx" value="'+(def.rx||0)+'" /></label></div>';
    } else if (def.type==="check") {
      html='<div class="inspector-row"><label>X<input type="number" step="0.1" id="in-x" value="'+def.x+'" /></label><label>Y<input type="number" step="0.1" id="in-y" value="'+def.y+'" /></label></div>'+
        '<div class="inspector-row"><label>Dimensiune<input type="number" step="0.1" id="in-sz" value="'+(def.size||6)+'" /></label><label>Culoare<input type="color" id="in-co" value="'+toHexColor(def.color)+'" /></label></div>';
    }
    el.inspectorForm.innerHTML = html;
    bindInspectorFields(def);
  }

  function bindInspectorFields(def) {
    var format=el.printFormat.value, tpl=getTemplateForFormat(format);
    function commit() { saveTemplateForFormat(format,tpl); remountDesignerCanvasOnly(); populateDesignerElementPick(); }
    var item=tpl.elements.find(function(x){return x.id===def.id;});
    if (!item) return;
    if (item.type==="text") {
      var ta=el.inspectorForm.querySelector("#in-text"), ix=el.inspectorForm.querySelector("#in-x"), iy=el.inspectorForm.querySelector("#in-y");
      var iw=el.inspectorForm.querySelector("#in-w"), fs=el.inspectorForm.querySelector("#in-fs"), col=el.inspectorForm.querySelector("#in-color");
      var fw=el.inspectorForm.querySelector("#in-fw"), al=el.inspectorForm.querySelector("#in-al");
      var dbt=debounce(function(){saveTemplateForFormat(format,tpl);remountDesignerCanvasOnly();},280);
      if (ta) ta.addEventListener("input",function(){item.text=ta.value;dbt();});
      [ix,iy,iw,fs].forEach(function(inp){if(inp)inp.addEventListener("change",function(){item.x=parseFloat(ix.value)||0;item.y=parseFloat(iy.value)||0;item.w=parseFloat(iw.value)||10;item.fontSize=parseFloat(fs.value)||10;commit();});});
      if (col) col.addEventListener("input",function(){item.color=col.value;commit();});
      if (fw) fw.addEventListener("change",function(){item.fontWeight=fw.value;commit();});
      if (al) al.addEventListener("change",function(){item.align=al.value;commit();});
    } else if (item.type==="barcode") {
      bindNumXYWH(item,commit);
      var lc=el.inspectorForm.querySelector("#in-lc"), dv=el.inspectorForm.querySelector("#in-dv");
      if (lc) lc.addEventListener("input",function(){item.lineColor=lc.value;commit();});
      if (dv) dv.addEventListener("change",function(){item.displayValue=dv.checked;commit();});
    } else if (item.type==="line") {
      var x1=el.inspectorForm.querySelector("#in-x1"),y1=el.inspectorForm.querySelector("#in-y1"),x2=el.inspectorForm.querySelector("#in-x2"),y2=el.inspectorForm.querySelector("#in-y2"),st=el.inspectorForm.querySelector("#in-st"),sw=el.inspectorForm.querySelector("#in-sw");
      [x1,y1,x2,y2,sw].forEach(function(inp){if(inp)inp.addEventListener("change",function(){item.x1=parseFloat(x1.value);item.y1=parseFloat(y1.value);item.x2=parseFloat(x2.value);item.y2=parseFloat(y2.value);item.strokeWidth=parseFloat(sw.value);commit();});});
      if (st) st.addEventListener("input",function(){item.stroke=st.value;commit();});
    } else if (item.type==="rect") {
      bindNumXYWH(item,commit);
      var fill=el.inspectorForm.querySelector("#in-fill"),stk=el.inspectorForm.querySelector("#in-stk"),sw2=el.inspectorForm.querySelector("#in-sw"),rx=el.inspectorForm.querySelector("#in-rx");
      if (fill) fill.addEventListener("input",function(){item.fill=fill.value;commit();});
      if (stk) stk.addEventListener("input",function(){item.stroke=stk.value;commit();});
      if (sw2) sw2.addEventListener("change",function(){item.strokeWidth=parseFloat(sw2.value);commit();});
      if (rx) rx.addEventListener("change",function(){item.rx=parseFloat(rx.value);commit();});
    } else if (item.type==="check") {
      var ix2=el.inspectorForm.querySelector("#in-x"),iy2=el.inspectorForm.querySelector("#in-y"),sz=el.inspectorForm.querySelector("#in-sz"),co=el.inspectorForm.querySelector("#in-co");
      [ix2,iy2,sz].forEach(function(inp){if(inp)inp.addEventListener("change",function(){item.x=parseFloat(ix2.value)||0;item.y=parseFloat(iy2.value)||0;item.size=parseFloat(sz.value)||6;commit();});});
      if (co) co.addEventListener("input",function(){item.color=co.value;commit();});
    }
  }

  function bindNumXYWH(item,commit) {
    var ix=el.inspectorForm.querySelector("#in-x"),iy=el.inspectorForm.querySelector("#in-y"),iw=el.inspectorForm.querySelector("#in-w"),ih=el.inspectorForm.querySelector("#in-h");
    [ix,iy,iw,ih].forEach(function(inp){if(inp)inp.addEventListener("change",function(){item.x=parseFloat(ix?ix.value:0)||0;item.y=parseFloat(iy?iy.value:0)||0;if(iw)item.w=parseFloat(iw.value)||10;if(ih)item.h=parseFloat(ih.value)||10;commit();});});
  }

  function addElement(type) {
    var format=el.printFormat.value, tpl=getTemplateForFormat(format), dim=PAGE_FORMATS[format];
    var id="el-"+Date.now(), def;
    if (type==="text")    def={id:id,type:"text",   x:4,y:4,w:dim.w-8,fontSize:12,fontWeight:"400",color:"#111",align:"left",text:"Nou text"};
    if (type==="barcode") def={id:id,type:"barcode",x:4,y:4,w:60,h:14,lineColor:"#000",displayValue:true};
    if (type==="line")    def={id:id,type:"line",   x1:0,y1:dim.h/2,x2:dim.w,y2:dim.h/2,stroke:"#000",strokeWidth:0.4};
    if (type==="rect")    def={id:id,type:"rect",   x:4,y:4,w:20,h:10,fill:"transparent",stroke:"#333",strokeWidth:0.3,rx:0};
    if (type==="check")   def={id:id,type:"check",  x:4,y:4,size:6,color:"#000",strokeWidth:0.35};
    if (!def) return;
    tpl.elements.push(def); saveTemplateForFormat(format,tpl);
    designState.selectedId=id; refreshDesignerCanvas();
  }

  function moveElementLayer(dir) {
    var id=designState.selectedId; if (!id) return;
    var format=el.printFormat.value, tpl=getTemplateForFormat(format);
    var idx=tpl.elements.findIndex(function(x){return x.id===id;}); if (idx<0) return;
    var newIdx=idx+dir; if (newIdx<0||newIdx>=tpl.elements.length) return;
    var tmp=tpl.elements[idx]; tpl.elements[idx]=tpl.elements[newIdx]; tpl.elements[newIdx]=tmp;
    saveTemplateForFormat(format,tpl); refreshDesignerCanvas();
  }

  function duplicateElement() {
    var id=designState.selectedId; if (!id) return;
    var format=el.printFormat.value, tpl=getTemplateForFormat(format);
    var def=tpl.elements.find(function(x){return x.id===id;}); if (!def) return;
    var copy=JSON.parse(JSON.stringify(def)); copy.id="el-"+Date.now();
    if (copy.x!=null){copy.x=round2(copy.x+3);copy.y=round2(copy.y+3);}
    tpl.elements.push(copy); saveTemplateForFormat(format,tpl);
    designState.selectedId=copy.id; refreshDesignerCanvas();
  }

  function deleteSelectedElement() {
    var id=designState.selectedId; if (!id) return;
    var format=el.printFormat.value, tpl=getTemplateForFormat(format);
    tpl.elements=tpl.elements.filter(function(x){return x.id!==id;});
    saveTemplateForFormat(format,tpl); designState.selectedId=null; refreshDesignerCanvas();
  }

  function getSelectedProductIds() {
    return Array.from(document.querySelectorAll(".sel-p:checked")).map(function(x){return x.getAttribute("data-id");});
  }

  function previewLabels() {
    var ids=getSelectedProductIds();
    if (!ids.length){alert("Selectează cel puțin un produs din lista Produse.");return;}
    var format=el.printFormat.value, tpl=getTemplateForFormat(format), dim=PAGE_FORMATS[format];
    el.printPreviewArea.innerHTML=""; el.printPreviewArea.classList.remove("hidden");
    ids.forEach(function(id){
      var p=state.products.find(function(x){return x.id===id;}); if (!p) return;
      var sheet=document.createElement("div");
      sheet.className="label-sheet label-sheet--render "+dim.className;
      mountElementsIntoSheet(sheet,p,format,tpl,"render");
      el.printPreviewArea.appendChild(sheet);
    });
  }

  function printBatch() {
    if (el.printPreviewArea.classList.contains("hidden")||!el.printPreviewArea.children.length) previewLabels();
    setTimeout(function(){window.print();},200);
  }

  if (el.toggleDesigner) {
    el.toggleDesigner.addEventListener("change",function(){
      el.labelDesigner.classList.toggle("hidden",!el.toggleDesigner.checked);
      if (el.toggleDesigner.checked) refreshDesignerCanvas();
    });
  }
  if (el.pageBgColor) {
    el.pageBgColor.addEventListener("input",function(){
      var format=el.printFormat.value, tpl=getTemplateForFormat(format);
      tpl.pageBg=el.pageBgColor.value; saveTemplateForFormat(format,tpl); remountDesignerCanvasOnly();
    });
  }
  if (el.printFormat) el.printFormat.addEventListener("change",function(){if(el.toggleDesigner&&el.toggleDesigner.checked)refreshDesignerCanvas();});
  if (el.btnAddText) el.btnAddText.addEventListener("click",function(){addElement("text");});
  if (el.btnAddBarcode) el.btnAddBarcode.addEventListener("click",function(){addElement("barcode");});
  if (el.btnAddLine) el.btnAddLine.addEventListener("click",function(){addElement("line");});
  if (el.btnAddRect) el.btnAddRect.addEventListener("click",function(){addElement("rect");});
  if (el.btnAddCheck) el.btnAddCheck.addEventListener("click",function(){addElement("check");});
  if (el.btnElUp) el.btnElUp.addEventListener("click",function(){moveElementLayer(-1);});
  if (el.btnElDown) el.btnElDown.addEventListener("click",function(){moveElementLayer(1);});
  if (el.btnDuplicateEl) el.btnDuplicateEl.addEventListener("click",duplicateElement);
  if (el.btnDeleteEl) el.btnDeleteEl.addEventListener("click",deleteSelectedElement);
  if (el.btnApplyPresetLayout) {
    el.btnApplyPresetLayout.addEventListener("click",function(){
      if (!confirm("Înlocuiești layout-ul cu presetul selectat?")) return;
      var format=el.printFormat.value;
      saveTemplateForFormat(format,getDefaultTemplate(format,el.printTemplate.value));
      var tpl=getTemplateForFormat(format);
      if (el.pageBgColor) el.pageBgColor.value=tpl.pageBg||"#ffffff";
      if (el.toggleDesigner&&el.toggleDesigner.checked) refreshDesignerCanvas();
    });
  }
  if (el.btnResetTemplate) {
    el.btnResetTemplate.addEventListener("click",function(){
      if (!confirm("Resetezi șablonul la valorile implicite?")) return;
      var format=el.printFormat.value;
      saveTemplateForFormat(format,getDefaultTemplate(format,el.printTemplate.value));
      var tpl=getTemplateForFormat(format);
      if (el.pageBgColor) el.pageBgColor.value=tpl.pageBg||"#ffffff";
      designState.selectedId=null; refreshDesignerCanvas();
    });
  }
  if (el.designerElementPick) {
    el.designerElementPick.addEventListener("change",function(){
      designState.selectedId=el.designerElementPick.value||null;
      remountDesignerCanvasOnly(); refreshDesignerInspector();
    });
  }
  if (el.btnPreviewLabels) el.btnPreviewLabels.addEventListener("click",previewLabels);
  if (el.btnPrintBatch) el.btnPrintBatch.addEventListener("click",printBatch);

  window.addEventListener("resize",debounce(function(){
    if (el.toggleDesigner&&el.toggleDesigner.checked) applyDesignerScale(el.printFormat.value);
  },200));

  document.addEventListener("keydown",function(e){
    if (!el.toggleDesigner||!el.toggleDesigner.checked) return;
    if (e.key!=="Delete"&&e.key!=="Backspace") return;
    var t=e.target;
    if (t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT")) return;
    if (designState.selectedId){e.preventDefault();deleteSelectedElement();}
  });

  /* ──────────────────── BOOT ──────────────────── */
  var sess = loadSession();
  if (sess && sess.token) {
    showMain();
  } else {
    initAuthView();
  }

})();
