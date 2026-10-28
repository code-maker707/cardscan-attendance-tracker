import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, CalendarDays, Camera, Check,
  CheckCircle2, ChevronDown, Clock3, GraduationCap, LayoutDashboard,
  LogOut, Plus, Search, ShieldCheck, Users, X,
} from 'lucide-react'
import { blink } from '@/blink/client'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import type { AttendanceRecordsRow, StudentsRow } from '@/lib/db-types'

const studentTable = blink.db.table<StudentsRow>('students')
const attendanceTable = blink.db.table<AttendanceRecordsRow>('attendance_records')
const classOptions = ['Grade 8 · Section A', 'Grade 8 · Section B']
const sampleStudents = [
  { studentCode: '2401', name: 'Ayesha Khan', grade: 'Grade 8', section: 'A' },
  { studentCode: '2402', name: 'Muhammad Ali', grade: 'Grade 8', section: 'A' },
  { studentCode: '2403', name: 'Fatima Ahmed', grade: 'Grade 8', section: 'A' },
  { studentCode: '2404', name: 'Hassan Raza', grade: 'Grade 8', section: 'A' },
  { studentCode: '2405', name: 'Zainab Malik', grade: 'Grade 8', section: 'A' },
  { studentCode: '2406', name: 'Hamza Iqbal', grade: 'Grade 8', section: 'A' },
  { studentCode: '2407', name: 'Maryam Shah', grade: 'Grade 8', section: 'A' },
  { studentCode: '2408', name: 'Usman Tariq', grade: 'Grade 8', section: 'A' },
  { studentCode: '2409', name: 'Sana Qureshi', grade: 'Grade 8', section: 'A' },
  { studentCode: '2410', name: 'Bilal Hussain', grade: 'Grade 8', section: 'A' },
  { studentCode: '2411', name: 'Hira Javed', grade: 'Grade 8', section: 'B' },
  { studentCode: '2412', name: 'Ahmed Nawaz', grade: 'Grade 8', section: 'B' },
  { studentCode: '2413', name: 'Noor Siddiqui', grade: 'Grade 8', section: 'B' },
  { studentCode: '2414', name: 'Daniyal Sheikh', grade: 'Grade 8', section: 'B' },
]

function todayKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Rollcall · Attendance, made simple' },
      { name: 'description', content: 'Scan student cards and see classroom attendance update in real time.' },
    ],
  }),
  component: () => <BlinkClientBoundary fallback={<LoadingScreen />}><AttendanceApp /></BlinkClientBoundary>,
})

function LoadingScreen() {
  return <div className="flex min-h-dvh items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" /></div>
}

