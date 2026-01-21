// Initialize 3D scene with Three.js
function init3DScene() {
    const canvas = document.getElementById('three-canvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Create scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0.1);
    canvas.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Create a sample cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({
        color: 0x667eea,
        emissive: 0x111111,
        shininess: 200
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add edges to cube for better visualization
    const edges = new THREE.EdgesGeometry(geometry);
    const lineSegments = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x764ba2 }));
    cube.add(lineSegments);

    camera.position.z = 4;

    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = canvas.clientWidth;
        const newHeight = canvas.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.005;
        renderer.render(scene, camera);
    }

    animate();
}

// Show/hide sections
function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    document.getElementById(sectionId).style.display = 'block';

    // Initialize 3D scene if showing models section
    if (sectionId === 'models') {
        setTimeout(() => {
            const canvas = document.getElementById('three-canvas');
            if (canvas && !canvas.hasChildNodes()) {
                init3DScene();
            }
        }, 100);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    init3DScene();
    
    // Try to load drawings from the drawings folder
    loadDrawings();
});

// Load drawings from the drawings folder
async function loadDrawings() {
    try {
        const response = await fetch('drawings/');
        const html = await response.text();
        
        // Parse HTML to find image files (simple approach)
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => /\.(jpg|jpeg|png|gif|webp)$/i.test(href));

        const container = document.getElementById('drawings-container');
        
        if (links.length > 0) {
            container.innerHTML = '';
            links.forEach((link, index) => {
                const fileName = link.split('/').pop();
                const card = document.createElement('div');
                card.className = 'drawing-card';
                card.innerHTML = `
                    <img src="${link}" alt="Drawing ${index + 1}" onerror="this.src='images/placeholder.svg'">
                    <h3>${fileName}</h3>
                `;
                container.appendChild(card);
            });
        }
    } catch (error) {
        console.log('Drawings folder not found or empty. Please add your drawings to the drawings/ folder.');
    }
}

// Optional: Load 3D models from models folder
async function load3DModels() {
    // This is a placeholder for future 3D model loading functionality
    // You can extend this to load .glb, .gltf, or .obj files
    console.log('3D model loading functionality can be extended here');
}
