import { MarchingCubes } from "../mcubes/MarchingCubes"
import { Float32BufferAttribute, ShaderMaterial, Color, DoubleSide, BufferGeometry, Mesh, Vector3 } from "three"
import { GeometryParent } from "../GeometryParent"

export class Function extends GeometryParent {
    constructor (props) {
        super(0, props.eqs)
        /* gradient from lowColor (bottom) to highColor (top); gui edits these in place */
        this.lowColor = new Color(0X2D0075)
        this.highColor = new Color(0x60EFFF)
        /* center of the sampling window (focal point) */
        this.center = new Vector3()
        this.MeshGetter()
    }

    PointGetter () {
        /* generates points using marching cubes alg */
        const trianglePoints = MarchingCubes(this.eqs, this.center, this.scale, this.size)
        const vertices = new Float32Array(3 * trianglePoints.length)
        /* faces */
        for (let i = 0; i < trianglePoints.length; i++) {
            const [x, y, z]     = trianglePoints[i]
            vertices[i * 3]     = x
            vertices[i * 3 + 1] = y
            vertices[i * 3 + 2] = z
        }
        const positionAttribute = new Float32BufferAttribute(vertices, 3)
        return [positionAttribute, trianglePoints]
    }

    MatGetter (geometry) {
        geometry.computeBoundingBox()
        const material = new ShaderMaterial({
            uniforms: {
                color1: {
                    value: this.lowColor,
                },
                color2: {
                    value: this.highColor,
                },
                bboxMin: {
                    value: geometry.boundingBox.min,
                },
                bboxMax: {
                    value: geometry.boundingBox.max,
                },
            },
            vertexShader: `
                uniform vec3 bboxMin;
                uniform vec3 bboxMax;

                varying vec2 vUv;

                void main() {
                    /* gradient by height (math z) */
                    vUv.y = (position.z - bboxMin.z) / (bboxMax.z - bboxMin.z);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;

                varying vec2 vUv;
                
                void main() {
                
                    gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
                }
            `,
            wireframe: false,
            side: DoubleSide,
        })
        return material
    }

    MeshGetter (update=false) {
        this.out.children = []
        if (update) {
            this.mesh.geometry.dispose()
            this.mesh.material.dispose()
        }
        const [positionAttribute, trianglePoints] = this.PointGetter()
        const meshBufferGeometry = new BufferGeometry()
        meshBufferGeometry.setAttribute('position', positionAttribute)
        meshBufferGeometry.setDrawRange(0, trianglePoints.length)
        meshBufferGeometry.computeVertexNormals()   
        /* make gradient material */
        /* from https://stackoverflow.com/questions/52614371/apply-color-gradient-to-material-on-mesh-three-js/52615186#52615186 */
        this.mesh = new Mesh(meshBufferGeometry, this.MatGetter(meshBufferGeometry))
        this.out.add(this.mesh)
    }

    functionCallback = () => {
        if (this.checkRedundant()) {
            return 
        } else {
            this.setSize()
            this.MeshGetter(true)
        }
    }

    /* resample the window around a new focal point */
    setFocus = (focus) => {
        if (this.center.equals(focus)) {
            return
        }
        this.center.copy(focus)
        this.MeshGetter(true)
    }

    /* middle of the drawn surface, for snapping the focal point to it */
    focusTarget = () => {
        const box = this.mesh.geometry.boundingBox
        return box.isEmpty() ? null : box.getCenter(new Vector3())
    }
}