import { z } from "zod";

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;

export const createEmployeeSchema = z.object({
  candidateName: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  joiningPlace: z.string().optional(),
  designation: z.string().min(1, "Designation is required"),
  salary: z.coerce.number().nonnegative("Must be 0 or greater"),
  mobileNo: z.string().min(1, "Mobile number is required"),
  familyMobileNo: z.string().optional(),
  relationWithFamily: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  companyName: z.string().optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  aadharNo: z.string().optional(),
  currentAddress: z.string().optional(),
  addressAsPerAadhar: z.string().optional(),
  bodAsPerAadhar: z.string().optional(),
  pfEligible: z.enum(["Yes", "No"]).optional(),
  esicEligible: z.enum(["Yes", "No"]).optional(),
  accountNo: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),
  paymentMode: z.string().optional(),
  modeOfAttendance: z.string().optional(),
  qualification: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Matches MyProfile.jsx's own editable fields exactly (MyProfile.jsx:14) —
// mobileNo, familyMobileNo, email, currentAddress are the only 4 fields the
// source lets an employee edit about themselves; everything else on the
// profile (designation, dateOfJoining, salary, etc.) is display-only there.
export const updateMyProfileEmployeeSchema = z.object({
  mobileNo: z.string().min(1, "Mobile number is required").optional(),
  familyMobileNo: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  currentAddress: z.string().optional(),
});

export type UpdateMyProfileEmployeeInput = z.infer<typeof updateMyProfileEmployeeSchema>;
