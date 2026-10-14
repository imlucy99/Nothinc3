// ===================== KONFIGURASI =====================
const CONFIG = {
    unit: 'MPH',      // 'MPH' atau 'KMH'
    maxSpeed: 180,    // Angka maksimal di dial
    majorStep: 20,    // Jarak angka besar
    midStep: 10,      // Jarak tick putih kecil
    minorStep: 2,     // Jarak tick oranye halus
    rpmMax: 8,        // Skala RPM (x1000 r/min)
    redline: 0.85,    // Mulai zona merah RPM (0.0 - 1.0)

    // Brand
    brandText: 'ANNIS',   // Teks animasi. Jika logo.png ada, otomatis diganti logo
    brandLogo: 'logo.png',

    // Chime
    chimeVolume: 0.35,        // 0.0 - 1.0
    fuelWarn: 0.2,            // Chime bensin saat di bawah 20%
    fuelRepeatMs: 30000,      // Ulangi chime bensin tiap N ms selama masih rendah (0 = sekali saja)
    seatbeltRepeatMs: 5000    // Ulangi chime seatbelt tiap N ms selama belum dipakai (0 = sekali saja)
};

const MPS_TO_MPH = 2.236936;
const MPS_TO_KMH = 3.6;
const SPEED_FACTOR = CONFIG.unit === 'KMH' ? MPS_TO_KMH : MPS_TO_MPH;

// Geometri dial bulat (viewBox SVG 400 x 400)
const CX = 200;
const CY = 200;
const R_OUTER = 180;
const START_ANGLE = 135;   // posisi angka 0 (derajat, searah jarum jam dari kanan)
const SWEEP = 270;         // total sudut dari 0 sampai maxSpeed
const RPM_START = 180;     // skala RPM: setengah lingkaran atas
const RPM_SWEEP = 180;
const R_RPM = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Inisialisasi Element DOM
const elSpeed = document.getElementById('speed-display');
const elGear = document.getElementById('gear');
const elOdo = document.getElementById('odometer');
const elNeedle = document.getElementById('needle');
const hSegs = document.querySelectorAll('.h-seg');
const fSegs = document.querySelectorAll('.f-seg');
const elRpmNeedle = document.getElementById('rpm-needle');

if (new URLSearchParams(location.search).has('preview')) {
    document.documentElement.classList.add('preview');
}

