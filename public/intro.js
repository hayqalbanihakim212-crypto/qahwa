/* Adegan 3D layar pembuka: cangkir keramik putih, uap, bisa diputar dengan jari/mouse. Dimuat hanya di layar pembuka. */
import * as THREE from "/vendor/three.module.min.js";
const mat = (c, r = 0.3) =>
  new THREE.MeshStandardMaterial({
    color: c,
    roughness: r,
    side: THREE.DoubleSide,
  });
const lathe = (pts) =>
  new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    72,
  );
const N = 40;

export function build() {
  const g = new THREE.Group(),
    cer = mat(0xf3efe9, 0.22);
  const saucer = new THREE.Mesh(
    lathe([
      [0.001, -0.02],
      [1, -0.02],
      [1.62, 0.1],
      [1.68, 0.15],
      [1.62, 0.16],
      [0.95, 0.05],
      [0.001, 0.05],
    ]),
    cer,
  );
  const cup = new THREE.Mesh(
    lathe([
      [0.001, 0],
      [0.5, 0],
      [0.58, 0.06],
      [0.92, 0.75],
      [1, 1.25],
      [0.94, 1.27],
      [0.87, 1.22],
      [0.8, 0.75],
      [0.5, 0.3],
      [0.001, 0.27],
    ]),
    cer,
  );
  cup.position.y = 0.05;
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.085, 16, 36, Math.PI),
    cer,
  );
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.8, 0.85, 0);
  handle.scale.set(1, 1.15, 1);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 64),
    mat(0x3a2113, 0.12),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 1.07;
  const pos = new Float32Array(N * 3),
    col = new Float32Array(N * 3).fill(1);
  const seed = Array.from({ length: N }, () => ({
    a: Math.random() * 6.28,
    r: Math.random() * 0.3,
    s: 0.12 + Math.random() * 0.1,
    o: Math.random(),
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const steam = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  steam.frustumCulled = false;
  g.add(saucer, cup, handle, coffee, steam);
  // uap naik, memudar ke hitam di atas dan di dekat permukaan (latar hitam)
  const tick = (t) => {
    for (let i = 0; i < N; i++) {
      const s = seed[i],
        k = (t * s.s + s.o) % 1,
        w = s.a + t * 0.5 + k * 3,
        r = s.r + k * 0.3;
      pos.set([Math.cos(w) * r, 1.15 + k * 1.5, Math.sin(w) * r], i * 3);
      col.fill(0.15 + 0.85 * Math.sin(Math.PI * k), i * 3, i * 3 + 3);
    }
    geo.attributes.position.needsUpdate =
      geo.attributes.color.needsUpdate = true;
  };
  return { g, steam, tick };
}

const blob = (inner, outer, size) => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

export function startHero(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  }); // melempar error jika WebGL tidak ada
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a12, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const back = new THREE.DirectionalLight(0xe9a63b, 1.3);
  back.position.set(-4, 2, -3);
  scene.add(back);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({
      map: blob("rgba(233,166,59,.30)", "rgba(233,166,59,0)"),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.04;
  scene.add(shadow);
  const { g, steam, tick } = build();
  steam.material.map = blob("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  g.position.y = 0;
  scene.add(g);

  const fit = () => {
    const w = canvas.clientWidth || 300,
      h = canvas.clientHeight || 300,
      a = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = a;
    camera.position.set(0, 3.2, 7.4 * Math.max(1, 0.95 / a));
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  let rot = 0.6,
    vel = 0,
    drag = false,
    lx = 0,
    t = 0,
    last = performance.now(),
    raf = 0,
    alive = true;
  canvas.onpointerdown = (e) => {
    drag = true;
    lx = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    vel = (e.clientX - lx) * 0.012;
    rot += vel;
    lx = e.clientX;
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    drag = false;
  };

  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) {
      t += dt;
      tick(t);
      if (!drag) {
        rot += dt * 0.45 + vel;
        vel *= 0.94;
      }
      g.position.y = Math.sin(t * 1.2) * 0.04;
    } else if (!steam.userData.once) {
      tick(0.4);
      steam.userData.once = 1;
    }
    g.rotation.y = rot;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    scene.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material &&
        (o.material.map && o.material.map.dispose(), o.material.dispose());
    });
    renderer.dispose();
  };
}
