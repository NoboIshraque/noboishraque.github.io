// A laptop that opens and a phone that turns around, driven by scroll progress (0 to 1).
// Built with three.js (MIT licence, bundled in assets/vendor/three).
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/three/addons/RoomEnvironment.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedRect(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedShape(w, h, r), 24), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return g;
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.30)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.10)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function mountDevices(canvas, urls) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

  // light: a soft key light that casts shadows, a cool rim light, and sky fill
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.6, 9, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8); rim.position.set(-4, 3, -5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e6ea, 0.35));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.1, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.renderOrder = -1; scene.add(ground);

  // materials
  const alu = new THREE.MeshPhysicalMaterial({ color: 0xdadce0, metalness: 1, roughness: 0.34, anisotropy: 0.35 });
  const aluWell = new THREE.MeshPhysicalMaterial({ color: 0xaeb2b8, metalness: 1, roughness: 0.52 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x151517, metalness: 0.05, roughness: 0.58 });
  const padMat = new THREE.MeshPhysicalMaterial({ color: 0xd2d5d9, metalness: 0.85, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x232427, metalness: 0.6, roughness: 0.45 });
  const glassBlack = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.2, envMapIntensity: 0.12 });
  const ti = new THREE.MeshPhysicalMaterial({ color: 0x55585e, metalness: 1, roughness: 0.27 });
  const backGlass = new THREE.MeshPhysicalMaterial({ color: 0x313338, metalness: 0.15, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const plateau = new THREE.MeshPhysicalMaterial({ color: 0x3a3c41, metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x07080c, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lensInner = new THREE.MeshPhysicalMaterial({ color: 0x1a2142, metalness: 0.6, roughness: 0.18, clearcoat: 1 });
  const flashMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d0, roughness: 0.45 });

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const load = (u) => new Promise((res) => loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; res(t); }, undefined, () => res(null)));
  const flat = (geo, mat, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; return m; };

  // ---------- laptop ----------
  const W = 3.0, D = 2.05, TB = 0.08, TL = 0.05;
  const laptop = new THREE.Group(); scene.add(laptop);
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, TB, D, 5, 0.035), alu); base.position.y = TB / 2; base.castShadow = true; laptop.add(base);
  const blob = flat(new THREE.PlaneGeometry(W * 1.45, D * 1.5), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }), 0, 0.001, 0, -Math.PI / 2);
  laptop.add(blob);

  // keyboard: a slightly darker well with real keys
  const kbW = W * 0.86, kbBack = -D / 2 + 0.13, u = kbW / 14.5, gap = u * 0.15, KH = 0.014;
  const rows = [
    { h: 0.55, k: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { h: 1, k: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5] },
    { h: 1, k: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { h: 1, k: [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.7] },
    { h: 1, k: [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2] },
    { h: 1, k: [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1], arrows: 7 },
  ];
  const keys = []; let z = kbBack;
  rows.forEach((row) => {
    let x = -kbW / 2; const rd = row.h * u;
    row.k.forEach((w, i) => {
      const kw = w * u - gap, cx = x + (w * u) / 2;
      if (row.arrows !== undefined && i >= row.arrows) {
        const hd = rd / 2 - gap * 0.75;
        if (i === row.arrows + 1) { keys.push({ x: cx, z: z + rd * 0.25, w: kw, d: hd }); keys.push({ x: cx, z: z + rd * 0.75, w: kw, d: hd }); }
        else keys.push({ x: cx, z: z + rd * 0.75, w: kw, d: hd });
      } else keys.push({ x: cx, z: z + rd / 2, w: kw, d: rd - gap });
      x += w * u;
    });
    z += rd;
  });
  const kbFront = z;
  laptop.add(flat(roundedRect(kbW + 0.05, kbFront - kbBack + 0.05, 0.03), aluWell, 0, TB + 0.0006, (kbFront + kbBack) / 2, -Math.PI / 2));
  const keyMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.22), keyMat, keys.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  keys.forEach((k, i) => { mtx.compose(new THREE.Vector3(k.x, TB + KH / 2 + 0.0008, k.z), q, new THREE.Vector3(k.w, KH, k.d)); keyMesh.setMatrixAt(i, mtx); });
  keyMesh.instanceMatrix.needsUpdate = true; laptop.add(keyMesh);
  const padD = Math.min(0.66, D / 2 - kbFront - 0.16);
  laptop.add(flat(roundedRect(W * 0.42, padD, 0.035), padMat, 0, TB + 0.0007, kbFront + 0.08 + padD / 2, -Math.PI / 2));
  const hingeBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W * 0.78, 24), hingeMat);
  hingeBar.rotation.z = Math.PI / 2; hingeBar.position.set(0, TB + 0.006, -D / 2 + 0.04); laptop.add(hingeBar);

  // lid with a black glass bezel and a camera
  // the hinge sits a little above the deck, so the closed lid clears the keys
  const hinge = new THREE.Group(); hinge.position.set(0, TB + KH + 0.004, -D / 2 + 0.03); laptop.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W, D, TL, 5, 0.025), alu); lid.position.set(0, D / 2, -TL / 2); lid.castShadow = true; hinge.add(lid);
  hinge.add(flat(roundedRect(W - 0.03, D - 0.03, 0.055), glassBlack, 0, D / 2, 0.0012));
  const sw = W - 0.2, sh = sw * 900 / 1440, sy = D / 2 + 0.05;
  const screenA = flat(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }), 0, sy, 0.0022);
  const screenB = flat(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0 }), 0, sy, 0.0028);
  hinge.add(screenA, screenB);
  hinge.add(flat(new THREE.CircleGeometry(0.013, 24), lensInner, 0, D - 0.06, 0.0024));

  // ---------- phone ----------
  const PW = 0.74, PH = 1.52, PT = 0.07, PR = 0.115, BV = 0.012;
  const phone = new THREE.Group(); scene.add(phone);
  const bodyGeo = new THREE.ExtrudeGeometry(roundedShape(PW - 2 * BV, PH - 2 * BV, PR - BV),
    { depth: PT - 2 * BV, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 6, curveSegments: 28 });
  bodyGeo.translate(0, 0, -(PT - 2 * BV) / 2);
  const body = new THREE.Mesh(bodyGeo, [backGlass, ti]); body.castShadow = true; phone.add(body);
  const front = PT / 2;
  phone.add(flat(roundedRect(PW - 0.014, PH - 0.014, PR - 0.007), glassBlack, 0, 0, front + 0.0008));
  const psw = PW - 0.06, psh = psw * 1688 / 780;
  const pscreen = flat(roundedRect(psw, psh, 0.088), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 0, 0, front + 0.0016);
  phone.add(pscreen);
  phone.add(flat(roundedRect(0.19, 0.052, 0.026), glassBlack, 0, psh / 2 - 0.05, front + 0.0024));
  // side buttons
  const btn = (h, x, y) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.014, h, 0.026, 2, 0.006), ti); b.position.set(x, y, 0); phone.add(b); };
  btn(0.07, -PW / 2 - 0.004, 0.40); btn(0.12, -PW / 2 - 0.004, 0.24); btn(0.12, -PW / 2 - 0.004, 0.09); btn(0.19, PW / 2 + 0.004, 0.22);
  // camera plateau and lenses on the back
  const plGeo = new THREE.ExtrudeGeometry(roundedShape(0.33, 0.33, 0.075), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 20 });
  plGeo.translate(0, 0, -front - 0.01);
  const pl = new THREE.Mesh(plGeo, plateau); pl.position.set(-PW / 2 + 0.205, PH / 2 - 0.205, 0); phone.add(pl);
  const back = -front - 0.014;
  [[-0.07, 0.07], [-0.07, -0.07], [0.075, 0]].forEach(([dx, dy]) => {
    const cx = pl.position.x + dx, cy = pl.position.y + dy, r = 0.056;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 40), ti); ring.rotation.x = Math.PI / 2; ring.position.set(cx, cy, back - 0.008); phone.add(ring);
    const g1 = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 40), lensGlass); g1.rotation.y = Math.PI; g1.position.set(cx, cy, back - 0.0185); phone.add(g1);
    const g2 = new THREE.Mesh(new THREE.CircleGeometry(r * 0.36, 32), lensInner); g2.rotation.y = Math.PI; g2.position.set(cx, cy, back - 0.019); phone.add(g2);
  });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.02, 24), flashMat); flash.rotation.y = Math.PI; flash.position.set(pl.position.x + 0.075, pl.position.y + 0.08, back - 0.0002); phone.add(flash);

  // ---------- timeline ----------
  let progress = 0, portrait = false;
  const target = new THREE.Vector3(), dir = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.9;
    render();
  }
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  function render() {
    const p = progress;
    const open = ease(seg(p, 0.06, 0.42));
    hinge.rotation.x = lerp(Math.PI / 2, -0.3, open);
    laptop.rotation.y = lerp(-0.6, 0, ease(seg(p, 0.0, 0.42)));
    screenB.material.opacity = ease(seg(p, 0.46, 0.58));
    const ph = ease(seg(p, 0.62, 0.9));
    phone.visible = p > 0.58;
    if (portrait) {
      laptop.position.set(0, 0, 0);
      phone.position.set(lerp(2.6, 0.95, ph), lerp(0.85, 0.775, ph), lerp(1.0, 1.25, ph));
    } else {
      laptop.position.set(lerp(0, -0.85, ph), 0, 0);
      phone.position.set(lerp(3.6, 1.6, ph), 0.775, lerp(0.6, 0.75, ph));
    }
    phone.rotation.set(lerp(0.2, 0.0, ph), lerp(Math.PI, -0.3, ph), lerp(-0.18, 0, ph));

    const t = ease(seg(p, 0.0, 0.45));
    // frame the devices inside the area under the caption (bottom `f` of the canvas)
    const f = portrait ? 0.66 : 0.7;
    target.set(portrait ? 0 : lerp(0, -0.2, ph), lerp(0.15, 1.0, t), 0);
    dir.set(lerp(0.5, 0.0, t), lerp(0.75, 0.2, t), 1).normalize();
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const bw = portrait ? lerp(4.1, 3.7, t) : (p > 0.58 ? lerp(3.8, 5.0, ph) : 3.8), bh = portrait ? 2.6 : 3.3;
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
    setProgress(p) { const n = clamp(p, 0, 1); if (Math.abs(n - progress) > 0.00005) { progress = n; render(); } },
    render,
  };
}
