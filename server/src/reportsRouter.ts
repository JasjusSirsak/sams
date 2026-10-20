import { Router, type Request, type Response } from 'express'
import { requireAuth, requireRole } from './auth'
import prisma from './db'
import { streamAttendancePdf, streamAttendanceXlsx } from './reportGenerators'
import { getAttendanceReport } from './reportsService'
import { createAttendanceReportPdf } from './reports/attendanceReport'

const reportsRouter = Router()

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  if (value.match(/^\d{4}-\d{2}-\d{2}$/) === null) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  if (date.toISOString().slice(0, 10) !== value) return null
  return date
}

function safeFilenamePart(value: string): string {
  const filenamePart = value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  if (filenamePart.length === 0) return 'class'
  return filenamePart
}

reportsRouter.get(
  '/attendance',
  requireAuth,
  requireRole('teacher', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    const { classId, startDate: rawStartDate, endDate: rawEndDate, format } = req.query

    if (typeof classId !== 'string') {
      return res.status(400).json({ message: 'classId must be a positive integer.' })
    }
    if (classId.match(/^[1-9]\d*$/) === null) {
      return res.status(400).json({ message: 'classId must be a positive integer.' })
    }
    const parsedClassId = BigInt(classId)
    if (parsedClassId > 9223372036854775807n) {
      return res.status(400).json({ message: 'classId is outside the supported integer range.' })
    }

    const startDate = parseDate(rawStartDate)
    const endDate = parseDate(rawEndDate)
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate must use YYYY-MM-DD format.' })
    }
    if (startDate > endDate) {
      return res.status(400).json({ message: 'startDate must be on or before endDate.' })
    }
    if (format !== 'pdf' && format !== 'xlsx') {
      return res.status(400).json({ message: 'format must be either pdf or xlsx.' })
    }

    try {
      const report = await getAttendanceReport(
        parsedClassId,
        startDate,
        endDate,
        req.user!.userId,
        req.user!.role
      )

      if (!report) {
        return res.status(404).json({ message: 'No attendance sessions found for this class and date range.' })
      }

      const filename = `attendance-${safeFilenamePart(report.className)}-${report.startDate}-to-${report.endDate}.${format}`
      if (format === 'pdf') {
        await streamAttendancePdf(res, report, filename)
      } else {
        await streamAttendanceXlsx(res, report, filename)
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_CLASS_SCOPE') {
        return res.status(403).json({ message: 'You are not assigned to this class for the selected period.' })
      }

      console.error('Failed to generate attendance report:', error)
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined)
        return
      }
      return res.status(500).json({ message: 'Failed to generate attendance report.' })
    }
  }
)

reportsRouter.get(
  '/attendance/:classId',
  requireAuth,
  requireRole('teacher', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    const { classId: rawClassId } = req.params
    if (typeof rawClassId !== 'string' || !/^[1-9]\d*$/.test(rawClassId)) {
      return res.status(400).json({ message: 'classId must be a positive integer.' })
    }

    const classId = BigInt(rawClassId)
    if (classId > 9223372036854775807n) {
      return res.status(400).json({ message: 'classId is outside the supported integer range.' })
    }

    const rawStartDate = req.query.startDate
    const rawEndDate = req.query.endDate
    const format = req.query.format ?? 'pdf'
    if (format !== 'pdf' && format !== 'xlsx') {
      return res.status(400).json({ message: 'format must be either pdf or xlsx.' })
    }
    if ((rawStartDate === undefined) !== (rawEndDate === undefined)) {
      return res.status(400).json({ message: 'startDate and endDate must be provided together.' })
    }

    try {
      const classInfo = await prisma.classes.findUnique({
        where: { class_id: classId },
        select: { class_id: true },
      })
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found.' })
      }

      let startDate: Date
      let endDate: Date

      if (rawStartDate !== undefined && rawEndDate !== undefined) {
        const parsedStartDate = parseDate(rawStartDate)
        const parsedEndDate = parseDate(rawEndDate)
        if (!parsedStartDate || !parsedEndDate) {
          return res.status(400).json({ message: 'startDate and endDate must use YYYY-MM-DD format.' })
        }
        if (parsedStartDate > parsedEndDate) {
          return res.status(400).json({ message: 'startDate must be on or before endDate.' })
        }
        startDate = parsedStartDate
        endDate = parsedEndDate
      } else {
        const latestEnrollment = await prisma.student_enrollments.findFirst({
          where: { class_id: classId },
          orderBy: { academic_period_id: 'desc' },
          select: {
            academic_periods: {
              select: { start_date: true, end_date: true },
            },
          },
        })

        if (latestEnrollment) {
          startDate = latestEnrollment.academic_periods.start_date
          endDate = latestEnrollment.academic_periods.end_date
        } else if (['staff', 'admin'].includes(req.user!.role.toLowerCase())) {
          const [firstSession, lastSession] = await Promise.all([
            prisma.attendance_sessions.findFirst({
              where: { class_id: classId },
              orderBy: { attendance_date: 'asc' },
              select: { attendance_date: true },
            }),
            prisma.attendance_sessions.findFirst({
              where: { class_id: classId },
              orderBy: { attendance_date: 'desc' },
              select: { attendance_date: true },
            }),
          ])

          if (!firstSession || !lastSession) {
            return res.status(404).json({ message: 'No attendance data found for this class.' })
          }
          startDate = firstSession.attendance_date
          endDate = lastSession.attendance_date
        } else {
          return res.status(404).json({ message: 'No academic period found for this class.' })
        }
      }

      const report = await getAttendanceReport(
        classId,
        startDate,
        endDate,
        req.user!.userId,
        req.user!.role
      )
      if (!report) {
        return res.status(404).json({ message: 'No attendance data found for this class and period.' })
      }

      const filename = `attendance-report-${rawClassId}.${format}`
      if (format === 'pdf') {
        const pdf = await createAttendanceReportPdf(report)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', pdf.length)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).send(pdf)
      } else {
        await streamAttendanceXlsx(res, report, filename)
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_CLASS_SCOPE') {
        return res.status(403).json({ message: 'You are not assigned to this class for the selected period.' })
      }

      console.error('Failed to generate class attendance PDF:', error)
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined)
        return
      }
      return res.status(500).json({ message: 'Failed to generate class attendance PDF.' })
    }
  }
)

export default reportsRouter