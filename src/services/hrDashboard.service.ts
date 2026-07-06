import { prisma } from "../config/database";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Matches Dashboard.jsx's own stat computation exactly (Dashboard.jsx:18-28):
// totalEmployee = EMPLOYEES.length; activeEmployee = count where status ===
// 'Active'; leftEmployee = LEAVING_EMPLOYEES.length (the real analog is
// LeavingRecord.count(), since Module #47 made LeavingRecord the persisted
// source of truth for "who has left"); leaveThisMonth = leaving records
// whose dateOfLeaving falls in the current calendar month/year.
//
// Unlike Module #51's MonthlyAttendance (where two fields reflected an
// unstated policy with no derivable formula), the source's own
// MONTHLY_HIRING_DATA and DESIGNATION_DATA arrays here are both purely
// derivable counts (employees hired/left per month, employees per
// designation) with zero business-rule ambiguity — so both are computed
// live from real Employee/LeavingRecord data instead of stored as a
// separate, driftable cache. See docs/migration/DECISIONS.md.
export const hrDashboardService = {
  async getSummary() {
    const now = new Date();

    const [totalEmployees, activeEmployees, resignedEmployees, employees, leavingRecords] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: "Active" } }),
      prisma.leavingRecord.count(),
      prisma.employee.findMany({ select: { dateOfJoining: true, designation: true } }),
      prisma.leavingRecord.findMany({ select: { dateOfLeaving: true } }),
    ]);

    const leftThisMonth = leavingRecords.filter(
      (r) => r.dateOfLeaving.getUTCMonth() === now.getUTCMonth() && r.dateOfLeaving.getUTCFullYear() === now.getUTCFullYear()
    ).length;

    // Trailing 6 months ending at the current month, matching the source's
    // own 6-entry chart shape but computed from real rolling dates.
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTH_NAMES[d.getUTCMonth()] });
    }

    const monthlyHiring = months.map(({ key, label }) => {
      const [year, month] = key.split("-").map(Number);
      const hired = employees.filter(
        (e) => e.dateOfJoining.getUTCMonth() === month && e.dateOfJoining.getUTCFullYear() === year
      ).length;
      const left = leavingRecords.filter(
        (r) => r.dateOfLeaving.getUTCMonth() === month && r.dateOfLeaving.getUTCFullYear() === year
      ).length;
      return { month: label, hired, left };
    });

    const designationCounts = new Map<string, number>();
    for (const e of employees) {
      designationCounts.set(e.designation, (designationCounts.get(e.designation) ?? 0) + 1);
    }
    const designationBreakdown = Array.from(designationCounts.entries()).map(([designation, count]) => ({
      designation,
      employees: count,
    }));

    return {
      totalEmployees,
      activeEmployees,
      resignedEmployees,
      leftThisMonth,
      monthlyHiring,
      designationBreakdown,
    };
  },
};
