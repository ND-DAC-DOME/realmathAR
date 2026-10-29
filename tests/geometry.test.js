import { describe, it, expect } from 'vitest'
import { parse } from '@cortex-js/compute-engine'
import { Group, Vector3, Matrix4, Quaternion } from 'three'
import { MarchingCubes } from '../src/geometry-gen/mcubes/MarchingCubes'
import { Function } from '../src/geometry-gen/complex-geometry/FunctionClass'
import { VectorField } from '../src/geometry-gen/complex-geometry/VectorFieldClass'
import { SpaceCurve } from '../src/geometry-gen/complex-geometry/SpaceCurveClass'
import { Vector } from '../src/geometry-gen/base-geometry/Vector'

/* mirrors Processor's 0*var padding */
const eq = (latex, vars) => parse(`\\left(${latex}\\right)` + vars.map((v) => `+\\left(0*${v}\\right)`).join(''))
const XYZ = ['x', 'y', 'z']

describe('MarchingCubes', () => {
    it('draws the surface where the equation is 0', () => {
        const points = MarchingCubes(eq('x^2+y^2+z^2-4', XYZ), 10, 30)
        const radii = points.map((p) => p.length())
        expect(Math.min(...radii)).toBeGreaterThan(1.95)
        expect(Math.max(...radii)).toBeLessThan(2.05)
    })
})

describe('Function', () => {
    it('disposes the old mesh when rebuilt at a new scale', () => {
        const f = new Function({ eqs: eq('x^2+y^2+z^2-4', XYZ) })
        let disposed = false
        f.mesh.geometry.addEventListener('dispose', () => { disposed = true })
        f.scale = 6
        f.functionCallback()
        expect(disposed).toBe(true)
        expect(f.out.children).toHaveLength(1)
    })
})

describe('VectorField', () => {
    const field = (x, y, z) => new VectorField({ eqs: { x: eq(x, XYZ), y: eq(y, XYZ), z: eq(z, XYZ) } })
    const arrowAt = (vf, target) => {
        const m = new Matrix4(), p = new Vector3(), q = new Quaternion(), s = new Vector3()
        for (let n = 0; n < vf.mesh.count; n++) {
            vf.mesh.getMatrixAt(n, m)
            m.decompose(p, q, s)
            if (p.equals(target)) return new Vector3(0, 1, 0).applyQuaternion(q)
        }
        return null
    }

    it('shows arrows on load at grid points, pointing along the field', () => {
        const vf = field('x-xy', 'x-y', '0')
        expect(vf.mesh.count).toBe(119)  // 11x11 grid minus 2 zero vectors
        const dir = arrowAt(vf, new Vector3(3, 0, 0))  // F = (3, 3, 0)
        expect(dir.x).toBeCloseTo(Math.SQRT1_2)
        expect(dir.y).toBeCloseTo(Math.SQRT1_2)
    })

    it('skips points where the field is undefined', () => {
        expect(field('\\frac{1}{x}', '1', '0').mesh.count).toBe(110)  // x = 0 column dropped
    })

    it('handles max slices quickly using the cache', () => {
        const vf = field('x-xy', 'x-y', '0')
        vf.slices = { x: 10, y: 10, z: 10 }
        vf.vecsCallback('x')
        expect(vf.mesh.count).toBeGreaterThan(9000)
    })
})

describe('SpaceCurve', () => {
    it('moves its point along the curve with t', () => {
        const sc = new SpaceCurve({
            eqs: { x: eq('\\cos(t)', ['t']), y: eq('\\sin(t)', ['t']), z: eq('0.1t', ['t']) },
            color: 0x0000ff,
            color2: 0xff00ff,
        })
        expect(sc.zeropoint).toEqual({ x: 1, y: 0, z: 0 })
        sc.t = Math.PI / 2
        sc.tCallback()
        expect(sc.point.position.x).toBeCloseTo(0)
        expect(sc.point.position.y).toBeCloseTo(1)
        expect(sc.point.position.z).toBeCloseTo(Math.PI / 20)
    })
})

describe('Vector', () => {
    it('draws from init to init + vec', () => {
        const { out } = Vector({ init: new Vector3(0, 0, -1), vec: new Vector3(0, 0, 2), color: 0xff })
        new Group().add(out).updateMatrixWorld(true)
        const tip = new Vector3(0, 2, 0).applyMatrix4(out.matrixWorld)
        expect(tip.x).toBeCloseTo(0)
        expect(tip.y).toBeCloseTo(0)
        expect(tip.z).toBeCloseTo(1)
    })
})
