import { describe, it, expect, afterEach, vi } from 'vitest'
import { parse, assign } from '@cortex-js/compute-engine'
import { EvaluateNumber } from '../src/input-processing/Evaluate'
import { Parser } from '../src/input-processing/Parser'
import { Processor } from '../src/input-processing/Processor'

const at = (href) => vi.stubGlobal('window', { location: { href, search: new URL(href).search } })

describe('EvaluateNumber', () => {
    it('returns numbers for exact forms that .evaluate() leaves symbolic', () => {
        assign('x', 2)
        expect(EvaluateNumber(parse('\\frac{1}{x}'))).toBe(0.5)
        expect(EvaluateNumber(parse('\\sqrt{x}'))).toBeCloseTo(Math.SQRT2)
        expect(EvaluateNumber(parse('\\sin(1)'))).toBeCloseTo(Math.sin(1))
    })

    it('returns NaN for complex and undefined results', () => {
        assign('x', 2)
        expect(EvaluateNumber(parse('\\sqrt{-x}'))).toBeNaN()
        expect(EvaluateNumber(parse('\\frac{1}{x-2}'))).toBeNaN()
    })
})

describe('Parser', () => {
    afterEach(() => vi.unstubAllGlobals())
    const json = { 'Pt 1': { x: '2', y: '3', z: '4' } }
    const enc = encodeURIComponent(JSON.stringify(json))

    it('reads the eqs query param', () => {
        at(`https://nd-dac-dome.github.io/realmathAR/?eqs=${enc}`)
        expect(Parser()).toEqual({ inputs: json, error: null })
    })

    it('reads the legacy 8th Wall url format', () => {
        at(`https://ndlearning.8thwall.app/realmath/${enc}`)
        expect(Parser()).toEqual({ inputs: json, error: null })
    })

    it('falls back to defaults without input', () => {
        at('https://nd-dac-dome.github.io/realmathAR/')
        const { inputs, error } = Parser()
        expect(Object.keys(inputs)).toContain('Func 1')
        expect(error).toBeNull()
    })

    it('falls back to defaults with an error for bad json', () => {
        at('https://nd-dac-dome.github.io/realmathAR/?eqs=notjson')
        const { inputs, error } = Parser()
        expect(Object.keys(inputs)).toContain('Func 1')
        expect(error).toMatch(/could not read input/)
    })
})

describe('Processor', () => {
    it('builds each component type with its type int', () => {
        const { components, errors } = Processor({
            'Func 1': { left: 'x^2+y^2+z^2', right: '1' },
            'Pt 1': { x: '//frac{1}{2}', y: '//pi', z: '0' },
            'Vec 1': { vec: { x: '0', y: '0', z: '1' }, init: { x: '0', y: '0', z: '-1' } },
            'VFld 1': { x: 'x-xy', y: 'x-y', z: '0' },
            'SCrv 1': { x: '//cos//left(t//right)', y: '//sin//left(t//right)', z: '0.1t' },
        })
        expect(errors).toEqual([])
        expect(components.map(([name, c]) => [name, c.type])).toEqual([
            ['Func 1', 0], ['Pt 1', 1], ['Vec 1', 2], ['VFld 1', 3], ['SCrv 1', 4],
        ])
        const pt = components[1][1].out.position
        expect(pt.x).toBe(0.5)
        expect(pt.y).toBeCloseTo(Math.PI)
    })

    it('reports invalid latex, bad coordinates, and unknown types without throwing', () => {
        const { components, errors } = Processor({
            'Func 1': { left: 'x^2+', right: 'z' },
            'Pt 1': { x: '1', y: '//sqrt{-1}', z: '0' },
            'Vec 1': { vec: { x: '1', y: '0', z: '0' } },
            'Blob 1': {},
            'Pt 2': { x: '1', y: '2', z: '3' },
        })
        expect(components.map(([name]) => name)).toEqual(['Pt 2'])
        expect(errors.map((e) => e.name)).toEqual(['Func 1', 'Pt 1', 'Vec 1', 'Blob 1'])
        expect(errors[0].message).toMatch(/invalid LaTeX "x\^2\+"/)
        expect(errors[1].message).toMatch(/not a number/)
        expect(errors[3].message).toMatch(/unknown type "Blob"/)
    })

    it('ignores prototype keys when matching types', () => {
        const { errors } = Processor({ 'constructor 1': {} })
        expect(errors[0].message).toMatch(/unknown type/)
    })
})
