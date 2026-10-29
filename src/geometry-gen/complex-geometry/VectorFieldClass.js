import { GeometryParent } from '../GeometryParent.js'
import {
    Vector3, Quaternion, Matrix4, Color, CylinderGeometry, ConeGeometry,
    InstancedMesh, InstancedBufferAttribute, MeshToonMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { assign } from '@cortex-js/compute-engine'
import { EvaluateNumber } from '../../input-processing/Evaluate'

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
    static MAXSLICES = 10   // max arrows on each side of the origin, per axis
    constructor (props) {
        /* initialize super and vars */
        super(3, props.eqs)
        /* # of arrows on each side of the origin, per axis */
        this.slices = {x: 5, y: 5, z: 0}
        this.prevSlices = {...this.slices}
        /* evaluated vectors keyed by grid point, so slider changes don't reeval */
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
            assign('x', i * step)
            assign('y', j * step)
            assign('z', k * step)
            let vec = new Vector3()
            for (const element of ['x', 'y', 'z']) {
                const result = EvaluateNumber(this.eqs[element])
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
        const matrix = new Matrix4()
        const quat = new Quaternion()
        const pos = new Vector3()
        const scale = new Vector3().setScalar(step * 0.8)
        const dir = new Vector3()
        const color = new Color()
        let count = 0
        for (let i = -nx; i <= nx; i++) {
            for (let j = -ny; j <= ny; j++) {
                for (let k = -nz; k <= nz; k++) {
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
}
