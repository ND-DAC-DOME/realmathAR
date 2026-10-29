import { Vector3 } from "three"
import { parse } from "@cortex-js/compute-engine";
import { GeometryContainer } from "../geometry-gen/GeometryContainer"
import { EvaluateNumber, CompileFunction } from "./Evaluate"

/* parentheses shorthand */
const PL = '//left('
const PR = '//right)'

/*
  NOTE: all geometry uses math coords (z up)
  threejs-scene-init rotates the containing group into 8th wall's y-up world
 */

/* parses latex (with // standing in for \), throwing on invalid input */
const ParseLatex = (latex) => {
    if (typeof latex !== 'string') {
        throw new Error(`expected a LaTeX string, got ${JSON.stringify(latex)}`)
    }
    const expr = parse(latex.replaceAll('//', '\\'))  // fixes latex delimiters
    if (!expr.isValid) {
        throw new Error(`invalid LaTeX "${latex}"`)
    }
    return expr
}

/* parses latex w/ added safeguards for potential missing vars, compiled to f({...vars}) */
const ParseEquation = (latex, vars) => {
    ParseLatex(latex)  // validate user input on its own for a clearer error
    return CompileFunction(ParseLatex(`${PL}${latex}${PR}` + vars.map((v) => `+${PL}0*${v}${PR}`).join('')))
}

/* parses {x, y, z} equations in the given vars, each compiled to f({...vars}) */
const ParseEquations = (value, vars) => {
    const eqs = {}
    for (const element of ['x', 'y', 'z']) {
        eqs[element] = ParseEquation(value[element], vars)
    }
    return eqs
}

/* parses {x, y, z} constants (e.g. "//pi" or "//frac{1}{2}") into a Vector3 */
const ParseCoords = (value) => {
    const coords = ['x', 'y', 'z'].map((element) => {
        const result = EvaluateNumber(ParseLatex(value[element]))
        if (!Number.isFinite(result)) {
            throw new Error(`${element} = "${value[element]}" is not a number`)
        }
        return result
    })
    return new Vector3(...coords)
}

const ProcessFunc = (value) => {
    ParseLatex(value.left)
    ParseLatex(value.right)
    return GeometryContainer(0, {
        eqs: ParseEquation(`${PL}${value.left}${PR}-${PL}${value.right}${PR}`, ['x', 'y', 'z']),
    })
}

const ProcessCurve = (value) => GeometryContainer(4, {
    eqs: ParseEquations(value, ['t']),
    color: 0x0000ff,
    color2: 0xda0fff,
})

/* vec drawn from init (tail) to init + vec (tip) */
const ProcessVec = (value) => GeometryContainer(2, {
    init: ParseCoords(value.init),
    vec: ParseCoords(value.vec),
    color: 0x00aaff,
})

const ProcessVFld = (value) => GeometryContainer(3, {
    eqs: ParseEquations(value, ['x', 'y', 'z']),
})

const ProcessPt = (value) => GeometryContainer(1, {
    pos: ParseCoords(value),
    color: 0xffff00,
})

/* first word of each input key picks its processor */
const PROCESSORS = {
    Func: ProcessFunc,
    Vec: ProcessVec,
    Pt: ProcessPt,
    SCrv: ProcessCurve,
    VFld: ProcessVFld,
}

/* returns built components as [name, component] pairs, plus {name, message} for any that failed */
export const Processor = (inputs) => {
    const components = []
    const errors = []
    for (const [key, value] of Object.entries(inputs ?? {})) {
        const type = key.split(' ')[0]
        try {
            if (!Object.hasOwn(PROCESSORS, type)) {
                throw new Error(`unknown type "${type}"`)
            }
            components.push([key, PROCESSORS[type](value)])
        } catch (e) {
            errors.push({name: key, message: e.message})
        }
    }
    return {components, errors}
}
