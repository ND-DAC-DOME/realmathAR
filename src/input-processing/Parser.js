/* default equation set */
// const defaultfunc = {'left': 'x^2+y^2+z^2', 'right': '1'}
// const defaultfunc = {'left': 'x^2', 'right': 'z'}
// const defaultfunc = {'left': 'x^2+y^2', 'right': 'z'}
// const defaultfunc = {'left': 'x^2+y^2', 'right': 'z^2'}
// const defaultfunc = {'left': 'x^2-y^2', 'right': 'z^2'}
const defaultfunc = {left: '//left(x+1//right)^2+y^2', right: 'z'}
// const defaultfunc =  {'left': 'x^2+y^2', 'right': '1'}

const defaultvec = {'vec': {'x': '0', 'y': '0', 'z': '1'}, 'init': {'x': '0', 'y': '0', 'z': '-1'}}
const defaultvec2 = {'vec': {'x': '-1', 'y': '-1', 'z': '-1'}, 'init': {'x': '0', 'y': '0', 'z': '0'}}
const defaultpt = {'x': '1', 'y': '1', 'z': '1'}
const defaultscrv = {'x': '//cos//left(t//right)', 'y': '//sin//left(t//right)', 'z': '0.1t'}
const defaultvfld = {'x': 'x-xy', 'y': 'x-y', 'z': '0'}
const defaults = {'Vec 1': defaultvec, 'Pt 1': defaultpt, 'Func 1': defaultfunc}
// const defaults = {'Vec 1': defaultvec, 'Vec 2': defaultvec2, 'Pt 1': defaultpt}
// const defaults = {'Vec 1': defaultvec2}
// const defaults = {'Func 1': defaultfunc, 'Func 2': {'left': 'x^2+//left(y+1//right)^2+z^2', 'right': '1'}}
// const defaults = {'Pt 1': defaultpt, 'Pt 2': {'x': '0', 'y': '0', 'z': '1'}}
// const defaults = {'SCrv 1': defaultscrv, 'VFld 1': defaultvfld, 'Vec 1': defaultvec}

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
*********************** */
export const Parser = () => {
    const url = GetInput()
    /* eslint-disable-next-line no-console */
    console.log(`CURRENT URL JSON: ${url}`)
    if (url === null) {
        return defaults
    }
    try {
        return JSON.parse(url)
    } catch (e) {
        /* eslint-disable-next-line no-console */
        console.log(`INVALID URL ERROR: ${e}`)
        return defaults
    }
}