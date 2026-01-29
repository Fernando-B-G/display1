import * as THREE from 'three';

export function buildGridReference(group) {
    const params = {
        gridSize: 10,
        divisions: 10,
        showGrids: true,
        showLabels: true,
        viewAngle: 0, // 0: Front, 1: Right, 2: Back, 3: Left
        camHeight: 2,
        camDist: 8
    };

    const state = {
        targetRotation: 0,
        currentRotation: 0,
        rotating: false
    };

    const root = new THREE.Group();
    group.add(root);

    // --- Iluminação ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    root.add(ambientLight);

    const solarLight = new THREE.DirectionalLight(0xffffff, 0.8);
    solarLight.position.set(5, 10, 7.5);
    root.add(solarLight);

    // --- Grids ---
    const gridsGroup = new THREE.Group();
    root.add(gridsGroup);

    const gridXZ = new THREE.GridHelper(params.gridSize, params.divisions, 0x444444, 0x222222);
    gridsGroup.add(gridXZ);

    const gridXY = new THREE.GridHelper(params.gridSize, params.divisions, 0x444444, 0x111111);
    gridXY.rotation.x = Math.PI / 2;
    gridXY.position.z = -params.gridSize / 2;
    gridXY.material.transparent = true;
    gridXY.material.opacity = 0.3;
    gridsGroup.add(gridXY);

    const gridYZ = new THREE.GridHelper(params.gridSize, params.divisions, 0x444444, 0x111111);
    gridYZ.rotation.z = Math.PI / 2;
    gridYZ.position.x = -params.gridSize / 2;
    gridYZ.material.transparent = true;
    gridYZ.material.opacity = 0.3;
    gridsGroup.add(gridYZ);

    // --- Eixos ---
    const axesGroup = new THREE.Group();
    root.add(axesGroup);

    const axisLen = params.gridSize / 2 + 1;
    const arrowHead = 0.4;
    const arrowWidth = 0.2;

    const xAxis = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), axisLen, 0xff3333, arrowHead, arrowWidth);
    const yAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), axisLen, 0x33ff33, arrowHead, arrowWidth);
    const zAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), axisLen, 0x3333ff, arrowHead, arrowWidth);
    axesGroup.add(xAxis, yAxis, zAxis);

    // --- Labels (Sprite approach) ---
    function createLabel(text, color, pos) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(pos);
        sprite.scale.set(0.6, 0.6, 1);
        return sprite;
    }

    const labelX = createLabel('X', '#ff3333', new THREE.Vector3(axisLen + 0.3, 0, 0));
    const labelY = createLabel('Y', '#33ff33', new THREE.Vector3(0, axisLen + 0.3, 0));
    const labelZ = createLabel('Z', '#3333ff', new THREE.Vector3(0, 0, axisLen + 0.3));
    axesGroup.add(labelX, labelY, labelZ);

    // --- Objetos de Teste ---
    const itemsGroup = new THREE.Group();
    root.add(itemsGroup);

    // Esfera
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0x3399ff, metalness: 0.2, roughness: 0.1 })
    );
    sphere.position.set(-2, 0.5, 0);
    itemsGroup.add(sphere);

    // Caixa
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.2, roughness: 0.2 })
    );
    box.position.set(0, 0.4, 0);
    itemsGroup.add(box);

    // Cone
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1, 32),
        new THREE.MeshStandardMaterial({ color: 0x44ff44, metalness: 0.2, roughness: 0.2 })
    );
    cone.position.set(2, 0.5, 0);
    itemsGroup.add(cone);

    // --- Loop de Animação ---
    group.userData.anim = (dt) => {
        // Rotação suave da câmera se necessário
        if (state.rotating) {
            const diff = state.targetRotation - state.currentRotation;
            if (Math.abs(diff) < 0.01) {
                state.currentRotation = state.targetRotation;
                state.rotating = false;
            } else {
                state.currentRotation += diff * dt * 4;
            }

            // Aqui teríamos que interagir com a câmera do THREE que está lá fora
            // No display1, a câmera geralmente é gerenciada por um OrbitControls ou similar
            // mas podemos tentar influenciar a visibilidade ou orientação relativa.
            // Entretanto, vamos rotacionar o root para simular a mudança de ponto de vista
            // mantendo os objetos virados para o que seria a "frente".
        }

        // Fazer os objetos darem um leve giro ou pulinho para mostrar que está vivo
        sphere.rotation.y += dt;
        box.rotation.y += dt * 0.5;
        cone.rotation.y += dt;

        // Rotação global do palco (para simular mudança de câmera)
        root.rotation.y = state.currentRotation;
    };

    // --- API ---
    group.userData.api = {
        set: (k, v) => {
            params[k] = v;
            if (k === 'showGrids') gridsGroup.visible = v;
            if (k === 'showLabels') axesGroup.visible = v;
            if (k === 'viewAngle') {
                state.targetRotation = -(v * Math.PI / 2); // 90 graus por incremento
                state.rotating = true;
            }
        },
        get: (k) => params[k]
    };

    group.userData.uiSchema = [
        {
            id: 'viewAngle', label: 'Mudar Ponto de Vista', type: 'select',
            options: ['Frente (0°)', 'Direita (90°)', 'Trás (180°)', 'Esquerda (270°)'],
            value: 'Frente (0°)',
            map: (val) => {
                if (val.includes('Frente')) return 0;
                if (val.includes('Direita')) return 1;
                if (val.includes('Trás')) return 2;
                if (val.includes('Esquerda')) return 3;
                return 0;
            }
        },
        { id: 'showGrids', label: 'Eixos e Grades', type: 'toggle', value: true },
        { id: 'gridSize', label: 'Tamanho da Grade', type: 'range', min: 2, max: 20, step: 1, value: 10 }
    ];

    group.userData.dispose = () => {
        root.clear();
        group.remove(root);
    };
}
