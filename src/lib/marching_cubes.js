
import { Color4, ComputeShader, HemisphericLight, Scene, StandardMaterial, StorageBuffer, UniformBuffer, VertexBuffer, Vector3, Constants, Mesh } from "@babylonjs/core"
import { AdvancedDynamicTexture, Control, Slider, StackPanel, TextBlock } from "@babylonjs/gui"
export const setupMarchingCubes = function (scene,
    sdSceneRepresentation,
    global_settings,
    state) {
    let engine = scene.getEngine()

    const gui = createGUI();
    gui.isVisible = false
    let WORLD_GRID_SIZE = 5;
    let GRID_RES = 32;
    let ISO_LEVEL = 0.0;

    let do_decimate = false
    let decimate_aggressiveness = 7
    let decimate_target_count = 200


    // uniform buffer
    const paramsBuffer = new UniformBuffer(engine);
    paramsBuffer.addUniform("gridRes", 1);
    paramsBuffer.addUniform("isoLevel", 1);
    paramsBuffer.addUniform("worldSize", 1);
    paramsBuffer.addUniform("_pad", 1);
    let dfc_slider

    let regenerateMeshFn = () => { }

    async function updateGridWorld() {

        // estimate max geometry
        const maxTriangles = GRID_RES * GRID_RES * GRID_RES * 5;
        const maxVertices = maxTriangles * 3;
        const floatsPerVert = 4; // pad to vec4

        paramsBuffer.updateUInt("gridRes", GRID_RES);
        paramsBuffer.updateFloat("isoLevel", ISO_LEVEL);
        paramsBuffer.updateFloat("worldSize", WORLD_GRID_SIZE);
        paramsBuffer.update();
        // — Storage buffers —
        // 1) SDF grid: one float per grid point
        const sdfBuffer = new StorageBuffer(
            engine,
            Float32Array.BYTES_PER_ELEMENT * GRID_RES * GRID_RES * GRID_RES,
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_STORAGE
        );

        // 2) triangle output
        const triBuffer = new StorageBuffer(
            engine,
            Float32Array.BYTES_PER_ELEMENT * floatsPerVert * maxVertices,
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_STORAGE |
            Constants.BUFFER_CREATIONFLAG_VERTEX
        );
        const clearTri = new Float32Array(floatsPerVert * maxVertices).fill(0);

        // 3) counter for triangles
        const counterBuffer = new StorageBuffer(
            engine,
            Uint32Array.BYTES_PER_ELEMENT * 4,
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_STORAGE |
            Constants.BUFFER_CREATIONFLAG_INDIRECT
        );


        // 4) index buffer for mesh
        const indexBuffer = new StorageBuffer(
            engine,
            Uint32Array.BYTES_PER_ELEMENT * floatsPerVert * maxVertices,
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_INDEX
        );
        // fill indexBuffer sequentially
        const idxData = new Uint32Array(floatsPerVert * maxVertices);
        for (let i = 0; i < idxData.length; ++i) idxData[i] = i;
        indexBuffer.update(idxData);




        
        // PASS 2: marching cubes reading precomputed grid
        const tableWGSL = `array<array<i32,16>,256>(
            ${triangleTable.map(r => `  array<i32,16>(${r.join(',')})`).join(',\n')}
            )`;
        const wgslMarch = `
            alias uint2 = vec2<u32>;
            struct Grid { vals: array<f32> };
            struct Triangles { vertices: array<vec3f> };
            @group(0) @binding(0) var<storage, read> grid: Grid;
            @group(0) @binding(1) var<storage, read_write> triangles: Triangles;
            @group(0) @binding(2) var<storage, read_write> counters: array<atomic<u32>>;
            @group(0) @binding(3) var<uniform> params: Params;

            struct Params { gridRes: u32, isoLevel: f32, worldSize: f32, _pad: f32, };
            const triTable: array<array<i32,16>,256> = ${tableWGSL};

            // edge→corner lookup
            const edgeVerts: array<uint2, 12> = array<uint2, 12>(
                uint2(0, 1),
                uint2(1, 2),
                uint2(2, 3),
                uint2(3, 0),
                uint2(4, 5),
                uint2(6, 5),
                uint2(6, 7),
                uint2(7, 4),
                uint2(0, 4),
                uint2(1, 5),
                uint2(2, 6),
                uint2(3, 7)
            );
            const cornerOffsets: array<vec3f, 8> = array<vec3f,8>(
            vec3(0,0,0),  // 0
            vec3(1,0,0),  // 1
            vec3(1,1,0),  // 2
            vec3(0,1,0),  // 3
            vec3(0,0,1),  // 4
            vec3(1,0,1),  // 5
            vec3(1,1,1),  // 6
            vec3(0,1,1)   // 7
            );


            fn vertexInterp(p1:vec3f,p2:vec3f,v1:f32,v2:f32)->vec3f { let t=(params.isoLevel-v1)/(v2-v1); return p1 + t*(p2-p1); }
            fn interpEdge(e:i32, base:vec3f, inv:f32, vals:array<f32,8>)->vec3f { let pr=edgeVerts[u32(e)]; let c0=pr.x; let c1=pr.y;
            let p0=base+cornerOffsets[c0]*inv; let p1=base+cornerOffsets[c1]*inv;
            return vertexInterp(p0,p1,vals[c0],vals[c1]); }

            @compute @workgroup_size(8,8,8)
            fn main(@builtin(global_invocation_id) id:vec3<u32>) {
            let r = params.gridRes - 1u;
            if (any(id >= vec3<u32>(r))) { return; }
            let inv = params.worldSize / f32(r);
            let base = vec3f(f32(id.x),f32(id.y),f32(id.z))*inv - vec3f(params.worldSize*0.5);
            // gather corner values from grid
            var vals: array<f32,8>;
            for (var k:u32=0u;k<8u;k++) {
                let off = cornerOffsets[k];
                let ix = id.x + u32(off.x);
                let iy = id.y + u32(off.y);
                let iz = id.z + u32(off.z);
                let idx = iz * params.gridRes * params.gridRes + iy * params.gridRes + ix;
                vals[k] = grid.vals[idx];
            }
            // build cube index
            var ci:u32=0u;
            for (var i:u32=0u;i<8u;i++){ if (vals[i]<params.isoLevel) { ci |= 1u << i; }}
            let table = triTable[ci];
            for (var i:u32=0u;i<16u;i+=3u) {
                if (table[i]==-1) { break; }
                let e0=table[i]; let e1=table[i+1]; let e2=table[i+2];
                let baseIndex = atomicAdd(&counters[0], 3u);  // vertex +=3
                atomicAdd(&counters[1], 1u); 
                triangles.vertices[baseIndex+0u] = interpEdge(e0, base, inv, vals);
                triangles.vertices[baseIndex+1u] = interpEdge(e1, base, inv, vals);
                triangles.vertices[baseIndex+2u] = interpEdge(e2, base, inv, vals);
            }
            }`;


        

        const marchShader = new ComputeShader(
            "marchingCubes",
            engine,
            { computeSource: wgslMarch },
            {
                bindingsMapping: {
                    grid: { group: 0, binding: 0 },
                    triangles: { group: 0, binding: 1 },
                    counter: { group: 0, binding: 2 },
                    params: { group: 0, binding: 3 }
                }
            }
        );
        marchShader.setStorageBuffer("grid", sdfBuffer);
        marchShader.setStorageBuffer("triangles", triBuffer);
        marchShader.setStorageBuffer("counter", counterBuffer);
        marchShader.setUniformBuffer("params", paramsBuffer);

        // Stage 3: Compute normals


        const normalsBuffer = new StorageBuffer(
            engine,
            // same size as triBuffer: floatsPerVert * maxVertices
            Float32Array.BYTES_PER_ELEMENT * floatsPerVert * maxVertices,
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_STORAGE |
            Constants.BUFFER_CREATIONFLAG_VERTEX
        );

        const wgslFlatNormals = `
            struct Triangles { vertices: array<vec3f>, };
            struct Normals   { normals:  array<vec4f>, };


            @group(0) @binding(0) var<storage, read>        triangles: Triangles;
            @group(0) @binding(1) var<storage, read_write> normals:   Normals;

            @compute @workgroup_size(256)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let triId = id.x;
            let base  = triId * 3u;

            let p0 = triangles.vertices[base + 0u];
            let p1 = triangles.vertices[base + 1u];
            let p2 = triangles.vertices[base + 2u];

            let face_norm = normalize(cross(p2 - p0, p1 - p0));

            normals.normals[base + 0u] = vec4f(face_norm, 0.);
            normals.normals[base + 1u] = vec4f(face_norm, 0.);
            normals.normals[base + 2u] = vec4f(face_norm, 0.);
            }
            `;

        // ─── 3) create and bind the flat‐normals compute shader ───────────────────────
        const normalsShader = new ComputeShader(
            "flatNormals",
            engine,
            { computeSource: wgslFlatNormals },
            {
                bindingsMapping: {
                    triangles: { group: 0, binding: 0 },
                    normals: { group: 0, binding: 1 },
                    counter: { group: 0, binding: 2 }
                }
            }
        );
        normalsShader.setStorageBuffer("triangles", triBuffer);
        normalsShader.setStorageBuffer("normals", normalsBuffer);


        // Stage 3: Calculate indirect dispatch counts for calculating normals
        // ─── A) create an indirect-args buffer (3×u32) ──────────────────────────────
        const dispatchArgsBuffer = new StorageBuffer(
            engine,
            Uint32Array.BYTES_PER_ELEMENT * 3,  // space for [x, y, z]
            Constants.BUFFER_CREATIONFLAG_READWRITE |
            Constants.BUFFER_CREATIONFLAG_STORAGE |
            Constants.BUFFER_CREATIONFLAG_INDIRECT  // allow dispatchIndirect
        );

        // ─── B) WGSL compute that reads your vertex-counter and writes [groups,1,1] ─
        const wgslComputeDispatch = `
            @group(0) @binding(0) var<storage, read_write>        counter: atomic<u32>;
            @group(0) @binding(1) var<storage, read_write> dispatch: array<u32,3>;

            @compute @workgroup_size(1)
            fn main() {
            // how many verts did marching-cubes emit?
            let vcount = atomicLoad(&counter);
            // triCount = vcount/3   (we know it's a multiple of 3)
            let tcount = vcount / 3u;
            // how many 256-sized workgroups? ceil(tcount/256)
            let groups = (tcount + 255u) / 256u;

            dispatch[0] = groups;
            dispatch[1] = 1u;
            dispatch[2] = 1u;
            }
            `;

        // ─── C) create & bind the “compute dispatch” shader ─────────────────────────
        const computeDispatchShader = new ComputeShader(
            "computeDispatchArgs",
            engine,
            { computeSource: wgslComputeDispatch },
            {
                bindingsMapping: {
                    counter: { group: 0, binding: 0 },
                    dispatch: { group: 0, binding: 1 }
                }
            }
        );
        computeDispatchShader.setStorageBuffer("counter", counterBuffer);
        computeDispatchShader.setStorageBuffer("dispatch", dispatchArgsBuffer);

        const wgslClear = `
        struct Grid { vals: array<f32> };
        @group(0) @binding(0) var<storage, read_write> grid: Grid;

        @compute @workgroup_size(256)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            grid.vals[id.x] = 0.; 
        }
        `;

        // ─── 2) create and bind the clear shader ─────────────────────────────────
        const clearGridShader = new ComputeShader(
            "clearGrid",
            engine,
            { computeSource: wgslClear },
            { bindingsMapping: { grid: { group: 0, binding: 0 } } }
        );
        clearGridShader.setStorageBuffer("grid", sdfBuffer);

        // prepare mesh to display
        if (scene.getMeshByName("isoMesh")) scene.getMeshByName("isoMesh").dispose(false, true)
        const mesh = new Mesh("isoMesh", scene);
        const vbuf_pos = new VertexBuffer(
            engine,
            triBuffer.getBuffer(),
            VertexBuffer.PositionKind,
            true,
            false,
            4
        );

        const vbuf_norm = new VertexBuffer(
            engine,
            normalsBuffer.getBuffer(),
            VertexBuffer.NormalKind,
            true,
            false,
            4
        );
        mesh.setVerticesBuffer(vbuf_pos, false);
        mesh.setVerticesBuffer(vbuf_norm, false);
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.material = new StandardMaterial();
        mesh.material.backFaceCulling = false;

        const work = Math.ceil(GRID_RES / 8);
        async function regenerateMesh() {

            // — WGSL shaders —
        // PASS 1: sample SDF into grid
        const wgslSample = `
            alias uint2 = vec2<u32>;
            struct Grid { vals: array<f32> };
            @group(0) @binding(0) var<storage, read_write> grid: Grid;
            @group(0) @binding(1) var<uniform> params: Params;

            struct Params { gridRes: u32, isoLevel: f32, worldSize: f32, _pad: f32, };
            ${sdSceneRepresentation.root.toWGSL({ with_materials: true })}
            fn sdf(p: vec3f)->f32 { return sdScene(p).dist; }

            @compute @workgroup_size(8,8,8)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let r = params.gridRes;
            if (any(id >= vec3<u32>(r))) { return; }
            let inv = params.worldSize / f32(r-1u);
            let p = vec3f(id) * inv - vec3f(params.worldSize*0.5);
            let val = sdf(p);
            let idx = id.z * r * r + id.y * r + id.x;
            grid.vals[idx] = val;
            }`;


            const sampleShader = new ComputeShader(
            "sdfSampler",
            engine,
            { computeSource: wgslSample },
            { bindingsMapping: { grid: { group: 0, binding: 0 }, params: { group: 0, binding: 1 } } }
            );
            sampleShader.setStorageBuffer("grid", sdfBuffer);
            sampleShader.setUniformBuffer("params", paramsBuffer);

            await Promise.all([sampleShader, marchShader, normalsShader, computeDispatchShader, clearGridShader].map(cs => cs.dispatchWhenReady(0, 0, 0)))

            return new Promise(async (resolve, reject) => {

                // clearGridShader.dispatch(GRID_RES * GRID_RES * GRID_RES / 256)
                // sdfBuffer.update(new Float32Array(GRID_RES * GRID_RES * GRID_RES));
                counterBuffer.update(new Uint32Array([0, 0]));


                sampleShader.dispatch(work, work, work)
                marchShader.dispatch(work, work, work)
                computeDispatchShader.dispatch(1, 1, 1)
                normalsShader.dispatchIndirect(dispatchArgsBuffer, 0);


                let vcount
                await Promise.all([counterBuffer.read()]).then(([cntBuf, triBuf]) => {
                    vcount = new Uint32Array(cntBuf.buffer)[0];
                    mesh.setIndexBuffer(indexBuffer.getBuffer(), vcount, vcount, true);
                    console.log(`Got ${vcount} unique vertices`)

                    if (dfc_slider) dfc_slider.maximum = vcount
                    resolve()
                })


                if (do_decimate) {
                    mesh.isVisible = false;

                    // 1) read back only once
                    const [pos_b, idx_b] = await Promise.all([
                        triBuffer.read(),
                        indexBuffer.read()
                    ]);
                    const rawPos = new Float32Array(pos_b.buffer);
                    const rawIdx = new Uint32Array(idx_b.buffer);

                    // 2) figure out how many tris we actually got
                    const vcount = new Uint32Array((await counterBuffer.read()).buffer)[0];
                    const triCount = vcount / 3;

                    // 3) only consider the first triCount * 3 indices
                    const usedIdx = rawIdx.subarray(0, triCount * 3);

                    // 4) weld duplicates (fast, on just the used verts!)
                    const { positions: wPos, indices: wIdx } = weldMeshData(
                        rawPos,    // packed xyz+pad
                        usedIdx,   // only the triangles you drew
                        4,         // floats per vertex in rawPos
                        1e-5       // adjust tolerance to taste
                    );

                    // 5) now run SQEM on the welded mesh
                    simplifyMeshSqem(mesh, {
                        scene: scene,
                        aggressiveness: decimate_aggressiveness,
                        target_count: decimate_target_count,
                        tri_count: wIdx.length / 3,
                        buffers: { pos: wPos, idx: wIdx },
                        stride: { pos_s: 3, idx_s: 3 }
                    });

                    const simple = scene.getMeshByName("simpleMesh");
                    if (simple) {
                        simple.isVisible = true;
                        simple.position.copyFrom(mesh.position);
                    }
                } else {
                    // hide the simplified mesh, show the isoMesh
                    const simple = scene.getMeshByName("simpleMesh");
                    if (simple) simple.isVisible = false;
                    mesh.isVisible = true;
                }
            })
        }


        regenerateMeshFn = createAsyncDebouncer(regenerateMesh)

        await regenerateMeshFn();

    }
    let grid_onChange = createAsyncDebouncer(updateGridWorld)
    createSlider(gui, 'World res', 1, 128, GRID_RES, 1, v => {
        GRID_RES = v
        grid_onChange();
    });

    createSlider(gui, 'World size', 0.5, 2, WORLD_GRID_SIZE, 0.0001, v => {
        WORLD_GRID_SIZE = v
        paramsBuffer.updateFloat("worldSize", WORLD_GRID_SIZE);
        paramsBuffer.update();
        regenerateMeshFn();
    });

    createSlider(gui, 'Isolevel', -1, 1, 0, 0.0001, v => {
        paramsBuffer.updateFloat('isoLevel', v);
        paramsBuffer.update();
        regenerateMeshFn();
    });

    createSlider(gui, 'Decimate', 0, 1, 0, 1, v => {
        do_decimate = v === 1 ? true : false
        regenerateMeshFn();
    });

    createSlider(gui, 'Aggressiveness', 0, 10, 3.141, .0001, v => {
        decimate_aggressiveness = v
        regenerateMeshFn();
    });

    dfc_slider = createSlider(gui, 'Desired face count', 50, 1000, 340, 1, v => {
        decimate_target_count = v
        regenerateMeshFn();
    });





    grid_onChange()



    return { regenerate_mesh: regenerateMeshFn, update_grid_and_regenerate_mesh: grid_onChange };

};

