import { prisma } from '../config/database'
import { GetMisChecklistDTO, GetMisChecklistStatsDTO } from '../schemas/misChecklist.schemas'

export class MisChecklistService {
  // Get paginated tasks with permission-based filtering
  async getTasks(filters: GetMisChecklistDTO, userId: number, isAdmin: boolean) {
    const whereClause = this.buildWhereClause(filters, userId, isAdmin)

    const tasks = await prisma.misTask.findMany({
      where: whereClause,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        assignedUser: { select: { id: true, username: true } },
        history: { select: { id: true, completedDate: true }, orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { dueDate: filters.dueDate ? 'asc' : 'desc' }
    })

    // Calculate status based on dueDate and completion
    const tasksWithStatus = tasks.map(task => ({
      ...task,
      status: this.calculateStatus(task)
    }))

    const total = await prisma.misTask.count({ where: whereClause })
    return { data: tasksWithStatus, total, page: filters.page, limit: filters.limit }
  }

  // Get stats by section with permission-based filtering
  async getStats(filters: GetMisChecklistStatsDTO, userId: number, isAdmin: boolean) {
    const whereClause = this.buildWhereClause(filters as any, userId, isAdmin)
    const tasks = await prisma.misTask.findMany({
      where: whereClause,
      include: { history: true }
    })

    // Calculate completion based on history records (if history exists, task is completed)
    const tasksWithStatus = tasks.map(t => ({
      ...t,
      status: this.calculateStatus(t)
    }))

    const stats = {
      totalTasks: tasksWithStatus.length,
      completedTasks: tasksWithStatus.filter(t => t.status === 'completed').length,
      pendingTasks: tasksWithStatus.filter(t => t.status === 'pending').length,
      overdueTasks: tasksWithStatus.filter(t => t.status === 'overdue').length,
      bySection: this.groupBySection(tasksWithStatus),
      completionRate: 0
    }

    if (stats.totalTasks > 0) {
      stats.completionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100)
    }

    return stats
  }

  // Get available sections (distinct values)
  async getSections() {
    const sections = await prisma.misTask.findMany({
      select: { section: true },
      distinct: ['section'],
      where: { section: { not: null } }
    })
    return sections.map(s => s.section).filter(Boolean).sort()
  }

  // Complete task - creates immutable history record instead of updating status
  async completeTask(taskId: number, userId: number, remarks?: string) {
    const task = await prisma.misTask.findUnique({ where: { id: taskId } })
    if (!task) {
      throw new Error('Task not found')
    }

    // Permission: user can complete own tasks, admin can complete any
    const isAdmin = await this.userIsAdmin(userId)
    if (!isAdmin && task.assignedUserId !== userId) {
      throw new Error('You can only complete your own tasks')
    }

    // Create immutable history record (don't update task status)
    const history = await prisma.misTaskHistory.create({
      data: {
        taskId,
        submittedByUserId: userId,
        completedDate: new Date(),
        remarks: remarks || null
      },
      include: {
        submittedBy: { select: { id: true, username: true } }
      }
    })

    return history
  }

  // Get task completion history
  async getTaskHistory(taskId: number) {
    const histories = await prisma.misTaskHistory.findMany({
      where: { taskId },
      include: {
        submittedBy: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return histories
  }

  // Helper: build where clause with permission-based filtering
  private buildWhereClause(filters: GetMisChecklistDTO | GetMisChecklistStatsDTO, userId: number, isAdmin: boolean) {
    const where: any = {}

    // Permission-based scoping: non-admin users see only their own tasks
    if (!isAdmin) {
      where.assignedUserId = userId
    } else if ((filters as any).userId) {
      // Admin can explicitly filter to a specific user
      where.assignedUserId = (filters as any).userId
    }

    // Apply filters
    if ((filters as any).dueDate) {
      const dueDate = new Date((filters as any).dueDate)
      where.dueDate = {
        gte: dueDate,
        lt: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }
    if ((filters as any).section) {
      where.section = (filters as any).section
    }
    if ((filters as any).status) {
      const status = (filters as any).status
      // Status is calculated, but we can filter by tasks with/without history
      if (status === 'completed') {
        where.history = { some: {} } // Has at least one history record
      } else if (status === 'pending') {
        where.history = { none: {} } // No history records
      } else if (status === 'overdue') {
        where.AND = [
          { history: { none: {} } }, // No history
          { dueDate: { lt: new Date() } } // Past due date
        ]
      }
    }
    if ((filters as any).search) {
      where.OR = [
        { taskName: { contains: (filters as any).search, mode: 'insensitive' } },
        { description: { contains: (filters as any).search, mode: 'insensitive' } }
      ]
    }

    return where
  }

  // Helper: calculate task status (pending, completed, or overdue)
  private calculateStatus(task: any): 'pending' | 'completed' | 'overdue' {
    const hasHistory = task.history && task.history.length > 0
    if (hasHistory) return 'completed'

    // If no completion and dueDate has passed, it's overdue
    if (task.dueDate && task.dueDate < new Date()) {
      return 'overdue'
    }

    return 'pending'
  }

  // Helper: group tasks by section with status breakdown
  private groupBySection(tasks: any[]) {
    const grouped = {} as Record<string, any[]>

    tasks.forEach(t => {
      const section = t.section || 'Uncategorized'
      if (!grouped[section]) grouped[section] = []
      grouped[section].push(t)
    })

    return Object.entries(grouped).map(([section, sectionTasks]) => ({
      section,
      total: sectionTasks.length,
      completed: sectionTasks.filter(t => t.status === 'completed').length,
      pending: sectionTasks.filter(t => t.status === 'pending').length,
      rate:
        sectionTasks.length > 0
          ? Math.round((sectionTasks.filter(t => t.status === 'completed').length / sectionTasks.length) * 100)
          : 0
    }))
  }

  private async userIsAdmin(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    return user?.role === 'ADMIN'
  }
}

export const misChecklistService = new MisChecklistService()
