import { Router } from 'express'
import { requireAuth } from './auth'
import { getChildAttendance, getChildGrades, getParentChildren } from './parentController'
import { requireParentRole } from './parentAuth'

const parentRouter = Router()

parentRouter.use(requireAuth, requireParentRole)

parentRouter.get(['/', '/children'], getParentChildren)
parentRouter.get('/children/:studentId/attendance', getChildAttendance)
parentRouter.get('/children/:studentId/grades', getChildGrades)

export default parentRouter
