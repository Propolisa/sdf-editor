/// BLENDER STYLE EDITING
import '@babylonjs/core/Debug/debugLayer'
import '@babylonjs/inspector'
import {
  GizmoManager,
  Vector2,
  Vector3,
  Quaternion,
  Tools,
  Matrix,
  ActionManager,
  ExecuteCodeAction,
  Axis,
  PointerEventTypes,
  Camera,
  ArcRotateCameraMouseWheelInput,
  ArcRotateCamera,
} from '@babylonjs/core'
import { HW_SCALING } from './defaults'
import { toRef, watch } from 'vue'

export function setupEditorView(scene, camera, global_settings, state, sdf_scene) {
  const engine = scene.getEngine()
  // Initialize GizmoManager
  var gizmoManager = new GizmoManager(scene)

  // Initialize all gizmos
  // gizmoManager.boundingBoxGizmoEnabled = true

  // --- Transform State Machine Integration with Realtime Preview ---
  // We'll work with sphereGlass as the selected mesh.
  var selectedMesh = null

  function TransformState() {
    return {
      mode: null, // "rotate", "scale", "translate"
      axis: null, // "x", "y", "z" or null
      amount: 0, // Scalar value (either from keyboard or computed from mouse)
      inputStr: '', // String input from numeric keys (if any)
      startMatrix: null, // Backup of the world matrix at the start of the transform
      startScreenPos: null, // Screen-space starting pointer position (Vector2)
      baseScreenPos: null, // Captured pointer position when the transform is initiated
      initialRotationAngle: undefined, // (For rotation) saved initial arc angle (radians) after threshold is met
      baseDistance: undefined, // (For scaling) initial distance from the mesh center in screen space
      baseMeshScreenPos: null, // (For translation) the initial screen position of the mesh center
      mouseTranslation: Vector3.Zero(), // (For free translate) computed offset in world space
      currentScreenPos: null, // Current pointer position (updated on pointer move)
    }
  }
  var transformState = TransformState()

  // Whenever a mesh is attached to a gizmo, capture it as the selected mesh.
  gizmoManager.onAttachedToMeshObservable.add((m) => {
    sdf_scene.onNeedsRedrawObservable.notifyObservers(true)
    transformState = TransformState()
    if (m?.name?.startsWith('node_')) {
      selectedMesh = m
    } else {
      selectedMesh = null
    }
  })

  // Helper to compute a flip factor based on the mesh-to-camera orientation relative to an axis.
  function getFlipFactor(axisVector, mesh) {
    var meshCenter = mesh.getBoundingInfo().boundingSphere.center
    var cameraToMesh = Vector3.Normalize(meshCenter.subtract(camera.position))
    return Vector3.Dot(cameraToMesh, axisVector) < 0 ? -1 : 1
  }

  function updateTransform() {
    // nothing to do until a mode & matrix are set
    if (!transformState.mode || !transformState.startMatrix) {
      return
    }

    // for translate, we need both baseScreenPos and currentScreenPos
    if (
      transformState.mode === 'translate' &&
      (!transformState.baseScreenPos || !transformState.currentScreenPos)
    ) {
      return
    }

    var origScale = new Vector3(),
      origRotation = new Quaternion(),
      origTranslation = new Vector3()
    transformState.startMatrix.decompose(origScale, origRotation, origTranslation)
    var newMatrix
    if (transformState.mode === 'rotate') {
      var angleDeg = transformState.amount || 0
      var angle = Tools.ToRadians(angleDeg)
      var axisVector
      if (transformState.axis) {
        axisVector =
          transformState.axis === 'x' ? Axis.X : transformState.axis === 'y' ? Axis.Y : Axis.Z
        angle *= getFlipFactor(axisVector, selectedMesh)
      } else {
        axisVector = Vector3.Normalize(camera.getTarget().subtract(camera.position))
      }
      var deltaQuat = Quaternion.RotationAxis(axisVector, angle)
      var newRotation = deltaQuat.multiply(origRotation)
      newMatrix = Matrix.Compose(origScale, newRotation, origTranslation)
    } else if (transformState.mode === 'scale') {
      var newScale
      // isNumericInput = did the user type digits?  (inputStr non-empty)
      var isNumericInput = transformState.inputStr !== ''
      // amt = the raw number they typed, or the interactive “1 + delta” factor
      var amt = transformState.amount == null ? 1 : transformState.amount

      if (!isNumericInput) {
        // —— interactive, relative scaling ——
        // amt around 1.0, so origScale*1 === no jump
        if (transformState.axis === 'x') {
          newScale = origScale.multiplyByFloats(amt, 1, 1)
        } else if (transformState.axis === 'y') {
          newScale = origScale.multiplyByFloats(1, amt, 1)
        } else if (transformState.axis === 'z') {
          newScale = origScale.multiplyByFloats(1, 1, amt)
        } else {
          newScale = origScale.scale(amt)
        }
      } else {
        // —— absolute, from numeric entry ——
        // typing “2” gives you exactly scale=2
        if (transformState.axis === 'x') {
          newScale = new Vector3(amt, origScale.y, origScale.z)
        } else if (transformState.axis === 'y') {
          newScale = new Vector3(origScale.x, amt, origScale.z)
        } else if (transformState.axis === 'z') {
          newScale = new Vector3(origScale.x, origScale.y, amt)
        } else {
          newScale = new Vector3(amt, amt, amt)
        }
      }

      newMatrix = Matrix.Compose(newScale, origRotation, origTranslation)
    } else if (transformState.mode === 'translate') {
      var newTranslation
      if (transformState.axis) {
        var meshCenter = selectedMesh.getBoundingInfo().boundingSphere.center
        var projectedCenter = Vector3.Project(
          meshCenter,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
        )
        var centerScreen = new Vector2(projectedCenter.x, projectedCenter.y)
        var candidateVector
        if (transformState.axis === 'x') candidateVector = Vector3.Right()
        else if (transformState.axis === 'y') candidateVector = Vector3.Up()
        else if (transformState.axis === 'z') candidateVector = Vector3.Forward()
        var candidateEndWorld = meshCenter.add(candidateVector)
        var projectedCandidate = Vector3.Project(
          candidateEndWorld,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
        )
        var candidateScreenDir = new Vector2(projectedCandidate.x, projectedCandidate.y)
          .subtract(centerScreen)
          .normalize()
        var offset = transformState.currentScreenPos.subtract(transformState.baseScreenPos)
        var scalar = Vector2.Dot(offset, candidateScreenDir)
        scalar *= getFlipFactor(candidateVector, selectedMesh)
        var factor = 0.01
        transformState.amount = scalar * factor
        var delta =
          transformState.axis === 'x'
            ? Vector3.Right().scale(transformState.amount)
            : transformState.axis === 'y'
              ? Vector3.Up().scale(transformState.amount)
              : Vector3.Forward().scale(transformState.amount)
        newTranslation = origTranslation.add(delta)
      } else {
        // Free translation: compute world delta from screen movement.
        var meshCenter = selectedMesh.getBoundingInfo().boundingSphere.center
        var projectedCenter = Vector3.Project(
          meshCenter,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
        )
        var depth = projectedCenter.z
        var viewMatrix = camera.getViewMatrix()
        var projectionMatrix = camera.getProjectionMatrix()
        var startWorld = Vector3.Unproject(
          new Vector3(transformState.baseScreenPos.x, transformState.baseScreenPos.y, depth),
          engine.getRenderWidth(),
          engine.getRenderHeight(),
          Matrix.Identity(),
          viewMatrix,
          projectionMatrix,
        )
        var currentWorld = Vector3.Unproject(
          new Vector3(transformState.currentScreenPos.x, transformState.currentScreenPos.y, depth),
          engine.getRenderWidth(),
          engine.getRenderHeight(),
          Matrix.Identity(),
          viewMatrix,
          projectionMatrix,
        )
        transformState.mouseTranslation = currentWorld.subtract(startWorld)
        newTranslation = origTranslation.add(transformState.mouseTranslation)
      }
      newMatrix = Matrix.Compose(origScale, origRotation, newTranslation)
    }
    var newScale = new Vector3(),
      newRotation = new Quaternion(),
      newTranslation = new Vector3()
    newMatrix.decompose(newScale, newRotation, newTranslation)

    const ε = 1e-5

    // 1) Scale: only update if the distance is greater than ε
    if (Vector3.Distance(selectedMesh.scaling, newScale) > ε) {
      selectedMesh.scaling.copyFrom(newScale)
    }

    // 2) Rotation: only update if the quaternions differ by more than ε
    if (!selectedMesh.rotationQuaternion) {
      // if coming from Euler-angles, make sure we have a quaternion first
      selectedMesh.rotationQuaternion = Quaternion.FromEulerVector(selectedMesh.rotation)
    }
    // Dot-product ≈1 means nearly identical orientation
    const dot = Math.abs(Quaternion.Dot(selectedMesh.rotationQuaternion, newRotation))
    if (dot < 1 - ε) {
      selectedMesh.rotationQuaternion.copyFrom(newRotation)
    }

    // 3) Translation: only update if the distance is greater than ε
    if (Vector3.Distance(selectedMesh.position, newTranslation) > ε) {
      selectedMesh.position.copyFrom(newTranslation)
    }

    sdf_scene.onNeedsRedrawObservable.notifyObservers(true)
  }

  // Handle key events.
  scene.actionManager = new ActionManager(scene)
  scene.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, function (evt) {
      var key = evt.sourceEvent.key
      var lowerKey = key.toLowerCase()

      if (lowerKey === 'escape') {
        transformState = TransformState()
        return
      }

      if (lowerKey === 'delete') {
        transformState = TransformState()
        if (state.selected_shape_id) {
          sdf_scene.removeNodeById(state.selected_shape_id)
        }
        return
      }

      if (lowerKey === 'i' && evt.sourceEvent.ctrlKey && evt.sourceEvent.altKey) {
        if (scene.debugLayer.isVisible()) {
          scene.debugLayer.hide()
        } else {
          scene.debugLayer.show()
        }
      }

      if (lowerKey === 'd' && evt.sourceEvent.shiftKey) {
        if (state.selected_shape_id) {
          sdf_scene.duplicateNode(state.selected_shape_id, true)
          transformState = TransformState()
          selectedMesh = scene.getNodeByName('node_' + state.selected_shape_id)

          handleKey('g')
        }
      }
    }),
  )

  function handleKey(key, event) {
    var lowerKey = key.toLowerCase()
    if (
      ['r', 's', 'g'].includes(lowerKey) &&
      !event?.ctrlKey &&
      !event?.altKey &&
      !event?.shiftKey
    ) {
      // Start a transform operation and clear any previous numeric input.
      if (!selectedMesh) return
      transformState.mode = lowerKey === 'r' ? 'rotate' : lowerKey === 's' ? 'scale' : 'translate'
      transformState.startMatrix = selectedMesh.getWorldMatrix().clone()
      transformState.inputStr = ''
      transformState.amount = undefined
      transformState.startScreenPos = null
      transformState.baseScreenPos = null
      transformState.initialRotationAngle = undefined
      transformState.baseDistance = undefined
      transformState.baseMeshScreenPos = null
      transformState.mouseTranslation = Vector3.Zero()
      transformState.currentScreenPos = null
      console.log('Started:', transformState.mode)
      updateTransform()
    } else if (['x', 'y', 'z'].includes(lowerKey)) {
      transformState.axis = transformState.axis === lowerKey ? null : lowerKey
      console.log('Axis:', transformState.axis)
      updateTransform()
    } else if (lowerKey === 'backspace') {
      if (transformState.inputStr.length > 0) {
        transformState.inputStr = transformState.inputStr.slice(0, -1)
      }
      transformState.amount =
        transformState.inputStr === '' ? undefined : parseFloat(transformState.inputStr)
      console.log('Amount:', transformState.amount)
      updateTransform()
    } else if (lowerKey === 'escape') {
      if (transformState.startMatrix) {
        var origScale = new Vector3(),
          origRotation = new Quaternion(),
          origTranslation = new Vector3()
        transformState.startMatrix.decompose(origScale, origRotation, origTranslation)
        selectedMesh.scaling.copyFrom(origScale)
        if (!selectedMesh.rotationQuaternion) {
          selectedMesh.rotationQuaternion = Quaternion.FromEulerVector(selectedMesh.rotation)
        }
        selectedMesh.rotationQuaternion.copyFrom(origRotation)
        selectedMesh.position.copyFrom(origTranslation)
        console.log('Transform canceled')
      }
      transformState = {
        mode: null,
        axis: null,
        amount: undefined,
        inputStr: '',
        startMatrix: null,
        startScreenPos: null,
        baseScreenPos: null,
        initialRotationAngle: undefined,
        baseDistance: undefined,
        baseMeshScreenPos: null,
        mouseTranslation: Vector3.Zero(),
        currentScreenPos: null,
      }
    } else if (!isNaN(parseInt(key)) || lowerKey === '.') {
      transformState.inputStr += key
      transformState.amount = parseFloat(transformState.inputStr)
      console.log('Amount:', transformState.amount)
      updateTransform()
    }
  }

  scene.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, function (evt) {
      var key = evt.sourceEvent.key

      handleKey(key, evt.sourceEvent)
    }),
  )

  watch(
    toRef(state, 'selected_shape_id'),
    (newValue, oldValue) => {
      sdf_scene.onNodeSelectedObservable.notifyObservers([newValue, oldValue])
      gizmoManager.attachToMesh(scene.getMeshByName('node_' + state.selected_shape_id))
    },
    { immediate: true },
  )
  const canvasEl = engine.getRenderingCanvas()
  canvasEl.tabIndex = 0

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
      sdf_scene.onNeedsRedrawObservable.notifyObservers(true)
      if (!transformState.mode) {
        state.selected_shape_id = state.selected_shape_id_buffer
      }
      console.log('Transform state cleared due to pointer click')
      if (transformState.mode) {
        transformState = new TransformState()
      }
    }
    if (pointerInfo.type === PointerEventTypes.POINTERUP) {
      sdf_scene.onNeedsRedrawObservable.notifyObservers(true)
    }
  })

  // Handle pointer movement in screen space.
  scene.onPointerMove = function (evt) {
    var currentScreenPos = new Vector2(
      evt.clientX / global_settings.display.resolution_multiplier,
      evt.clientY / global_settings.display.resolution_multiplier,
    )
    transformState.currentScreenPos = currentScreenPos
    if (transformState.mode) {
      // Capture the initial pointer position if not already done.
      if (!transformState.baseScreenPos) {
        transformState.baseScreenPos = currentScreenPos.clone()
      }
      // --- Rotation ---
      if (transformState.mode === 'rotate' && transformState.inputStr === '') {
        var rotate_init_threshold = 5 // minimum movement in pixels to start rotation
        var offsetVec = currentScreenPos.subtract(transformState.baseScreenPos)
        if (offsetVec.length() < rotate_init_threshold) {
          return
        }
        if (transformState.initialRotationAngle === undefined) {
          transformState.initialRotationAngle = Math.atan2(offsetVec.y, offsetVec.x)
        }
        var currentAngle = Math.atan2(offsetVec.y, offsetVec.x)
        var deltaAngle = transformState.initialRotationAngle - currentAngle
        transformState.amount = Tools.ToDegrees(deltaAngle)
        updateTransform()
      }
      // --- Scaling ---
      else if (transformState.mode === 'scale' && transformState.inputStr === '') {
        var meshCenter = selectedMesh.getBoundingInfo().boundingSphere.center
        var projectedCenter = Vector3.Project(
          meshCenter,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
        )
        var centerScreen = new Vector2(projectedCenter.x, projectedCenter.y)
        if (transformState.axis) {
          // Axis-constrained scaling: compute the candidate axis in screen space.
          var candidateVector
          if (transformState.axis === 'x') candidateVector = Vector3.Right()
          else if (transformState.axis === 'y') candidateVector = Vector3.Up()
          else if (transformState.axis === 'z') candidateVector = Vector3.Forward()
          var candidateEndWorld = meshCenter.add(candidateVector)
          var projectedCandidate = Vector3.Project(
            candidateEndWorld,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
          )
          var candidateScreenDir = new Vector2(projectedCandidate.x, projectedCandidate.y)
            .subtract(centerScreen)
            .normalize()
          // Capture the initial absolute distance along the candidate axis.
          if (transformState.baseDistance === undefined) {
            transformState.baseDistance = Math.abs(
              Vector2.Dot(transformState.baseScreenPos.subtract(centerScreen), candidateScreenDir),
            )
          }
          var currentDistance = Math.abs(
            Vector2.Dot(currentScreenPos.subtract(centerScreen), candidateScreenDir),
          )
          var deltaDistance = currentDistance - transformState.baseDistance
          var factor = 0.005
          transformState.amount = 1 + deltaDistance * factor
          updateTransform()
        } else {
          // Uniform scaling: use the radial distance from the mesh center.
          if (transformState.baseDistance === undefined) {
            transformState.baseDistance = currentScreenPos.subtract(centerScreen).length()
          }
          var currentDistance = currentScreenPos.subtract(centerScreen).length()
          var deltaDistance = currentDistance - transformState.baseDistance
          var factor = 0.005

          transformState.amount = 1 + deltaDistance * factor
          updateTransform()
        }
      }
      // --- Translation ---
      else if (transformState.mode === 'translate' && transformState.inputStr === '') {
        if (transformState.axis) {
          var meshCenter = selectedMesh.getBoundingInfo().boundingSphere.center
          var projectedCenter = Vector3.Project(
            meshCenter,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
          )
          var centerScreen = new Vector2(projectedCenter.x, projectedCenter.y)
          var candidateVector
          if (transformState.axis === 'x') candidateVector = Vector3.Right()
          else if (transformState.axis === 'y') candidateVector = Vector3.Up()
          else if (transformState.axis === 'z') candidateVector = Vector3.Forward()
          var candidateEndWorld = meshCenter.add(candidateVector)
          var projectedCandidate = Vector3.Project(
            candidateEndWorld,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
          )
          var candidateScreenDir = new Vector2(projectedCandidate.x, projectedCandidate.y)
            .subtract(centerScreen)
            .normalize()
          var offset = currentScreenPos.subtract(transformState.baseScreenPos)
          var scalar = Vector2.Dot(offset, candidateScreenDir)
          var factor = 0.01
          transformState.amount = scalar * factor
          updateTransform()
        } else {
          // Free translation: use unproject to compute world delta.
          var meshCenter = selectedMesh.getBoundingInfo().boundingSphere.center
          var projectedCenter = Vector3.Project(
            meshCenter,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
          )
          var depth = projectedCenter.z
          var viewMatrix = camera.getViewMatrix()
          var projectionMatrix = camera.getProjectionMatrix()
          var startWorld = Vector3.Unproject(
            new Vector3(transformState.baseScreenPos.x, transformState.baseScreenPos.y, depth),
            engine.getRenderWidth(),
            engine.getRenderHeight(),
            Matrix.Identity(),
            viewMatrix,
            projectionMatrix,
          )
          var currentWorld = Vector3.Unproject(
            new Vector3(currentScreenPos.x, currentScreenPos.y, depth),
            engine.getRenderWidth(),
            engine.getRenderHeight(),
            Matrix.Identity(),
            viewMatrix,
            projectionMatrix,
          )
          transformState.mouseTranslation = currentWorld.subtract(startWorld)
          updateTransform()
        }
      }
    }
  }

  // ─── Blender-style numpad navigation ───
  // (place this *inside* setupEditorView, just before its closing `}`)
  const cameraState = {
    initial: {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.getTarget().clone(),
      mode: camera.mode,
    },
    backup: null,
    lastView: null,
  }

  function backupCamera() {
    cameraState.backup = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.getTarget().clone(),
      mode: camera.mode,
    }
  }

  function restoreCamera() {
    if (!cameraState.backup) {
      return
    }
    camera.alpha = cameraState.backup.alpha
    camera.beta = cameraState.backup.beta
    camera.radius = cameraState.backup.radius
    camera.setTarget(cameraState.backup.target)
    camera.mode = cameraState.backup.mode
  }

  function toggleView(view) {
    if (cameraState.lastView === view) {
      restoreCamera()
      cameraState.lastView = null
    } else {
      backupCamera()
      applyView(view)
      cameraState.lastView = view
    }
  }

  function applyView(view) {
    if (['front', 'back', 'left', 'right', 'top', 'bottom'].includes(view)) {
      // camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    }
    switch (view) {
      case 'front':
        camera.alpha = 0
        camera.beta = Math.PI / 2
        break
      case 'back':
        camera.alpha = Math.PI
        camera.beta = Math.PI / 2
        break
      case 'right':
        camera.alpha = Math.PI / 2
        camera.beta = Math.PI / 2
        break
      case 'left':
        camera.alpha = -Math.PI / 2
        camera.beta = Math.PI / 2
        break
      case 'top':
        camera.alpha = 0
        camera.beta = 0
        break
      case 'bottom':
        camera.alpha = 0
        camera.beta = Math.PI
        break
      case 'camera':
        camera.alpha = cameraState.initial.alpha
        camera.beta = cameraState.initial.beta
        camera.radius = cameraState.initial.radius
        camera.setTarget(cameraState.initial.target)
        camera.mode = cameraState.initial.mode
        break
    }
  }

  function toggleOrtho() {
    if (camera.mode === Camera.PERSPECTIVE_CAMERA) {
      const H = Math.tan(camera.fov / 2) * camera.radius
      const aspect = scene.getEngine().getAspectRatio(camera, true)
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA
      camera.orthoLeft = -H * aspect
      camera.orthoRight = H * aspect
      camera.orthoTop = H
      camera.orthoBottom = -H
    } else {
      const H = camera.orthoTop
      camera.radius = H / Math.tan(camera.fov / 2)
      camera.mode = Camera.PERSPECTIVE_CAMERA
    }
  }

  function rotateView(dir) {
    const step = Tools.ToRadians(15)
    switch (dir) {
      case 'left':
        camera.alpha -= step
        break
      case 'right':
        camera.alpha += step
        break
      case 'up':
        camera.beta = Math.max(0.01, camera.beta - step)
        break
      case 'down':
        camera.beta = Math.min(Math.PI - 0.01, camera.beta + step)
        break
    }
  }

  function panView(dir) {
    const step = camera.radius * 0.1
    const target = camera.getTarget().clone()
    const up = camera.upVector.clone()
    const dirVec = camera.position.subtract(target).normalize()
    const right = Vector3.Cross(dirVec, up).normalize()
    switch (dir) {
      case 'left':
        target.addInPlace(right.scale(-step))
        break
      case 'right':
        target.addInPlace(right.scale(step))
        break
      case 'up':
        target.addInPlace(up.scale(step))
        break
      case 'down':
        target.addInPlace(up.scale(-step))
        break
    }
    camera.setTarget(target)
  }

  function zoomOnSelection() {
    if (!selectedMesh) {
      return
    }
    const info = selectedMesh.getBoundingInfo()
    const center = info.boundingSphere.centerWorld.clone()
    const radius = info.boundingSphere.radiusWorld
    backupCamera()
    camera.setTarget(center)
    camera.radius = radius * 3
    cameraState.lastView = null
  }

  function setCameraToViewport() {
    cameraState.initial = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.getTarget().clone(),
      mode: camera.mode,
    }
  }

  scene.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, function (evt) {
      const k = evt.sourceEvent.key.toLowerCase()
      const ctrl = evt.sourceEvent.ctrlKey
      const alt = evt.sourceEvent.altKey
      if (transformState.mode) {
        return
      }
      camera.inertialAlphaOffset = 0
      camera.inertialBetaOffset = 0

      switch (k) {
        case '1':
          toggleView(ctrl ? 'back' : 'front')
          break
        case '3':
          toggleView(ctrl ? 'right' : 'left')
          break
        case '7':
          toggleView(ctrl ? 'bottom' : 'top')
          break
        case '5':
          toggleOrtho()
          break
        case '0':
          if (ctrl && alt) setCameraToViewport()
          else toggleView('camera')
          break
        case '2':
          ctrl ? panView('up') : rotateView('up')
          break
        case '4':
          ctrl ? panView('left') : rotateView('left')
          break
        case '6':
          ctrl ? panView('right') : rotateView('right')
          break
        case '8':
          ctrl ? panView('down') : rotateView('down')
          break
        case '/':
          /* local-view toggle */ break
        case '.':
          zoomOnSelection()
          break
        case '+':
          camera.radius *= 0.8
          break
      }
    }),
  )

  // ─── Ortho‐mode inertia zoom on scroll ───
  const orthoZoomScale = 0.001 // tweak for sensitivity
  const inertiaDamping = 0.85 // between 0 (fast stop) and 1 (infinite glide)
  let orthoScrollVel = 0 // current “momentum”

  // 1) Per‐frame damping + apply zoom
  scene.onBeforeRenderObservable.add(() => {
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA && Math.abs(orthoScrollVel) > 0.001) {
      // compute uniform scale factor: positive vel -> zoom OUT
      const factor = Math.exp(orthoScrollVel * orthoZoomScale)
      camera.orthoLeft *= factor
      camera.orthoRight *= factor
      camera.orthoTop *= factor
      camera.orthoBottom *= factor

      // apply damping
      orthoScrollVel *= inertiaDamping
    }
  })

  // 2) Capture scroll and feed momentum (invert sign so wheel‐down -> zoom out)
  canvasEl.addEventListener(
    'wheel',
    (evt) => {
      if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        evt.preventDefault()
        // add to velocity (positive deltaY = scroll‐down = zoom out)
        orthoScrollVel += evt.deltaY
      }
    },
    { passive: false },
  )

  // ─── Manage default wheel input on ortho/persp ───
  function updateMouseWheelInput() {
    const attached = camera.inputs.attached
    // remove default wheel zoom in ortho
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
      if (attached.mousewheel) {
        camera.inputs.remove(attached.mousewheel)
      }
    } else {
      // re-add it when back to perspective
      if (!attached.mousewheel) {
        camera.inputs.add(new ArcRotateCameraMouseWheelInput())
      }
    }
  }

  // call once on init
  updateMouseWheelInput()

  // also call whenever we toggle ortho/persp
  const origToggleOrtho = toggleOrtho
  toggleOrtho = () => {
    origToggleOrtho()
    updateMouseWheelInput()
  }
}
