/* default equation set, shown when no input is given */
const defaults = {
    'Vec 1': {'vec': {'x': '0', 'y': '0', 'z': '1'}, 'init': {'x': '0', 'y': '0', 'z': '-1'}},
    'Pt 1': {'x': '1', 'y': '1', 'z': '1'},
    'Func 1': {left: '//left(x+1//right)^2+y^2', right: 'z'},
}

/* old 8th wall hosting appended the encoded json directly after this */
const LEGACY_BASE_URL = 'https://ndlearning.8thwall.app/realmath/'

/* gets raw json string from ?eqs= param, falling back to legacy url format */
const GetInput = () => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('eqs')) {
        return params.get('eqs')  // already decoded
    }
    const href = window.location.href
    if (href.startsWith(LEGACY_BASE_URL)) {
        return decodeURIComponent(href.slice(LEGACY_BASE_URL.length))
    }
    return null
}

/* **********************
* The equation JSONs from input page are embedded into the URL
*   preferred: <app url>?eqs=<encodeURIComponent(json)>
*   legacy:    https://ndlearning.8thwall.app/realmath/<encodeURIComponent(json)>
* The equations are then gleaned from the URL
* returns {inputs, error}, falling back to defaults if input is missing or invalid
*********************** */
export const Parser = () => {
    const url = GetInput()
    if (url === null) {
        return {inputs: defaults, error: null}
    }
    try {
        return {inputs: JSON.parse(url), error: null}
    } catch (e) {
        return {inputs: defaults, error: `could not read input, showing examples instead (${e.message})`}
    }
}
