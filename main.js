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


  const gui = new GUI( {closeFolders: true});
gui.add( document, 'title' );


  const params = {
    visible: false,
    gradientStrength: 0.4,
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

  const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });

 
  
  material.onBeforeCompile = (shader) => {
    // Add uniforms for both effects
    shader.uniforms.cornerGradientStrength = { value: 2.0 };
    shader.uniforms.gradientStrength = { value: 1.0 };
    shader.uniforms.topColor = { value: new THREE.Color(0xffffff) };
    shader.uniforms.bottomColor = { value: new THREE.Color(0x333333) };  
    // Add varying to pass position data to the fragment shader
    shader.vertexShader = `
      varying vec3 vPosition;
      ${shader.vertexShader}
    `.replace(
      `#include <begin_vertex>`,
      `
        #include <begin_vertex>
        vPosition = position; // Pass local position to fragment shader
      `
    );
  
    // Modify fragment shader to combine both effects
    shader.fragmentShader = `
      uniform float cornerGradientStrength;
      uniform float gradientStrength;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPosition;
  
      ${shader.fragmentShader}
    `.replace(
      `#include <dithering_fragment>`,
      `
        // Bottom-to-top gradient effect
        float blendFactor = smoothstep(-gradientStrength, gradientStrength, vPosition.y);
        vec3 verticalGradientColor = mix(bottomColor, topColor, blendFactor);
  
        // Corner darkening effect
        vec3 absPosition = abs(vPosition); // Absolute position for symmetry
        float distanceFromCenter = length(absPosition); // Distance from face center
        float cornerFactor = pow(distanceFromCenter, cornerGradientStrength);
  
        // Combine both effects
        vec3 finalColor = mix(verticalGradientColor, vec3(0.0, 0.0, 0.0), cornerFactor);
  
        // Apply final color to fragment
        gl_FragColor.rgb *= finalColor;
  
        #include <dithering_fragment>
      `
    );
    material.userData.shader = shader;

  };
  


// Function to create a cube with custom properties
function createCube(properties) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = material.clone();
  
  // Store custom properties in material's userData
  cubeMaterial.userData.customProperties = properties;

  // Override onBeforeCompile to set custom uniforms
  const originalOnBeforeCompile = material.onBeforeCompile;
  cubeMaterial.onBeforeCompile = function(shader) {
    originalOnBeforeCompile.call(this, shader);
    
    const customProps = this.userData.customProperties;
    shader.uniforms.cornerGradientStrength.value = customProps.cornerGradientStrength;
    shader.uniforms.gradientStrength.value = customProps.gradientStrength;
    shader.uniforms.topColor.value.set(customProps.color);
    shader.uniforms.bottomColor.value.set(customProps.bottomColor || '#333333');
  };

  const cube = new THREE.Mesh(geometry, cubeMaterial);
  cube.position.copy(properties.position);

  return cube;
}
// Create cubes with individual properties
const cubes = [
  createCube({ color: '#ff0000', cornerGradientStrength: 3.0, gradientStrength: 0.8, position: new THREE.Vector3(-2, 0, 0) }),
  createCube({ color: '#00ff00', cornerGradientStrength: 7.0, gradientStrength: 1.0, position: new THREE.Vector3(0, 0, 0) }),
  createCube({ color: '#ffffff', cornerGradientStrength: 3.0, gradientStrength: 0.6, position: new THREE.Vector3(2, 0, 0) }),
  createCube({ color: '#ADD8E6', cornerGradientStrength: 3.0, gradientStrength: 1.0, position: new THREE.Vector3(4, 0, 0) }),
];

cubes.forEach(cube => scene.add(cube));

// Some cubes
/*const geometry = new THREE.BoxGeometry(1, 1, 1);
const cube = new THREE.Mesh(geometry, material);
cube.position.y=0.5;
scene.add(cube);

const cube2 = new THREE.Mesh(geometry, material);
cube2.position.y=0.5;
cube2.position.z=1.5;
scene.add(cube2);


const cube3 = new THREE.Mesh(geometry, material);
cube3.position.y=0.5;
cube3.position.z=3;
scene.add(cube3);*/


const geometryPlane = new THREE.PlaneGeometry(20, 20)
const materialplane = new THREE.MeshBasicMaterial({ color: 0xbbbbbbb });
const plane = new THREE.Mesh(geometryPlane, materialplane);
scene.add(plane);
plane.rotation.x = -Math.PI/2
plane.position.y = -0.5

//const clock = new THREE.Clock();

// Animation function
function animate() {
   
    requestAnimationFrame(animate);
    //const elapsedTime = clock.getElapsedTime();
  renderer.render(scene, camera);
  perf.end();
}

animate();





