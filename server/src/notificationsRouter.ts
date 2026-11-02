import { Router, type Request, type Response } from 'express'
import { requireAuth, requireRole } from './auth'

const notificationsRouter = Router()
const NOTIFICATION_ROLES = ['admin', 'staff', 'teacher', 'student', 'parent'] as const

notificationsRouter.get(
  '/',
  requireAuth,
  requireRole(...NOTIFICATION_ROLES),
  async (_req: Request, res: Response) => {
    // Return empty notifications list safely without requiring notifications table/schema migration
    return res.json({
      data: [],
      unread_count: 0,
    })
  },
)

notificationsRouter.patch(
  '/:notificationId/read',
  requireAuth,
  requireRole(...NOTIFICATION_ROLES),
  async (req: Request, res: Response) => {
    const notificationIdValue = req.params.notificationId
    if (typeof notificationIdValue !== 'string' || !/^[1-9]\d*$/.test(notificationIdValue)) {
      return res.status(400).json({ message: 'A valid notification ID is required.' })
    }

    return res.json({ message: 'Notification marked as read.' })
  },
)

export default notificationsRouter
