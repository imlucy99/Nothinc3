// ===================== KONFIGURASI =====================
const CONFIG = {
    unit: 'MPH',          // 'MPH' atau 'KMH' (angka digital di layar tengah)
    rpmMax: 8,            // Skala RPM di dial luar (x1000 r/min)
    redline: 0.85,        // Mulai zona merah RPM (0.0 - 1.0)
    psiMax: 100,          // Engine health 100% = N PSI (ubah ke 1000 untuk menampilkan nilai health apa adanya)
    clock12h: true,       // true = format 12 jam (AM/PM), false = 24 jam

    // Intro / brand
    brandText: 'ANNIS',   // Teks animasi. Jika logo.png ada, otomatis diganti logo
    brandLogo: 'logo.png',
    intro: true,          // Mainkan intro saat HUD baru dipakai

    // Chime
    chimeVolume: 0.35,        // 0.0 - 1.0
    fuelWarn: 0.2,            // Chime bensin saat di bawah 20%
    fuelRepeatMs: 30000,      // Ulangi chime bensin tiap N ms selama masih rendah (0 = sekali saja)
    seatbeltRepeatMs: 5000    // Ulangi chime seatbelt tiap N ms selama belum dipakai (0 = sekali saja)
};

const MPS_TO_MPH = 2.236936;
const MPS_TO_KMH = 3.6;
const SPEED_FACTOR = CONFIG.unit === 'KMH' ? MPS_TO_KMH : MPS_TO_MPH;

// Geometri dial (viewBox SVG 400 x 400)
const CX = 200;
const CY = 200;
const R_TICK = 178;
const R_LABEL = 126;
const START_ANGLE = 135;   // posisi angka 0 (derajat, searah jarum jam dari kanan)
const SWEEP = 270;         // total sudut dari 0 sampai rpmMax
const SVG_NS = 'http://www.w3.org/2000/svg';

// Elemen DOM
const elHud = document.getElementById('hud');
const elSpeed = document.getElementById('speed-display');
const elGear = document.getElementById('gear');
const elOdo = document.getElementById('odometer');
const elClock = document.getElementById('clock');
const elNeedle = document.getElementById('needle');
const elIntro = document.getElementById('intro');
const elBrand = document.getElementById('brand');
const elFuelValue = document.getElementById('fuel-value');
const elHealthValue = document.getElementById('health-value');

const params = new URLSearchParams(location.search);
if (params.has('preview')) document.documentElement.classList.add('preview');

// ===================== MEMBANGUN DIAL RPM =====================
function polar(radius, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function fractionToAngle(f) {
    return START_ANGLE + Math.max(0, Math.min(1, f)) * SWEEP;
}

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function buildDial() {
    const ticks = document.getElementById('ticks');
    const labels = document.getElementById('labels');

    // Tick tiap 100 rpm, sedang tiap 500, besar + angka tiap 1000
    const steps = CONFIG.rpmMax * 10;
    const minorFrag = document.createDocumentFragment();
    for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const angle = fractionToAngle(f);
        const red = f >= CONFIG.redline;
        let cls = 'tick-minor';
        let len = 6;
        if (i % 10 === 0) { cls = 'tick-major'; len = 18; }
        else if (i % 5 === 0) { cls = 'tick-mid'; len = 11; }

        const [x1, y1] = polar(R_TICK, angle);
        const [x2, y2] = polar(R_TICK - len, angle);
        const line = svgEl('line', {
            x1: x1.toFixed(2), y1: y1.toFixed(2),
            x2: x2.toFixed(2), y2: y2.toFixed(2),
            class: cls + (red ? ' red' : '')
        });
        (cls === 'tick-minor' ? minorFrag : ticks).appendChild(line);

        if (cls === 'tick-major') {
            const [lx, ly] = polar(R_LABEL, angle);
            const text = svgEl('text', {
                x: lx.toFixed(2), y: ly.toFixed(2),
                class: 'tick-label' + (red ? ' red' : '')
            });
            text.textContent = i / 10;
            labels.appendChild(text);
        }
    }
    ticks.insertBefore(minorFrag, ticks.firstChild);

    document.getElementById('speed-mode').innerText = CONFIG.unit === 'KMH' ? 'KM/H' : 'MPH';
    document.getElementById('odo-unit').innerText = CONFIG.unit === 'KMH' ? 'km' : 'mi';
}

buildDial();

// ===================== ANIMASI JARUM (RPM) =====================
let needleTarget = START_ANGLE;
let needleCurrent = START_ANGLE;

