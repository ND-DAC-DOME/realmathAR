import {edgeTable, triTable} from './MarchingCubesData'
import { Vector3 } from 'three'
import { assign } from "@cortex-js/compute-engine";
import { EvaluateNumber } from "../../input-processing/Evaluate";

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
/* samples equation on a size^3 grid spanning [-scale/2, scale/2] on each axis */
export const MarchingCubes = (equation, scale, size) => {
  // containers
  const values = []  // type: Number
  const points = []  // type: THREE.Vector3
  // generate the list of 3D points and the corresponding values
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = -(scale / 2) + (scale * i) / (size - 1)
        const y = -(scale / 2) + (scale * j) / (size - 1)
        const z = -(scale / 2) + (scale * k) / (size - 1)
        points.push(new Vector3(x, y, z))
        assign('x', x)
        assign('y', y)
        assign('z', z)
        /* always push (even NaN) so values stay index-aligned with points */
        values.push(EvaluateNumber(equation))
      }
    }
  }

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
          vlist[0] = points[p].clone().lerp(points[px], mu)
        }
        if (bits & 2) {
          mu = (isolevel - value1) / (value3 - value1)
          vlist[1] = points[px].clone().lerp(points[pxy], mu)
        }
        if (bits & 4) {
          mu = (isolevel - value2) / (value3 - value2)
          vlist[2] = points[py].clone().lerp(points[pxy], mu)
        }
        if (bits & 8) {
          mu = (isolevel - value0) / (value2 - value0)
          vlist[3] = points[p].clone().lerp(points[py], mu)
        }
        // top of the cube
        if (bits & 16) {
          mu = (isolevel - value4) / (value5 - value4)
          vlist[4] = points[pz].clone().lerp(points[pxz], mu)
        }
        if (bits & 32) {
          mu = (isolevel - value5) / (value7 - value5)
          vlist[5] = points[pxz].clone().lerp(points[pxyz], mu)
        }
        if (bits & 64) {
          mu = (isolevel - value6) / (value7 - value6)
          vlist[6] = points[pyz].clone().lerp(points[pxyz], mu)
        }
        if (bits & 128) {
          mu = (isolevel - value4) / (value6 - value4)
          vlist[7] = points[pz].clone().lerp(points[pyz], mu)
        }
        // vertical lines of the cube
        if (bits & 256) {
          mu = (isolevel - value0) / (value4 - value0)
          vlist[8] = points[p].clone().lerp(points[pz], mu)
        }
        if (bits & 512) {
          mu = (isolevel - value1) / (value5 - value1)
          vlist[9] = points[px].clone().lerp(points[pxz], mu)
        }
        if (bits & 1024) {
          mu = (isolevel - value3) / (value7 - value3)
          vlist[10] = points[pxy].clone().lerp(points[pxyz], mu)
        }
        if (bits & 2048) {
          mu = (isolevel - value2) / (value6 - value2)
          vlist[11] = points[py].clone().lerp(points[pyz], mu)
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