function AttendanceApp() {
  const [user, setUser] = useState<{ id: string; email?: string; displayName?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [students, setStudents] = useState<StudentsRow[]>([])
  const [records, setRecords] = useState<AttendanceRecordsRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [view, setView] = useState<'attendance' | 'students'>('attendance')
  const [className, setClassName] = useState(classOptions[0])
  const [search, setSearch] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [newStudentCode, setNewStudentCode] = useState('')
  const [saving, setSaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => blink.auth.onAuthStateChanged((state) => {
    setUser(state.user ? { id: state.user.id, email: state.user.email, displayName: state.user.displayName } : null)
    if (!state.isLoading) setAuthLoading(false)
  }), [])

  const loadData = useCallback(async (userId: string) => {
    try {
      let roster = await studentTable.list({ where: { userId }, orderBy: { name: 'asc' } })
      if (roster.length === 0) {
        await studentTable.createMany(sampleStudents.map((student) => ({ ...student, userId, createdAt: new Date().toISOString() })))
        roster = await studentTable.list({ where: { userId }, orderBy: { name: 'asc' } })
      }
      setStudents(roster)
      setRecords(await attendanceTable.list({ where: { userId, attendanceDate: todayKey() }, orderBy: { scannedAt: 'desc' } }))
    } catch (error) {
      toast.error(messageOf(error))
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => { void loadData(user.id) }, 0)
    return () => window.clearTimeout(timer)
  }, [user, loadData])

  const markPresent = useCallback(async (rawCode: string, method: string) => {
    if (!user) return
    const code = rawCode.trim().toUpperCase()
    const student = students.find((item) => item.studentCode.toUpperCase() === code)
    if (!student) {
      toast.error(`No student found for card ${code || 'without an ID'}.`)
      return
    }
    if (records.some((item) => item.studentCode.toUpperCase() === code && item.className === className)) {
      toast.info(`${student.name} is already marked present.`)
      return
    }
    setSaving(true)
    try {
      await attendanceTable.create({ userId: user.id, studentId: student.id, studentName: student.name, studentCode: student.studentCode, className, attendanceDate: todayKey(), scannedAt: new Date().toISOString(), method })
      setRecords(await attendanceTable.list({ where: { userId: user.id, attendanceDate: todayKey() }, orderBy: { scannedAt: 'desc' } }))
      setStudentCode('')
      toast.success(`${student.name} marked present`)
    } catch (error) {
      toast.error(messageOf(error))
    } finally {
      setSaving(false)
    }
  }, [className, records, students, user])

  useEffect(() => {
    if (!scanning || !videoRef.current) return
    let active = true
    let controls: { stop: () => void } | undefined
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (!active || !videoRef.current) return
      const reader = new BrowserQRCodeReader()
      return reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result && active) {
          active = false
          controls?.stop()
          scannerRef.current?.stop()
          setScanning(false)
          void markPresent(result.getText(), 'QR card')
        }
      }).then((createdControls) => {
        controls = createdControls
        scannerRef.current = createdControls
      })
    }).catch((error: unknown) => {
      if (active) {
        setScanning(false)
        toast.error(`Camera could not start: ${messageOf(error)}`)
      }
    })
    return () => {
      active = false
      controls?.stop()
      scannerRef.current?.stop()
      scannerRef.current = null
    }
  }, [scanning, markPresent])

  const classStudents = useMemo(() => {
    const section = className.endsWith('B') ? 'B' : 'A'
    return students.filter((student) => student.section === section)
  }, [className, students])
  const classRecords = useMemo(() => records.filter((record) => record.className === className), [className, records])
  const presentCodes = useMemo(() => new Set(records.map((record) => record.studentCode)), [records])
  const filteredStudents = students.filter((student) => `${student.name} ${student.studentCode}`.toLowerCase().includes(search.toLowerCase()))
  const sampleRosterRows = students.filter((student) => sampleStudents.some((sample) => sample.studentCode === student.studentCode && sample.name === student.name))
  const percent = classStudents.length ? Math.round(classRecords.length / classStudents.length * 100) : 0
  const teacherName = user?.displayName?.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim() || ''
  const greetingName = teacherName.split(/\s+/)[0]

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (studentCode.trim()) void markPresent(studentCode, 'Card ID')
  }

  const submitStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !studentName.trim() || !newStudentCode.trim()) return
    setSaving(true)
    try {
      await studentTable.create({ userId: user.id, name: studentName.trim(), studentCode: newStudentCode.trim().toUpperCase(), grade: 'Grade 8', section: className.endsWith('B') ? 'B' : 'A', createdAt: new Date().toISOString() })
      setStudents(await studentTable.list({ where: { userId: user.id }, orderBy: { name: 'asc' } }))
      setStudentName('')
      setNewStudentCode('')
      setAddingStudent(false)
      toast.success('Student added to the class roster')
    } catch (error) {
      toast.error(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  const removeSampleRoster = async () => {
    if (!user || sampleRosterRows.length === 0) return
    setSaving(true)
    try {
      await Promise.all(sampleRosterRows.map((student) => studentTable.delete(student.id)))
      setStudents(await studentTable.list({ where: { userId: user.id }, orderBy: { name: 'asc' } }))
      toast.success('Sample students removed. Add your class roster when you’re ready.')
    } catch (error) {
      toast.error(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) return <LoadingScreen />
  if (!user) return <SignInScreen />

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-card px-5 py-6 lg:flex">
          <Brand />
          <div className="mt-12 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <nav className="mt-3 space-y-1" aria-label="Main navigation">
            <button onClick={() => setView('attendance')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === 'attendance' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><LayoutDashboard size={17} /> Attendance</button>
            <button onClick={() => setView('students')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === 'students' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Users size={17} /> Students <span className="ml-auto rounded-md bg-background/15 px-2 py-0.5 text-xs">{students.length}</span></button>
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-background p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-primary" /> Your records are private</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Attendance and rosters are saved securely to your account.</p></div>
          <button onClick={() => void blink.auth.logout()} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><LogOut size={16} /> Sign out</button>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-12 sm:px-7 lg:px-10">
          <header className="flex h-[76px] items-center justify-between border-b border-border">
            <div className="flex items-center gap-3 lg:hidden"><Brand compact /></div>
            <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex"><CalendarDays size={15} />{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-sm font-semibold">{teacherName || 'Teacher'}</div><div className="text-xs text-muted-foreground">Classroom educator</div></div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-serif text-sm font-semibold text-accent-foreground">{(teacherName || user.email || 'T').slice(0, 1).toUpperCase()}</div></div>
          </header>

          <nav className="mt-4 grid grid-cols-2 gap-2 lg:hidden" aria-label="Main navigation"><button onClick={() => setView('attendance')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${view === 'attendance' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}><LayoutDashboard size={16} /> Attendance</button><button onClick={() => setView('students')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${view === 'students' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}><Users size={16} /> Students</button></nav>

          <div className="mb-8 mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Classroom overview</div><h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Good morning{greetingName ? `, ${greetingName}` : ''}.</h1><p className="mt-2 text-sm text-muted-foreground">A clear picture of who's here today.</p></div>
            <label className="relative flex h-11 min-w-56 items-center rounded-xl border border-border bg-card px-3 shadow-sm"><BookOpen size={16} className="mr-2 shrink-0 text-primary" /><select value={className} onChange={(event) => setClassName(event.target.value)} className="w-full appearance-none bg-transparent pr-6 text-sm font-semibold outline-none">{classOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 text-muted-foreground" /></label>
          </div>

          {sampleRosterRows.length > 0 && <div className="mb-5 flex flex-col gap-3 rounded-xl border border-accent/70 bg-accent/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Starter roster loaded</p><p className="mt-0.5 text-xs text-muted-foreground">These example students help you preview attendance. Remove them before adding your real class.</p></div><button onClick={() => void removeSampleRoster()} disabled={saving} className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition hover:bg-secondary disabled:opacity-50">Remove {sampleRosterRows.length} sample students</button></div>}

          {view === 'attendance' ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Attendance summary">
                <StatCard label="Present today" value={`${classRecords.length}`} note={`of ${classStudents.length} students`} icon={<Users size={18} />} trend={<ArrowUpRight size={15} />} />
                <StatCard label="Attendance rate" value={`${percent}%`} note="for this class today" icon={<CheckCircle2 size={18} />} trend={percent >= 75 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} />
                <StatCard label="Not yet checked in" value={`${Math.max(0, classStudents.length - classRecords.length)}`} note="students expected" icon={<Clock3 size={18} />} />
                <StatCard label="Class roster" value={`${classStudents.length}`} note={className.replace(' · ', ' / ')} icon={<GraduationCap size={18} />} />
              </section>

              <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.9fr)]">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><h2 className="font-serif text-xl">Class check-in</h2><p className="mt-1 text-xs text-muted-foreground">Scan a student card to mark them present.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">{className}</span></div>
                  <div className="p-5 sm:p-6">
                    <div className={`relative flex min-h-[215px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed ${scanning ? 'border-primary bg-foreground' : 'border-border bg-background'}`}>
                      {scanning ? <><video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline /><div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative h-40 w-40 rounded-2xl border-2 border-primary shadow-[0_0_0_999px_rgba(0,0,0,0.32)]"><span className="absolute -top-1 left-1/2 h-0.5 w-2/3 -translate-x-1/2 animate-pulse bg-primary" /></div></div><div className="absolute bottom-3 rounded-full bg-foreground/75 px-3 py-1.5 text-xs font-medium text-background">Point the camera at a student QR card</div></> : <><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Camera size={24} /></div><p className="text-sm font-semibold">Ready to scan</p><p className="mt-1 max-w-xs text-center text-xs leading-5 text-muted-foreground">Use your device camera to read a QR code printed on a student card.</p><button onClick={() => setScanning(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] active:scale-[0.98]"><Camera size={15} /> Open camera</button></>}
                    </div>
                    {scanning && <button onClick={() => { scannerRef.current?.stop(); setScanning(false) }} className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-medium hover:bg-secondary">Stop camera</button>}
                    <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="h-px flex-1 bg-border" />or enter card ID<span className="h-px flex-1 bg-border" /></div>
                    <form onSubmit={submitCode} className="flex gap-2"><label className="sr-only" htmlFor="student-code">Student card ID</label><input id="student-code" value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="e.g. 2401" className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring" /><button disabled={!studentCode.trim() || saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} /> Mark present</button></form>
                    <p className="mt-2 text-[11px] text-muted-foreground">QR codes should contain the student's card ID. You can also type the ID above.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-serif text-xl">Today’s attendance</h2><p className="mt-1 text-xs text-muted-foreground">Live check-ins for this class</p></div><button onClick={() => setView('students')} className="text-xs font-semibold text-primary hover:underline">View roster</button></div>
                  <div className="divide-y divide-border">{dataLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : classRecords.length ? classRecords.slice(0, 7).map((record) => <div key={record.id} className="flex items-center gap-3 px-5 py-3.5"><AvatarName name={record.studentName} code={record.studentCode} /><span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{new Date(record.scannedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>) : <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary"><CalendarDays size={19} /></div><p className="text-sm font-semibold">A fresh start</p><p className="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">Student check-ins will appear here as cards are scanned.</p></div>}</div>
                  {classRecords.length > 7 && <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">And {classRecords.length - 7} more students checked in</div>}
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><h2 className="font-serif text-xl">Your students</h2><p className="mt-1 text-xs text-muted-foreground">A quick look at today’s class roster</p></div><button onClick={() => setAddingStudent(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-secondary"><Plus size={15} /> Add student</button></div>
                <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">{classStudents.slice(0, 6).map((student) => <StudentRow key={student.id} student={student} present={presentCodes.has(student.studentCode)} onMark={() => void markPresent(student.studentCode, 'Roster')} />)}</div>
                {classStudents.length > 6 && <button onClick={() => setView('students')} className="w-full border-t border-border py-3 text-xs font-semibold text-primary hover:bg-secondary/60">See all {classStudents.length} students</button>}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Classroom directory</div><h2 className="font-serif text-2xl">Student roster</h2><p className="mt-1 text-sm text-muted-foreground">Manage card IDs and check-in status.</p></div><button onClick={() => setAddingStudent(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] active:scale-[0.98]"><Plus size={16} /> Add student</button></div>
              <div className="flex items-center gap-2 border-b border-border px-5 py-3"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students or card IDs" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div>
              <div className="divide-y divide-border">{filteredStudents.map((student) => <div key={student.id} className="flex items-center gap-3 px-5 py-4 sm:px-6"><AvatarName name={student.name} code={student.studentCode} /><span className="hidden rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground sm:inline">{student.grade} · Section {student.section}</span><span className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold">{presentCodes.has(student.studentCode) ? <span className="text-primary">Present</span> : <span className="text-muted-foreground">Not checked in</span>}</span><button onClick={() => void markPresent(student.studentCode, 'Roster')} disabled={presentCodes.has(student.studentCode)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-secondary disabled:opacity-50">{presentCodes.has(student.studentCode) ? 'Checked in' : 'Mark present'}</button></div>)}{filteredStudents.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No students match that search.</p>}</div>
            </section>
          )}
          <footer className="mt-10 flex items-center justify-between border-t border-border pt-5 text-[11px] text-muted-foreground"><span>Rollcall · Attendance, made simple</span><span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Private to your account</span></footer>
        </main>
      </div>

      {addingStudent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddingStudent(false) }}><div role="dialog" aria-modal="true" aria-labelledby="add-student-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><GraduationCap size={19} /></div><h2 id="add-student-title" className="font-serif text-2xl">Add a student</h2><p className="mt-1 text-sm text-muted-foreground">Add their name and the ID printed on their card.</p></div><button onClick={() => setAddingStudent(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X size={18} /></button></div><form onSubmit={submitStudent} className="space-y-4"><label className="block text-sm font-medium">Student name<input required value={studentName} onChange={(event) => setStudentName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Amara Johnson" /></label><label className="block text-sm font-medium">Card ID<input required value={newStudentCode} onChange={(event) => setNewStudentCode(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. 2415" /></label><div className="flex gap-2 pt-2"><button type="button" onClick={() => setAddingStudent(false)} className="h-11 flex-1 rounded-lg border border-border text-sm font-semibold hover:bg-secondary">Cancel</button><button disabled={saving} className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : 'Add to roster'}</button></div></form></div></div>}
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap size={21} /></div>{!compact && <div><div className="font-serif text-xl font-semibold leading-none">rollcall</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Classroom tools</div></div>}</div>
}

function StatCard({ label, value, note, icon, trend }: { label: string; value: string; note: string; icon: ReactNode; trend?: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">{icon}</span></div><div className="mt-4 flex items-baseline gap-2"><span className="font-serif text-3xl font-semibold tracking-tight">{value}</span>{trend && <span className="text-primary">{trend}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>
}

function AvatarName({ name, code }: { name: string; code: string }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{initials}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{name}</div><div className="font-mono text-[10px] tracking-wide text-muted-foreground">ID {code}</div></div></div>
}

function StudentRow({ student, present, onMark }: { student: StudentsRow; present: boolean; onMark: () => void }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3"><AvatarName name={student.name} code={student.studentCode} /><button onClick={onMark} disabled={present} className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${present ? 'bg-secondary text-primary' : 'border border-border hover:bg-secondary'}`}>{present ? <><Check size={13} /> Present</> : 'Mark present'}</button></div>
}

function SignInScreen() {
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-lg sm:p-9"><Brand /><div className="mt-10"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"><ShieldCheck size={14} /> Private classroom workspace</div><h1 className="font-serif text-3xl font-medium leading-tight">Every student counted.<br />Every morning, simpler.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to scan student cards, manage your roster, and keep a reliable attendance record.</p><button onClick={() => blink.auth.login(window.location.href)} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:scale-[1.01] active:scale-[0.99]">Continue with Blink <ArrowUpRight size={16} /></button><div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} /> Your student records stay private to your account</div></div></div></main>
}

