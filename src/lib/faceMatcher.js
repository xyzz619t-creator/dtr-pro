import { supabase } from './supabase'

// ===========================================================
// MATCH EMPLOYEE FACE
//
// IMPORTANT:
//
// The kiosk does NOT read employee_face_profiles directly.
//
// The live face embedding is sent to the protected
// match_employee_face() Supabase function.
//
// That function will compare the live embedding against
// enrolled employee templates and return only the result.
// ===========================================================

export async function matchEmployeeFace(
  faceEmbedding
) {
  // =========================================================
  // VALIDATE EMBEDDING
  // =========================================================

  if (
    !Array.isArray(faceEmbedding) ||
    faceEmbedding.length < 32
  ) {
    throw new Error(
      'Invalid face embedding.'
    )
  }

  // =========================================================
  // CLEAN VALUES
  // =========================================================

  const embedding =
    faceEmbedding.map((value) =>
      Number(value)
    )

  const containsInvalidValue =
    embedding.some(
      (value) =>
        !Number.isFinite(value)
    )

  if (containsInvalidValue) {
    throw new Error(
      'Face embedding contains invalid values.'
    )
  }

  // =========================================================
  // CALL PROTECTED SUPABASE FUNCTION
  // =========================================================

  const { data, error } =
    await supabase.rpc(
      'match_employee_face',
      {
        p_face_embedding:
          embedding,
      }
    )

  // =========================================================
  // RPC ERROR
  // =========================================================

  if (error) {
    console.error(
      'match_employee_face RPC error:',
      error
    )

    // Function not created yet
    if (
      error.code === '42883' ||
      error.code === 'PGRST202'
    ) {
      throw new Error(
        'Face matching service is not installed yet.'
      )
    }

    throw new Error(
      error.message ||
        'Unable to match employee face.'
    )
  }

  // =========================================================
  // NORMALIZE RESPONSE
  //
  // Supabase RPC may return JSON directly.
  // =========================================================

  let result = data

  if (
    Array.isArray(result)
  ) {
    result =
      result[0] || null
  }

  // Some RPCs may return JSON as a string.
  if (
    typeof result === 'string'
  ) {
    try {
      result =
        JSON.parse(result)
    } catch {
      // Keep original value
    }
  }

  // =========================================================
  // NO RESPONSE
  // =========================================================

  if (!result) {
    return {
      success: true,
      matched: false,
      employee: null,
      distance: null,
      message:
        'No matching employee found.',
    }
  }

  // =========================================================
  // BACKEND FAILURE
  // =========================================================

  if (
    result.success === false
  ) {
    return {
      success: false,
      matched: false,
      employee: null,
      distance:
        result.distance ??
        null,
      message:
        result.message ||
        'Unable to identify employee.',
    }
  }

  // =========================================================
  // NO MATCH
  // =========================================================

  if (
    result.matched === false
  ) {
    return {
      success: true,
      matched: false,
      employee: null,
      distance:
        result.distance ??
        null,
      message:
        result.message ||
        'Face not recognized.',
    }
  }

  // =========================================================
  // NORMALIZE EMPLOYEE
  // =========================================================

  const employee =
    result.employee || {
      id:
        result.employee_id ||
        null,

      employee_code:
        result.employee_code ||
        null,

      first_name:
        result.first_name ||
        '',

      last_name:
        result.last_name ||
        '',
    }

  const employeeCode =
    employee?.employee_code

  if (!employeeCode) {
    return {
      success: false,
      matched: false,
      employee: null,
      distance:
        result.distance ??
        null,
      message:
        'Face match did not return an employee code.',
    }
  }

  // =========================================================
  // SUCCESS
  // =========================================================

  return {
    success: true,

    matched: true,

    employee: {
      ...employee,

      employee_code:
        String(
          employeeCode
        ),
    },

    distance:
      result.distance ??
      null,

    confidence:
      result.confidence ??
      null,

    message:
      result.message ||
      'Employee recognized.',
  }
}