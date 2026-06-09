import { prisma } from "../config/database";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import type { CreateTemplateInput, UpdateTemplateInput, TemplateQueryInput, ImportTemplatesInput } from "../schemas/template.schemas";

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
        { assignedUser: { username: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const dir = query.sortDir ?? "asc";
    const orderByMap: Record<string, object> = {
      taskCode:     { taskCode: dir },
      department:   { department: { name: dir } },
      givenBy:      { givenBy: dir },
      assignedUser: { assignedUser: { username: dir } },
      frequency:    { frequency: dir },
      startDate:    { startDate: dir },
    };
    const orderBy = query.sortBy
      ? [orderByMap[query.sortBy]]
      : [{ isActive: "desc" }, { createdAt: "desc" }];

    const [templates, total] = await Promise.all([
      prisma.taskTemplate.findMany({
        where,
        skip,
        take,
        orderBy,
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

  async importMany(input: ImportTemplatesInput) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const t of input) {
      try {
        const dept = await prisma.department.findFirst({
          where: { name: { equals: t.departmentName, mode: "insensitive" } },
        });
        if (!dept) {
          results.errors.push(`${t.taskCode}: department "${t.departmentName}" not found`);
          continue;
        }

        const user = await prisma.user.findUnique({ where: { username: t.assignedUsername } });
        if (!user) {
          results.errors.push(`${t.taskCode}: user "${t.assignedUsername}" not found`);
          continue;
        }

        const exists = await prisma.taskTemplate.findUnique({ where: { taskCode: t.taskCode } });
        if (exists) { results.skipped++; continue; }

        await prisma.taskTemplate.create({
          data: {
            taskCode: t.taskCode,
            departmentId: dept.id,
            givenBy: t.givenBy,
            assignedUserId: user.id,
            description: t.description,
            startDate: new Date(t.startDate),
            lastDate: t.lastDate ? new Date(t.lastDate) : undefined,
            frequency: t.frequency,
            enableReminders: t.enableReminders ?? true,
            requireAttachment: t.requireAttachment ?? false,
          },
        });
        results.created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.errors.push(`${t.taskCode}: ${msg}`);
      }
    }

    return results;
  },
};
