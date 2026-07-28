// Camera-framing helper shared by SceneManager.setModel() and resetCamera().
//
// STL files (Blender / 3D-printing convention) use a Z-up coordinate system,
// so this module frames objects for a Z-up world: the camera's up-vector is
// set to +Z (so OrbitControls orbits around a vertical Z axis) and the
// camera is placed at a pleasant fixed 3/4 angle in that space, pulled back
// far enough that the object's bounding sphere fills roughly `fill` of the
// vertical field of view. Orbit controls' target is re-centered on the
// object so subsequent drag/orbit/zoom behaves correctly.

import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Fixed 3/4 view direction in Z-up space: +X right, -Y toward the viewer
// (front), +Z up. This is the SAME direction used by the offline
// thumbnailer so a model's thumbnail matches its orientation in the live
// viewer.
const VIEW_DIR = new THREE.Vector3(1, -1, 0.75).normalize()

/**
 * Frames `object` in `camera`'s view and points `controls` at it.
 *
 * @param fill fraction (0-1) of the vertical frame the object's bounding
 *   sphere should fill; defaults to 0.8 (a little breathing room around the
 *   model).
 */
export function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  controls: OrbitControls,
  fill = 0.8,
): void {
  const box = new THREE.Box3().setFromObject(object)

  // Guard against an empty/degenerate object (no geometry yet): fall back to
  // a unit sphere at the origin rather than producing NaNs.
  const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 1) : box.getBoundingSphere(new THREE.Sphere())
  const center = sphere.center
  const radius = sphere.radius > 0 ? sphere.radius : 1

  const vFov = (camera.fov * Math.PI) / 180
  const distance = radius / (Math.sin(vFov / 2) * fill)

  camera.up.set(0, 0, 1)
  camera.position.copy(center).addScaledVector(VIEW_DIR, distance)
  camera.near = Math.max(distance - radius * 2, 0.01)
  camera.far = distance + radius * 2
  camera.lookAt(center)
  camera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.update()
}
