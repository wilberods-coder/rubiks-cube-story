/* Static, build-free ES module. All dependencies live beside the page. */
const $ = (selector) => document.querySelector(selector);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = motionPreference.matches;
let lenis;
let animationContext;
let scenes = [];
const state = { heroTurn: 0, explode: 0, mechanicsTurn: 0, buttonTurn: 0 };
const pointer = { x: 0, y: 0 };
let renderFrame = () => {};
let needsRender = true;
addEventListener('scroll', () => { needsRender = true; }, { passive: true });

function updateMotionButton() {
  document.body.classList.toggle('motion-paused', motionPaused);
  $('#motion-toggle').textContent = motionPaused ? 'Включить анимацию' : 'Пауза анимации';
  $('#motion-toggle').setAttribute('aria-pressed', String(motionPaused));
}

// One clock synchronizes Lenis, ScrollTrigger and WebGL; no duplicate RAF loops.
function setupMotion() {
  needsRender = true;
  animationContext?.revert();
  lenis?.destroy();
  lenis = undefined;
  updateMotionButton();
  state.heroTurn = 0;
  state.mechanicsTurn = 0;
  state.explode = motionPaused ? .65 : 0;
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  if (!motionPaused) {
    if (window.Lenis) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', ScrollTrigger.update);
    }
    animationContext = gsap.context(() => {
      gsap.to(state, {
        heroTurn: 1.15, ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1 }
      });
      // CSS sticky provides the pin; ScrollTrigger only controls the animation.
      gsap.timeline({ scrollTrigger: {
        trigger: '#mechanics', start: 'top top', end: 'bottom bottom', scrub: .8,
        onUpdate: (self) => {
          $('#mechanics-progress').style.transform = `scaleX(${self.progress})`;
          $('#mechanics-label').textContent = self.progress < .25 ? '01 / ЕДИНОЕ ЦЕЛОЕ' : self.progress < .7 ? '02 / СВОБОДА ДВИЖЕНИЯ' : '03 / СВЯЗЬ ВНУТРИ';
        }
      }}).to(state, { explode: 1, mechanicsTurn: .75, duration: 1, ease: 'none' });
      document.querySelectorAll('.reveal').forEach((element) => {
        gsap.from(element, { y: 50, opacity: 0, duration: .85, ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
      const art = $('.history-art');
      const eras = [ ['#f6f7f4', '#6c7971'], ['#f4ede3', '#96704e'], ['#edf1fc', '#667dae'] ];
      document.querySelectorAll('.history-step').forEach((step, index) => {
        const setEra = () => gsap.to(art, { backgroundColor: eras[index][0], color: eras[index][1], duration: .6 });
        ScrollTrigger.create({ trigger: step, start: 'top 60%', end: 'bottom 60%', onEnter: setEra, onEnterBack: setEra });
      });
      gsap.to('.blueprint', { y: -15, rotation: -3, ease: 'none',
        scrollTrigger: { trigger: '#history', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
  ScrollTrigger.refresh();
}

async function setupThree() {
  const THREE = await import('./assets/vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.autoClear = false;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1', width: '100%', height: '100%' });
  document.body.append(canvas);

  function roundedShape(size, radius) {
    const s = new THREE.Shape(), a = -size / 2, b = size / 2;
    s.moveTo(a + radius, a); s.lineTo(b - radius, a);
    s.quadraticCurveTo(b, a, b, a + radius); s.lineTo(b, b - radius);
    s.quadraticCurveTo(b, b, b - radius, b); s.lineTo(a + radius, b);
    s.quadraticCurveTo(a, b, a, b - radius); s.lineTo(a, a + radius);
    s.quadraticCurveTo(a, a, a + radius, a);
    return s;
  }
  // Shared geometries and materials: creating another cube doesn't duplicate buffers.
  const bodyGeometry = new THREE.ExtrudeGeometry(roundedShape(.82, .08), {
    depth: .82, bevelEnabled: true, bevelThickness: .065, bevelSize: .065, bevelSegments: 2, steps: 1, curveSegments: 3
  });
  bodyGeometry.center();
  const stickerGeometry = new THREE.ExtrudeGeometry(roundedShape(.78, .09), {
    depth: .012, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, steps: 1, curveSegments: 4
  });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x101113, roughness: .32, metalness: .12 });
  const palette = [0xee7549, 0xe8b94a, 0xdadbb7, 0xe8d964, 0x93bd58, 0x507cde];
  const stickers = palette.map(color => new THREE.MeshStandardMaterial({ color, roughness: .31, metalness: .04 }));
  const axisMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8f99, metalness: .8, roughness: .28 });
  const axisGeometry = new THREE.CylinderGeometry(.10, .10, 2.45, 12);
  const coreGeometry = new THREE.SphereGeometry(.29, 16, 12);
  const faceTransforms = [
    { normal: [1,0,0], rotation: [0, Math.PI/2, 0] },
    { normal: [-1,0,0], rotation: [0, -Math.PI/2, 0] },
    { normal: [0,1,0], rotation: [-Math.PI/2, 0, 0] },
    { normal: [0,-1,0], rotation: [Math.PI/2, 0, 0] },
    { normal: [0,0,1], rotation: [0,0,0] },
    { normal: [0,0,-1], rotation: [0,Math.PI,0] }
  ];

  function createScene(host, mechanism = false) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 60);
    camera.position.set(0, 0, mechanism ? 12.6 : 9.8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5f6780, 3));
    const key = new THREE.DirectionalLight(0xffffff, 4.1); key.position.set(-3, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x97b2ff, 2.2); rim.position.set(5, 1, -4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd4a3, 1.1); fill.position.set(-5,-2,2); scene.add(fill);
    const cube = new THREE.Group(); scene.add(cube);
    const layers = [-1,0,1].map(() => new THREE.Group());
    layers.forEach(layer => cube.add(layer));
    for (let x=-1; x<=1; x++) for (let y=-1; y<=1; y++) for (let z=-1; z<=1; z++) {
      if (x===0 && y===0 && z===0) continue;
      const cubie = new THREE.Group();
      cubie.position.set(x * .99, y * .99, z * .99);
      cubie.userData.base = cubie.position.clone();
      cubie.add(new THREE.Mesh(bodyGeometry, plastic));
      faceTransforms.forEach(({normal, rotation}, face) => {
        if (x*normal[0]+y*normal[1]+z*normal[2] !== 1) return;
        const sticker = new THREE.Mesh(stickerGeometry, stickers[face]);
        sticker.position.set(...normal.map(n=>n * .482)); sticker.rotation.set(...rotation);
        cubie.add(sticker);
      });
      layers[y+1].add(cubie);
    }
    if (mechanism) {
      const core = new THREE.Mesh(coreGeometry, axisMaterial); cube.add(core);
      for (let axis=0;axis<3;axis++) {
        const rod = new THREE.Mesh(axisGeometry, axisMaterial);
        if (axis===0) rod.rotation.z=Math.PI/2;
        if (axis===2) rod.rotation.x=Math.PI/2;
        cube.add(rod);
      }
    }
    cube.rotation.set(.48, -.58, -.12);
    host.classList.add('ready');
    return { host, scene, camera, cube, layers, mechanism, visible: true };
  }
  scenes = [createScene($('#hero-canvas')), createScene($('#mechanics-canvas'), true)];
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); contextLost = true; canvas.style.visibility = 'hidden';
    scenes.forEach(({host}) => host.classList.remove('ready'));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false; needsRender = true; canvas.style.visibility = 'visible';
    scenes.forEach(({host}) => host.classList.add('ready'));
  });
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => { const item=scenes.find(s=>s.host===entry.target); if(item) item.visible=entry.isIntersecting; });
  }, {rootMargin:'40px'});
  scenes.forEach(({host})=>visibility.observe(host));
  let lastTime = 0;
  renderFrame = (time) => {
    if (contextLost || document.hidden || (motionPaused && !needsRender)) return;
    // 30 fps on narrow screens reduces GPU work and battery use.
    if (innerWidth < 700 && time-lastTime < 1/30) return;
    lastTime = time;
    needsRender = false;
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const item of scenes) {
      if (!item.visible) continue;
      const rect = item.host.getBoundingClientRect();
      if (rect.bottom<=0 || rect.top>=innerHeight || !rect.width || !rect.height) continue;
      const {cube,layers,camera,mechanism} = item;
      const drift = motionPaused ? 0 : Math.sin(time * .5) * .045;
      cube.rotation.x = .48 + (motionPaused ? 0 : pointer.y*.11) + drift;
      cube.rotation.y = -.58 + (mechanism ? state.mechanicsTurn : state.heroTurn + state.buttonTurn) + (motionPaused ? 0 : pointer.x*.17);
      cube.rotation.z = -.10;
      cube.position.y = mechanism || motionPaused ? 0 : Math.sin(time*.7)*.07;
      if (mechanism) layers.forEach((layer,index) => {
        const side=index-1;
        layer.position.y = side * state.explode * 1.05;
        layer.rotation.y = side * state.explode * .3;
        layer.children.forEach(cubie => {
          const b=cubie.userData.base;
          cubie.position.set(b.x*(1+state.explode*.43), b.y, b.z*(1+state.explode*.43));
        });
      });
      else layers[2].rotation.y = .17 + (motionPaused ? 0 : Math.sin(time*.35)*.055);
      camera.aspect = rect.width/rect.height;
      // Keep all corners inside portrait and shallow landscape viewports.
      camera.position.z = (mechanism ? 12.6 : 9.8) * Math.max(1, 1/camera.aspect);
      camera.updateProjectionMatrix();
      renderer.setViewport(rect.left, innerHeight-rect.bottom, rect.width, rect.height);
      renderer.setScissor(Math.max(0,rect.left), Math.max(0,innerHeight-rect.bottom), Math.min(innerWidth,rect.right)-Math.max(0,rect.left), Math.min(innerHeight,rect.bottom)-Math.max(0,rect.top));
      renderer.render(item.scene,camera);
    }
  };
  window.addEventListener('resize', () => {
    needsRender = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth<700 ? 1.25 : 1.5));
    renderer.setSize(innerWidth,innerHeight);
  }, {passive:true});
  // Expose only useful diagnostics, with no scene or renderer globals.
  needsRender = true;
  document.documentElement.dataset.webgl = 'ready';
}

