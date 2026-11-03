import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;
const TOOTH_HEIGHT = 1.75;

const AQUA = new THREE.Color('#9ee6e9');
const GOLD = new THREE.Color('#f1cf8e');

const lerp = (a, b, t) => a + (b - a) * t;
const ss = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Ashima 3D simplex noise
const NOISE_GLSL = /* glsl */ `
vec3 dpMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 dpMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 dpPermute(vec4 x) { return dpMod289(((x * 34.0) + 10.0) * x); }
vec4 dpTaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float dpNoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = dpMod289(i);
  vec4 p = dpPermute(dpPermute(dpPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = dpTaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/**
 * The WebGL scene: a porcelain molar with a light that glides along its edges, floating in gold dust.
 * Scroll position drives `target`; the scene eases toward it. `setStory(p)` drives the
 * "Inside the smile" chapters: glass anatomy → whitening sweep → kintsugi restoration.
 */
export class ToothScene {
  constructor(canvas, { isMobile = false, reduced = false } = {}) {
    this.canvas = canvas;
    this.isMobile = isMobile;
    this.reduced = reduced;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    this.camera.position.set(0, 0, 7);

    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.intro = { p: 0 };
    this.glass = 0;

    // driven externally (scroll keyframes)
    this.target = { x: 0, y: 0, rx: 0, ry: 0, rz: 0, s: 1, alpha: 1, rim: 0, hot: 0 };
    this.current = { ...this.target };

    this.tmpV = new THREE.Vector3();
    this.tmpC = new THREE.Vector3();

    this.buildEnvironment();
    this.buildLights();
    this.buildRig();
    this.buildAura();
    this.buildHalo();
    this.buildDust();
    this.buildShadow();

    this.resize();
  }

  /* ---------------------------------------------------------------- setup */

  buildEnvironment() {
    // A tiny studio: gradient dome + emissive softboxes (white key, aqua & gold rims).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#ffffff') },
          mid: { value: new THREE.Color('#dfe6e5') },
          bottom: { value: new THREE.Color('#7f8d8c') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vP;
          void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top, mid, bottom; varying vec3 vP;
          void main() {
            float h = vP.y;
            vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, bottom, smoothstep(0.0, 0.9, -h));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      })
    );
    env.add(dome);

    const panel = (hex, intensity, w, h, pos) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), side: THREE.DoubleSide })
      );
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel('#ffffff', 6.0, 7, 5, [-6, 7, 7]); // key softbox
    panel('#ffffff', 1.8, 4, 10, [9, 1, 5]); // fill strip
    panel('#6fd6dc', 5.0, 2.5, 12, [-9, 0, -5]); // aqua rim strip
    panel('#f2c477', 5.0, 2.5, 12, [9, 2, -6]); // gold rim strip
    panel('#ffffff', 2.4, 14, 1.2, [0, 10, -1]); // top strip

    this.scene.environment = pmrem.fromScene(env, 0.03).texture;
    pmrem.dispose();
  }

  buildLights() {
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 4, 5);
    this.aquaLight = new THREE.PointLight(0x5fd8cf, 22, 14, 2);
    this.aquaLight.position.set(-3.2, -0.6, -2.2);
    this.goldLight = new THREE.PointLight(0xf2c77e, 20, 14, 2);
    this.goldLight.position.set(3.2, 1.6, -2.0);
    this.scene.add(key, this.aquaLight, this.goldLight, new THREE.AmbientLight(0xffffff, 0.15));
  }

  buildRig() {
    this.root = new THREE.Group(); // scroll-driven transform
    this.floatG = new THREE.Group(); // idle float
    this.tilt = new THREE.Group(); // pointer tilt
    this.spin = new THREE.Group(); // rotation around Y
    this.body = new THREE.Group(); // tooth layers, turned so both roots face the camera
    this.body.rotation.y = Math.PI / 2;
    this.root.add(this.floatG);
    this.floatG.add(this.tilt);
    this.tilt.add(this.spin);
    this.spin.add(this.body);
    this.scene.add(this.root);

    this.uniforms = {
      uRim: { value: AQUA.clone() },
      uRimStrength: { value: 0.5 },
      uStain: { value: 0 },
      uStainColor: { value: new THREE.Color('#d6b77b') },
      uSweep: { value: 2 },
      uSweepGlow: { value: 0 },
      uCrack: { value: 0 },
      uGold: { value: 0 },
      uGoldColor: { value: new THREE.Color('#d7a957') },
      uTime: { value: 0 },
      uShine: { value: 1 },
      uShineColor: { value: new THREE.Color('#f4fffd') },
    };

    // Enamel: pearl porcelain with iridescent clearcoat. Story effects are injected below.
    this.toothMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fbf8f1'),
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      iridescence: 0.55,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 520],
      sheen: 0.45,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#c4eff1'),
      specularIntensity: 1,
      envMapIntensity: 1.05,
      transparent: true,
    });
    this.toothMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          varying vec3 vObj;
          uniform vec3 uRim; uniform float uRimStrength;
          uniform float uStain; uniform vec3 uStainColor;
          uniform float uSweep; uniform float uSweepGlow;
          uniform float uCrack; uniform float uGold; uniform vec3 uGoldColor;
          uniform float uTime; uniform float uShine; uniform vec3 uShineColor;
          ${NOISE_GLSL}`
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          // whitening: stains remain below the sweeping band of light
          float dpN = dpNoise(vObj * 2.3) * 0.5 + 0.5;
          float dpN2 = dpNoise(vObj * 6.0 + 4.0) * 0.5 + 0.5;
          float dpBelow = 1.0 - smoothstep(uSweep - 0.05, uSweep + 0.05, vObj.y);
          float dpStain = uStain * dpBelow * clamp(0.62 + 0.28 * dpN + 0.1 * dpN2 + 0.25 * smoothstep(0.2, -0.7, vObj.y), 0.0, 0.92);
          diffuseColor.rgb = mix(diffuseColor.rgb, uStainColor * (0.9 + 0.14 * dpN2), dpStain);
          // restoration: ridged-noise fissures across the crown, filled with gold
          float dpR = 1.0 - abs(dpNoise(vObj * vec3(2.4, 1.5, 2.4) + vec3(3.1, 0.4, 1.7)));
          float dpR2 = 1.0 - abs(dpNoise(vObj * vec3(4.2, 2.6, 4.2) + vec3(-2.0, 1.3, 0.6)));
          float dpVein = max(smoothstep(0.955, 0.99, dpR), 0.7 * smoothstep(0.97, 0.995, dpR2));
          dpVein *= smoothstep(-0.35, 0.05, vObj.y) * uCrack;
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.16, 0.12, 0.09), uGoldColor, uGold), dpVein);
          float dpScan = exp(-pow((vObj.y - uSweep) * 13.0, 2.0)) * uSweepGlow;`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.24, dpVein * uGold);'
        )
        .replace(
          '#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, dpVein * uGold);'
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
          totalEmissiveRadiance += uGoldColor * dpVein * uGold * 0.6 + vec3(1.0, 0.98, 0.92) * dpScan * 1.1;`
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          float facing = saturate(dot(normalize(normal), normalize(vViewPosition)));
          float fres = pow(1.0 - facing, 2.6);
          outgoingLight += uRim * fres * uRimStrength;
          // edge shine: a soft band of light glides diagonally over the tooth, flaring where it meets the silhouette
          float edge = pow(1.0 - facing, 3.4);
          float along = dot(vObj, normalize(vec3(0.55, 1.0, 0.25)));
          float sweep = mod(uTime * 0.45, 3.8) - 1.9;
          float band = exp(-pow((along - sweep) * 4.2, 2.0));
          outgoingLight += uShineColor * uShine * (edge * (0.28 + 1.9 * band) + band * 0.05);
          #include <opaque_fragment>`
        );
    };

    // inner anatomy, revealed when the enamel turns to glass
    this.dentinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e3b676'),
      roughness: 0.38,
      sheen: 0.6,
      sheenColor: new THREE.Color('#ffe2b0'),
      clearcoat: 0.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.pulpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f28a78'),
      emissive: new THREE.Color('#ff6f5c'),
      emissiveIntensity: 0.8,
      roughness: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const anchor = (p) => {
      const o = new THREE.Object3D();
      o.position.set(...p);
      this.spin.add(o);
      return o;
    };
    // hero annotations: lustre, contour, foundation
    this.heroAnchors = [[0.1, 0.8, 0.28], [0.46, 0.25, 0.2], [0.16, -0.78, 0.08]].map(anchor);
    // anatomy annotations: enamel, dentin, pulp
    this.storyAnchors = [[0.44, 0.56, 0.2], [0.3, 0.18, 0.15], [0.06, -0.16, 0.05]].map(anchor);
  }

  buildAura() {
    // an inflated back-face shell: glows just outside the silhouette, with a shine that travels around it
    this.auraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color('#f2fffd') },
        uStrength: { value: 0 },
        uPush: { value: 0.06 },
        uTime: this.uniforms.uTime,
      },
      vertexShader: /* glsl */ `
        uniform float uPush;
        varying vec3 vN; varying vec3 vObj;
        void main() {
          vObj = position;
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uPush, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uStrength; uniform float uTime;
        varying vec3 vN; varying vec3 vObj;
        void main() {
          float rim = pow(clamp(-vN.z * 1.6, 0.0, 1.0), 1.4); // bright beside the tooth, fading outward
          float along = dot(vObj, normalize(vec3(0.55, 1.0, 0.25)));
          float sweep = mod(uTime * 0.45, 3.8) - 1.9;
          float band = exp(-pow((along - sweep) * 3.4, 2.0));
          gl_FragColor = vec4(uColor, rim * uStrength * (0.45 + 1.7 * band));
        }
      `,
    });
  }

  buildHalo() {
    // soft light behind the tooth so its edges glow against the page
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.32, 'rgba(226,250,247,0.5)');
    grd.addColorStop(0.62, 'rgba(190,240,234,0.14)');
    grd.addColorStop(1, 'rgba(190,240,234,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    this.haloMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.haloMat);
    this.halo.position.z = -0.75;
    this.halo.scale.set(2.5, 3.1, 1);
    this.halo.renderOrder = -1;
    this.floatG.add(this.halo);
  }

  buildDust() {
    const count = this.isMobile ? 220 : 520;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = -4 + Math.random() * 6;
      seed[i] = Math.random();
      size[i] = 0.4 + Math.pow(Math.random(), 3) * 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: 1 },
        uOpacity: { value: 0 },
        uGold: { value: new THREE.Color('#e0b96c') },
        uLight: { value: new THREE.Color('#ffffff') },
        uDark: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute float aSize;
        uniform float uTime; uniform float uPR;
        varying float vTw; varying float vSeed;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.05 + aSeed * 0.08) + 4.5, 9.0) - 4.5;
          p.x += sin(uTime * 0.25 + aSeed * 6.2831) * 0.25;
          p.z += cos(uTime * 0.2 + aSeed * 12.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPR * 26.0 / -mv.z;
          vTw = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed * 1.6) + aSeed * 40.0);
          vSeed = aSeed;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; uniform vec3 uGold; uniform vec3 uLight; uniform float uDark;
        varying float vTw; varying float vSeed;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a *= a;
          vec3 col = mix(uGold, uLight, step(0.45, vSeed));
          gl_FragColor = vec4(col, a * vTw * uOpacity * 0.9);
        }
      `,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.renderOrder = 10;
    this.scene.add(this.dust);
  }

  buildShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(13,26,29,0.55)');
    grd.addColorStop(0.45, 'rgba(13,26,29,0.18)');
    grd.addColorStop(1, 'rgba(13,26,29,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMat);
    this.shadow.position.set(0, -1.18, -0.4);
    this.shadow.scale.set(1.5, 0.22, 1);
    this.shadow.renderOrder = -1;
    this.root.add(this.shadow);
  }

  /* ---------------------------------------------------------------- load */

  load(onProgress) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return new Promise((resolve, reject) => {
      loader.load(
        `${BASE}assets/model/tooth.glb`,
        (gltf) => {
          let mesh;
          gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
          const geo = mesh.geometry;
          geo.deleteAttribute('uv');
          geo.computeBoundingBox();
          const size = new THREE.Vector3();
          geo.boundingBox.getSize(size);
          geo.center();
          const k = TOOTH_HEIGHT / size.y;
          geo.scale(k, k, k);
          if (!geo.attributes.normal) geo.computeVertexNormals();

          this.pulp = new THREE.Mesh(geo, this.pulpMat);
          this.pulp.scale.set(0.38, 0.56, 0.38);
          this.pulp.position.y = 0.06;
          this.pulp.renderOrder = 1;
          this.dentin = new THREE.Mesh(geo, this.dentinMat);
          this.dentin.scale.setScalar(0.82);
          this.dentin.renderOrder = 2;
          this.tooth = new THREE.Mesh(geo, this.toothMat);
          this.tooth.renderOrder = 3;
          this.aura = new THREE.Mesh(geo, this.auraMat);
          this.aura.renderOrder = 4;
          this.pulp.visible = this.dentin.visible = false;
          this.body.add(this.pulp, this.dentin, this.tooth, this.aura);

          // compile up-front so the first frame after the loader doesn't hitch
          this.pulp.visible = this.dentin.visible = true;
          this.renderer.compile(this.scene, this.camera);
          this.pulp.visible = this.dentin.visible = false;
          resolve();
        },
        (e) => { if (e.total && onProgress) onProgress(e.loaded / e.total); },
        reject
      );
    });
  }

  /* ---------------------------------------------------------------- runtime */

  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  /**
   * "Inside the smile" chapters, p ∈ [0, 1]:
   * I anatomy (enamel turns to glass, a scan passes) → II whitening (stains wiped by light)
   * → III restoration (fissures appear, fill with gold, then heal seamlessly).
   */
  setStory(p) {
    const u = this.uniforms;
    const glass = ss(p, 0.03, 0.12) * (1 - ss(p, 0.27, 0.34));
    const scan = ss(p, 0.1, 0.27);
    const stain = ss(p, 0.33, 0.4) * (1 - ss(p, 0.64, 0.68));
    const wipe = ss(p, 0.43, 0.62);
    const crack = ss(p, 0.7, 0.76) * (1 - ss(p, 0.91, 0.99));
    const gold = ss(p, 0.78, 0.86);

    if (p < 0.33) {
      u.uSweep.value = lerp(1.1, -1.1, scan);
      u.uSweepGlow.value = Math.sin(scan * Math.PI) * glass;
    } else {
      u.uSweep.value = lerp(1.0, -1.15, wipe);
      u.uSweepGlow.value = Math.sin(wipe * Math.PI) * stain;
    }
    u.uStain.value = stain;
    u.uCrack.value = crack;
    u.uGold.value = gold;

    this.glass = glass;
    this.toothMat.opacity = 1 - glass * 0.9;
    this.toothMat.depthWrite = glass < 0.01;
    this.toothMat.sheen = 0.45 * (1 - glass) + 0.01;
    this.toothMat.iridescence = 0.55 + glass * 0.45;
    this.dentinMat.opacity = glass * 0.58;
    this.pulpMat.opacity = glass;
    if (this.dentin) this.dentin.visible = this.pulp.visible = glass > 0.005;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    const pr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.6 : 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dustMat.uniforms.uPR.value = pr;
    this.pxPerUnit = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z);
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const c = this.current;
    const tg = this.target;

    const k = 1 - Math.pow(0.002, dt);
    for (const key in tg) c[key] += (tg[key] - c[key]) * k;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.pow(0.01, dt));

    const ip = this.intro.p;
    const eIn = easeOutCubic(ip);
    const motion = this.reduced ? 0.25 : 1;

    this.root.position.set(c.x, c.y + (1 - eIn) * -2.4, 0);
    this.root.rotation.set(c.rx, 0, c.rz);
    this.root.scale.setScalar(c.s * lerp(0.55, 1, eIn));

    this.spin.rotation.y = c.ry + (1 - eIn) * -Math.PI * 1.4 + Math.sin(t * 0.32) * 0.3 * motion;
    const bob = Math.sin(t * 0.8) * 0.06 * motion;
    this.floatG.position.y = bob;
    this.floatG.rotation.z = Math.sin(t * 0.45) * 0.035 * motion;

    this.tilt.rotation.y = this.pointerSmooth.x * 0.38;
    this.tilt.rotation.x = -this.pointerSmooth.y * 0.22;

    this.uniforms.uTime.value = t * motion + 1.2;
    this.uniforms.uShine.value = 0.85 + c.rim * 0.3;
    const sweep = ((t * motion + 1.2) * 0.45) % 3.8;
    const pulse = Math.exp(-Math.pow((sweep - 1.9) * 1.6, 2));
    this.haloMat.opacity = eIn * (0.16 + 0.1 * pulse) * (1 - this.glass * 0.5);
    this.auraMat.uniforms.uStrength.value = eIn * (1 - Math.min(1, this.glass * 3));

    this.shadow.scale.set(1.5 - bob * 1.8, 0.22 - bob * 0.25, 1);
    this.shadowMat.opacity = 0.32 * eIn * (1 - c.rim * 0.85) * (1 - this.glass * 0.6);

    this.uniforms.uRim.value.copy(AQUA).lerp(GOLD, c.rim);
    this.uniforms.uRimStrength.value = 0.42 + c.rim * 0.35 + this.glass * 1.6;
    this.goldLight.intensity = 20 + c.rim * 14;
    this.pulpMat.emissiveIntensity = 0.65 + 0.35 * Math.pow(Math.sin(t * 2.2) * 0.5 + 0.5, 3);

    this.dustMat.uniforms.uTime.value = t * motion;
    this.dustMat.uniforms.uOpacity.value = eIn;
    this.dustMat.uniforms.uDark.value = c.rim;
    this.dust.position.x = -this.pointerSmooth.x * 0.3;
    this.dust.position.y = -this.pointerSmooth.y * 0.2;

    const alpha = Math.max(0, Math.min(1, c.alpha));
    this.canvas.style.opacity = alpha.toFixed(3);
    this.visible = alpha > 0.005;
    if (this.visible) this.renderer.render(this.scene, this.camera);
  }

  /** Screen-space positions for HTML annotations anchored to the tooth. */
  project(anchors) {
    this.root.getWorldPosition(this.tmpC);
    const center = this.tmpC.clone().project(this.camera);
    const cx = (center.x * 0.5 + 0.5) * this.width;
    const labelX = cx + 0.5 * this.pxPerUnit * this.root.scale.x + 36;
    return anchors.map((o) => {
      o.getWorldPosition(this.tmpV);
      const depth = this.tmpV.z - this.tmpC.z;
      this.tmpV.project(this.camera);
      return {
        x: (this.tmpV.x * 0.5 + 0.5) * this.width,
        y: (-this.tmpV.y * 0.5 + 0.5) * this.height,
        labelX,
        front: depth > -0.05,
      };
    });
  }
}