function renderNeedle() {
    needleCurrent += (needleTarget - needleCurrent) * 0.25;
    if (Math.abs(needleTarget - needleCurrent) < 0.01) needleCurrent = needleTarget;
    elNeedle.setAttribute('transform', `translate(${CX} ${CY}) rotate(${needleCurrent.toFixed(2)})`);
    requestAnimationFrame(renderNeedle);
}
requestAnimationFrame(renderNeedle);

// ===================== JAM =====================
function tickClock() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    if (!elClock) return;
    const h = d.getHours();
    if (CONFIG.clock12h) {
        elClock.textContent = (h % 12 || 12) + ':' + p(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM');
    } else {
        elClock.textContent = p(h) + ':' + p(d.getMinutes());
    }
}
tickClock();
setInterval(tickClock, 1000);

// ===================== CHIME (Web Audio, tanpa file suara) =====================
let audioCtx = null;

function getAudio() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
    return audioCtx;
}

// Buka kunci audio saat ada interaksi pertama (kebijakan autoplay browser)
['click', 'keydown', 'touchstart', 'mousedown'].forEach(function (evt) {
    window.addEventListener(evt, getAudio, { once: true });
});

function tone(freq, offset, duration) {
    const ctx = getAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + offset;
    const vol = Math.max(0, Math.min(1, CONFIG.chimeVolume));

    [[freq, 1], [freq * 2, 0.25]].forEach(function (p) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = p[0];
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol * p[1], t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
    });
}

const CHIMES = {
    // ding-ding ... ding-ding (nada naik-turun, tegas)
    seatbelt: [[1318.5, 0, 0.25], [1046.5, 0.2, 0.3], [1318.5, 0.6, 0.25], [1046.5, 0.8, 0.4]],
    // tiga nada turun (peringatan bensin)
    fuel: [[880, 0, 0.3], [698.5, 0.26, 0.3], [523.25, 0.52, 0.55]]
};

function playChime(type) {
    (CHIMES[type] || []).forEach(function (n) { tone(n[0], n[1], n[2]); });
}
window.playChime = playChime; // tes manual: playChime('seatbelt') / playChime('fuel')

// ===================== HELPER =====================
function isTrueValue(val) {
    return val === true || val === 1 || val === "1" || val === "true";
}

function tween(from, to, ms, fn, done) {
    const t0 = performance.now();
    (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        fn(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
        else if (done) done();
    })(t0);
}

// ===================== INTRO (ANNIS / logo.png) =====================
let logoOK = false;
let introActive = false;
let introId = 0;
let lastSpeed = 0;
let lastRPM = 0;

function probeLogo(cb) {
    let finished = false;
    const fin = function (ok) {
        if (finished) return;
        finished = true;
        logoOK = ok;
        cb();
    };
    const probe = new Image();
    probe.onload = function () { fin(true); };
    probe.onerror = function () { fin(false); };
    setTimeout(function () { fin(false); }, 1200);
    probe.src = CONFIG.brandLogo;
}

function renderBrand() {
    elBrand.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'brand-row';

    if (logoOK) {
        const img = new Image();
        img.className = 'brand-logo';
        img.src = CONFIG.brandLogo;
        img.alt = CONFIG.brandText;
        row.appendChild(img);
    } else {
        Array.from(CONFIG.brandText).forEach(function (ch, i) {
            const s = document.createElement('span');
            s.className = 'brand-letter';
            s.style.setProperty('--i', i);
            s.textContent = ch;
            row.appendChild(s);
        });
    }

    const line = document.createElement('div');
    line.className = 'intro-line';
    elBrand.appendChild(row);
    elBrand.appendChild(line);
}

function playIntro() {
    const id = ++introId;
    const alive = function () { return id === introId; };

    introActive = true;
    elHud.classList.add('booting');
    renderBrand();
    elIntro.classList.add('show');

    // Self-test: jarum RPM menyapu penuh lalu kembali
    setTimeout(function () {
        if (!alive()) return;
        tween(0, 1, 1100, function (f) {
            needleTarget = fractionToAngle(f);
        }, function () {
            if (!alive()) return;
            tween(1, 0, 1100, function (f) {
                needleTarget = fractionToAngle(f);
            });
        });
    }, 300);

    // Layar intro memudar, tampilan digital muncul
    setTimeout(function () { if (alive()) elIntro.classList.remove('show'); }, 3000);

    setTimeout(function () {
        if (!alive()) return;
        introActive = false;
        elHud.classList.remove('booting');
        window.setSpeed(lastSpeed);
        window.setRPM(lastRPM);
    }, 3500);
}
window.playIntro = playIntro; // panggil lagi saat pemain masuk kendaraan jika perlu

// ===================== API UNTUK JGRP / CEF =====================