function start() {
  setupMotion();
  $('#motion-toggle').addEventListener('click',()=>{ motionPaused=!motionPaused; setupMotion(); });
  motionPreference.addEventListener('change',(event)=>{ motionPaused=event.matches; setupMotion(); });
  $('#rotate-cube').addEventListener('click',()=>{
    needsRender = true;
    if(window.gsap && !motionPaused) gsap.to(state,{buttonTurn:state.buttonTurn+Math.PI/2,duration:1,ease:'power2.inOut',overwrite:true});
    else state.buttonTurn+=Math.PI/2;
  });
  $('#hero-canvas').addEventListener('pointermove',event=>{
    if(event.pointerType==='touch') return;
    const rect=event.currentTarget.getBoundingClientRect();
    pointer.x=(event.clientX-rect.left)/rect.width-.5;
    pointer.y=(event.clientY-rect.top)/rect.height-.5;
  },{passive:true});
  $('#hero-canvas').addEventListener('pointerleave',()=>{pointer.x=0;pointer.y=0;});
  document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
    const target=$(link.getAttribute('href'));
    if(!target || !lenis) return;
    event.preventDefault();
    lenis.scrollTo(target,{offset:-90,onComplete:()=>{
      history.pushState(null,'',link.getAttribute('href'));
      target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
    }});
  }));
  // GitHub Pages project URLs provide a real repository link after deployment.
  if(location.hostname.endsWith('.github.io')) {
    const owner=location.hostname.split('.')[0];
    const repository=location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io`;
    $('#github-link').href=`https://github.com/${owner}/${repository}`;
    $('#github-link').textContent='GitHub';
  }
  const tick=time=>{lenis?.raf(time*1000);renderFrame(time);};
  if(window.gsap) { gsap.ticker.add(tick);gsap.ticker.lagSmoothing(0); }
  else { const raf=time=>{tick(time/1000);requestAnimationFrame(raf);};requestAnimationFrame(raf); }
  setupThree().catch(error=>{
    console.warn('3D недоступно; текстовая версия остаётся доступной.',error);
    document.documentElement.dataset.webgl='unavailable';
    $('#rotate-cube').disabled=true;
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
