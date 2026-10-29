import { Vector3 } from "three"
import { GeometryContainer } from "../geometry-gen/GeometryContainer"
import { simplify, evaluate, N, assign, parse } from "@cortex-js/compute-engine";

/* parentheses shorthand */
const PL = '//left('
const PR = '//right)'

/*
  NOTE: all geometry uses math coords (z up)
  threejs-scene-init rotates the containing group into 8th wall's y-up world
 */

/* helper keeps me from having to rewrite */
/* create the equation w/ added safeguards for potential missing vars */
const EquationHelper = (value, type) => {
  if (type === 'func') {
    return `${PL}${value.left}${PR}-${PL}${value.right}${PR}
            +${PL}0*x${PR}+${PL}0*y${PR}+${PL}0*z${PR}`
  } else if (type === 'vfld') {
    return `${PL}${value}${PR}+${PL}0*x${PR}+${PL}0*y${PR}+
            ${PL}0*z${PR}`
  } else {
    return `${PL}${value}${PR}+${PL}0*t${PR}`
  }
}

const ProcessFunc = (value) => {
    /* create the equation w/ added safeguards for potential missing vars */
    const eqstring = EquationHelper(value, 'func')
    /* eslint-disable-next-line no-console */
    console.log(eqstring)
    const eq = parse(eqstring.replaceAll('//', '\\'))  // fixes latex delimiters
    /* eslint-disable-next-line no-console */
    console.log(eq.json)
    return GeometryContainer(0, {
        eqs: eq, 
        scalein: null, 
        sizein: null, 
        color: 0xda0fdf,
    })
}

const ProcessCurve = (value, scale=10) => {
    try {
        const eqs = {}
        for (const element of ['x', 'y', 'z']) {
        let eqstring = EquationHelper(value[element], 'scrv')
        eqs[element] = parse(eqstring.replaceAll('//', '\\'))  // fixes latex delimiters
        }
        const curve = GeometryContainer(4, {
            eqs: eqs, 
            scale: scale, 
            color: 0x0000ff, 
            color2: 0xda0fff,
        })
        return curve
    } catch (e) {
        /* eslint-disable-next-line no-console */
        console.log(`INVALID CURVE ERROR: ${e}`)
        return -1
    }
}

const ProcessVec = (value, color=0x00aaff) => {
    try {
        /* direction vector */
        const vec = new Vector3(
        Number(`${parse(value.vec.x).value}`),
        Number(`${parse(value.vec.y).value}`),
        Number(`${parse(value.vec.z).value}`)
        )
        /* ie, known point of intersection */
        const init = new Vector3(
        Number(`${parse(value.init.x).value}`),
        Number(`${parse(value.init.y).value}`),
        Number(`${parse(value.init.z).value}`)
        )
        /* make the line eddboy */
        return GeometryContainer(2, {
            init: init, 
            vec: vec,
            color: color
        })
    } catch (e) {
        /* eslint-disable-next-line no-console */
        console.log(`VEC PARSING ERROR: ${e}`)
        return -1
    }
}

const ProcessVFld = (value, sliceranges=[9, 9, 1], scale=10) => {
    try {
        const eqs = {}
        for (const element of ['x', 'y', 'z']) {
        let eqstring = EquationHelper(value[element], 'vfld')
        eqs[element] = parse(eqstring.replaceAll('//', '\\'))  // fixes latex delimiters
        }
        const vfld = GeometryContainer(3, {
            eqs: eqs, 
            scale: scale, 
            sliceranges: sliceranges, 
            update: false
        })
        /* eslint-disable-next-line no-console */
        console.log('vfld made')
        return vfld
    } catch (e) {
        /* eslint-disable-next-line no-console */
        console.log(`INVALID VFLD ERROR: ${e}`)
        return -1
    }
}

const ProcessPt = (value, color=0xffff00) => {
    try {
        /* point coords */
        const vec = new Vector3(
        Number(`${parse(value.x).value}`),
        Number(`${parse(value.y).value}`),
        Number(`${parse(value.z).value}`)
        )
        return GeometryContainer(1, {
            pos: vec,
            color: color
        })
    } catch (e) {
        /* eslint-disable-next-line no-console */
        console.log(`PT PARSING ERROR: ${e}`)
        return -1
    }
}

export const Processor = (inputs) => {
    const components = []
    if (inputs) {
        for (const [key, value] of Object.entries(inputs)) {
            /* type of graph component changes how we process */
            const type = key.split(' ')[0]
            /* eslint-disable-next-line no-console */
            console.log(`TYPE: ${type}`)
            /* eslint-disable-next-line no-console */
            console.log(value)
            let returnval = -1
            switch (type) {
                case 'Func':
                    returnval = ProcessFunc(value)
                    break
                case 'Vec':
                    returnval = ProcessVec(value)
                    break
                case 'Pt':
                    returnval = ProcessPt(value)
                    break
                case 'SCrv':
                    returnval = ProcessCurve(value)
                    break
                case 'VFld':
                    returnval = ProcessVFld(value)
                    break
                default:
                    returnval = -1
            }
            if (returnval !== -1) {
                components.push([key, returnval])
            }
        }
    }
    // TODO: ADD ERROR FLAGS
    return components
}