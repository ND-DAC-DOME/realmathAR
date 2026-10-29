import { GeometryParent } from '../GeometryParent.js'
import {
    Vector3, Quaternion, Matrix4, Color, CylinderGeometry, ConeGeometry,
    InstancedMesh, InstancedBufferAttribute, MeshToonMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const UP = new Vector3(0, 1, 0)

/* unit-length arrow along +y, shared by every instance */
const ArrowGeometry = () => {
    const shaft = new CylinderGeometry(0.03, 0.03, 0.75, 6)
    shaft.translate(0, 0.375, 0)
    const head = new ConeGeometry(0.1, 0.25, 6)
    head.translate(0, 0.875, 0)
    return mergeGeometries([shaft, head])
}

export class VectorField extends GeometryParent {
    static STEP = 1         // spacing between arrows
    static MAXSLICES = 10   // max arrows on each side of the center, per axis
    constructor (props) {
        /* initialize super and vars */
        super(3, props.eqs)
        /* # of arrows on each side of the center, per axis */
        this.slices = {x: 5, y: 5, z: 0}
        this.prevSlices = {...this.slices}
        /* grid point the arrows are centered on (focal point, snapped to the grid) */
        this.center = new Vector3()
        /* evaluated vectors keyed by grid point, so slider/focus changes don't reeval */
        this.cache = new Map()
        /* one instanced mesh draws every arrow in a single draw call */
        const maxCount = (2 * this.constructor.MAXSLICES + 1) ** 3
        this.mesh = new InstancedMesh(ArrowGeometry(), new MeshToonMaterial(), maxCount)
        this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(maxCount * 3), 3)
        this.mesh.frustumCulled = false  // instance count changes, so bounds go stale
        this.out.add(this.mesh)
        this.getVecs()
    }

    /* field value at grid point (i, j, k), or null where undefined */
    evalAt (i, j, k) {
        const key = `${i},${j},${k}`
        if (!this.cache.has(key)) {
            const step = this.constructor.STEP
            const at = {x: i * step, y: j * step, z: k * step}
            let vec = new Vector3()
            for (const element of ['x', 'y', 'z']) {
                const result = this.eqs[element](at)
                if (!Number.isFinite(result)) {
                    vec = null
                    break
                }
                vec[element] = result
            }
            this.cache.set(key, vec)
        }
        return this.cache.get(key)
    }

    /* lay out arrows for the current slices: unit length, pointing along the field */
    getVecs () {
        const step = this.constructor.STEP
        const {x: nx, y: ny, z: nz} = this.slices
        const {x: cx, y: cy, z: cz} = this.center
        const matrix = new Matrix4()
        const quat = new Quaternion()
        const pos = new Vector3()
        const scale = new Vector3().setScalar(step * 0.8)
        const dir = new Vector3()
        const color = new Color()
        let count = 0
        for (let i = cx - nx; i <= cx + nx; i++) {
            for (let j = cy - ny; j <= cy + ny; j++) {
                for (let k = cz - nz; k <= cz + nz; k++) {
                    const vec = this.evalAt(i, j, k)
                    /* skip undefined and zero vectors, which have no direction */
                    if (vec === null || vec.lengthSq() === 0) {
                        continue
                    }
                    dir.copy(vec).normalize()
                    quat.setFromUnitVectors(UP, dir)
                    pos.set(i * step, j * step, k * step)
                    matrix.compose(pos, quat, scale)
                    this.mesh.setMatrixAt(count, matrix)
                    /* color by direction */
                    this.mesh.setColorAt(count, color.setRGB(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)))
                    count += 1
                }
            }
        }
        this.mesh.count = count
        this.mesh.instanceMatrix.needsUpdate = true
        this.mesh.instanceColor.needsUpdate = true
    }

    vecsCallback = (coord) => {
        /* prevent redundant changes */
        if (this.prevSlices[coord] === this.slices[coord]) {
            return
        } else {
            this.prevSlices[coord] = this.slices[coord]
            this.getVecs()
        }
    }

    /* recenter the grid on the grid point nearest a new focal point */
    setFocus = (focus) => {
        const step = this.constructor.STEP
        const center = new Vector3(
            Math.round(focus.x / step), Math.round(focus.y / step), Math.round(focus.z / step)
        )
        if (this.center.equals(center)) {
            return
        }
        this.center.copy(center)
        this.getVecs()
    }
}
