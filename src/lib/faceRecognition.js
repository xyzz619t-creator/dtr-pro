import * as faceapi from '@vladmandic/face-api'

// ===========================================================
// FACE RECOGNITION CONFIG
// ===========================================================

const MODEL_URL = '/models'

let modelsLoaded = false
let modelsLoadingPromise = null

// ===========================================================
// LOAD FACE MODELS
// ===========================================================

export async function loadFaceRecognitionModels() {
  // Already loaded
  if (modelsLoaded) {
    return true
  }

  // Already loading
  if (modelsLoadingPromise) {
    return modelsLoadingPromise
  }

  modelsLoadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(
      MODEL_URL
    ),

    faceapi.nets.faceLandmark68Net.loadFromUri(
      MODEL_URL
    ),

    faceapi.nets.faceRecognitionNet.loadFromUri(
      MODEL_URL
    ),
  ])
    .then(() => {
      modelsLoaded = true

      console.log(
        'Face recognition models loaded successfully.'
      )

      return true
    })
    .catch((error) => {
      modelsLoadingPromise = null
      modelsLoaded = false

      console.error(
        'Unable to load face recognition models:',
        error
      )

      throw error
    })

  return modelsLoadingPromise
}

// ===========================================================
// CHECK MODEL STATUS
// ===========================================================

export function areFaceModelsLoaded() {
  return modelsLoaded
}

// ===========================================================
// DETECTOR OPTIONS
// ===========================================================

function getDetectorOptions() {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.65,
  })
}

// ===========================================================
// CREATE FACE TEMPLATE
//
// Used during Admin face enrollment.
//
// Returns:
// {
//   embedding: [...128 values],
//   dimension: 128,
//   confidence: 0.98,
//   box: {...}
// }
// ===========================================================

export async function createFaceTemplate(
  videoElement
) {
  // ---------------------------------------------------------
  // VALIDATE VIDEO
  // ---------------------------------------------------------

  if (!videoElement) {
    throw new Error(
      'Camera video is not available.'
    )
  }

  if (
    videoElement.readyState < 2 ||
    !videoElement.videoWidth ||
    !videoElement.videoHeight
  ) {
    throw new Error(
      'Camera is still starting. Please wait a moment.'
    )
  }

  // ---------------------------------------------------------
  // MAKE SURE MODELS ARE READY
  // ---------------------------------------------------------

  await loadFaceRecognitionModels()

  // ---------------------------------------------------------
  // DETECT ALL FACES
  //
  // We use ALL faces during enrollment because enrollment
  // must fail when more than one person is in front of camera.
  // ---------------------------------------------------------

  const results = await faceapi
    .detectAllFaces(
      videoElement,
      getDetectorOptions()
    )
    .withFaceLandmarks()
    .withFaceDescriptors()

  // ---------------------------------------------------------
  // NO FACE
  // ---------------------------------------------------------

  if (!results || results.length === 0) {
    throw new Error(
      'No face detected. Please look directly at the camera.'
    )
  }

  // ---------------------------------------------------------
  // MORE THAN ONE FACE
  // ---------------------------------------------------------

  if (results.length > 1) {
    throw new Error(
      'More than one face was detected. Only one employee should be visible.'
    )
  }

  const result = results[0]

  // ---------------------------------------------------------
  // CONFIDENCE
  // ---------------------------------------------------------

  const confidence =
    Number(result.detection.score) || 0

  if (confidence < 0.65) {
    throw new Error(
      'Face detection quality is too low. Improve the lighting and try again.'
    )
  }

  // ---------------------------------------------------------
  // FACE SIZE
  //
  // Avoid registering someone too far away from the iPad.
  // ---------------------------------------------------------

  const faceWidth =
    result.detection.box.width

  const videoWidth =
    videoElement.videoWidth

  const faceRatio =
    faceWidth / videoWidth

  if (faceRatio < 0.18) {
    throw new Error(
      'Please move closer to the camera.'
    )
  }

  // ---------------------------------------------------------
  // FACE TOO CLOSE
  // ---------------------------------------------------------

  if (faceRatio > 0.85) {
    throw new Error(
      'Please move slightly away from the camera.'
    )
  }

  // ---------------------------------------------------------
  // DESCRIPTOR
  //
  // face-api recognition model normally returns
  // a 128-dimensional Float32Array.
  // Convert it to a normal JavaScript array so Supabase
  // can store it in real[].
  // ---------------------------------------------------------

  const embedding =
    Array.from(result.descriptor)

  if (!embedding.length) {
    throw new Error(
      'Unable to generate the face template.'
    )
  }

  // ---------------------------------------------------------
  // RETURN RESULT
  // ---------------------------------------------------------

  return {
    embedding,

    dimension:
      embedding.length,

    confidence:
      Math.min(
        1,
        Math.max(
          0,
          confidence
        )
      ),

    box: {
      x:
        result.detection.box.x,

      y:
        result.detection.box.y,

      width:
        result.detection.box.width,

      height:
        result.detection.box.height,
    },
  }
}

// ===========================================================
// DETECT FACE ONLY
//
// We'll use this later for continuous kiosk scanning.
// It does not generate the descriptor unless needed.
// ===========================================================

export async function detectSingleFace(
  videoElement
) {
  if (!videoElement) {
    return null
  }

  if (
    videoElement.readyState < 2 ||
    !videoElement.videoWidth ||
    !videoElement.videoHeight
  ) {
    return null
  }

  await loadFaceRecognitionModels()

  const result = await faceapi.detectSingleFace(
    videoElement,
    getDetectorOptions()
  )

  if (!result) {
    return null
  }

  return {
    confidence:
      result.score,

    box: {
      x:
        result.box.x,

      y:
        result.box.y,

      width:
        result.box.width,

      height:
        result.box.height,
    },
  }
}

// ===========================================================
// FACE DISTANCE
//
// We'll use this later when matching a live employee face
// against enrolled templates.
//
// Smaller number = closer match.
// ===========================================================

export function calculateFaceDistance(
  descriptorA,
  descriptorB
) {
  if (
    !descriptorA ||
    !descriptorB
  ) {
    return Infinity
  }

  if (
    descriptorA.length !==
    descriptorB.length
  ) {
    return Infinity
  }

  let sum = 0

  for (
    let index = 0;
    index < descriptorA.length;
    index++
  ) {
    const difference =
      Number(
        descriptorA[index]
      ) -
      Number(
        descriptorB[index]
      )

    sum +=
      difference *
      difference
  }

  return Math.sqrt(sum)
}