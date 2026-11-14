// A laptop that opens and a phone that turns around, driven by scroll progress (0 to 1).
// Built with three.js (MIT licence, bundled in assets/vendor/three).
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/three/addons/RoomEnvironment.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 16), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return g;
}

function keyboardTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = '#b4b8bf'; g.fillRect(0, 0, c.width, c.height);
  const rows = [14, 14, 13, 12, 11, 9], gap = 8, top = 14;
  const kh = (c.height - top * 2 - gap * (rows.length - 1)) / rows.length;
  rows.forEach((n, r) => {
    const y = top + r * (kh + gap), kw = (c.width - 28 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      let w = kw, x = 14 + i * (kw + gap);
      if (r === 5 && i === 4) { w = kw * 1; }
      g.fillStyle = '#1b1b1d';
      const rr = 7; g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + kh, rr); g.arcTo(x + w, y + kh, x, y + kh, rr); g.arcTo(x, y + kh, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.fill();
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.38)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function mountDevices(canvas, urls) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 6, 5); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.85, roughness: 0.3 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0xa4a8b0, metalness: 0.75, roughness: 0.42 });
  const black = new THREE.MeshStandardMaterial({ color: 0x08080a, metalness: 0.3, roughness: 0.18 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x3b3c40, metalness: 0.8, roughness: 0.32 });

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const load = (u) => new Promise((res) => loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; res(t); }, undefined, () => res(null)));

  // laptop
  const W = 3.0, D = 2.05, TB = 0.085, TL = 0.055;
  const laptop = new THREE.Group(); scene.add(laptop);
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, TB, D, 4, 0.04), alu); base.position.y = TB / 2; laptop.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, D * 0.42), new THREE.MeshStandardMaterial({ map: keyboardTexture(), metalness: 0.25, roughness: 0.65 }));
  kb.rotation.x = -Math.PI / 2; kb.position.set(0, TB + 0.0015, -D * 0.12); laptop.add(kb);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(W * 0.38, 0.004, D * 0.3, 2, 0.002), aluDark); pad.position.set(0, TB + 0.001, D * 0.28); laptop.add(pad);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, D * 1.6), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; laptop.add(shadow);

  const hinge = new THREE.Group(); hinge.position.set(0, TB, -D / 2 + 0.03); laptop.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W, D, TL, 4, 0.03), alu); lid.position.set(0, D / 2, -TL / 2); hinge.add(lid);
  const bezel = new THREE.Mesh(roundedRect(W - 0.04, D - 0.04, 0.05), black); bezel.position.set(0, D / 2, 0.0015); hinge.add(bezel);
  const sw = W - 0.2, sh = sw * 900 / 1440;
  const screenA = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
  screenA.position.set(0, D / 2 + 0.05, 0.003); hinge.add(screenA);
  const screenB = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0 }));
  screenB.position.set(0, D / 2 + 0.05, 0.0036); hinge.add(screenB);

  // phone
  const PW = 0.74, PH = 1.52, PT = 0.075;
  const phone = new THREE.Group(); scene.add(phone);
  phone.add(new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PT, 6, 0.1), graphite));
  const glass = new THREE.Mesh(roundedRect(PW - 0.02, PH - 0.02, 0.1), black); glass.position.z = PT / 2 + 0.001; phone.add(glass);
  const pscreen = new THREE.Mesh(roundedRect(PW - 0.07, (PW - 0.07) * 1688 / 780, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  pscreen.position.z = PT / 2 + 0.002; phone.add(pscreen);
  const island = new THREE.Mesh(roundedRect(0.2, 0.055, 0.0275), black); island.position.set(0, PH / 2 - 0.09, PT / 2 + 0.003); phone.add(island);
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.32, 0.03, 4, 0.06), graphite); bump.position.set(-PW / 2 + 0.21, PH / 2 - 0.21, -PT / 2 - 0.012); phone.add(bump);
  [[-0.07, 0.07], [-0.07, -0.07], [0.07, 0.0]].forEach(([dx, dy], i) => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(i < 2 ? 0.055 : 0.03, i < 2 ? 0.055 : 0.03, 0.025, 32), black);
    lens.rotation.x = Math.PI / 2; lens.position.set(bump.position.x + dx, bump.position.y + dy, -PT / 2 - 0.032); phone.add(lens);
  });

  let progress = 0, portrait = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.9;
    render();
  }

  function render() {
    const p = progress;
    const open = ease(seg(p, 0.06, 0.42));
    hinge.rotation.x = lerp(Math.PI / 2, -0.3, open);
    laptop.rotation.y = lerp(-0.6, 0, ease(seg(p, 0.0, 0.42)));
    screenB.material.opacity = ease(seg(p, 0.46, 0.58));
    const ph = ease(seg(p, 0.64, 0.9));
    phone.visible = p > 0.6;
    if (portrait) {
      laptop.position.set(0, 0, 0);
      phone.position.set(lerp(2.6, 0.95, ph), lerp(0.55, 0.62, ph), lerp(1.0, 1.25, ph));
    } else {
      laptop.position.set(lerp(0, -0.85, ph), 0, 0);
      phone.position.set(lerp(3.6, 1.6, ph), 0.8, lerp(0.6, 0.75, ph));
    }
    phone.rotation.set(lerp(0.25, 0.02, ph), lerp(Math.PI, -0.3, ph), lerp(-0.2, 0, ph));

    const t = ease(seg(p, 0.0, 0.45));
    // frame the devices inside the area under the caption (bottom `f` of the canvas)
    const f = portrait ? 0.66 : 0.7;
    const target = new THREE.Vector3(portrait ? 0 : lerp(0, -0.2, ph), lerp(0.15, 1.0, t), 0);
    const dir = new THREE.Vector3(lerp(0.5, 0.0, t), lerp(0.75, 0.2, t), 1).normalize();
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const bw = portrait ? lerp(4.1, 3.7, t) : (p > 0.6 ? lerp(3.8, 5.0, ph) : 3.8), bh = portrait ? 2.6 : 3.3;
    const dist = Math.max(bw / (2 * tv * camera.aspect), bh / (2 * tv * f)) * 1.04;
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    camera.setViewOffset(w, h, 0, -h * (1 - f) / 2, w, h);
    renderer.render(scene, camera);
  }

  const ready = Promise.all([load(urls.laptopA), load(urls.laptopB), load(urls.phone)]).then(([a, b, c]) => {
    if (a) { screenA.material.map = a; screenA.material.needsUpdate = true; }
    if (b) { screenB.material.map = b; screenB.material.needsUpdate = true; }
    if (c) { pscreen.material.map = c; pscreen.material.needsUpdate = true; }
    resize();
  });

  return {
    ready,
    resize,
    setProgress(p) { const n = clamp(p, 0, 1); if (Math.abs(n - progress) > 0.0005) { progress = n; render(); } },
    render,
  };
}
