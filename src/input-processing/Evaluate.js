/**
 * numerically evaluates an expression using the currently assigned vars
 * .evaluate() keeps exact forms (1/2, sqrt(2), sin(1)) that Number() turns into NaN
 * returns NaN where the result is undefined or complex
 */
export const EvaluateNumber = (expr) => {
    const result = expr.N()
    return result.im === 0 ? result.re : NaN
}