// Helpers (createGUI, createSlider) unchanged


const triangleTable = [[-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 8, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 9, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 1, 9, 8, 3, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [2, 10, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 8, 3, 1, 2, 10, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [9, 2, 10, 9, 0, 2, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 2, 10, 3, 10, 8, 8, 10, 9, -1, 0, 0, 0, 0, 0, -1], [2, 3, 11, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [11, 0, 8, 11, 2, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 9, 0, 2, 3, 11, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [2, 1, 9, 2, 9, 11, 11, 9, 8, -1, 0, 0, 0, 0, 0, -1], [3, 10, 1, 3, 11, 10, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 0, 8, 1, 8, 10, 10, 8, 11, -1, 0, 0, 0, 0, 0, -1], [0, 3, 11, 0, 11, 9, 9, 11, 10, -1, 0, 0, 0, 0, 0, -1], [11, 10, 9, 11, 9, 8, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 7, 8, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 3, 0, 4, 7, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 7, 8, 9, 0, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [9, 4, 7, 9, 7, 1, 1, 7, 3, -1, 0, 0, 0, 0, 0, -1], [4, 7, 8, 1, 2, 10, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 3, 0, 4, 7, 3, 2, 10, 1, -1, 0, 0, 0, 0, 0, -1], [2, 9, 0, 2, 10, 9, 4, 7, 8, -1, 0, 0, 0, 0, 0, -1], [3, 2, 7, 7, 9, 4, 7, 2, 9, 9, 2, 10, -1, 0, 0, -1], [8, 4, 7, 3, 11, 2, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [7, 11, 2, 7, 2, 4, 4, 2, 0, -1, 0, 0, 0, 0, 0, -1], [2, 3, 11, 1, 9, 0, 8, 4, 7, -1, 0, 0, 0, 0, 0, -1], [2, 1, 9, 2, 9, 4, 2, 4, 11, 11, 4, 7, -1, 0, 0, -1], [10, 3, 11, 10, 1, 3, 8, 4, 7, -1, 0, 0, 0, 0, 0, -1], [4, 7, 0, 0, 10, 1, 7, 10, 0, 7, 11, 10, -1, 0, 0, -1], [8, 4, 7, 0, 3, 11, 0, 11, 9, 9, 11, 10, -1, 0, 0, -1], [7, 9, 4, 7, 11, 9, 9, 11, 10, -1, 0, 0, 0, 0, 0, -1], [4, 9, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 3, 0, 4, 9, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 5, 4, 0, 1, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 8, 3, 4, 3, 5, 5, 3, 1, -1, 0, 0, 0, 0, 0, -1], [1, 2, 10, 9, 5, 4, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 9, 5, 8, 3, 0, 1, 2, 10, -1, 0, 0, 0, 0, 0, -1], [10, 5, 4, 10, 4, 2, 2, 4, 0, -1, 0, 0, 0, 0, 0, -1], [4, 8, 3, 4, 3, 2, 4, 2, 5, 5, 2, 10, -1, 0, 0, -1], [2, 3, 11, 5, 4, 9, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [11, 0, 8, 11, 2, 0, 9, 5, 4, -1, 0, 0, 0, 0, 0, -1], [5, 0, 1, 5, 4, 0, 3, 11, 2, -1, 0, 0, 0, 0, 0, -1], [11, 2, 8, 8, 5, 4, 2, 5, 8, 2, 1, 5, -1, 0, 0, -1], [3, 10, 1, 3, 11, 10, 5, 4, 9, -1, 0, 0, 0, 0, 0, -1], [9, 5, 4, 1, 0, 8, 1, 8, 10, 10, 8, 11, -1, 0, 0, -1], [10, 5, 11, 11, 0, 3, 11, 5, 0, 0, 5, 4, -1, 0, 0, -1], [4, 10, 5, 4, 8, 10, 10, 8, 11, -1, 0, 0, 0, 0, 0, -1], [7, 9, 5, 7, 8, 9, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 9, 5, 0, 5, 3, 3, 5, 7, -1, 0, 0, 0, 0, 0, -1], [8, 0, 1, 8, 1, 7, 7, 1, 5, -1, 0, 0, 0, 0, 0, -1], [3, 1, 5, 3, 5, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [7, 9, 5, 7, 8, 9, 1, 2, 10, -1, 0, 0, 0, 0, 0, -1], [1, 2, 10, 0, 9, 5, 0, 5, 3, 3, 5, 7, -1, 0, 0, -1], [7, 8, 5, 5, 2, 10, 8, 2, 5, 8, 0, 2, -1, 0, 0, -1], [10, 3, 2, 10, 5, 3, 3, 5, 7, -1, 0, 0, 0, 0, 0, -1], [9, 7, 8, 9, 5, 7, 11, 2, 3, -1, 0, 0, 0, 0, 0, -1], [0, 9, 2, 2, 7, 11, 2, 9, 7, 7, 9, 5, -1, 0, 0, -1], [3, 11, 2, 8, 0, 1, 8, 1, 7, 7, 1, 5, -1, 0, 0, -1], [2, 7, 11, 2, 1, 7, 7, 1, 5, -1, 0, 0, 0, 0, 0, -1], [11, 1, 3, 11, 10, 1, 7, 8, 9, 7, 9, 5, -1, 0, 0, -1], [11, 10, 1, 11, 1, 7, 7, 1, 0, 7, 0, 9, 7, 9, 5, -1], [5, 7, 8, 5, 8, 10, 10, 8, 0, 10, 0, 3, 10, 3, 11, -1], [11, 10, 5, 11, 5, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [10, 6, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 8, 3, 10, 6, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [9, 0, 1, 5, 10, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 1, 9, 8, 3, 1, 10, 6, 5, -1, 0, 0, 0, 0, 0, -1], [6, 1, 2, 6, 5, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [6, 1, 2, 6, 5, 1, 0, 8, 3, -1, 0, 0, 0, 0, 0, -1], [5, 9, 0, 5, 0, 6, 6, 0, 2, -1, 0, 0, 0, 0, 0, -1], [6, 5, 2, 2, 8, 3, 5, 8, 2, 5, 9, 8, -1, 0, 0, -1], [2, 3, 11, 10, 6, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 11, 2, 0, 8, 11, 6, 5, 10, -1, 0, 0, 0, 0, 0, -1], [0, 1, 9, 3, 11, 2, 10, 6, 5, -1, 0, 0, 0, 0, 0, -1], [10, 6, 5, 2, 1, 9, 2, 9, 11, 11, 9, 8, -1, 0, 0, -1], [11, 6, 5, 11, 5, 3, 3, 5, 1, -1, 0, 0, 0, 0, 0, -1], [11, 6, 8, 8, 1, 0, 8, 6, 1, 1, 6, 5, -1, 0, 0, -1], [0, 3, 11, 0, 11, 6, 0, 6, 9, 9, 6, 5, -1, 0, 0, -1], [5, 11, 6, 5, 9, 11, 11, 9, 8, -1, 0, 0, 0, 0, 0, -1], [7, 8, 4, 6, 5, 10, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 4, 7, 3, 0, 4, 5, 10, 6, -1, 0, 0, 0, 0, 0, -1], [6, 5, 10, 7, 8, 4, 9, 0, 1, -1, 0, 0, 0, 0, 0, -1], [5, 10, 6, 9, 4, 7, 9, 7, 1, 1, 7, 3, -1, 0, 0, -1], [1, 6, 5, 1, 2, 6, 7, 8, 4, -1, 0, 0, 0, 0, 0, -1], [7, 0, 4, 7, 3, 0, 6, 5, 1, 6, 1, 2, -1, 0, 0, -1], [4, 7, 8, 5, 9, 0, 5, 0, 6, 6, 0, 2, -1, 0, 0, -1], [2, 6, 5, 2, 5, 3, 3, 5, 9, 3, 9, 4, 3, 4, 7, -1], [4, 7, 8, 5, 10, 6, 11, 2, 3, -1, 0, 0, 0, 0, 0, -1], [6, 5, 10, 7, 11, 2, 7, 2, 4, 4, 2, 0, -1, 0, 0, -1], [4, 7, 8, 9, 0, 1, 6, 5, 10, 3, 11, 2, -1, 0, 0, -1], [6, 5, 10, 11, 4, 7, 11, 2, 4, 4, 2, 9, 9, 2, 1, -1], [7, 8, 4, 11, 6, 5, 11, 5, 3, 3, 5, 1, -1, 0, 0, -1], [0, 4, 7, 0, 7, 1, 1, 7, 11, 1, 11, 6, 1, 6, 5, -1], [4, 7, 8, 9, 6, 5, 9, 0, 6, 6, 0, 11, 11, 0, 3, -1], [7, 11, 4, 11, 9, 4, 11, 5, 9, 11, 6, 5, -1, 0, 0, -1], [10, 4, 9, 10, 6, 4, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [10, 4, 9, 10, 6, 4, 8, 3, 0, -1, 0, 0, 0, 0, 0, -1], [1, 10, 6, 1, 6, 0, 0, 6, 4, -1, 0, 0, 0, 0, 0, -1], [4, 8, 6, 6, 1, 10, 6, 8, 1, 1, 8, 3, -1, 0, 0, -1], [9, 1, 2, 9, 2, 4, 4, 2, 6, -1, 0, 0, 0, 0, 0, -1], [0, 8, 3, 9, 1, 2, 9, 2, 4, 4, 2, 6, -1, 0, 0, -1], [0, 2, 6, 0, 6, 4, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 4, 8, 3, 2, 4, 4, 2, 6, -1, 0, 0, 0, 0, 0, -1], [4, 10, 6, 4, 9, 10, 2, 3, 11, -1, 0, 0, 0, 0, 0, -1], [8, 2, 0, 8, 11, 2, 4, 9, 10, 4, 10, 6, -1, 0, 0, -1], [2, 3, 11, 1, 10, 6, 1, 6, 0, 0, 6, 4, -1, 0, 0, -1], [8, 11, 2, 8, 2, 4, 4, 2, 1, 4, 1, 10, 4, 10, 6, -1], [3, 11, 1, 1, 4, 9, 11, 4, 1, 11, 6, 4, -1, 0, 0, -1], [6, 4, 9, 6, 9, 11, 11, 9, 1, 11, 1, 0, 11, 0, 8, -1], [11, 0, 3, 11, 6, 0, 0, 6, 4, -1, 0, 0, 0, 0, 0, -1], [8, 11, 6, 8, 6, 4, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [6, 7, 8, 6, 8, 10, 10, 8, 9, -1, 0, 0, 0, 0, 0, -1], [3, 0, 7, 7, 10, 6, 0, 10, 7, 0, 9, 10, -1, 0, 0, -1], [1, 10, 6, 1, 6, 7, 1, 7, 0, 0, 7, 8, -1, 0, 0, -1], [6, 1, 10, 6, 7, 1, 1, 7, 3, -1, 0, 0, 0, 0, 0, -1], [9, 1, 8, 8, 6, 7, 8, 1, 6, 6, 1, 2, -1, 0, 0, -1], [7, 3, 0, 7, 0, 6, 6, 0, 9, 6, 9, 1, 6, 1, 2, -1], [8, 6, 7, 8, 0, 6, 6, 0, 2, -1, 0, 0, 0, 0, 0, -1], [2, 6, 7, 2, 7, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [11, 2, 3, 6, 7, 8, 6, 8, 10, 10, 8, 9, -1, 0, 0, -1], [9, 10, 6, 9, 6, 0, 0, 6, 7, 0, 7, 11, 0, 11, 2, -1], [3, 11, 2, 0, 7, 8, 0, 1, 7, 7, 1, 6, 6, 1, 10, -1], [6, 7, 10, 7, 1, 10, 7, 2, 1, 7, 11, 2, -1, 0, 0, -1], [1, 3, 11, 1, 11, 9, 9, 11, 6, 9, 6, 7, 9, 7, 8, -1], [6, 7, 11, 9, 1, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 0, 7, 0, 6, 7, 0, 11, 6, 0, 3, 11, -1, 0, 0, -1], [6, 7, 11, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [6, 11, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 0, 8, 11, 7, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [6, 11, 7, 9, 0, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 8, 3, 1, 9, 8, 7, 6, 11, -1, 0, 0, 0, 0, 0, -1], [11, 7, 6, 2, 10, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 2, 10, 0, 8, 3, 11, 7, 6, -1, 0, 0, 0, 0, 0, -1], [9, 2, 10, 9, 0, 2, 11, 7, 6, -1, 0, 0, 0, 0, 0, -1], [11, 7, 6, 3, 2, 10, 3, 10, 8, 8, 10, 9, -1, 0, 0, -1], [2, 7, 6, 2, 3, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 7, 6, 8, 6, 0, 0, 6, 2, -1, 0, 0, 0, 0, 0, -1], [7, 2, 3, 7, 6, 2, 1, 9, 0, -1, 0, 0, 0, 0, 0, -1], [8, 7, 9, 9, 2, 1, 9, 7, 2, 2, 7, 6, -1, 0, 0, -1], [6, 10, 1, 6, 1, 7, 7, 1, 3, -1, 0, 0, 0, 0, 0, -1], [6, 10, 1, 6, 1, 0, 6, 0, 7, 7, 0, 8, -1, 0, 0, -1], [7, 6, 3, 3, 9, 0, 6, 9, 3, 6, 10, 9, -1, 0, 0, -1], [6, 8, 7, 6, 10, 8, 8, 10, 9, -1, 0, 0, 0, 0, 0, -1], [8, 6, 11, 8, 4, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [11, 3, 0, 11, 0, 6, 6, 0, 4, -1, 0, 0, 0, 0, 0, -1], [6, 8, 4, 6, 11, 8, 0, 1, 9, -1, 0, 0, 0, 0, 0, -1], [1, 9, 3, 3, 6, 11, 9, 6, 3, 9, 4, 6, -1, 0, 0, -1], [8, 6, 11, 8, 4, 6, 10, 1, 2, -1, 0, 0, 0, 0, 0, -1], [2, 10, 1, 11, 3, 0, 11, 0, 6, 6, 0, 4, -1, 0, 0, -1], [11, 4, 6, 11, 8, 4, 2, 10, 9, 2, 9, 0, -1, 0, 0, -1], [4, 6, 11, 4, 11, 9, 9, 11, 3, 9, 3, 2, 9, 2, 10, -1], [3, 8, 4, 3, 4, 2, 2, 4, 6, -1, 0, 0, 0, 0, 0, -1], [2, 0, 4, 2, 4, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 1, 9, 3, 8, 4, 3, 4, 2, 2, 4, 6, -1, 0, 0, -1], [9, 2, 1, 9, 4, 2, 2, 4, 6, -1, 0, 0, 0, 0, 0, -1], [6, 10, 4, 4, 3, 8, 4, 10, 3, 3, 10, 1, -1, 0, 0, -1], [1, 6, 10, 1, 0, 6, 6, 0, 4, -1, 0, 0, 0, 0, 0, -1], [10, 9, 0, 10, 0, 6, 6, 0, 3, 6, 3, 8, 6, 8, 4, -1], [10, 9, 4, 10, 4, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [6, 11, 7, 5, 4, 9, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 8, 3, 9, 5, 4, 7, 6, 11, -1, 0, 0, 0, 0, 0, -1], [0, 5, 4, 0, 1, 5, 6, 11, 7, -1, 0, 0, 0, 0, 0, -1], [7, 6, 11, 4, 8, 3, 4, 3, 5, 5, 3, 1, -1, 0, 0, -1], [2, 10, 1, 11, 7, 6, 5, 4, 9, -1, 0, 0, 0, 0, 0, -1], [0, 8, 3, 1, 2, 10, 4, 9, 5, 11, 7, 6, -1, 0, 0, -1], [6, 11, 7, 10, 5, 4, 10, 4, 2, 2, 4, 0, -1, 0, 0, -1], [6, 11, 7, 5, 2, 10, 5, 4, 2, 2, 4, 3, 3, 4, 8, -1], [2, 7, 6, 2, 3, 7, 4, 9, 5, -1, 0, 0, 0, 0, 0, -1], [4, 9, 5, 8, 7, 6, 8, 6, 0, 0, 6, 2, -1, 0, 0, -1], [3, 6, 2, 3, 7, 6, 0, 1, 5, 0, 5, 4, -1, 0, 0, -1], [1, 5, 4, 1, 4, 2, 2, 4, 8, 2, 8, 7, 2, 7, 6, -1], [5, 4, 9, 6, 10, 1, 6, 1, 7, 7, 1, 3, -1, 0, 0, -1], [4, 9, 5, 7, 0, 8, 7, 6, 0, 0, 6, 1, 1, 6, 10, -1], [3, 7, 6, 3, 6, 0, 0, 6, 10, 0, 10, 5, 0, 5, 4, -1], [4, 8, 5, 8, 10, 5, 8, 6, 10, 8, 7, 6, -1, 0, 0, -1], [5, 6, 11, 5, 11, 9, 9, 11, 8, -1, 0, 0, 0, 0, 0, -1], [0, 9, 5, 0, 5, 6, 0, 6, 3, 3, 6, 11, -1, 0, 0, -1], [8, 0, 11, 11, 5, 6, 11, 0, 5, 5, 0, 1, -1, 0, 0, -1], [11, 5, 6, 11, 3, 5, 5, 3, 1, -1, 0, 0, 0, 0, 0, -1], [10, 1, 2, 5, 6, 11, 5, 11, 9, 9, 11, 8, -1, 0, 0, -1], [2, 10, 1, 3, 6, 11, 3, 0, 6, 6, 0, 5, 5, 0, 9, -1], [0, 2, 10, 0, 10, 8, 8, 10, 5, 8, 5, 6, 8, 6, 11, -1], [11, 3, 6, 3, 5, 6, 3, 10, 5, 3, 2, 10, -1, 0, 0, -1], [2, 3, 6, 6, 9, 5, 3, 9, 6, 3, 8, 9, -1, 0, 0, -1], [5, 0, 9, 5, 6, 0, 0, 6, 2, -1, 0, 0, 0, 0, 0, -1], [6, 2, 3, 6, 3, 5, 5, 3, 8, 5, 8, 0, 5, 0, 1, -1], [6, 2, 1, 6, 1, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 9, 5, 8, 5, 3, 3, 5, 6, 3, 6, 10, 3, 10, 1, -1], [1, 0, 10, 0, 6, 10, 0, 5, 6, 0, 9, 5, -1, 0, 0, -1], [0, 3, 8, 10, 5, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [10, 5, 6, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [11, 5, 10, 11, 7, 5, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [5, 11, 7, 5, 10, 11, 3, 0, 8, -1, 0, 0, 0, 0, 0, -1], [11, 5, 10, 11, 7, 5, 9, 0, 1, -1, 0, 0, 0, 0, 0, -1], [9, 3, 1, 9, 8, 3, 5, 10, 11, 5, 11, 7, -1, 0, 0, -1], [2, 11, 7, 2, 7, 1, 1, 7, 5, -1, 0, 0, 0, 0, 0, -1], [3, 0, 8, 2, 11, 7, 2, 7, 1, 1, 7, 5, -1, 0, 0, -1], [2, 11, 0, 0, 5, 9, 0, 11, 5, 5, 11, 7, -1, 0, 0, -1], [9, 8, 3, 9, 3, 5, 5, 3, 2, 5, 2, 11, 5, 11, 7, -1], [10, 2, 3, 10, 3, 5, 5, 3, 7, -1, 0, 0, 0, 0, 0, -1], [5, 10, 7, 7, 0, 8, 10, 0, 7, 10, 2, 0, -1, 0, 0, -1], [1, 9, 0, 10, 2, 3, 10, 3, 5, 5, 3, 7, -1, 0, 0, -1], [7, 5, 10, 7, 10, 8, 8, 10, 2, 8, 2, 1, 8, 1, 9, -1], [7, 5, 1, 7, 1, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 1, 0, 8, 7, 1, 1, 7, 5, -1, 0, 0, 0, 0, 0, -1], [0, 5, 9, 0, 3, 5, 5, 3, 7, -1, 0, 0, 0, 0, 0, -1], [7, 5, 9, 7, 9, 8, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 5, 10, 4, 10, 8, 8, 10, 11, -1, 0, 0, 0, 0, 0, -1], [11, 3, 10, 10, 4, 5, 10, 3, 4, 4, 3, 0, -1, 0, 0, -1], [9, 0, 1, 4, 5, 10, 4, 10, 8, 8, 10, 11, -1, 0, 0, -1], [3, 1, 9, 3, 9, 11, 11, 9, 4, 11, 4, 5, 11, 5, 10, -1], [8, 4, 11, 11, 1, 2, 4, 1, 11, 4, 5, 1, -1, 0, 0, -1], [5, 1, 2, 5, 2, 4, 4, 2, 11, 4, 11, 3, 4, 3, 0, -1], [11, 8, 4, 11, 4, 2, 2, 4, 5, 2, 5, 9, 2, 9, 0, -1], [2, 11, 3, 5, 9, 4, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 5, 10, 4, 10, 2, 4, 2, 8, 8, 2, 3, -1, 0, 0, -1], [10, 4, 5, 10, 2, 4, 4, 2, 0, -1, 0, 0, 0, 0, 0, -1], [0, 1, 9, 8, 2, 3, 8, 4, 2, 2, 4, 10, 10, 4, 5, -1], [10, 2, 5, 2, 4, 5, 2, 9, 4, 2, 1, 9, -1, 0, 0, -1], [4, 3, 8, 4, 5, 3, 3, 5, 1, -1, 0, 0, 0, 0, 0, -1], [0, 4, 5, 0, 5, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 3, 9, 3, 5, 9, 3, 4, 5, 3, 8, 4, -1, 0, 0, -1], [4, 5, 9, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [7, 4, 9, 7, 9, 11, 11, 9, 10, -1, 0, 0, 0, 0, 0, -1], [8, 3, 0, 7, 4, 9, 7, 9, 11, 11, 9, 10, -1, 0, 0, -1], [0, 1, 4, 4, 11, 7, 1, 11, 4, 1, 10, 11, -1, 0, 0, -1], [10, 11, 7, 10, 7, 1, 1, 7, 4, 1, 4, 8, 1, 8, 3, -1], [2, 11, 7, 2, 7, 4, 2, 4, 1, 1, 4, 9, -1, 0, 0, -1], [0, 8, 3, 1, 4, 9, 1, 2, 4, 4, 2, 7, 7, 2, 11, -1], [7, 2, 11, 7, 4, 2, 2, 4, 0, -1, 0, 0, 0, 0, 0, -1], [7, 4, 11, 4, 2, 11, 4, 3, 2, 4, 8, 3, -1, 0, 0, -1], [7, 4, 3, 3, 10, 2, 3, 4, 10, 10, 4, 9, -1, 0, 0, -1], [2, 0, 8, 2, 8, 10, 10, 8, 7, 10, 7, 4, 10, 4, 9, -1], [4, 0, 1, 4, 1, 7, 7, 1, 10, 7, 10, 2, 7, 2, 3, -1], [4, 8, 7, 1, 10, 2, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [9, 7, 4, 9, 1, 7, 7, 1, 3, -1, 0, 0, 0, 0, 0, -1], [8, 7, 0, 7, 1, 0, 7, 9, 1, 7, 4, 9, -1, 0, 0, -1], [4, 0, 3, 4, 3, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [4, 8, 7, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 9, 10, 8, 10, 11, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 11, 3, 0, 9, 11, 11, 9, 10, -1, 0, 0, 0, 0, 0, -1], [1, 8, 0, 1, 10, 8, 8, 10, 11, -1, 0, 0, 0, 0, 0, -1], [3, 1, 10, 3, 10, 11, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [2, 9, 1, 2, 11, 9, 9, 11, 8, -1, 0, 0, 0, 0, 0, -1], [0, 9, 3, 9, 11, 3, 9, 2, 11, 9, 1, 2, -1, 0, 0, -1], [11, 8, 0, 11, 0, 2, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [2, 11, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 10, 2, 3, 8, 10, 10, 8, 9, -1, 0, 0, 0, 0, 0, -1], [9, 10, 2, 9, 2, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [3, 8, 2, 8, 10, 2, 8, 1, 10, 8, 0, 1, -1, 0, 0, -1], [2, 1, 10, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [8, 9, 1, 8, 1, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, 0, 9, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 3, 8, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1], [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1]]

function createSlider(guiPanel, label, min, max, value, step, callback) {

    // Create and add a text label
    const text = new TextBlock();
    text.paddingLeftInPixels = 8
    text.paddingRightInPixels = 8

    text.text = `${label}: ${value}`;
    text.height = "30px";
    text.color = "white";
    text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    guiPanel.addControl(text);

    // Create and configure the slider
    const slider = new Slider();
    slider.minimum = min;
    slider.maximum = max;
    slider.value = value;
    slider.step = step;
    slider.height = "20px";
    slider.width = "200px";
    slider.onValueChangedObservable.add((v) => {
        text.text = `${label}: ${Number.isInteger(v) ? v : v.toFixed(3)}`;
        callback(v);
    });
    guiPanel.addControl(slider);
    return slider
}

function createGUI() {
    const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const guiPanel = new StackPanel();

    guiPanel.background = new Color4(0, 0, 0, .2)
    guiPanel.alpha = .7
    guiPanel.width = "220px";
    guiPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    guiPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(guiPanel);
    return guiPanel
}

/**
 * Wraps a function so that only one call runs at a time.
 * If the wrapper is invoked while a call is in flight, it schedules
 * exactly one more execution once the current run finishes.
 *
 * @param  {Function} fn  The function to debounce. May return a Promise or a value.
 * @return {Function}     The debounced wrapper.
 */
function createAsyncDebouncer(fn) {
    let inFlight = false;
    let waiting = false;

    const debounced = (...args) => {
        // If already running, mark that we need to run again afterward
        if (inFlight) {
            waiting = true;
            return;
        }

        // Otherwise, start a run
        inFlight = true;
        // Ensure we handle both sync and async functions uniformly
        Promise.resolve(fn(...args))
            .finally(() => {
                inFlight = false;
                // If calls piled up, clear the flag and run once more
                if (waiting) {
                    waiting = false;
                    debounced(...args);
                }
            });
    };

    return debounced;
}


function simplifyMeshSqem(original_mesh, { scene, aggressiveness, target_count, tri_count, buffers: { pos, idx }, stride: { pos_s = 3, idx_s = 3 } = {} }) {

    // === Quadric Mesh Simplification ===

    function SymetricMatrix() {
        this.m = new Array(10).fill(0);
    }
    SymetricMatrix.prototype = {
        set: function set(
            m11, m12, m13, m14,
            m22, m23, m24,
            m33, m34,
            m44) {

            this.m[0] = m11; this.m[1] = m12; this.m[2] = m13; this.m[3] = m14;
            this.m[4] = m22; this.m[5] = m23; this.m[6] = m24;
            this.m[7] = m33; this.m[8] = m34;
            this.m[9] = m44;
            return this;
        },
        makePlane: function makePlane(a, b, c, d) {
            return this.set(
                a * a, a * b, a * c, a * d,
                b * b, b * c, b * d,
                c * c, c * d,
                d * d
            );
        },
        det: function determinant(
            a11, a12, a13,
            a21, a22, a23,
            a31, a32, a33
        ) {
            var m = this.m;
            return m[a11] * m[a22] * m[a33]
                + m[a13] * m[a21] * m[a32]
                + m[a12] * m[a23] * m[a31]
                - m[a13] * m[a22] * m[a31]
                - m[a11] * m[a23] * m[a32]
                - m[a12] * m[a21] * m[a33];
        },
        add: function add(n) {
            var r = new SymetricMatrix();
            for (var i = 0; i < 10; i++) {
                r.m[i] = this.m[i] + n.m[i];
            }
            return r;
        },
        addSelf: function addSelf(n) {
            for (var i = 0; i < 10; i++) {
                this.m[i] += n.m[i];
            }
        }
    };

    function Triangle() {
        this.v = [0, 0, 0];
        this.err = [0, 0, 0, 0];
        this.deleted = false;
        this.dirty = false;
        this.n = new Vector3();
    }
    function Vertex() {
        this.p = new Vector3();
        this.q = new SymetricMatrix();
        this.tstart = -1;
        this.tcount = -1;
        this.border = false;
    }
    function Ref() {
        this.tid = -1;
        this.tvertex = -1;
    }

    var vertices = [], triangles = [], refs = [];

    function init(origVertices, origFaces) {
        vertices = origVertices.map(function (v) {
            var vert = new Vertex();
            vert.p.copyFrom(v);
            return vert;
        });
        triangles = origFaces.map(function (f) {
            var tri = new Triangle();
            tri.v[0] = f.a; tri.v[1] = f.b; tri.v[2] = f.c;
            return tri;
        });
        refs = [];
    }

    function resize(array, count) {
        if (array.length > count) array.splice(count);
    }

    // temporary vectors for flipped test
    var n = new Vector3(), d1 = new Vector3(), d2 = new Vector3();

    function flipped(p, i0, i1, v0, v1, deleted) {
        for (var k = 0; k < v0.tcount; k++) {
            var r = refs[v0.tstart + k];
            var t = triangles[r.tid];
            if (t.deleted) continue;

            var s = r.tvertex;
            var id1 = t.v[(s + 1) % 3];
            var id2 = t.v[(s + 2) % 3];

            if (id1 === i1 || id2 === i1) {
                deleted[k] = true;
                continue;
            }
            // d1 = normalize(vertices[id1].p - p)
            d1.copyFrom(vertices[id1].p).subtractInPlace(p).normalize();
            d2.copyFrom(vertices[id2].p).subtractInPlace(p).normalize();

            if (Math.abs(d1.dot(d2)) > 0.999) return true;

            Vector3.CrossToRef(d1, d2, n);
            n.normalize();
            deleted[k] = false;
            if (n.dot(t.n) < 0.2) return true;
        }
        return false;
    }

    function vertex_error(q, x, y, z) {
        var m = q.m;
        return m[0] * x * x + 2 * m[1] * x * y + 2 * m[2] * x * z + 2 * m[3] * x
            + m[4] * y * y + 2 * m[5] * y * z + 2 * m[6] * y
            + m[7] * z * z + 2 * m[8] * z + m[9];
    }

    function calculate_error(id_v1, id_v2, p_result) {
        var vertex1 = vertices[id_v1];
        var vertex2 = vertices[id_v2];
        var q = vertex1.q.add(vertex2.q);
        var border = vertex1.border && vertex2.border;
        var det = q.det(0, 1, 2, 1, 4, 5, 2, 5, 7);
        var error;
        if (det !== 0 && !border) {
            p_result.x = -1 / det * q.det(1, 2, 3, 4, 5, 6, 5, 7, 8);
            p_result.y = 1 / det * q.det(0, 2, 3, 1, 5, 6, 2, 7, 8);
            p_result.z = -1 / det * q.det(0, 1, 3, 1, 4, 6, 2, 5, 8);
            error = vertex_error(q, p_result.x, p_result.y, p_result.z);
        } else {
            var p1 = vertex1.p;
            var p2 = vertex2.p;
            var p3 = p1.add(p2).scale(0.5);
            var error1 = vertex_error(q, p1.x, p1.y, p1.z);
            var error2 = vertex_error(q, p2.x, p2.y, p2.z);
            var error3 = vertex_error(q, p3.x, p3.y, p3.z);
            error = Math.min(error1, error2, error3);
            if (error1 === error) p_result.copyFrom(p1);
            else if (error2 === error) p_result.copyFrom(p2);
            else p_result.copyFrom(p3);
        }
        return error;
    }

    function update_triangles(i0, v, deleted, deleted_triangles) {
        var p = new Vector3();
        for (var k = 0; k < v.tcount; k++) {
            var r = refs[v.tstart + k];
            var t = triangles[r.tid];
            if (t.deleted) continue;
            if (deleted[k]) {
                t.deleted = true;
                deleted_triangles++;
                continue;
            }
            t.v[r.tvertex] = i0;
            t.dirty = true;

            t.err[0] = calculate_error(t.v[0], t.v[1], p);
            t.err[1] = calculate_error(t.v[1], t.v[2], p);
            t.err[2] = calculate_error(t.v[2], t.v[0], p);
            t.err[3] = Math.min(t.err[0], t.err[1], t.err[2]);

            refs.push(r);
        }
        return deleted_triangles;
    }

    function update_mesh(iteration) {
        if (iteration > 0) {
            var dst = 0;
            for (var i = 0; i < triangles.length; i++) {
                if (!triangles[i].deleted) {
                    triangles[dst++] = triangles[i];
                }
            }
            triangles.splice(dst);
        }

        if (iteration === 0) {
            // init quadrics
            for (var i = 0; i < vertices.length; i++) {
                vertices[i].q = new SymetricMatrix();
            }

            for (let i = 0; i < triangles.length; i++) {
                var t = triangles[i];
                var p = [], p1p0 = new Vector3(), p2p0 = new Vector3();

                for (var j = 0; j < 3; j++) {
                    p[j] = vertices[t.v[j]].p;
                }
                p1p0.copyFrom(p[1]).subtractInPlace(p[0]);
                p2p0.copyFrom(p[2]).subtractInPlace(p[0]);

                Vector3.CrossToRef(p1p0, p2p0, n);
                n.normalize();
                t.n = n;

                var tmp = new SymetricMatrix().makePlane(
                    n.x, n.y, n.z, -n.dot(p[0])
                );
                for (j = 0; j < 3; j++) {
                    vertices[t.v[j]].q.addSelf(tmp);
                }
            }

            for (let i = 0; i < triangles.length; i++) {
                var t = triangles[i], ptmp = new Vector3();
                for (var j = 0; j < 3; j++) {
                    t.err[j] = calculate_error(t.v[j], t.v[(j + 1) % 3], ptmp);
                }
                t.err[3] = Math.min(t.err[0], t.err[1], t.err[2]);
            }
        }

        // build refs
        for (let i = 0; i < vertices.length; i++) {
            vertices[i].tstart = 0; vertices[i].tcount = 0;
        }
        for (let i = 0; i < triangles.length; i++) {
            for (var j = 0; j < 3; j++) {
                vertices[triangles[i].v[j]].tcount++;
            }
        }
        var tstart = 0;
        for (let i = 0; i < vertices.length; i++) {
            var v = vertices[i];
            v.tstart = tstart;
            tstart += v.tcount;
            v.tcount = 0;
        }

        resize(refs, triangles.length * 3);
        for (let i = 0; i < triangles.length; i++) {
            var t = triangles[i];
            for (j = 0; j < 3; j++) {
                var v = vertices[t.v[j]];
                refs[v.tstart + v.tcount] = new Ref();
                refs[v.tstart + v.tcount].tid = i;
                refs[v.tstart + v.tcount].tvertex = j;
                v.tcount++;
            }
        }

        // identify borders
        if (iteration === 0) {
            for (let i = 0; i < vertices.length; i++) {
                vertices[i].border = false;
            }
            for (let i = 0; i < vertices.length; i++) {
                var v = vertices[i], vcount = [], vids = [];
                for (j = 0; j < v.tcount; j++) {
                    var tri = triangles[refs[v.tstart + j].tid];
                    for (var k = 0; k < 3; k++) {
                        var id = tri.v[k],
                            ofs = vids.indexOf(id);
                        if (ofs === -1) {
                            vids.push(id);
                            vcount.push(1);
                        } else {
                            vcount[ofs]++;
                        }
                    }
                }
                for (j = 0; j < vids.length; j++) {
                    if (vcount[j] === 1) {
                        vertices[vids[j]].border = true;
                    }
                }
            }
        }
    }

    function compact_mesh() {
        var i, j;
        // reset usage flags
        for (let i = 0; i < vertices.length; i++) {
            vertices[i].tcount = 0;
        }

        // keep only non‐deleted triangles and mark which vertices survive
        var dstT = 0;
        for (let i = 0; i < triangles.length; i++) {
            var t = triangles[i];
            if (!t.deleted) {
                triangles[dstT++] = t;
                for (j = 0; j < 3; j++) {
                    vertices[t.v[j]].tcount = 1;
                }
            }
        }
        triangles.splice(dstT);

        // build old→new index map and compact vertices
        var mapping = [];
        var dstV = 0;
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].tcount) {
                mapping[i] = dstV;
                vertices[dstV] = vertices[i];
                dstV++;
            }
        }
        vertices.splice(dstV);

        // remap all triangle vertex indices
        for (let i = 0; i < triangles.length; i++) {
            var t = triangles[i];
            for (j = 0; j < 3; j++) {
                t.v[j] = mapping[t.v[j]];
            }
        }
    }

    function simplify_mesh(target_count, agressiveness) {
        if (agressiveness === undefined) agressiveness = 7;
        console.time('simplify_mesh');

        for (var i = 0; i < triangles.length; i++) {
            triangles[i].deleted = false;
        }

        var deleted_triangles = 0,
            deleted0 = [], deleted1 = [],
            triangle_count = triangles.length;

        for (var iteration = 0; iteration < 100; iteration++) {
            if (triangle_count - deleted_triangles <= target_count) break;

            update_mesh(iteration);
            for (var j = 0; j < triangles.length; j++) {
                triangles[j].dirty = false;
            }

            var threshold = 1e-9 * Math.pow(iteration + 3, agressiveness);

            for (let i = 0; i < triangles.length; i++) {
                var t = triangles[i];
                if (t.err[3] > threshold || t.deleted || t.dirty) continue;

                for (var j = 0; j < 3; j++) {
                    if (t.err[j] < threshold) {
                        var i0 = t.v[j], i1 = t.v[(j + 1) % 3];
                        var v0 = vertices[i0], v1 = vertices[i1];
                        var p = new Vector3();

                        if (v0.border !== v1.border) continue;
                        calculate_error(i0, i1, p);
                        resize(deleted0, v0.tcount);
                        resize(deleted1, v1.tcount);

                        if (flipped(p, i0, i1, v0, v1, deleted0)) continue;
                        if (flipped(p, i1, i0, v1, v0, deleted1)) continue;

                        v0.p.copyFrom(p);
                        v0.q.addSelf(v1.q);

                        var tstart = refs.length;
                        deleted_triangles = update_triangles(i0, v0, deleted0, deleted_triangles);
                        deleted_triangles = update_triangles(i0, v1, deleted1, deleted_triangles);

                        var tcount = refs.length - tstart;
                        if (tcount <= v0.tcount) {
                            // reuse
                        } else {
                            v0.tstart = tstart;
                        }
                        v0.tcount = tcount;
                        break;
                    }
                }
                if (triangle_count - deleted_triangles <= target_count) break;
            }
        }

        compact_mesh();
        console.timeEnd('simplify_mesh');
    }

    function simplifyModify(origV, origF, targetCount, aggressiveness) {
        init(origV, origF);
        simplify_mesh(targetCount, aggressiveness);

        var positions = [], indices = [];
        for (var i = 0; i < vertices.length; i++) {
            var p = vertices[i].p;
            positions.push(p.x, p.y, p.z);
        }
        for (let i = 0; i < triangles.length; i++) {
            indices.push(
                triangles[i].v[0],
                triangles[i].v[1],
                triangles[i].v[2]
            );
        }
        return { positions: positions, indices: indices };
    }

    var posArray = pos;
    var idxArray = idx;

    var origV = [], origF = [];
    for (let i = 0; i < posArray.length; i += pos_s) {
        origV.push(new Vector3(
            posArray[i], posArray[i + 1], posArray[i + 2]
        ));
    }
    for (let i = 0; i < tri_count * idx_s; i += idx_s) {
        origF.push({ a: idxArray[i], b: idxArray[i + 1], c: idxArray[i + 2] });
    }
    origF.forEach(f => {
        [f.a, f.b, f.c].forEach(idx => {
            if (idx < 0 || idx >= origV.length) {
                throw new Error(`Face index ${idx} out of range (0–${origV.length - 1})`);
            }
        });
    });
    // ─── Deduplicate original mesh to avoid cracks ───────────────────────────────
    function deduplicate(origV, origF) {
        var map = {}, newV = [], newF = [];
        function key(v) {
            return v.x.toFixed(6) + '_' + v.y.toFixed(6) + '_' + v.z.toFixed(6);
        }
        // build unique vertex list
        origV.forEach(function (v, i) {
            var k = key(v);
            if (map[k] === undefined) {
                map[k] = newV.length;
                newV.push(v);
            }
        });
        // rebuild faces to point at deduped verts
        origF.forEach(function (f) {
            newF.push({
                a: map[key(origV[f.a])],
                b: map[key(origV[f.b])],
                c: map[key(origV[f.c])]
            });
        });
        return { vertices: newV, faces: newF };
    }

    var deduped = deduplicate(origV, origF);
    var result = simplifyModify(deduped.vertices, deduped.faces, target_count, aggressiveness);
    let raw = original_mesh

    let simpleMesh = scene.getMeshByName("simpleMesh") || new Mesh("simpleMesh", scene);
    simpleMesh.setVerticesData(
        VertexBuffer.PositionKind,
        result.positions,
        true
    );
    simpleMesh.setIndices(result.indices, result.positions.length / 3);

    // compute how many triangles we’ve got
    const triCount = result.indices.length / 3;

    // if we have fewer than, say, 1 triangle—or whatever “too few” means—just hide
    if (triCount < 1) {
        simpleMesh.setEnabled(false);   // will skip rendering entirely
    } else {
        simpleMesh.setEnabled(true);
        // upload positions & indices
        simpleMesh.setVerticesData(
            VertexBuffer.PositionKind,
            result.positions,
            true
        );
        simpleMesh.setIndices(result.indices);
        simpleMesh.position.copyFrom(raw.position);
    }

    simpleMesh.position.copyFrom(raw.position);


    return simpleMesh

}

/**
 * Welds / merges duplicate xyz vertices (ignores the 4th padding float)
 * only over the indices you actually use, so it stays fast.
 *
 * @param {Float32Array} positions flat [x,y,z,_, x,y,z,_, …]
 * @param {Uint32Array}  indices   flat [i,i,i, i,i,i, …]
 * @param {number}       stride    how many floats per vertex in `positions` (here 4)
 * @param {number}       tol       snapping tolerance in world units
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
function weldMeshData(positions, indices, stride = 4, tol = 1e-5) {
    const map = Object.create(null);
    const newPos = [];
    const newIdx = new Uint32Array(indices.length);
    const scale = 1 / tol;

    for (let f = 0; f < indices.length; ++f) {
        const oldI = indices[f];
        const off = oldI * stride;
        const x = positions[off];
        const y = positions[off + 1];
        const z = positions[off + 2];
        // grid‐snap key
        const key = `${Math.round(x * scale)}_${Math.round(y * scale)}_${Math.round(z * scale)}`;
        let ni = map[key];
        if (ni === undefined) {
            ni = newPos.length / 3;
            map[key] = ni;
            newPos.push(x, y, z);
        }
        newIdx[f] = ni;
    }

    return {
        positions: new Float32Array(newPos),
        indices: newIdx
    };
}
