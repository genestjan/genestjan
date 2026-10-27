// The live brass compass in the home hero: a light build of site/tools/compass/scene.js
// (no map, no shadows, see-through) that floats, turns, and keeps searching for Freedom.
// If WebGL is missing, the still picture inside the host stays.
import * as THREE from "./vendor/three.module.min.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

const host = document.querySelector("[data-compass3d]");
if (host) start(host).catch(() => {});

const NAVY = "#0c222e", NAVY2 = "#123344", GOLD = "#b8971f", CREAM = "#f4efdb", MINT = "#9fd9bc";
const STAGES = [["Quiet Planner", 72], ["Fully Booked Solo", 144], ["Stretched Clinic Owner", 216], ["Ready-to-Scale Expert", 288]];

function arcText(g, text, deg, r, font) {
  g.font = font;
  const bottom = deg > 90 && deg < 270, total = g.measureText(text).width, a0 = (deg - 90) * Math.PI / 180;
  let s = -total / 2;
  for (const ch of text) {
    const w = g.measureText(ch).width, mid = (s + w / 2) / r, a = bottom ? a0 - mid : a0 + mid;
    g.save(); g.translate(512 + Math.cos(a) * r, 512 + Math.sin(a) * r); g.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    g.fillText(ch, 0, 0); g.restore(); s += w;
  }
}

function dial() {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = NAVY; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = NAVY2; g.beginPath(); g.arc(512, 512, 512, 0, 7); g.arc(512, 512, 430, 0, 7, true); g.fill();
  for (let i = 0; i < 120; i++) {
    const a = i * 3 * Math.PI / 180 - Math.PI / 2, big = i % 10 === 0, len = big ? 46 : i % 5 ? 18 : 30;
    g.strokeStyle = big ? GOLD : CREAM; g.globalAlpha = big ? 1 : .65; g.lineWidth = big ? 5 : 2;
    g.beginPath(); g.moveTo(512 + Math.cos(a) * 500, 512 + Math.sin(a) * 500); g.lineTo(512 + Math.cos(a) * (500 - len), 512 + Math.sin(a) * (500 - len)); g.stroke();
  }
  g.globalAlpha = 1; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = MINT; arcText(g, "Freedom", 0, 365, "600 76px Newsreader");
  g.fillStyle = CREAM; for (const [n, d] of STAGES) arcText(g, n.toUpperCase(), d, 380, "700 29px Karla");
  g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.arc(512, 512, 300, 0, 7); g.stroke();
  g.fillStyle = CREAM; g.font = "400 43px Newsreader"; g.fillText("Beki Eakins", 512, 670);
  g.globalAlpha = .7; g.font = "700 20px Karla"; g.fillText("RUTHIN  ·  NORTH WALES", 512, 720);
  return c;
}

async function start(host) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  await Promise.all([document.fonts.load("600 64px Newsreader"), document.fonts.load("700 40px Karla")]).catch(() => {});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a54a, metalness: 1, roughness: .26, envMap: env, envMapIntensity: 1.1 });
  const tex = new THREE.CanvasTexture(dial()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const compass = new THREE.Group();
  const profile = [[0, 0], [2.95, 0], [3.08, .1], [3.15, .45], [3.1, .8], [2.98, .92], [2.86, .9], [2.82, .75], [2.8, .32], [0, .32]].map(([x, y]) => new THREE.Vector2(x, y));
  compass.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 128), brass));
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.8, 128), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .38, roughness: .85 }));
  face.rotation.x = -Math.PI / 2; face.position.y = .33; compass.add(face);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .55, 32), brass); crown.rotation.x = Math.PI / 2; crown.position.set(0, .45, -3.38); compass.add(crown);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(.6, .1, 20, 64), brass); bow.rotation.x = Math.PI / 2; bow.position.set(0, .45, -4.1); compass.add(bow);
  const needle = new THREE.Group(); needle.position.y = .46; compass.add(needle);
  const half = (tip, mat) => {
    const s = new THREE.Shape(); s.moveTo(-.2, 0); s.lineTo(0, tip); s.lineTo(.2, 0); s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 }), mat);
    m.rotation.x = -Math.PI / 2; return m;
  };
  needle.add(half(2.35, new THREE.MeshStandardMaterial({ color: 0xd8b445, metalness: .85, roughness: .25, envMap: env })));
  needle.add(half(-2.35, new THREE.MeshStandardMaterial({ color: 0xf4efdb, roughness: .45 })));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, .16, 32), brass); cap.position.y = .08; needle.add(cap);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(2.86, 128), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: .08, envMap: env, envMapIntensity: .35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = .8; compass.add(glass);
  compass.position.z = .55;  // turn about the middle of the case, bow included
  const rig = new THREE.Group(); rig.add(compass); scene.add(rig);

  const key = new THREE.DirectionalLight(0xffe2bd, 2.8); key.position.set(-6, 9, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd9bc, 2.2); rim.position.set(7, -3, -8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xbcd0dc, 0x0c222e, .7));

  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100); camera.position.set(0, 0, 17);
  const fit = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(host); fit();

  // the needle keeps searching: a spring towards each stage in turn, resting longest on Freedom
  let angle = -1.2, vel = 0, target = 0, step = 0, hold = 0;
  const stops = [72, 144, 216, 288, 360].map((d) => d * Math.PI / 180);
  let px = 0, py = 0, tx = 0, ty = 0;
  addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
  addEventListener("deviceorientation", (e) => { if (e.gamma != null) { tx = Math.max(-.5, Math.min(.5, e.gamma / 60)); ty = Math.max(-.5, Math.min(.5, (e.beta - 45) / 90)); } }, { passive: true });

  let t = 0, last = performance.now(), running = false;
  const frame = (now) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    hold -= dt;
    if (hold <= 0) { const i = step % 5; target = Math.floor(step / 5) * Math.PI * 2 + stops[i]; hold = i === 4 ? 4 : 1.6; step++; }
    vel += ((target - angle) * 10 - vel * 3.1) * dt; angle += vel * dt;
    needle.rotation.y = -angle;
    px += (tx - px) * .05; py += (ty - py) * .05;
    const r = host.getBoundingClientRect(), out = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
    rig.rotation.set(1.12 + Math.sin(t * .5) * .05 + py * .3 + out * .5, Math.sin(t * .32) * .32 + px * .5, Math.sin(t * .27) * .05);
    rig.position.y = Math.sin(t * .9) * .12;
    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  };
  host.classList.add("live");
  if (reduce) { needle.rotation.y = -stops[4]; rig.rotation.set(1.12, -.2, 0); renderer.render(scene, camera); return; }
  new IntersectionObserver((es) => {
    const on = es[0].isIntersecting;
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!on) running = false;
  }).observe(host);
}
