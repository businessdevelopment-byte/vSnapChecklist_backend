import { prisma } from "../config/database";

export const systemSettingsService = {
  async get() {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, skipSundays: true },
    });
    return settings;
  },

  async update(data: { skipSundays?: boolean }) {
    return prisma.systemSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, skipSundays: data.skipSundays ?? true },
    });
  },
};
