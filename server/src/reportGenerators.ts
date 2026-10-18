import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import type { AttendanceReport } from './reportsService'

const COLUMNS = [
  { header: 'No.', key: 'number', width: 7 },
  { header: 'Student ID', key: 'nis', width: 16 },
  { header: 'Student Name', key: 'name', width: 28 },
  { header: 'Sessions', key: 'sessions', width: 12 },
  { header: 'Present', key: 'present', width: 12 },
  { header: 'Sick', key: 'sick', width: 12 },
  { header: 'Permitted', key: 'permitted', width: 12 },
  { header: 'Absent', key: 'absent', width: 12 },
  { header: 'Unrecorded', key: 'unrecorded', width: 14 },
  { header: 'Attendance Rate', key: 'attendanceRate', width: 20 },
] as const

function studentCells(
  student: AttendanceReport['students'][number],
  index: number
): (string | number)[] {
  return [
    index + 1,
    student.nis,
    student.name,
    student.sessions,
    student.present,
    student.sick,
    student.permitted,
    student.absent,
    student.unrecorded,
    student.attendanceRate,
  ]
}

function setDownloadHeaders(response: Response, contentType: string, filename: string) {
  response.setHeader('Content-Type', contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  response.setHeader('Cache-Control', 'no-store')
}

export async function streamAttendanceXlsx(
  response: Response,
  report: AttendanceReport,
  filename: string
): Promise<void> {
  setDownloadHeaders(
    response,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename
  )

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: response,
    useStyles: true,
    useSharedStrings: false,
  })
  workbook.creator = 'SAMS'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Attendance Report', {
    views: [{ state: 'frozen', ySplit: 6 }],
  })
  worksheet.columns = COLUMNS.map((column, columnIndex) => {
    const contentWidths = report.students.map((student, index) =>
      String(studentCells(student, index)[columnIndex]).length + 2
    )
    const maximumWidth = columnIndex === 2 ? 42 : 32
    const width = Math.min(maximumWidth, Math.max(8, column.header.length + 2, ...contentWidths))
    return { ...column, width }
  })
  worksheet.addRow(['Class Attendance Report']).commit()
  worksheet.addRow([`Class: ${report.className} (Grade ${report.gradeLevel})`]).commit()
  worksheet.addRow([`Date range: ${report.startDate} to ${report.endDate}`]).commit()
  worksheet.addRow([`Class sessions: ${report.classSessionCount}`]).commit()
  worksheet.addRow([
    `Overall attendance rate: ${(report.totals.attendanceRate * 100).toFixed(1)}%`,
  ]).commit()
  worksheet.addRow([]).commit()

  const header = worksheet.addRow(COLUMNS.map((column) => column.header))
  header.height = 24
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B5B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C8C3' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C8C3' } },
      left: { style: 'thin', color: { argb: 'FFB8C8C3' } },
      right: { style: 'thin', color: { argb: 'FFB8C8C3' } },
    }
  })
  header.commit()

  report.students.forEach((student, index) => {
    const row = worksheet.addRow(studentCells(student, index))
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFD8E1DE' } },
        bottom: { style: 'hair', color: { argb: 'FFD8E1DE' } },
        left: { style: 'hair', color: { argb: 'FFD8E1DE' } },
        right: { style: 'hair', color: { argb: 'FFD8E1DE' } },
      }
    })
    row.getCell(10).numFmt = '0.0%'
    row.commit()
  })

  const totalRow = worksheet.addRow([
    'Total',
    '',
    '',
    report.totals.sessions,
    report.totals.present,
    report.totals.sick,
    report.totals.permitted,
    report.totals.absent,
    report.totals.unrecorded,
    report.totals.attendanceRate,
  ])
  totalRow.font = { bold: true }
  totalRow.getCell(10).numFmt = '0.0%'
  totalRow.commit()

  await workbook.commit()
}

