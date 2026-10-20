import { Router, type Request, type Response } from 'express'
import { requireAuth, requireRole } from './auth'
import { getGradesByClassAndSubject, saveGrades } from './services/gradesService'

const gradesRouter = Router()

function sendResult(res: Response, result: { statusCode: number; body: unknown }) {
  return res.status(result.statusCode).json(result.body)
}

function sendInternalError(res: Response, message: string, error: unknown) {
  console.error(message, error)
  return res.status(500).json({ message: 'Internal server error.' })
}

gradesRouter.post(
  '/',
  requireAuth,
  requireRole('teacher', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      return sendResult(res, await saveGrades(req.body, req.user!))
    } catch (error) {
      return sendInternalError(res, 'Failed to save student grades:', error)
    }
  }
)

gradesRouter.get(
  '/class/:classId/subject/:subjectId',
  requireAuth,
  requireRole('teacher', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      return sendResult(
        res,
        await getGradesByClassAndSubject(
          req.params.classId,
          req.params.subjectId,
          {
            assessment_name: req.query.assessment_name,
            assessment_type: req.query.assessment_type,
          },
          req.user!
        )
      )
    } catch (error) {
      return sendInternalError(res, 'Failed to retrieve grades for class and subject:', error)
    }
  }
)

export default gradesRouter
