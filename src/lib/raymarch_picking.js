import { Vector2, StorageBuffer, Engine } from '@babylonjs/core'

/**
 * Creates a pure-JS shape picker that reads just a single u32 from the GPU buffer
 * and writes it as an i32 into a one-element storage buffer.
 *
 * @param {Engine} engine - The Babylon.js engine instance.
 * @returns {{
 *   /**
 *    * Bind your two storage buffers once:
 *    * @param {StorageBuffer} shapeBuf - Full-resolution shape-ID buffer (array<u32>).
 *    * @param {StorageBuffer} pickBuf - One-element array<i32> to receive the picked ID.
 *    *\/
 *   setBuffers(shapeBuf: StorageBuffer, pickBuf: StorageBuffer): void,
 *
 *   /**
 *    * Reads a single u32 from the shape buffer at the given UV coordinates,
 *    * writes it into the pick buffer, and resolves once done.
 *    *
 *    * @param {Vector2} mouseUV - Normalized mouse UV coordinates (0–1 range).
 *    * @returns {Promise<number>} Promise resolving to the picked shape ID.
 *    * @throws {Error} If buffers have not been bound via setBuffers().
 *    *\/
 *   pick(mouseUV: Vector2): Promise<number>
 * }}
 */
export function createShapePickerJS(engine) {
  /** @type {StorageBuffer|null} */
  let shapeBuffer = null

  /** @type {StorageBuffer|null} */
  let pickedShapeBuffer = null

  return {
    /**
     * Bind the two storage buffers.
     *
     * @param {StorageBuffer} shapeBuf
     * @param {StorageBuffer} pickBuf
     */
    setBuffers(shapeBuf, pickBuf) {
      shapeBuffer = shapeBuf
      pickedShapeBuffer = pickBuf
    },

    /**
     * Sample the shape-ID buffer at the given UV and write into the pick buffer.
     *
     * @param {Vector2} mouseUV
     * @returns {Promise<number>}
     */
    async pick(mouseUV) {
      if (!shapeBuffer || !pickedShapeBuffer) {
        throw new Error('ShapePickerJS: setBuffers() must be called first')
      }

      // 1) Compute pixel index
      const w = engine.getRenderWidth(false)
      const h = engine.getRenderHeight(false)
      const x = Math.min(Math.max(Math.floor(mouseUV.x * w), 0), w - 1)
      const y = Math.min(Math.max(Math.floor(mouseUV.y * h), 0), h - 1)
      const idx = y * w + x

      // 2) Compute byte offset & read just 4 bytes
      const byteOffset = idx * 4 // one u32 = 4 bytes
      const byteSize = 4
      const tmp = new Uint32Array(1)

      await shapeBuffer.read(byteOffset, byteSize, tmp, /* noDelay: */ true)

      // 3) Write that value (as a signed i32) into your pick buffer
      const toWrite = new Int32Array([tmp[0]])
      await pickedShapeBuffer.update(toWrite, /* byteOffset */ 0, Int32Array.BYTES_PER_ELEMENT)

      return tmp[0]
    },
  }
}