export function streamAttendancePdf(
  response: Response,
  report: AttendanceReport,
  filename: string
): Promise<void> {
  setDownloadHeaders(response, 'application/pdf', filename)

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: false })
    document.on('error', reject)
    response.on('finish', resolve)
    response.on('error', reject)
    document.pipe(response)

    const pageWidth = document.page.width - 64
    const widths = [28, 62, 145, 48, 48, 42, 54, 46, 60, 72]
    const tableWidth = widths.reduce((sum, width) => sum + width, 0)
    const tableLeft = (document.page.width - tableWidth) / 2
    const rowHeight = 19
    const headers = COLUMNS.map((column) => column.header)

    const drawTableHeader = () => {
      let x = tableLeft
      const { y } = document
      headers.forEach((label, index) => {
        document.rect(x, y, widths[index], rowHeight).fillAndStroke('#176B5B', '#CBD7D3')
        document.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
          .text(label, x + 3, y + 6, { width: widths[index] - 6, align: index === 2 ? 'left' : 'center', lineBreak: false })
        x += widths[index]
      })
      document.y = y + rowHeight
    }

    document.fillColor('#17332D').font('Helvetica-Bold').fontSize(20)
      .text('Class Attendance Report', 40, 32, { width: pageWidth })
    document.moveDown(0.35)
    document.fillColor('#40544F').font('Helvetica').fontSize(10)
      .text(`Class: ${report.className} (Grade ${report.gradeLevel})`)
      .text(`Date range: ${report.startDate} to ${report.endDate}`)
      .text(`Class sessions: ${report.classSessionCount}`)

    const summaryY = document.y + 12
    const summaryItems = [
      ['Students', String(report.students.length)],
      ['Attendance rate', `${(report.totals.attendanceRate * 100).toFixed(1)}%`],
      ['Present records', String(report.totals.present)],
      ['Unrecorded', String(report.totals.unrecorded)],
    ]
    const summaryGap = 10
    const summaryWidth = (pageWidth - summaryGap * (summaryItems.length - 1)) / summaryItems.length
    summaryItems.forEach(([label, value], index) => {
      const x = 32 + index * (summaryWidth + summaryGap)
      document.roundedRect(x, summaryY, summaryWidth, 43, 3).fillAndStroke('#F0F5F3', '#D5E0DC')
      document.fillColor('#58716A').font('Helvetica').fontSize(8).text(label, x + 10, summaryY + 8)
      document.fillColor('#17332D').font('Helvetica-Bold').fontSize(14).text(value, x + 10, summaryY + 21)
    })
    document.y = summaryY + 56
    drawTableHeader()

    const rows = report.students.map((student, index) => [
      String(index + 1), student.nis, student.name, String(student.sessions),
      String(student.present), String(student.sick), String(student.permitted),
      String(student.absent), String(student.unrecorded), `${(student.attendanceRate * 100).toFixed(1)}%`,
    ])
    rows.push([
      'Total', '', '', String(report.totals.sessions), String(report.totals.present),
      String(report.totals.sick), String(report.totals.permitted), String(report.totals.absent),
      String(report.totals.unrecorded), `${(report.totals.attendanceRate * 100).toFixed(1)}%`,
    ])

    rows.forEach((values, rowIndex) => {
      if (document.y + rowHeight > document.page.height - 32) {
        document.addPage()
        document.y = 32
        drawTableHeader()
      }

      let x = tableLeft
      const { y } = document
      const isTotal = rowIndex === rows.length - 1
      values.forEach((value, index) => {
        const fill = isTotal ? '#E6EFEC' : rowIndex % 2 === 0 ? '#FFFFFF' : '#F6F8F7'
        document.rect(x, y, widths[index], rowHeight).fillAndStroke(fill, '#D8E1DE')
        document.fillColor('#263B35').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
          .text(value, x + 3, y + 6, {
            width: widths[index] - 6,
            align: index === 2 ? 'left' : index < 3 ? 'left' : 'center',
            lineBreak: false,
            ellipsis: true,
          })
        x += widths[index]
      })
      document.y = y + rowHeight
    })

    document.end()
  })
}