// 1. Kecepatan (input m/s) -> angka digital di layar tengah (MPH)
window.setSpeed = function(speed) {
    lastSpeed = speed;
    if (introActive) return;

    const value = Math.round(Number(speed || 0) * SPEED_FACTOR);
    if (elSpeed) elSpeed.textContent = String(Math.min(value, 999));
};

// 2. RPM (0.0 - 1.0) -> jarum merah di dial luar
window.setRPM = function(rpm) {
    lastRPM = rpm;
    if (introActive) return;

    const val = Math.max(0, Math.min(1, Number(rpm || 0)));
    needleTarget = fractionToAngle(val);
};

// 3. Bensin (Fuel) -> persen di layar tengah + chime saat < 20%
let fuelIsLow = false;
let fuelTimer = null;

window.setFuel = function(fuel) {
    const val = Number(fuel || 0);
    // Mendukung nilai 0.0-1.0 maupun 0-100%
    let percent = (val > 1) ? (val / 100) : val;
    percent = Math.max(0, Math.min(1, percent));
    if (elFuelValue) elFuelValue.textContent = Math.round(percent * 100) + '%';

    const low = percent < CONFIG.fuelWarn;
    const group = document.getElementById('fuel-group');
    if (group) group.classList.toggle('low', low);

    if (low !== fuelIsLow) {
        fuelIsLow = low;
        clearInterval(fuelTimer);
        fuelTimer = null;
        if (low) {
            playChime('fuel');
            if (CONFIG.fuelRepeatMs > 0) {
                fuelTimer = setInterval(function () { playChime('fuel'); }, CONFIG.fuelRepeatMs);
            }
        }
    }
};

// 4. Engine Health -> angka PSI di layar tengah
window.setHealth = function(health) {
    const val = Number(health || 0);
    let percent = (val > 1) ? (val / 1000) : val;
    percent = Math.max(0, Math.min(1, percent));
    if (elHealthValue) elHealthValue.textContent = String(Math.round(percent * CONFIG.psiMax));

    const group = document.getElementById('health-group');
    if (group) {
        group.className = 'stat';
        if (percent <= 0.25) group.classList.add('danger');
        else if (percent <= 0.50) group.classList.add('warn');
    }
};

// 5. Gear (0 = R, 'N' = netral, 1..n = gigi)
window.setGear = function(gear) {
    if (!elGear) return;
    if (gear === 'N' || gear === 'n') { elGear.innerText = 'N'; return; }
    elGear.innerText = (gear == 0 || gear === "0") ? 'R' : String(gear);
};

// 6. Lampu (0 = mati, 1 = dekat/hijau, 2 = jauh/biru) - satu ikon yang berubah otomatis
window.setHeadlights = function(state) {
    const el = document.getElementById('headlight');
    if (!el) return;
    const val = Number(state || 0);
    el.className = 'icon-item headlight' + (val === 2 ? ' high-beam' : (val === 1 ? ' active' : ''));
};

// 7. Seatbelt + chime saat tidak dipakai
let seatbeltBuckled = null;
let seatbeltTimer = null;

window.setSeatbelts = function(state) {
    const el = document.getElementById('seatbelts');
    const buckled = isTrueValue(state);
    if (el) el.className = buckled ? 'icon-item active' : 'icon-item warn';

    if (buckled === seatbeltBuckled) return; // tidak ada perubahan, jangan bunyi lagi
    seatbeltBuckled = buckled;

    clearInterval(seatbeltTimer);
    seatbeltTimer = null;
    if (!buckled) {
        playChime('seatbelt');
        if (CONFIG.seatbeltRepeatMs > 0) {
            seatbeltTimer = setInterval(function () { playChime('seatbelt'); }, CONFIG.seatbeltRepeatMs);
        }
    }
};

// 8. Odometer
window.setOdometer = function(distance) {
    if (!elOdo) return;
    elOdo.innerText = Number(distance || 0).toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
};

// ===================== START =====================
if (CONFIG.intro && !params.has('nointro')) {
    probeLogo(playIntro);
} else {
    elHud.classList.remove('booting');
}

// ===================== DEMO (buka index.html?preview&demo) =====================
if (params.has('demo')) {
    let t = 0, fuel = 1, odo = 124567.4;
    setGear(1); setHealth(1000); setHeadlights(1); setSeatbelts(1);
    setInterval(function () {
        t += 0.05;
        const speedMps = (Math.sin(t) * 0.5 + 0.5) * 65;   // 0 - 65 m/s
        setSpeed(speedMps);
        setRPM(0.2 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.75);
        setGear(Math.min(6, 1 + Math.floor(speedMps / 11)));
        fuel = Math.max(0, fuel - 0.0004);
        setFuel(fuel);
        odo += speedMps * 0.00002;
        setOdometer(odo);
    }, 50);
}
