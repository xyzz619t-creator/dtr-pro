import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  createFaceTemplate,
  detectSingleFace,
  loadFaceRecognitionModels,
} from '../lib/faceRecognition'

import {
  matchEmployeeFace,
} from '../lib/faceMatcher'

import './FaceScanner.css'

// ===========================================================
// CONFIG
// ===========================================================

const SCAN_INTERVAL_MS = 1400

// Require the same employee twice before accepting.
const REQUIRED_CONSECUTIVE_MATCHES = 2

// ===========================================================
// FACE SCANNER
// ===========================================================

function FaceScanner({
  active = true,
  disabled = false,
  onRecognized,
}) {
  // =========================================================
  // REFS
  // =========================================================

  const videoRef = useRef(null)

  const streamRef = useRef(null)

  const scanTimerRef = useRef(null)

  const scanRunningRef = useRef(false)

  const recognitionLockedRef =
    useRef(false)

  const callbackRef =
    useRef(onRecognized)

  const candidateRef = useRef({
    employeeCode: null,
    count: 0,
  })

  // =========================================================
  // STATE
  // =========================================================

  const [
    modelsReady,
    setModelsReady,
  ] = useState(false)

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false)

  const [
    initializing,
    setInitializing,
  ] = useState(true)

  const [
    scanning,
    setScanning,
  ] = useState(false)

  const [
    facePresent,
    setFacePresent,
  ] = useState(false)

  const [
    status,
    setStatus,
  ] = useState(
    'Starting face recognition...'
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    recognizedEmployee,
    setRecognizedEmployee,
  ] = useState(null)

  // =========================================================
  // KEEP CALLBACK CURRENT
  // =========================================================

  useEffect(() => {
    callbackRef.current =
      onRecognized
  }, [onRecognized])

  // =========================================================
  // INITIALIZE MODELS + CAMERA
  // =========================================================

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      setInitializing(true)

      setErrorMessage('')

      setStatus(
        'Loading face recognition...'
      )

      try {
        // ===================================================
        // LOAD FACE MODELS
        // ===================================================

        await loadFaceRecognitionModels()

        if (cancelled) {
          return
        }

        setModelsReady(true)

        setStatus(
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
            'Camera is not supported by this browser.'
          )
        }

        // ===================================================
        // OPEN FRONT CAMERA
        // ===================================================

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
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
            .forEach((track) => {
              track.stop()
            })

          return
        }

        streamRef.current =
          stream

        // ===================================================
        // ATTACH STREAM TO VIDEO
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

        setFacePresent(false)

        setStatus(
          'Face recognition active'
        )
      } catch (error) {
        console.error(
          'Face scanner initialization error:',
          error
        )

        let friendlyMessage =
          error?.message ||
          'Unable to start face scanner.'

        if (
          error?.name ===
          'NotAllowedError'
        ) {
          friendlyMessage =
            'Camera permission was denied. Please allow camera access.'
        }

        if (
          error?.name ===
          'NotFoundError'
        ) {
          friendlyMessage =
            'No camera was found on this device.'
        }

        if (
          error?.name ===
          'NotReadableError'
        ) {
          friendlyMessage =
            'The camera is being used by another application.'
        }

        setErrorMessage(
          friendlyMessage
        )

        setStatus(
          'Camera unavailable'
        )
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    initialize()

    return () => {
      cancelled = true

      stopScanning()
      stopCamera()
    }
  }, [])

  // =========================================================
  // RESET WHEN ACTIVE AGAIN
  // =========================================================

  useEffect(() => {
    if (!active) {
      stopScanning()

      return
    }

    recognitionLockedRef.current =
      false

    resetCandidate()

    setRecognizedEmployee(null)

    setFacePresent(false)

    setErrorMessage('')

    if (
      cameraReady &&
      modelsReady &&
      !disabled
    ) {
      setStatus(
        'Face recognition active'
      )
    }
  }, [
    active,
    disabled,
    cameraReady,
    modelsReady,
  ])

  // =========================================================
  // START / STOP AUTO SCANNING
  // =========================================================

  useEffect(() => {
    if (
      !active ||
      disabled ||
      !cameraReady ||
      !modelsReady
    ) {
      stopScanning()

      return
    }

    startScanning()

    return () => {
      stopScanning()
    }
  }, [
    active,
    disabled,
    cameraReady,
    modelsReady,
  ])

  // =========================================================
  // START SCANNING
  // =========================================================

  function startScanning() {
    stopScanning()

    if (
      recognitionLockedRef.current
    ) {
      return
    }

    setScanning(true)

    // Scan immediately.
    scanOnce()

    scanTimerRef.current =
      window.setInterval(
        () => {
          scanOnce()
        },
        SCAN_INTERVAL_MS
      )
  }

  // =========================================================
  // STOP SCANNING
  // =========================================================

  function stopScanning() {
    if (
      scanTimerRef.current
    ) {
      window.clearInterval(
        scanTimerRef.current
      )

      scanTimerRef.current =
        null
    }

    setScanning(false)
  }

  // =========================================================
  // STOP CAMERA
  // =========================================================

  function stopCamera() {
    if (
      streamRef.current
    ) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop()
        })

      streamRef.current =
        null
    }

    if (
      videoRef.current
    ) {
      videoRef.current.srcObject =
        null
    }
  }

  // =========================================================
  // RESET CANDIDATE
  // =========================================================

  function resetCandidate() {
    candidateRef.current = {
      employeeCode: null,
      count: 0,
    }
  }

  // =========================================================
  // SCAN ONE FRAME
  // =========================================================

  async function scanOnce() {
    if (
      scanRunningRef.current ||
      recognitionLockedRef.current ||
      !active ||
      disabled ||
      !videoRef.current
    ) {
      return
    }

    scanRunningRef.current = true

    try {
      setErrorMessage('')

      // =====================================================
      // 1. CHECK WHETHER A FACE IS PRESENT
      //
      // This happens while the camera preview is hidden.
      // =====================================================

      const detection =
        await detectSingleFace(
          videoRef.current
        )

      // =====================================================
      // NO PERSON / NO FACE
      // =====================================================

      if (!detection) {
        setFacePresent(false)

        resetCandidate()

        setRecognizedEmployee(null)

        setStatus(
          'Face recognition active'
        )

        return
      }

      // =====================================================
      // FACE PRESENT
      //
      // Show camera preview now.
      // =====================================================

      setFacePresent(true)

      setStatus(
        'Face detected. Identifying...'
      )

      // =====================================================
      // 2. CREATE LIVE FACE EMBEDDING
      // =====================================================

      const liveFace =
        await createFaceTemplate(
          videoRef.current
        )

      if (
        recognitionLockedRef.current
      ) {
        return
      }

      // =====================================================
      // 3. MATCH AGAINST SUPABASE
      // =====================================================

      const match =
        await matchEmployeeFace(
          liveFace.embedding
        )

      // =====================================================
      // NOT RECOGNIZED
      // =====================================================

      if (
        !match?.success ||
        !match?.matched ||
        !match?.employee
      ) {
        resetCandidate()

        setStatus(
          match?.message ||
          'Face not recognized. Use Employee Code if needed.'
        )

        return
      }

      // =====================================================
      // EMPLOYEE CODE
      // =====================================================

      const employeeCode =
        String(
          match.employee
            .employee_code
        )

      // =====================================================
      // CONSECUTIVE MATCH CHECK
      // =====================================================

      if (
        candidateRef.current
          .employeeCode ===
        employeeCode
      ) {
        candidateRef.current
          .count += 1
      } else {
        candidateRef.current = {
          employeeCode,
          count: 1,
        }
      }

      const matchCount =
        candidateRef.current.count

      // =====================================================
      // FIRST MATCH
      // =====================================================

      if (
        matchCount <
        REQUIRED_CONSECUTIVE_MATCHES
      ) {
        const employeeName =
          getEmployeeName(
            match.employee
          )

        setStatus(
          employeeName
            ? `Confirming ${employeeName}...`
            : 'Confirming employee...'
        )

        return
      }

      // =====================================================
      // EMPLOYEE CONFIRMED
      // =====================================================

      recognitionLockedRef.current =
        true

      stopScanning()

      setRecognizedEmployee(
        match.employee
      )

      const employeeName =
        getEmployeeName(
          match.employee
        )

      setStatus(
        employeeName
          ? `Recognized: ${employeeName}`
          : 'Employee recognized.'
      )

      // =====================================================
      // SEND EMPLOYEE CODE TO APP.JSX
      // =====================================================

      if (
        callbackRef.current
      ) {
        callbackRef.current(
          employeeCode,
          match
        )
      }
    } catch (error) {
      const errorText =
        String(
          error?.message ||
          ''
        )

      // =====================================================
      // NO FACE
      // =====================================================

      if (
        errorText.includes(
          'No face detected'
        )
      ) {
        setFacePresent(false)

        resetCandidate()

        setStatus(
          'Face recognition active'
        )

        return
      }

      // =====================================================
      // MULTIPLE PEOPLE
      //
      // Keep camera visible because people are present.
      // =====================================================

      if (
        errorText.includes(
          'More than one face'
        )
      ) {
        setFacePresent(true)

        resetCandidate()

        setStatus(
          'One employee at a time, please.'
        )

        return
      }

      // =====================================================
      // TOO FAR
      // =====================================================

      if (
        errorText.includes(
          'move closer'
        )
      ) {
        setFacePresent(true)

        resetCandidate()

        setStatus(
          'Please move closer to the camera.'
        )

        return
      }

      // =====================================================
      // TOO CLOSE
      // =====================================================

      if (
        errorText.includes(
          'move slightly away'
        )
      ) {
        setFacePresent(true)

        resetCandidate()

        setStatus(
          'Please move slightly away from the camera.'
        )

        return
      }

      // =====================================================
      // LOW QUALITY
      // =====================================================

      if (
        errorText.includes(
          'quality is too low'
        )
      ) {
        setFacePresent(true)

        resetCandidate()

        setStatus(
          'Improve lighting and look toward the camera.'
        )

        return
      }

      // =====================================================
      // MATCHING SERVICE MISSING
      // =====================================================

      if (
        errorText.includes(
          'Face matching service is not installed'
        )
      ) {
        stopScanning()

        setFacePresent(false)

        setStatus(
          'Face recognition unavailable'
        )

        setErrorMessage(
          'Face matching service is not installed.'
        )

        return
      }

      // =====================================================
      // OTHER ERROR
      // =====================================================

      console.error(
        'Face scanner error:',
        error
      )

      resetCandidate()

      setStatus(
        'Unable to identify employee.'
      )

      setErrorMessage(
        error?.message ||
        'Face recognition error.'
      )
    } finally {
      scanRunningRef.current =
        false
    }
  }

  // =========================================================
  // EMPLOYEE NAME
  // =========================================================

  function getEmployeeName(
    employee
  ) {
    if (!employee) {
      return ''
    }

    return [
      employee.first_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  // =========================================================
  // CLASS NAME
  // =========================================================

  const scannerClassName = [
    'face-scanner',

    active
      ? 'active'
      : 'inactive',

    facePresent
      ? 'face-present'
      : 'no-face',

    recognizedEmployee
      ? 'employee-recognized'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className={
        scannerClassName
      }
    >

      {/* =====================================================
          CAMERA
      ===================================================== */}

      <div className="face-scanner-camera">

        <video
          ref={videoRef}
          className="face-scanner-video"
          autoPlay
          muted
          playsInline
        />


        {/* =================================================
            FACE GUIDE
        ================================================= */}

        <div className="face-scanner-guide">

          <div className="face-scanner-oval" />

        </div>


        {/* =================================================
            CAMERA INITIALIZING
        ================================================= */}

        {!cameraReady && (

          <div className="face-scanner-overlay">

            {initializing
              ? modelsReady
                ? 'Starting camera...'
                : 'Loading face recognition...'
              : 'Camera unavailable'}

          </div>

        )}


        {/* =================================================
            CAMERA READY BADGE
        ================================================= */}

        {cameraReady &&
          facePresent &&
          active &&
          !recognizedEmployee && (

          <div className="face-scanner-ready">

            <span>
              ●
            </span>

            Face Scanner

          </div>

        )}


        {/* =================================================
            RECOGNIZED
        ================================================= */}

        {recognizedEmployee && (

          <div className="face-scanner-recognized">

            <div className="face-recognized-check">
              ✓
            </div>


            <strong>
              Recognized
            </strong>


            <span>
              {getEmployeeName(
                recognizedEmployee
              )}
            </span>

          </div>

        )}

      </div>


      {/* =====================================================
          STATUS
      ===================================================== */}

      <div className="face-scanner-status">

        <div
          className={
            scanning
              ? 'face-scanner-indicator scanning'
              : 'face-scanner-indicator'
          }
        />


        <span>
          {status}
        </span>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {errorMessage && (

        <div className="face-scanner-error">
          {errorMessage}
        </div>

      )}

    </div>
  )
}

export default FaceScanner