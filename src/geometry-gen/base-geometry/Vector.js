import { Vector3, Group, ConeGeometry, Mesh, DoubleSide, MeshToonMaterial } from "three"
import { Line2 } from "three/examples/jsm/lines/Line2.js"
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"

const WIDTH = 0.05
const UP = new Vector3(0, 1, 0)

/**
 * adaptation from js ArrowHelper native
 * allows custom line width utilizing Line2 addon
 * draws vec as an arrow whose tail is at init and tip is at init + vec
 */
export const Vector = (props) => {
    /* initializing vars / kwargs */
    const group = new Group()
    const {init, vec, color} = props
    const length = vec.length()
    const head = length / 8
    /* creating the line (arrow shaft), built along +y then rotated into place */
    const line = new Line2(
        (new LineGeometry()).setPositions([0, 0, 0, 0, length - head, 0]),
        new LineMaterial({
            color: color,
            linewidth: WIDTH,
            worldUnits: true,
        })
    )
    /* creating the cone (arrow point) */
    const cone = new Mesh(new ConeGeometry(head / 4, head, 6, 1), new MeshToonMaterial({
        color: color,
        side: DoubleSide,
    }))
    cone.position.set(0, length - head / 2, 0)
    group.add(line)
    group.add(cone)
    group.position.copy(init)
    /* orient +y along vec */
    if (length > 0) {
        group.quaternion.setFromUnitVectors(UP, vec.clone().normalize())
    }
    return {
        out: group,
        type: 2
    }
}
