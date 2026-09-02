import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'

import {
  createFaceTemplate,
  loadFaceRecognitionModels,
} from '../lib/faceRecognition'

import './FaceEnrollment.css'

// ===========================================================
// EMPTY FACE CAPTURES
// ===========================================================

function createEmptyCaptures() {
  return {
    front: null,
    left: null,
    right: null,
  }
}

// ===========================================================
// FACE ENROLLMENT
// ===========================================================

function FaceEnrollment({
  employee,
  onClose,
  onSaved,
}) {
  // =========================================================
  // REFS
  // =========================================================

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // =========================================================
  // CAMERA / MODEL STATE
  // =========================================================

  const [modelsReady, setModelsReady] =
    useState(false)

  const [cameraReady, setCameraReady] =
    useState(false)

  const [initializing, setInitializing] =
    useState(true)

  // =========================================================
  // CAPTURE STATE
  // =========================================================

  const [captures, setCaptures] =
    useState(createEmptyCaptures)

  const [capturingType, setCapturingType] =
    useState(null)

  // =========================================================
  // SAVE STATE
  // =========================================================

  const [saving, setSaving] =
    useState(false)

  // =========================================================
  // MESSAGES
  // =========================================================

  const [message, setMessage] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  // =========================================================
  // INITIALIZE
  // =========================================================

  useEffect(() => {
    let cancelled = false

    async function initializeEnrollment() {
      setInitializing(true)

      setMessage(
        'Loading face recognition models...'
      )

      setErrorMessage('')

      try {
        // ===================================================
        // LOAD MODELS
        // ===================================================

        await loadFaceRecognitionModels()

        if (cancelled) {
          return
        }

        setModelsReady(true)

        setMessage(
          'Starting camera...'
        )

        // ===================================================
        // CHECK CAMERA SUPPORT
        // ===================================================

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            'Camera access is not supported by this browser.'
          )
        }

        // ===================================================
        // REQUEST CAMERA
        // ===================================================

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,

            video: {
              facingMode: 'user',

              width: {
                ideal: 1280,
              },

              height: {
                ideal: 720,
              },
            },
          })

        if (cancelled) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            )

          return
        }

        streamRef.current =
          stream

        // ===================================================
        // ATTACH CAMERA TO VIDEO
        // ===================================================

        const video =
          videoRef.current

        if (!video) {
          throw new Error(
            'Camera video element is unavailable.'
          )
        }

        video.srcObject =
          stream

        await video.play()

        if (cancelled) {
          return
        }

        setCameraReady(true)

        setMessage(
          'Camera ready. Start with the front face.'
        )
      } catch (error) {
        console.error(
          'Face enrollment initialization error:',
          error
        )

        let friendlyMessage =
          error.message ||
          'Unable to start face enrollment.'

        if (
          error.name ===
          'NotAllowedError'
        ) {
          friendlyMessage =
            'Camera permission was denied. Please allow camera access and try again.'
        }

        if (
          error.name ===
          'NotFoundError'
        ) {
          friendlyMessage =
            'No camera was found on this device.'
        }

        if (
          error.name ===
          'NotReadableError'
        ) {
          friendlyMessage =
            'The camera is already being used by another application.'
        }

        setErrorMessage(
          friendlyMessage
        )

        setMessage('')
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    initializeEnrollment()

    return () => {
      cancelled = true

      stopCamera()
    }
  }, [])

  // =========================================================
  // STOP CAMERA
  // =========================================================

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop()
        })

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null
    }
  }

  // =========================================================
  // CAPTURE FACE
  // =========================================================

  async function captureFace(
    sampleType
  ) {
    if (
      !modelsReady ||
      !cameraReady ||
      capturingType ||
      saving
    ) {
      return
    }

    setCapturingType(
      sampleType
    )

    setErrorMessage('')

    // =======================================================
    // INSTRUCTIONS
    // =======================================================

    if (sampleType === 'front') {
      setMessage(
        'Capturing front face...'
      )
    }

    if (sampleType === 'left') {
      setMessage(
        'Capturing left face...'
      )
    }

    if (sampleType === 'right') {
      setMessage(
        'Capturing right face...'
      )
    }

    try {
      const result =
        await createFaceTemplate(
          videoRef.current
        )

      setCaptures(
        (previous) => ({
          ...previous,

          [sampleType]:
            result,
        })
      )

      // =====================================================
      // NEXT INSTRUCTION
      // =====================================================

      if (sampleType === 'front') {
        setMessage(
          'Front captured successfully. Turn your face slightly to the left.'
        )
      }

      if (sampleType === 'left') {
        setMessage(
          'Left captured successfully. Turn your face slightly to the right.'
        )
      }

      if (sampleType === 'right') {
        setMessage(
          'Right captured successfully. All face samples are ready.'
        )
      }
    } catch (error) {
      console.error(
        'Face capture error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to capture face.'
      )

      setMessage('')
    } finally {
      setCapturingType(null)
    }
  }

  // =========================================================
  // CLEAR ALL CAPTURES
  // =========================================================

  function resetCaptures() {
    if (
      capturingType ||
      saving
    ) {
      return
    }

    setCaptures(
      createEmptyCaptures()
    )

    setErrorMessage('')

    setMessage(
      'Captures cleared. Start again with the front face.'
    )
  }

  // =========================================================
  // SAVE FACE PROFILE
  // =========================================================

  async function saveFaceProfile() {
    if (!employee?.id) {
      setErrorMessage(
        'Employee information is missing.'
      )

      return
    }

    if (
      !captures.front ||
      !captures.left ||
      !captures.right
    ) {
      setErrorMessage(
        'Please capture Front, Left and Right before saving.'
      )

      return
    }

    setSaving(true)

    setErrorMessage('')

    setMessage(
      'Saving face profile...'
    )

    try {
      // =====================================================
      // GET LOGGED-IN ADMIN
      // =====================================================

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      const adminUser =
        userData?.user

      if (!adminUser) {
        throw new Error(
          'Administrator session was not found. Please sign in again.'
        )
      }

      const now =
        new Date().toISOString()

      // =====================================================
      // CREATE FRONT / LEFT / RIGHT ROWS
      // =====================================================

      const rows = [
        {
          sampleType:
            'front',

          template:
            captures.front,
        },

        {
          sampleType:
            'left',

          template:
            captures.left,
        },

        {
          sampleType:
            'right',

          template:
            captures.right,
        },
      ].map(
        ({
          sampleType,
          template,
        }) => ({
          employee_id:
            employee.id,

          sample_type:
            sampleType,

          face_embedding:
            template.embedding,

          embedding_dimension:
            template.dimension,

          model_name:
            'vladmandic-face-api',

          model_version:
            'face-recognition-128d-v1',

          quality_score:
            Number(
              template.confidence
                .toFixed(5)
            ),

          status:
            'active',

          enrolled_by:
            adminUser.id,

          enrolled_at:
            now,

          revoked_by:
            null,

          revoked_at:
            null,
        })
      )

      // =====================================================
      // UPSERT
      //
      // If the employee already has front/left/right,
      // re-registering replaces those templates.
      // =====================================================

      const {
        error: saveError,
      } = await supabase
        .from(
          'employee_face_profiles'
        )
        .upsert(
          rows,
          {
            onConflict:
              'employee_id,sample_type',
          }
        )

      if (saveError) {
        throw saveError
      }

      setMessage(
        'Face profile registered successfully.'
      )

      // =====================================================
      // REFRESH PARENT STATUS
      // =====================================================

      if (onSaved) {
        await onSaved()
      }

      // =====================================================
      // CLOSE AFTER SUCCESS
      // =====================================================

      setTimeout(() => {
        stopCamera()

        if (onClose) {
          onClose()
        }
      }, 900)
    } catch (error) {
      console.error(
        'Face profile save error:',
        error
      )

      setErrorMessage(
        `Unable to save face profile: ${error.message}`
      )

      setMessage('')
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // CLOSE
  // =========================================================

  function handleClose() {
    if (
      saving ||
      capturingType
    ) {
      return
    }

    stopCamera()

    if (onClose) {
      onClose()
    }
  }

  // =========================================================
  // CAPTURE STATUS
  // =========================================================

  const completedCount =
    Object.values(
      captures
    ).filter(Boolean).length

  const allCaptured =
    Boolean(
      captures.front &&
      captures.left &&
      captures.right
    )

  // =========================================================
  // EMPLOYEE NAME
  // =========================================================

  const employeeName =
    `${employee?.first_name || ''} ${employee?.last_name || ''}`
      .trim()

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="face-enrollment-backdrop">

      <div className="face-enrollment-modal">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="face-enrollment-header">

          <div>

            <h2>
              Register Face
            </h2>

            <p>
              {employeeName}

              {employee?.employee_code && (
                <>
                  {' • '}
                  Employee Code:{' '}
                  {
                    employee.employee_code
                  }
                </>
              )}
            </p>

          </div>


          <button
            type="button"
            className="face-enrollment-close"
            onClick={handleClose}
            disabled={
              saving ||
              Boolean(
                capturingType
              )
            }
            aria-label="Close"
          >
            ×
          </button>

        </div>


        {/* =================================================
            BODY
        ================================================= */}

        <div className="face-enrollment-body">

          {/* =================================================
              CAMERA
          ================================================= */}

          <div className="face-camera-section">

            <div className="face-camera-frame">

              <video
                ref={videoRef}
                className="face-camera-video"
                autoPlay
                muted
                playsInline
              />


              {/* FACE GUIDE */}

              <div className="face-camera-guide">

                <div className="face-guide-oval" />

              </div>


              {/* INITIALIZING */}

              {!cameraReady && (

                <div className="face-camera-loading">

                  {initializing
                    ? modelsReady
                      ? 'Starting camera...'
                      : 'Loading face recognition...'
                    : 'Camera unavailable'}

                </div>

              )}


              {/* CAMERA READY BADGE */}

              {cameraReady && (

                <div className="face-camera-ready">
                  ● Camera Ready
                </div>

              )}

            </div>


            <div className="face-camera-help">

              <strong>
                Enrollment tips
              </strong>

              <ul>

                <li>
                  Only one employee should be visible.
                </li>

                <li>
                  Keep the face inside the guide.
                </li>

                <li>
                  Use good lighting.
                </li>

                <li>
                  Remove masks or anything covering the face.
                </li>

                <li>
                  Do not stand too close or too far from the camera.
                </li>

              </ul>

            </div>

          </div>


          {/* =================================================
              CAPTURE PANEL
          ================================================= */}

          <div className="face-capture-section">

            {/* PROGRESS */}

            <div className="face-enrollment-progress">

              <div>

                <strong>
                  Face Enrollment
                </strong>

                <span className="face-enrollment-subtitle">
                  Capture three views
                </span>

              </div>


              <span className="face-progress-count">
                {completedCount}/3
              </span>

            </div>


            {/* =================================================
                FRONT
            ================================================= */}

            <FaceCaptureStep
              number="1"
              title="Front"
              description="Look directly at the camera."
              captured={
                Boolean(
                  captures.front
                )
              }
              capturing={
                capturingType ===
                'front'
              }
              disabled={
                !cameraReady ||
                saving ||
                Boolean(
                  capturingType
                )
              }
              onCapture={() =>
                captureFace(
                  'front'
                )
              }
            />


            {/* =================================================
                LEFT
            ================================================= */}

            <FaceCaptureStep
              number="2"
              title="Left"
              description="Turn your face slightly to your left."
              captured={
                Boolean(
                  captures.left
                )
              }
              capturing={
                capturingType ===
                'left'
              }
              disabled={
                !cameraReady ||
                saving ||
                Boolean(
                  capturingType
                )
              }
              onCapture={() =>
                captureFace(
                  'left'
                )
              }
            />


            {/* =================================================
                RIGHT
            ================================================= */}

            <FaceCaptureStep
              number="3"
              title="Right"
              description="Turn your face slightly to your right."
              captured={
                Boolean(
                  captures.right
                )
              }
              capturing={
                capturingType ===
                'right'
              }
              disabled={
                !cameraReady ||
                saving ||
                Boolean(
                  capturingType
                )
              }
              onCapture={() =>
                captureFace(
                  'right'
                )
              }
            />


            {/* =================================================
                QUALITY INFORMATION
            ================================================= */}

            {captures.front && (

              <FaceQuality
                label="Front"
                confidence={
                  captures.front
                    .confidence
                }
              />

            )}


            {captures.left && (

              <FaceQuality
                label="Left"
                confidence={
                  captures.left
                    .confidence
                }
              />

            )}


            {captures.right && (

              <FaceQuality
                label="Right"
                confidence={
                  captures.right
                    .confidence
                }
              />

            )}


            {/* =================================================
                MESSAGE
            ================================================= */}

            {message && (

              <div className="face-enrollment-message">
                {message}
              </div>

            )}


            {/* =================================================
                ERROR
            ================================================= */}

            {errorMessage && (

              <div className="face-enrollment-error">
                {errorMessage}
              </div>

            )}

          </div>

        </div>


        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="face-enrollment-footer">

          <button
            type="button"
            className="face-reset-button"
            onClick={
              resetCaptures
            }
            disabled={
              saving ||
              Boolean(
                capturingType
              ) ||
              completedCount === 0
            }
          >
            Reset
          </button>


          <div className="face-footer-actions">

            <button
              type="button"
              className="face-cancel-button"
              onClick={handleClose}
              disabled={
                saving ||
                Boolean(
                  capturingType
                )
              }
            >
              Cancel
            </button>


            <button
              type="button"
              className="face-save-button"
              onClick={
                saveFaceProfile
              }
              disabled={
                !allCaptured ||
                saving ||
                Boolean(
                  capturingType
                )
              }
            >

              {saving
                ? 'Saving...'
                : 'Save Face Profile'}

            </button>

          </div>

        </div>

      </div>

    </div>
  )
}

// ===========================================================
// CAPTURE STEP
// ===========================================================

function FaceCaptureStep({
  number,
  title,
  description,
  captured,
  capturing,
  disabled,
  onCapture,
}) {
  return (
    <div
      className={
        captured
          ? 'face-step completed'
          : 'face-step'
      }
    >

      <div className="face-step-number">

        {captured
          ? '✓'
          : number}

      </div>


      <div className="face-step-content">

        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>

      </div>


      <button
        type="button"
        onClick={onCapture}
        disabled={disabled}
      >

        {capturing
          ? 'Capturing...'
          : captured
          ? 'Retake'
          : 'Capture'}

      </button>

    </div>
  )
}

// ===========================================================
// QUALITY
// ===========================================================

function FaceQuality({
  label,
  confidence,
}) {
  const percentage =
    Math.round(
      Number(confidence || 0) *
      100
    )

  return (
    <div className="face-quality-row">

      <span>
        {label} Quality
      </span>

      <strong>
        {percentage}%
      </strong>

    </div>
  )
}

export default FaceEnrollment