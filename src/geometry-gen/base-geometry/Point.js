import {SphereGeometry, Mesh, DoubleSide, MeshToonMaterial} from 'three'

export const Point = (props) => {
    const {pos, color = 0xffff00} = props
    const geometry = new SphereGeometry(0.1, 8, 8)
    const material = new MeshToonMaterial({
        color: color,
        side: DoubleSide,
    })
    const point = new Mesh(geometry, material)
    point.position.set(pos.x, pos.y, pos.z)
    return point
}