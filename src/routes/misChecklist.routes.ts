import { Router } from 'express'
import {
  getMisChecklistTasks,
  getMisChecklistStats,
  getMisChecklistSections,
  completeMisChecklistTask,
  getMisTaskHistory
} from '../controllers/misChecklist.controller'
import { authMiddleware } from '../middleware/authMiddleware'

const router = Router()

// Apply auth middleware to all routes
router.use(authMiddleware)

/**
 * GET /api/mis-checklist
 * Fetch paginated MIS checklist tasks with filters
 * User sees own tasks, admin sees all by default (can filter by userId)
 */
router.get('/', getMisChecklistTasks)

/**
 * GET /api/mis-checklist/stats
 * Get aggregated stats (total, completed, pending, overdue) with section breakdown
 */
router.get('/stats', getMisChecklistStats)

/**
 * GET /api/mis-checklist/sections
 * Get list of distinct sections for dropdown filter
 */
router.get('/sections', getMisChecklistSections)

/**
 * GET /api/mis-checklist/history/:id
 * Get completion history for a specific task
 */
router.get('/history/:id', getMisTaskHistory)

/**
 * POST /api/mis-checklist/:id/complete
 * Mark a task complete by creating a MisTaskHistory record (immutable)
 * Request body: { remarks?: string }
 */
router.post('/:id/complete', completeMisChecklistTask)

export default router
