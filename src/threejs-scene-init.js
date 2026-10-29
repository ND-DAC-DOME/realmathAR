import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { Parser } from './input-processing/Parser';
import { Processor } from './input-processing/Processor';

/* *******************************TODO**********************************
  * Migrate to lil-gui, dat-gui is outdated
  * * lil-gui also supports easier color sliders
  * Untangle gui callbacks
  * Make axis generation less messy
  *  *  tbh just move back to axis helper probably
  * Add color changer callbacks
  * Update to current mathlive
  * ???
  * profit
********************************************************************* */

/* initializing range constraints + steps */
const GlobalRanges =    {
                            axis: [75, 1],
                            t: [100, 0.1]
                        }

async function CallbackCaller (callback, animate) {
  const prommy = await callback()
  animate()
}

export const initScenePipelineModule = () => {
  const purple = 0xAD50FF

  // Populates a cube into an XR scene and sets the initial camera position.
  const initXrScene = ({scene, camera, renderer}) => {
    const animate = () => {
      renderer.render();
    }

    // Enable shadows in the rednerer.
    renderer.shadowMap.enabled = true

    // Add some light to the scene.
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(5, 10, 7)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    /* axes and grid */
    const axes = new THREE.AxesHelper(10)
    const grid = new THREE.GridHelper(10, 10, 0x9bdc6e, 0x333333)

    /* group that will hold components */
    const Components = new THREE.Group()

    /**
     * math space: components use math coords (z up), but the 8th wall world is y up
     * rotating -90deg about x maps math (x, y, z) -> scene (x, z, -y), keeping handedness
     * grid stays outside so it lies flat on the floor
     */
    const mathSpace = new THREE.Group()
    mathSpace.rotation.x = -Math.PI / 2
    mathSpace.add(axes)
    mathSpace.add(Components)

    /* global params affect more than 1 object */
    const params = {
        scale: 1.0,
    }

    const gui = new GUI()

    const genFolder = gui.addFolder('Global Variables')
    genFolder.add(axes, 'visible').name('axes visible?')
    genFolder.add(grid, 'visible').name('grid visible?')
    genFolder.add(params, 'scale', 0, 1, 0.1).onChange((value) => {
      axes.scale.set(value, value, value)
      grid.scale.set(value, value, value)
      Components.scale.set(value, value, value)
    })

    scene.add(mathSpace)
    scene.add(grid)

    /* callback when vfld slices changed */
    const VectorFieldCallback = (value, index, vfld) => {
        /* clear old slices from display */
        vfld.group.children = []
        let i = 0 
        let j = 0
        let k = 0
        /* get desired slices from slice cache */
        for (let x = -vfld.xSlices; x < vfld.xSlices; x++) {
            for (let y = -vfld.ySlices; y < vfld.ySlices; y++) {
                for (let z = -vfld.zSlices; z < vfld.zSlices; z++) {
                    try {
                        vfld.group.add(vfld.slices[i][j][k])
                    } catch (e) {
                        console.error(`${e}`)
                    }
                    k+=1
                }
                k = 0
                j+=1
            }
            j = 0
            i+=1
        }
        animate()
    }

    /* ****************************************************************************************
      GUI INITIALIZATION FOR EACH COMPONENT
    **************************************************************************************** */
    const GuiInit = (gui, component) => {
        /* for components affected by range constraints */
        const RangeSlider = (callback = null) => {
            gui
            .add(component, 'scale', 5, GlobalRanges.axis[0], GlobalRanges.axis[1])
            .name(`axis +-range (x,y,z)`)
            .onFinishChange(() => {
                if (callback !== null) {
                    CallbackCaller(callback, animate)
                }
            })
        }
        /* for components with flat colors */
        const ColorSlider = (obj, name=null) => {
            if (name !== null) {  
              gui.addColor(obj.material, 'color').name(name)
            } else {
              gui.addColor(obj.material, 'color')
            }
        }
        /* all will have visibility toggle */
        gui.add(component.out, 'visible')
        /* gui composition by component type */
        switch (component.type) {
            // func
            case 0:
                RangeSlider(component.functionCallback)
                break
            // pt
            case 1:
                ColorSlider(component.out)
                break;
            // vec
            case 2:
                gui
                .addColor(component.out.children[0].material, 'color')
                .onChange((value) => {
                  component.out.children[1].material.color = value.clone();
                });
                break
            // vfld
            case 3:
                /**
                 *  SLICE UPDATERS
                 *  having a separate one for each vFld prevents too many concurrent rerenders 
                 *  map so as to not rewrite 3 lines or store arbitrary array
                 **/
                const sliceFolder = gui.addFolder('Vectors Along []-Axis');
                (['x', 'y', 'z']).map((coord) => {
                    sliceFolder
                      .add(component.slices, coord, 0, component.constructor.MAXSLICES, 1)
                      .name(`${coord}-axis`)
                      .onFinishChange(()=>{
                        component.vecsCallback(coord);
                        animate();
                      });
                })
                break
            // scrv
            case 4:
                RangeSlider(component.curveCallback);
                gui
                .add(component, 't', -GlobalRanges.t[0], GlobalRanges.t[0], GlobalRanges.t[1])
                .onChange(() => {component.tCallback()});
                ColorSlider(component.line, 'curve color');
                ColorSlider(component.point, 'point color');
                break
        }
    }
    /* *************************************************************************************** */

    /* extract components from URL, init their GUIs, prepare for scene addition */
    Processor(Parser()).map((component) => {
      console.log(component)
      let [name, obj] = component
      console.log(obj)
      let newFolder = gui.addFolder(name)
      GuiInit(newFolder, obj)
      Components.add(obj.out)
    })

    console.log('components complete')

    // Set the initial camera position relative to the scene we just laid out. This must be at a
    // height greater than y=0.
    camera.position.set(0, 2, 1)

    console.log(Components)
  };

  // Return a camera pipeline module that adds scene elements on start.
  return {
    // Camera pipeline modules need a name. It can be whatever you want but must be unique within
    // your app.
    name: 'threejsinitscene',

    // onStart is called once when the camera feed begins. In this case, we need to wait for the
    // XR8.Threejs scene to be ready before we can access it to add content. It was created in
    // XR8.Threejs.pipelineModule()'s onStart method.
    onStart: ({canvas}) => {
      console.log('in onStart')
      const {scene, camera, renderer} = XR8.Threejs.xrScene()  // Get the 3js scene from XR8.Threejs
      console.log(camera)

      initXrScene({scene, camera, renderer})  // Add objects set the starting camera position.

      // prevent scroll/pinch gestures on canvas
      canvas.addEventListener('touchmove', (event) => {
        event.preventDefault()
      })

      // Sync the xr controller's 6DoF position and camera paremeters with our scene.
      XR8.XrController.updateCameraProjectionMatrix(
        {origin: camera.position, facing: camera.quaternion}
      )

      // Recenter content when the canvas is tapped.
      canvas.addEventListener(
        'touchstart', (e) => {
          e.touches.length === 1 && XR8.XrController.recenter()
        }, true
      )
    },
  }
}