// ===================== MEMBANGUN DIAL =====================
function polar(radius, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function valueToAngle(value) {
    const v = Math.max(0, Math.min(CONFIG.maxSpeed, value));
    return START_ANGLE + (v / CONFIG.maxSpeed) * SWEEP;
}

function arcPath(radius, fromDeg, toDeg) {
    const [x1, y1] = polar(radius, fromDeg);
    const [x2, y2] = polar(radius, toDeg);
    const large = (toDeg - fromDeg) > 180 ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function buildDial() {
    const ring = document.getElementById('ring');
    const ticks = document.getElementById('ticks');
    const labels = document.getElementById('labels');
    const rpmScale = document.getElementById('rpm-scale');

    // Garis lingkar luar oranye
    ring.appendChild(svgEl('path', {
        d: arcPath(R_OUTER + 4, START_ANGLE - 1.5, START_ANGLE + SWEEP + 1.5),
        class: 'ring-line',
        filter: 'url(#glow)'
    }));

    // Ticks kecepatan
    const minorFrag = document.createDocumentFragment();
    for (let v = 0; v <= CONFIG.maxSpeed; v += CONFIG.minorStep) {
        const angle = valueToAngle(v);
        let cls = 'tick-minor';
        let len = 9;
        if (v % CONFIG.majorStep === 0) { cls = 'tick-major'; len = 20; }
        else if (v % CONFIG.midStep === 0) { cls = 'tick-mid'; len = 12; }

        const [x1, y1] = polar(R_OUTER, angle);
        const [x2, y2] = polar(R_OUTER - len, angle);
        const line = svgEl('line', {
            x1: x1.toFixed(2), y1: y1.toFixed(2),
            x2: x2.toFixed(2), y2: y2.toFixed(2),
            class: cls
        });
        (cls === 'tick-minor' ? minorFrag : ticks).appendChild(line);

        if (cls === 'tick-major') {
            const [lx, ly] = polar(R_OUTER - 38, angle);
            const text = svgEl('text', { x: lx.toFixed(2), y: ly.toFixed(2), class: 'tick-label' });
            text.textContent = v;
            labels.appendChild(text);
        }
    }
    ticks.insertBefore(minorFrag, ticks.firstChild);

    // Skala RPM (setengah lingkaran atas)
    const redFrom = RPM_START + CONFIG.redline * RPM_SWEEP;
    rpmScale.appendChild(svgEl('path', {
        d: arcPath(R_RPM + 4, RPM_START, RPM_START + RPM_SWEEP),
        class: 'rpm-arc'
    }));
    rpmScale.appendChild(svgEl('path', {
        d: arcPath(R_RPM + 4, redFrom, RPM_START + RPM_SWEEP),
        class: 'rpm-arc red'
    }));

    for (let r = 0; r <= CONFIG.rpmMax; r += 0.5) {
        const angle = RPM_START + (r / CONFIG.rpmMax) * RPM_SWEEP;
        const major = Number.isInteger(r);
        const red = r / CONFIG.rpmMax >= CONFIG.redline;
        const [x1, y1] = polar(R_RPM, angle);
        const [x2, y2] = polar(R_RPM - (major ? 10 : 6), angle);
        rpmScale.appendChild(svgEl('line', {
            x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2),
            class: 'rpm-tick' + (major ? ' major' : '') + (red ? ' red' : '')
        }));
        if (major) {
            const [lx, ly] = polar(R_RPM - 21, angle);
            const t = svgEl('text', { x: lx.toFixed(2), y: ly.toFixed(2), class: 'rpm-num' + (red ? ' red' : '') });
            t.textContent = r;
            rpmScale.appendChild(t);
        }
    }

    document.getElementById('speed-mode').innerText = CONFIG.unit === 'KMH' ? 'KM/H' : 'MPH';
    document.getElementById('odo-unit').innerText = CONFIG.unit === 'KMH' ? 'km' : 'mi';
}

buildDial();

// ===================== BRAND (ANNIS / logo.png) =====================
(function initBrand() {
    const brand = document.getElementById('brand');
    if (!brand) return;

    function showText() {
        brand.innerHTML = '';
        Array.from(CONFIG.brandText).forEach((ch, i) => {
            const s = document.createElement('span');
            s.className = 'brand-letter';
            s.style.setProperty('--i', i);
            s.textContent = ch;
            brand.appendChild(s);
        });
    }

    showText(); // default: teks beranimasi

    // Jika logo.png ada, ganti teks dengan logo
    const probe = new Image();
    probe.onload = function () {
        brand.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'brand-logo';
        img.src = CONFIG.brandLogo;
        img.alt = CONFIG.brandText;
        brand.appendChild(img);
    };
    probe.onerror = function () { /* logo tidak ada: tetap pakai teks */ };
    probe.src = CONFIG.brandLogo;
})();

// ===================== ANIMASI JARUM =====================
let needleTarget = START_ANGLE;
let needleCurrent = START_ANGLE;
let rpmTarget = RPM_START;
let rpmCurrent = RPM_START;

function renderNeedle() {
    needleCurrent += (needleTarget - needleCurrent) * 0.2;
    if (Math.abs(needleTarget - needleCurrent) < 0.01) needleCurrent = needleTarget;
    elNeedle.setAttribute('transform', `translate(${CX} ${CY}) rotate(${needleCurrent.toFixed(2)})`);

    rpmCurrent += (rpmTarget - rpmCurrent) * 0.25;
    if (Math.abs(rpmTarget - rpmCurrent) < 0.01) rpmCurrent = rpmTarget;
    elRpmNeedle.setAttribute('transform', `translate(${CX} ${CY}) rotate(${rpmCurrent.toFixed(2)})`);
    requestAnimationFrame(renderNeedle);
}
requestAnimationFrame(renderNeedle);

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
window.playChime = playChime; // untuk tes manual: playChime('seatbelt') / playChime('fuel')

// ===================== HELPER =====================
function isTrueValue(val) {
    return val === true || val === 1 || val === "1" || val === "true";
}

function fillSegments(segs, active) {
    segs.forEach((seg, i) => {
        if (i < active) seg.classList.add('active');
        else seg.classList.remove('active');
    });
}

// ===================== API UNTUK JGRP / CEF =====================

// 1. Kecepatan (input m/s, jarum analog + 3 digit)
window.setSpeed = function(speed) {
    const value = Math.round(Number(speed || 0) * SPEED_FACTOR);
    needleTarget = valueToAngle(value);

    if (!elSpeed) return;
    const padded = String(Math.min(value, 999)).padStart(3, '0');

    if (value < 10) {
        elSpeed.innerHTML = `<span class="dim">${padded.slice(0, 2)}</span><span class="bright">${padded.slice(2)}</span>`;
    } else if (value < 100) {
        elSpeed.innerHTML = `<span class="dim">${padded.slice(0, 1)}</span><span class="bright">${padded.slice(1)}</span>`;
    } else {
        elSpeed.innerHTML = `<span class="bright">${padded}</span>`;
    }
};

// 2. RPM (0.0 - 1.0)
window.setRPM = function(rpm) {
    const val = Math.max(0, Math.min(1, Number(rpm || 0)));
    rpmTarget = RPM_START + val * RPM_SWEEP;
    elRpmNeedle.classList.toggle('red', val >= CONFIG.redline);
};

// 3. Bensin (Fuel) + chime saat < 20%
let fuelIsLow = false;
let fuelTimer = null;

window.setFuel = function(fuel) {
    const val = Number(fuel || 0);
    // Mendukung nilai 0.0-1.0 maupun 0-100%
    let percent = (val > 1) ? (val / 100) : val;
    percent = Math.max(0, Math.min(1, percent));
    fillSegments(fSegs, Math.round(percent * fSegs.length));

    const low = percent < CONFIG.fuelWarn;
    const wrap = document.getElementById('fuel-segments');
    const group = document.getElementById('fuel-group');
    if (wrap) wrap.classList.toggle('low', low);
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

// 4. Engine Health
window.setHealth = function(health) {
    const val = Number(health || 0);
    let percent = (val > 1) ? (val / 1000) : val;
    percent = Math.max(0, Math.min(1, percent));
    fillSegments(hSegs, Math.round(percent * hSegs.length));

    const engineIcon = document.getElementById('engine-icon');
    if (engineIcon) {
        engineIcon.className = 'bar-icon engine';
        if (percent <= 0.25) {
            engineIcon.classList.add('active-danger');
        } else if (percent <= 0.50) {
            engineIcon.classList.add('active-warn');
        }
    }
};

// 5. Gear
window.setGear = function(gear) {
    if (!elGear) return;
    elGear.innerText = (gear == 0 || gear === "0") ? 'R' : String(gear);
};

// 6. Lampu (0 = mati, 1 = dekat, 2 = jauh)
window.setHeadlights = function(state) {
    const low = document.getElementById('headlight-low');
    const high = document.getElementById('headlight-high');
    const val = Number(state || 0);
    if (low) low.className = (val === 1) ? 'icon-item active' : 'icon-item';
    if (high) high.className = (val === 2) ? 'icon-item high-beam' : 'icon-item';
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
    if (elOdo) elOdo.innerText = Number(distance || 0).toFixed(1);
};

// ===================== DEMO (buka index.html?preview&demo) =====================
if (new URLSearchParams(location.search).has('demo')) {
    let t = 0, fuel = 1, odo = 1234.5;
    setGear(1); setHealth(1000); setHeadlights(1); setSeatbelts(1);
    setInterval(function () {
        t += 0.05;
        const speedMps = (Math.sin(t) * 0.5 + 0.5) * 70;   // 0 - 70 m/s
        setSpeed(speedMps);
        setRPM(0.2 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.75);
        setGear(Math.min(6, 1 + Math.floor(speedMps / 12)));
        fuel = Math.max(0, fuel - 0.0004);
        setFuel(fuel);
        odo += speedMps * 0.00002;
        setOdometer(odo);
    }, 50);
}
