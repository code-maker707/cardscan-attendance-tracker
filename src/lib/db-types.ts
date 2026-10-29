// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type AttendanceRecordsRow = {
  id: string
  userId: string
  studentId: string
  studentName: string
  studentCode: string
  className: string
  attendanceDate: string
  scannedAt: string
  method: string
  checkedOutAt: string | null
}

export type StudentsRow = {
  id: string
  userId: string
  studentCode: string
  name: string
  grade: string
  section: string
  createdAt: string
}

export type UsersRow = {
  id: string
  email: string
  emailVerified: number | string | null
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  phoneVerified: number | string | null
  role: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
  lastSignIn: string
}
