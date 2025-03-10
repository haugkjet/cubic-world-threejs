import * as THREE from 'three';
import { ThreePerf } from 'three-perf'
import GUI from 'lil-gui';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { ShaderMaterial} from "three";

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
  
// Create scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
THREE.ColorManagement.enabled = true;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; 
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () =>
    {
        // Update sizes
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight
    
        // Update camera
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()
    
        // Update renderer
        renderer.setSize(sizes.width, sizes.height)
    })

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomparams = {
    enableBloom: true,
    bloomStrength: 0.162,
    bloomRadius: 0.4,
    bloomThreshold: 0.496
  };

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.162,
    0.4,
    0.496
  );
  composer.addPass(bloomPass);

  const gui = new GUI( {closeFolders: true});
gui.add( document, 'title' );


  
  gui.add(bloomparams, 'enableBloom').name('Enable Bloom').onChange(toggleBloom);
  gui.add(bloomparams, 'bloomStrength', 0, 3).onChange(updateBloomPass);
  gui.add(bloomparams, 'bloomRadius', 0, 1).onChange(updateBloomPass);
  gui.add(bloomparams, 'bloomThreshold', 0, 1).onChange(updateBloomPass);  

  function toggleBloom(value) {
    bloomPass.enabled = value;
  }

  function updateBloomPass() {
    bloomPass.strength = bloomparams.bloomStrength;
    bloomPass.radius = bloomparams.bloomRadius;
    bloomPass.threshold = bloomparams.bloomThreshold;
  }

  const params = {
    visible: false,
    roomenv: true,
    roombackground: false,
    gradientStrength: 1.0,
  };

  const SKY_COLOR = 0x6ac5fe ;
  const GROUND_COLOR = 0xdaf0ff;
  const SKY_SIZE = 100;
  
  const vertexShader = `
        varying vec3 vWorldPosition;
              void main() {
                  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                  vWorldPosition = worldPosition.xyz;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
              }`;
  const fragmentShader = `
        uniform vec3 topColor;
              uniform vec3 bottomColor;
              varying vec3 vWorldPosition;
              void main() {
                  float h = normalize( vWorldPosition).y;
                  gl_FragColor = vec4( mix( bottomColor, topColor, max( h, 0.0 ) ), 1.0 );
              }`;
  const uniforms = {
    topColor: { value: new THREE.Color(SKY_COLOR) },
    bottomColor: { value: new THREE.Color(GROUND_COLOR) },
  };
  const skyGeo = new THREE.SphereGeometry(SKY_SIZE, 32, 15);
  const skyMat = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  
// Create and apply RoomEnvironment
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
const roomEnvironmentMap = pmremGenerator.fromScene(roomEnvironment).texture;
scene.environment = roomEnvironmentMap;

const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(0, 0, 0); // Or your desired look-at point  
controls.update();


camera.position.set(-15, 10, 15);
camera.lookAt(0,0,0);

// Initialize three-perf
const perf = new ThreePerf({
    anchorX: 'left',
    anchorY: 'top',
    domElement: document.body, // or other canvas rendering wrapper
    renderer: renderer, // three js renderer instance you use for rendering

});
perf.visible =false;

  gui.add(params, 'visible').name('Show Performance').onChange((value) => {
    if (value) {
      perf.visible = true;
    } else {
      perf.visible =false;
    }
  });  
  gui.add(params, 'roomenv').name('Room Env').onChange((value) => {
    if (value) {
        scene.environment = roomEnvironmentMap;
    } else {
        scene.environment = null
    }
  });  

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,

  });
  
  material.onBeforeCompile = (shader) => {
    shader.uniforms.topColor = { value: new THREE.Color(0xffffff) };
    shader.uniforms.bottomColor = { value: new THREE.Color(0x333333) };
    shader.uniforms.gradientStrength = { value: 1.0 }; // Default strength
  
    // Modify vertex shader to pass position
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
    #include <common>
    varying vec3 vPosition;
    `
  );

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    vPosition = position;
    `
  );

  // Modify fragment shader to apply gradient effect
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `
    #include <common>
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float gradientStrength;
    varying vec3 vPosition;
    `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `
    #include <dithering_fragment>
    
    // Calculate blend factor based on y-position and strength
    float blendFactor = smoothstep(-gradientStrength, gradientStrength, vPosition.y);
    vec3 finalColor = mix(bottomColor, topColor, blendFactor);
    
    // Apply the final color to the fragment
    gl_FragColor.rgb *= finalColor;
    `
  );

  // Store the modified shader for external access (e.g., GUI updates)
  material.userData.shader = shader;
};


// Update the gradient strength dynamically when changed in the GUI
gui.add(params, 'gradientStrength', 0.1, 5.0).onChange((value) => {
  if (material.userData.shader) {
    material.userData.shader.uniforms.gradientStrength.value = value;
  }
});

// Create a cube
const geometry2 = new THREE.BoxGeometry(1, 1, 1);
const cube = new THREE.Mesh(geometry2, material);
cube.position.y=0.5;
scene.add(cube);

// Create a cube
const geometry3 = new THREE.BoxGeometry(1, 1, 1);
const cube3 = new THREE.Mesh(geometry3, material);
cube3.position.y=0.5;
cube3.position.z=1.5;
cube.rotateX(45);

scene.add(cube3);



const geometryPlane = new THREE.PlaneGeometry(20, 20)
const materialplane = new THREE.MeshStandardMaterial({ color: 0xbbbbbb });
const plane = new THREE.Mesh(geometryPlane, materialplane);
scene.add(plane);
plane.rotation.x = -Math.PI/2
plane.position.y = 0

//const clock = new THREE.Clock();

// Animation function
function animate() {
   
    requestAnimationFrame(animate);
    //const elapsedTime = clock.getElapsedTime();
     composer.render();
  perf.end();
}

animate();