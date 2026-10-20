import prisma from '../db'

export function getJakartaDate(date = new Date()): Date {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]))

  return new Date(`${dateValues.year}-${dateValues.month}-${dateValues.day}T00:00:00.000Z`)
}

export async function getActivePeriod(date = new Date()) {
  const activeDate = getJakartaDate(date)
  return prisma.academic_periods.findFirst({
    where: {
      start_date: { lte: activeDate },
      end_date: { gte: activeDate },
    },
    orderBy: { start_date: 'desc' },
  })
}
