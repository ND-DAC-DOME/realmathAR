import * as THREE from 'three'
import GUI from 'lil-gui'
import { Parser } from './input-processing/Parser';
import { Processor } from './input-processing/Processor';

/* initializing range constraints + steps: [min, max, step] */
const GlobalRanges =    {
                            window: [5, 75, 1],       // surface sampling window width
                            focus: [-75, 75, 0.5],    // focal point coords
                            scale: [0.05, 3, 0.05],   // whole-graph scale
                            size: [0.1, 3, 0.05],     // per-component display size
                            t: [100, 0.1],
                        }

/* distance between the first two touches, for pinch-to-scale */
const TouchDistance = (touches) => Math.hypot(
  touches[0].clientX - touches[1].clientX,
  touches[0].clientY - touches[1].clientY
)

export const initScenePipelineModule = () => {
  // Populates the graph components into an XR scene and sets the initial camera position.
  // Returns controls that the touch handlers in onStart use.
  const initXrScene = ({scene, camera, renderer}) => {
    // Enable shadows in the renderer.
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

    /**
     * focal point: the math-space point shown at the AR anchor (where the axes normally meet)
     * focusGroup is shifted by -focus; surfaces and vector fields also resample around it
     */
    const focus = new THREE.Vector3()
    const focusGroup = new THREE.Group()
    focusGroup.add(axes)
    focusGroup.add(Components)
    mathSpace.add(focusGroup)

    /* global params affect more than 1 object */
    const params = {
        scale: 1.0,
    }

    const gui = new GUI()

    const genFolder = gui.addFolder('Global Variables')
    genFolder.add(axes, 'visible').name('axes visible?')
    genFolder.add(grid, 'visible').name('grid visible?')
    const scaleController = genFolder.add(params, 'scale', ...GlobalRanges.scale)
    const setScale = (value) => {
      params.scale = THREE.MathUtils.clamp(value, GlobalRanges.scale[0], GlobalRanges.scale[1])
      mathSpace.scale.setScalar(params.scale)
      grid.scale.setScalar(params.scale)
      scaleController.updateDisplay()
    }
    scaleController.onChange(setScale)

    scene.add(mathSpace)
    scene.add(grid)

    /* each component sits in a wrapper so it can be resized about the focal point */
    const entries = []  // {name, obj, wrapper, size}
    const applySize = (entry) => {
      /* scale about focus: p -> focus + size * (p - focus) */
      entry.wrapper.scale.setScalar(entry.size)
      entry.wrapper.position.copy(focus).multiplyScalar(1 - entry.size)
    }

    /* call after changing focus; resample = also rebuild surfaces/fields around it */
    const moveFocus = (resample) => {
      focusGroup.position.copy(focus).negate()
      entries.forEach(applySize)
      if (resample) {
        entries.forEach(({obj}) => obj.setFocus?.(focus))
      }
    }

    /* ****************************************************************************************
      GUI INITIALIZATION FOR EACH COMPONENT
    **************************************************************************************** */
    const GuiInit = (gui, entry) => {
        const component = entry.obj
        /* for components with flat colors */
        const ColorSlider = (obj, name=null) => {
            if (name !== null) {
              gui.addColor(obj.material, 'color').name(name)
            } else {
              gui.addColor(obj.material, 'color')
            }
        }
        /* all will have visibility toggle and display size */
        gui.add(component.out, 'visible')
        gui.add(entry, 'size', ...GlobalRanges.size).name('display size').onChange(() => applySize(entry))
        /* gui composition by component type */
        switch (component.type) {
            // func
            case 0:
                gui
                .add(component, 'scale', ...GlobalRanges.window)
                .name('window width')
                .onFinishChange(() => component.functionCallback())
                gui.addColor(component, 'lowColor').name('low color')
                gui.addColor(component, 'highColor').name('high color')
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
                      });
                })
                break
            // scrv
            case 4: {
                const tController = gui
                .add(component, 't', -component.tRange, component.tRange, GlobalRanges.t[1])
                .onChange(() => {component.tCallback()});
                gui
                .add(component, 'tRange', 1, component.constructor.MAXTRANGE, 1)
                .name('t range (+-)')
                .onFinishChange(() => {
                  component.tRangeCallback()
                  /* keep the t slider inside the drawn range */
                  tController.min(-component.tRange).max(component.tRange)
                  component.t = THREE.MathUtils.clamp(component.t, -component.tRange, component.tRange)
                  tController.updateDisplay()
                  component.tCallback()
                });
                ColorSlider(component.line, 'curve color');
                ColorSlider(component.point, 'point color');
                break
            }
        }
    }
    /* *************************************************************************************** */

    /* extract components from URL, init their GUIs, prepare for scene addition */
    const {inputs, error} = Parser()
    const {components, errors} = Processor(inputs)
    components.forEach(([name, obj]) => {
      const wrapper = new THREE.Group()
      wrapper.add(obj.out)
      Components.add(wrapper)
      entries.push({name, obj, wrapper, size: 1})
    })

    /* focal point controls: sliders, plus snapping to a component */
    const focusFolder = gui.addFolder('Focal Point')
    const focusControllers = ['x', 'y', 'z'].map((coord) => focusFolder
      .add(focus, coord, ...GlobalRanges.focus)
      .onChange(() => moveFocus(false))
      .onFinishChange(() => moveFocus(true)))
    /* where snapping to each component goes (vector fields have no natural center) */
    const FocusTarget = ({obj}) => {
      switch (obj.type) {
        case 1:
        case 2:
          return obj.out.position.clone()
        default:
          return obj.focusTarget?.() ?? null
      }
    }
    const PICK = '(pick one)'
    const snap = {target: PICK}
    const snapNames = ['origin', ...entries.filter(({obj}) => obj.type !== 3).map(({name}) => name)]
    const snapController = focusFolder.add(snap, 'target', [PICK, ...snapNames]).name('center on')
    snapController.onChange((name) => {
      const entry = entries.find((e) => e.name === name)
      const target = name === 'origin' ? new THREE.Vector3() : entry && FocusTarget(entry)
      if (target) {
        focus.copy(target)
        focusControllers.forEach((controller) => controller.updateDisplay())
        moveFocus(true)
      }
      /* reset so the same target can be picked again */
      snap.target = PICK
      snapController.updateDisplay()
    })

    entries.forEach((entry) => GuiInit(gui.addFolder(entry.name), entry))

    /* surface input problems in the gui, not just the console */
    if (error !== null) {
      errors.unshift({name: 'URL', message: error})
    }
    if (errors.length > 0) {
      const errorFolder = gui.addFolder('Input Errors')
      errors.forEach(({name, message}) => {
        console.error(`${name}: ${message}`)
        errorFolder.add({message}, 'message').name(name).disable()
      })
    }

    // Set the initial camera position relative to the scene we just laid out. This must be at a
    // height greater than y=0.
    camera.position.set(0, 2, 1)

    return {setScale, getScale: () => params.scale}
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
      const {scene, camera, renderer} = XR8.Threejs.xrScene()  // Get the 3js scene from XR8.Threejs

      const view = initXrScene({scene, camera, renderer})  // Add objects set the starting camera position.

      // Sync the xr controller's 6DoF position and camera parameters with our scene.
      XR8.XrController.updateCameraProjectionMatrix(
        {origin: camera.position, facing: camera.quaternion}
      )

      /* two fingers pinch-scale the graph; a quick single tap recenters it */
      let pinch = null      // {dist, scale} while two fingers are down
      let tapStart = null   // when a single-finger touch began, if it may still be a tap
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          pinch = {dist: TouchDistance(e.touches), scale: view.getScale()}
          tapStart = null
        } else if (e.touches.length === 1) {
          tapStart = performance.now()
        }
      }, true)

      // prevent scroll/pinch gestures on canvas, and scale while pinching
      canvas.addEventListener('touchmove', (event) => {
        event.preventDefault()
        if (pinch !== null && event.touches.length === 2) {
          view.setScale(pinch.scale * TouchDistance(event.touches) / pinch.dist)
        }
      })

      // Recenter content when the canvas is tapped.
      canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          pinch = null
        }
        if (e.touches.length === 0) {
          if (tapStart !== null && performance.now() - tapStart < 300) {
            XR8.XrController.recenter()
          }
          tapStart = null
        }
      }, true)
    },
  }
}
