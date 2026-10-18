import PDFDocument from 'pdfkit'
import type { AttendanceReport } from '../reportsService'

export function createAttendanceReportPdf(report: AttendanceReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 })
    const chunks: Buffer[] = []

    document.on('data', (chunk: Buffer) => chunks.push(chunk))
    document.on('error', reject)
    document.on('end', () => resolve(Buffer.concat(chunks)))

    document.fontSize(20).font('Helvetica-Bold').text('Class Attendance Report')
    document.moveDown(0.5)
    document.fontSize(11).font('Helvetica')
      .text(`Class: ${report.className} (Grade ${report.gradeLevel})`)
      .text(`Period: ${report.startDate} to ${report.endDate}`)
      .text(`Class sessions: ${report.classSessionCount}`)
      .text(`Generated: ${new Date().toLocaleDateString('en-GB')}`)
    document.moveDown()

    const columns = [
      { label: 'No.', width: 36 },
      { label: 'Student ID', width: 90 },
      { label: 'Student Name', width: 190 },
      { label: 'Present', width: 70 },
      { label: 'Sick', width: 60 },
      { label: 'Permitted', width: 80 },
      { label: 'Absent', width: 70 },
      { label: 'Rate', width: 70 },
    ]
    const tableWidth = columns.reduce((total, column) => total + column.width, 0)
    const left = (document.page.width - tableWidth) / 2
    const rowHeight = 22

    function drawRow(values: string[], bold = false, fill = '#FFFFFF') {
      let x = left
      const y = document.y
      values.forEach((value, index) => {
        document.rect(x, y, columns[index].width, rowHeight).fillAndStroke(fill, '#CBD5D1')
        document.fillColor('#17332D')
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .text(value, x + 5, y + 7, {
            width: columns[index].width - 10,
            align: index === 2 ? 'left' : index < 3 ? 'left' : 'center',
            lineBreak: false,
            ellipsis: true,
          })
        x += columns[index].width
      })
      document.y = y + rowHeight
    }

    drawRow(columns.map((column) => column.label), true, '#E6EFEC')
    report.students.forEach((student, index) => {
      if (document.y + rowHeight > document.page.height - 36) {
        document.addPage()
        document.y = 36
        drawRow(columns.map((column) => column.label), true, '#E6EFEC')
      }
      if (document.y + rowHeight > document.page.height - 36) {
        document.addPage()
        document.y = 36
        drawRow(columns.map((column) => column.label), true, '#E6EFEC')
      }
      drawRow([
        String(index + 1),
        student.nis,
        student.name,
        String(student.present),
        String(student.sick),
        String(student.permitted),
        String(student.absent),
        `${(student.attendanceRate * 100).toFixed(1)}%`,
      ], false, index % 2 === 0 ? '#FFFFFF' : '#F6F8F7')
    })

    drawRow([
      'Total',
      '',
      '',
      String(report.totals.present),
      String(report.totals.sick),
      String(report.totals.permitted),
      String(report.totals.absent),
      `${(report.totals.attendanceRate * 100).toFixed(1)}%`,
    ], true, '#E6EFEC')

    document.end()
  })
}
