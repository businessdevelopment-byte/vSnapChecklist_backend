import { Request, Response } from 'express'
import {
  getMisChecklistSchema,
  getMisChecklistStatsSchema,
  completeTaskSchema
} from '../schemas/misChecklist.schemas'
import { misChecklistService } from '../services/misChecklist.service'

export const getMisChecklistTasks = async (req: Request, res: Response) => {
  try {
    const filters = getMisChecklistSchema.parse(req.query)
    const userId = req.user?.userId
    const isAdmin = req.user?.role === 'ADMIN'

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const result = await misChecklistService.getTasks(filters, userId, isAdmin)
    res.json({ success: true, ...result, message: 'Tasks retrieved' })
  } catch (error: any) {
    console.error('Error fetching MIS checklist tasks:', error)
    res.status(400).json({ success: false, message: error.message || 'Failed to retrieve tasks' })
  }
}

export const getMisChecklistStats = async (req: Request, res: Response) => {
  try {
    const filters = getMisChecklistStatsSchema.parse(req.query)
    const userId = req.user?.userId
    const isAdmin = req.user?.role === 'ADMIN'

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const result = await misChecklistService.getStats(filters, userId, isAdmin)
    res.json({ success: true, data: result, message: 'Stats retrieved' })
  } catch (error: any) {
    console.error('Error fetching MIS checklist stats:', error)
    res.status(400).json({ success: false, message: error.message || 'Failed to retrieve stats' })
  }
}

export const getMisChecklistSections = async (req: Request, res: Response) => {
  try {
    const sections = await misChecklistService.getSections()
    res.json({ success: true, data: sections, message: 'Sections retrieved' })
  } catch (error: any) {
    console.error('Error fetching MIS checklist sections:', error)
    res.status(400).json({ success: false, message: error.message || 'Failed to retrieve sections' })
  }
}

export const completeMisChecklistTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const taskId = parseInt(Array.isArray(id) ? id[0] : id)
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { remarks } = completeTaskSchema.parse(req.body)

    const history = await misChecklistService.completeTask(taskId, userId, remarks)
    res.json({ success: true, data: history, message: 'Task completed' })
  } catch (error: any) {
    console.error('Error completing MIS checklist task:', error)
    if (error.message === 'Task not found') {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }
    if (error.message.includes('can only complete')) {
      return res.status(403).json({ success: false, message: error.message })
    }
    res.status(400).json({ success: false, message: error.message || 'Failed to complete task' })
  }
}

export const getMisTaskHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const taskId = parseInt(Array.isArray(id) ? id[0] : id)

    const histories = await misChecklistService.getTaskHistory(taskId)
    res.json({ success: true, data: histories, message: 'Task history retrieved' })
  } catch (error: any) {
    console.error('Error fetching MIS task history:', error)
    res.status(400).json({ success: false, message: error.message || 'Failed to retrieve task history' })
  }
}
