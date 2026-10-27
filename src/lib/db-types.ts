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
