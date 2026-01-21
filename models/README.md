# 3D Models Folder

Add your 3D model files here (.gltf, .glb, .obj)

The website is set up to display 3D models from this folder.

## Supported formats:

- glTF (.gltf, .glb)
- OBJ (.obj)
- STL (.stl)

## How to add 3D models:

1. Place your 3D model files in this folder
2. Update the script.js to load and display your models
3. You can use the Three.js library (already included) to render them

Example loading code for glTF models:
```javascript
const loader = new THREE.GLTFLoader();
loader.load('models/yourmodel.glb', (gltf) => {
    scene.add(gltf.scene);
});
```
