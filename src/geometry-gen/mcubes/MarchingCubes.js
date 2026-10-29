import {edgeTable, triTable} from './MarchingCubesData'
import { Vector3 } from 'three'

/* surface is where the equation (left - right) is 0 */
const isolevel = 0

/// //////////////////////////////////////////////////////////////////////////////////
/// adapted from tamani-coding's AND stemkoski's marching cubes examples
/// tamani-coding's repo is here: https://github.com/tamani-coding/threejs-marching-cubes-example/blob/main/README.md
/// stemkoski's repo is here: https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Graphulus-Function.html#L65
/// usage of TAMANI-CODING's code according to MIT license:
///   Copyright (c) 2023 tamani-coding
///
///   Permission is hereby granted, free of charge, to any person obtaining a copy
///   of this software and associated documentation files (the "Software"), to deal
///   in the Software without restriction, including without limitation the rights
///   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
///   copies of the Software, and to permit persons to whom the Software is
///   furnished to do so, subject to the following conditions:
///
///   The above copyright notice and this permission notice shall be included in all
///   copies or substantial portions of the Software.
///
///   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
///   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
///   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
///   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
///   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
///   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
///   SOFTWARE.
///   stemkoski license not provided
/// //////////////////////////////////////////////////////////////////////////////////
/**
 * samples fn({x, y, z}) on a size^3 grid spanning center +- scale/2 on each axis
 * returns triangle vertices (Vector3, every 3 make a face) of the surface fn = 0
 */
export const MarchingCubes = (fn, center, scale, size) => {
  /* grid index -> coordinate along each axis */
  const coord = (i, c) => c - (scale / 2) + (scale * i) / (size - 1)
  /* scalar values, indexed i + size * j + size^2 * k; NaN where undefined */
  const values = new Float64Array(size * size * size)
  let n = 0
  for (let k = 0; k < size; k++) {
    const z = coord(k, center.z)
    for (let j = 0; j < size; j++) {
      const y = coord(j, center.y)
      for (let i = 0; i < size; i++) {
        values[n++] = fn({x: coord(i, center.x), y, z})
      }
    }
  }
  /* sample index -> its position, built only for cubes the surface crosses */
  const point = (p) => new Vector3(
    coord(p % size, center.x),
    coord(Math.floor(p / size) % size, center.y),
    coord(Math.floor(p / (size * size)), center.z)
  )

  // approximated intersection points
  const vlist = new Array(12)
  // size^2
  const size2 = size * size
  // mesh triangles
  const trianglePoints = []

  for (let z = 0; z < size - 1; z++) {
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        // index of base point, and also adjacent points on cube
        const p     = x + size * y + size2 * z
        const px    = p   + 1
        const py    = p   + size
        const pxy   = py  + 1
        const pz    = p   + size2
        const pxz   = px  + size2
        const pyz   = py  + size2
        const pxyz  = pxy + size2

        // store scalar values corresponding to vertices
        const value0 = values[p]
        const value1 = values[px]
        const value2 = values[py]
        const value3 = values[pxy]
        const value4 = values[pz]
        const value5 = values[pxz]
        const value6 = values[pyz]
        const value7 = values[pxyz]

        // place a "1" in bit positions corresponding to vertices whose
        //   isovalue is less than given constant.
        let cubeindex = 0
        if (value0 < isolevel) {
          cubeindex |= 1
        }
        if (value1 < isolevel) {
          cubeindex |= 2
        }
        if (value2 < isolevel) {
          cubeindex |= 8
        }
        if (value3 < isolevel) {
          cubeindex |= 4
        }
        if (value4 < isolevel) {
          cubeindex |= 16
        }
        if (value5 < isolevel) {
          cubeindex |= 32
        }
        if (value6 < isolevel) {
          cubeindex |= 128
        }
        if (value7 < isolevel) {
          cubeindex |= 64
        }

        // bits = 12 bit number, indicates which edges are crossed by the isosurface
        const bits = edgeTable[cubeindex]

        // if none are crossed, proceed to next iteration
        if (bits === 0) {
          continue
        }

        //  check which edges are crossed, and estimate the point location
        //  using a weighted average of scalar values at edge endpoints.
        //  store the vertex in an array for use later.
        let mu = 0.5

        // bottom of the cube
        if (bits & 1) {		
          mu = (isolevel - value0) / (value1 - value0)
          vlist[0] = point(p).lerp(point(px), mu)
        }
        if (bits & 2) {
          mu = (isolevel - value1) / (value3 - value1)
          vlist[1] = point(px).lerp(point(pxy), mu)
        }
        if (bits & 4) {
          mu = (isolevel - value2) / (value3 - value2)
          vlist[2] = point(py).lerp(point(pxy), mu)
        }
        if (bits & 8) {
          mu = (isolevel - value0) / (value2 - value0)
          vlist[3] = point(p).lerp(point(py), mu)
        }
        // top of the cube
        if (bits & 16) {
          mu = (isolevel - value4) / (value5 - value4)
          vlist[4] = point(pz).lerp(point(pxz), mu)
        }
        if (bits & 32) {
          mu = (isolevel - value5) / (value7 - value5)
          vlist[5] = point(pxz).lerp(point(pxyz), mu)
        }
        if (bits & 64) {
          mu = (isolevel - value6) / (value7 - value6)
          vlist[6] = point(pyz).lerp(point(pxyz), mu)
        }
        if (bits & 128) {
          mu = (isolevel - value4) / (value6 - value4)
          vlist[7] = point(pz).lerp(point(pyz), mu)
        }
        // vertical lines of the cube
        if (bits & 256) {
          mu = (isolevel - value0) / (value4 - value0)
          vlist[8] = point(p).lerp(point(pz), mu)
        }
        if (bits & 512) {
          mu = (isolevel - value1) / (value5 - value1)
          vlist[9] = point(px).lerp(point(pxz), mu)
        }
        if (bits & 1024) {
          mu = (isolevel - value3) / (value7 - value3)
          vlist[10] = point(pxy).lerp(point(pxyz), mu)
        }
        if (bits & 2048) {
          mu = (isolevel - value2) / (value6 - value2)
          vlist[11] = point(py).lerp(point(pyz), mu)
        }

        // lookup triangles
        let i = 0
        cubeindex <<= 4  // multiply by 16...
        while (triTable[cubeindex + i] !== -1) {
          const index1 = triTable[cubeindex + i]
          const index2 = triTable[cubeindex + i + 1]
          const index3 = triTable[cubeindex + i + 2]

          trianglePoints.push(vlist[index1].clone())
          trianglePoints.push(vlist[index2].clone())
          trianglePoints.push(vlist[index3].clone())

          i += 3
        }
      }
    }
  }

  return trianglePoints
}