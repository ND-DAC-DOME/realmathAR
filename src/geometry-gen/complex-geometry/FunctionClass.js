import { MarchingCubes } from "../mcubes/MarchingCubes"
import { Float32BufferAttribute, ShaderMaterial, Color, DoubleSide, BufferGeometry, Mesh, Group } from "three"
import { GeometryParent } from "../GeometryParent"

export class Function extends GeometryParent {
    constructor (props) {
        super(0, props.eqs)
        this.colors = [new Color(0X2D0075), new Color(0x60EFFF)]
        this.MeshGetter()
        this.prevMaxes = {x: this.xMax, y: this.yMax, z: this.zMax}
    }

    PointGetter () {
        /* generates points using marching cubes alg */
        const trianglePoints = MarchingCubes(this.eqs, this.scale, this.size)
        const maxPolygons = 30000
        const vertices = Array(3 * maxPolygons).fill(0)
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
                    value: this.colors[0],
                },
                color2: {
                    value: this.colors[1],
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
            this.MeshGetter()
        }
    }
}