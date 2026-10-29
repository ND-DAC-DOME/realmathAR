import { Vector3, LineBasicMaterial, BufferGeometry, Line } from 'three'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { Point } from '../base-geometry/Point'
import { GeometryParent } from '../GeometryParent.js'

export class SpaceCurve extends GeometryParent {
    static SEGMENTS = 1000  // samples across the whole t-range
    static MAXTRANGE = 100
    constructor (props) {
        super(4, props.eqs)
        this.t = 0
        /* curve is drawn for t in [-tRange, tRange] */
        this.tRange = 10
        this.prevTRange = this.tRange
        this.pointColor = props.color2
        /* basic baby mats for babies */
        this.linemat = new LineBasicMaterial({
            color: props.color,
        })
        this.material = new LineMaterial({
            color: props.color,
            linewidth: 0.05,
            worldUnits: true,
        })
        this.getCurve(true)
    }

    /* curve position at t, or null where any component is undefined */
    curveAt (t) {
        const point = new Vector3()
        for (const element of ['x', 'y', 'z']) {
            const result = this.eqs[element]({t})
            if (!Number.isFinite(result)) {
                return null
            }
            point[element] = result
        }
        return point
    }

    getCurve (init=false) {
        this.out.children = []
        /* get the points on the line, skipping undefined ones */
        const points = []
        const step = (2 * this.tRange) / this.constructor.SEGMENTS
        for (let i = 0; i <= this.constructor.SEGMENTS; i++) {
            const point = this.curveAt(-this.tRange + i * step)
            if (point !== null) {
                points.push(point)
            }
        }
        const geometry = new BufferGeometry().setFromPoints(points)
        const linegeo = new LineGeometry().fromLine(new Line(geometry, this.linemat))

        /* only need new point/no disposal if initializing */
        if (init === true) {
            this.point = Point({pos: new Vector3(), color: this.pointColor})
            this.line = new Line2(linegeo, this.material)
            this.tCallback()
        } else {
            this.line.geometry.dispose()
            this.line.material.dispose()
            this.line = new Line2(linegeo, this.material)
        }
        this.out.add(this.point)
        this.out.add(this.line)
    }

    /* moves the point to the curve at the current t (origin where undefined) */
    tCallback = () => {
        this.point.position.copy(this.curveAt(Number(this.t)) ?? new Vector3())
    }

    tRangeCallback = () => {
        if (this.tRange === this.prevTRange) {
            return
        }
        this.prevTRange = this.tRange
        this.getCurve()
    }

    /* the point's current position, for snapping the focal point to it */
    focusTarget = () => this.point.position.clone()
}
