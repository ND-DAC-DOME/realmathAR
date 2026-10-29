import { Vector3, LineBasicMaterial, BufferGeometry, Line, Group } from 'three'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { Point } from '../base-geometry/Point'
import { assign } from "@cortex-js/compute-engine";
import { EvaluateNumber } from '../../input-processing/Evaluate'
import { GeometryParent } from '../GeometryParent.js'

export class SpaceCurve extends GeometryParent {
    constructor (props) {
        super(4, props.eqs)
        this.t = 0
        this.pointColor = props.color2
        this.zeropoint = {x: 0, y: 0, z: 0}
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

    getCurve (init=false) {
        this.out.children = []
        const points = []
        /* get the points on the line */
        for (let t = -this.scale; t < this.scale; t += 0.1) {
            let add = true  // prevents nan values from being pushed to points
            const values = {'x': null, 'y': null, 'z': null}
            assign('t', t)

            for (const element of ['x', 'y', 'z']) {
                const result = EvaluateNumber(this.eqs[element])
                if (Number.isFinite(result)) {
                    values[element] = result
                } else {
                    add = false
                    break
                }
            }
            if (add) {
                points.push(new Vector3(values.x, values.y, values.z))
            }
        }
        /* if initializing, also need to get the zero point */
        if (init === true) {
            /* guarantees we get the point at t=0 */
            assign('t', 0)
            for (const element of ['x', 'y', 'z']) {
                const result = EvaluateNumber(this.eqs[element])
                if (Number.isFinite(result)) {
                    this.zeropoint[element] = result
                } else {
                    this.zeropoint[element] = 0
                }
            }
        }
        const geometry = new BufferGeometry().setFromPoints(points)
        const linegeo = new LineGeometry().fromLine(new Line(geometry, this.linemat))

        /* only need new point/no disposal if initializing */
        if (init === true) {
            this.point = Point({pos: new Vector3(this.zeropoint.x, this.zeropoint.y, this.zeropoint.z), color: this.pointColor})
            this.line = new Line2(linegeo, this.material)
        } else {
            this.line.geometry.dispose()
            this.line.material.dispose()
            this.line = new Line2(linegeo, this.material)
        }
        this.out.add(this.point)
        this.out.add(this.line)
    }

    tCallback = () => {
        let newPoint = {...this.zeropoint}
        assign('t', Number(this.t))
        for (const element of ['x', 'y', 'z']) {
            const result = EvaluateNumber(this.eqs[element])
            if (Number.isFinite(result)) {
                newPoint[element] = result
            } else {
                newPoint[element] = 0
            }
        }
        this.point.position.set(newPoint.x, newPoint.y, newPoint.z)
    }

    curveCallback = () => {
        if (this.checkRedundant()) {
            return 
        } else {
            this.getCurve()
        }
    }
}