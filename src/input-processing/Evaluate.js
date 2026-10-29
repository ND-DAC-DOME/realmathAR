import { compile } from '@cortex-js/compute-engine'

/**
 * numerically evaluates a constant expression (point/vector coordinates)
 * .evaluate() keeps exact forms (1/2, sqrt(2), sin(1)) that Number() turns into NaN
 * returns NaN where the result is undefined or complex
 */
export const EvaluateNumber = (expr) => {
    const result = expr.N()
    return result.im === 0 ? result.re : NaN
}

/**
 * compiles an expression into a plain js function of its vars, e.g. f({x, y, z})
 * ~150x faster than evaluating through compute-engine at every sample point
 * falls back to substitute + N() for anything compile() doesn't support
 * returns NaN where the result is undefined or complex
 * NOTE: never assign() vars globally -- compile() bakes assigned values in as constants
 */
export const CompileFunction = (expr) => {
    const compiled = compile(expr)
    if (compiled.success) {
        const run = compiled.run
        return (vars) => {
            const result = run(vars)
            return typeof result === 'number' ? result : NaN
        }
    }
    return (vars) => EvaluateNumber(expr.subs(vars))
}
