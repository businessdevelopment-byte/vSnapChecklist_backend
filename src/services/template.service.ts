import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { CreateTemplateInput, UpdateTemplateInput, TemplateQueryInput } from "../schemas/template.schemas";

export const templateService = {
  async getAll(query: TemplateQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.frequency) where.frequency = query.frequency;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { taskCode: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.taskTemplate.findMany({
        where,
        skip,
        take,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        include: {
          department: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, username: true } },
        },
      }),
      prisma.taskTemplate.count({ where }),
    ]);

    return { data: templates, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: number) {
    const template = await prisma.taskTemplate.findUnique({
      where: { id },
      include: {
        department: true,
        assignedUser: { select: { id: true, username: true, email: true } },
      },
    });
    if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });
    return template;
  },

  async create(input: CreateTemplateInput) {
    const existing = await prisma.taskTemplate.findUnique({ where: { taskCode: input.taskCode } });
    if (existing) throw Object.assign(new Error(`Task code "${input.taskCode}" already exists`), { status: 409 });

    return prisma.taskTemplate.create({
      data: {
        taskCode: input.taskCode,
        departmentId: input.departmentId,
        givenBy: input.givenBy,
        assignedUserId: input.assignedUserId,
        description: input.description,
        startDate: new Date(input.startDate),
        lastDate: input.lastDate ? new Date(input.lastDate) : undefined,
        frequency: input.frequency,
        enableReminders: input.enableReminders ?? true,
        requireAttachment: input.requireAttachment ?? false,
      },
      include: {
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, username: true } },
      },
    });
  },

  async update(id: number, input: UpdateTemplateInput) {
    await this.getById(id);
    return prisma.taskTemplate.update({
      where: { id },
      data: {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        lastDate: input.lastDate ? new Date(input.lastDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, username: true } },
      },
    });
  },

  // Soft delete — sets isActive = false, does NOT delete entries
  async deactivate(id: number) {
    await this.getById(id);
    return prisma.taskTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
