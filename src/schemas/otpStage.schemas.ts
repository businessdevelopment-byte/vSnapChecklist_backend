import { z } from "zod";

// Ordered sequence of the 13 OTP stages. `advanceStage` always moves a job
// from its current stage to the next entry in this array — the pipeline is
// linear (unlike PMS/Political, no branching exists in the source).
// COMPLETED is the true terminal marker — completing the last real stage
// (MOODBOARD_DELIVERY_TO_CLIENT) moves a job here instead of failing with
// "no next stage." No page ever queries pending-at-COMPLETED, so completed
// jobs simply stop appearing in any stage's Pending list.
export const OTP_STAGE_ORDER = [
  "ORDER_RECEIVED",
  "ASSIGN_MEMBER",
  "RE_CONFIRMATION",
  "PHOTOGRAPHER_ALLOTMENT",
  "PHOTOGRAPHER_SEARCH",
  "FINAL_PHOTOGRAPHER",
  "PHOTOGRAPHER_BRIEFING",
  "MAKE_TOKEN",
  "STORY_BRIEFING",
  "MOODBOARD_CREATION",
  "CLIENT_BRIEFING_BEFORE_SHOOT",
  "PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT",
  "MOODBOARD_DELIVERY_TO_CLIENT",
  "COMPLETED",
] as const;

export type OtpStageName = (typeof OTP_STAGE_ORDER)[number];

export function nextOtpStage(stage: OtpStageName): OtpStageName | null {
  const idx = OTP_STAGE_ORDER.indexOf(stage);
  return idx >= 0 && idx < OTP_STAGE_ORDER.length - 1 ? OTP_STAGE_ORDER[idx + 1] : null;
}

const yesNo = (def: "Yes" | "No") => z.enum(["Yes", "No"]).default(def);

const assignMemberSchema = z.object({
  assignedMember: z.string().min(1, "Member is required"),
  assignedEmail: z.string().optional(),
  assignedPhone: z.string().optional(),
  remarks: z.string().optional(),
});

const reConfirmationSchema = z.object({
  venue: z.string().optional(),
  confirmedDate: z.string().optional(),
  confirmationStatus: yesNo("No"),
  moodboardRequired: yesNo("No"),
  remarks: z.string().optional(),
});

const photographerAllotmentSchema = z.object({
  photographerAvailable: yesNo("Yes"),
  photographerName: z.string().optional(),
  photographerContact: z.string().optional(),
  remarks2: z.string().optional(),
});

const searchOption = z.object({
  name: z.string().optional(),
  contact: z.string().optional(),
  rate: z.string().optional(),
  socialLink: z.string().optional(),
  remarks: z.string().optional(),
});
const photographerSearchSchema = z.object({
  options: z.array(searchOption).length(3, "Exactly 3 photographer options are required"),
});

const finalPhotographerSchema = z.object({
  selectedOption: z.enum(["1", "2", "3"]).default("1"),
  paymentTerms: z.string().optional(),
  approvalRemarks: z.string().optional(),
});

const photographerBriefingSchema = z.object({
  assistantPhotographer: z.string().optional(),
  videographerAssigned: z.string().optional(),
  equipmentRequired: z.string().optional(),
  photographyCost: z.string().optional(),
  status: z.enum(["Pending", "Confirmed", "In Progress"]).default("Pending"),
  allotmentRemarks: z.string().optional(),
});

const makeTokenSchema = z.object({
  tokenAmount: z.string().optional(),
  paymentMode: z.enum(["UPI (GPay/PhonePe)", "Bank Transfer", "Cash", "Cheque"]).default("UPI (GPay/PhonePe)"),
  paymentPaidDate: z.string().optional(),
  receiptNumber: z.string().optional(),
  paymentRemarks: z.string().optional(),
  paymentScreenshotUrl: z.string().optional(),
  paymentAgain: z.enum(["No", "Yes"]).default("No"),
  remarks: z.string().optional(),
});

const storyBriefingSchema = z.object({
  briefingMode: z.enum(["Zoom Call", "Physical Meeting", "Phone Call", "WhatsApp/E-mail"]).default("Zoom Call"),
  themeVision: z.string().optional(),
  shootStyle: z.string().optional(),
  referenceLink: z.string().optional(),
  keyMoments: z.string().optional(),
  preferredLocations: z.string().optional(),
  outfitsBride: z.string().optional(),
  outfitsGroom: z.string().optional(),
  editingStyle: z.string().optional(),
  voiceUploadUrl: z.string().optional(),
  specialInstructions: z.string().optional(),
  additionalRequirement: z.string().optional(),
  shotListReceived: z.enum(["Yes", "No", "Awaited"]).default("Yes"),
  sharedWithCreative: yesNo("Yes"),
  finalBriefStatus: z.enum(["Pending", "Approved", "Changes Requested"]).default("Pending"),
});

const moodboardCreationSchema = z.object({
  moodboardRequired: yesNo("Yes"),
  creativeTeam: z.string().optional(),
  createdByName: z.string().optional(),
  referenceLink: z.string().optional(),
  refInputsReceived: yesNo("Yes"),
  sharedWithClient: yesNo("Yes"),
  clientFeedbackStatus: z.enum(["Awaited", "Approved", "Changes Requested", "Rejected"]).default("Awaited"),
  revisionCount: z.coerce.number().int().nonnegative().default(0),
  finalApprovalDate: z.string().optional(),
  finalMoodboardStatus: z.enum(["Pending", "Approved", "Closed"]).default("Pending"),
});

const clientBriefingBeforeShootSchema = z.object({
  briefingMode: z.enum(["WhatsApp Call", "Phone Call", "Zoom Call", "Physical Meeting"]).default("WhatsApp Call"),
  clientAvailability: z.enum(["Confirmed", "Tentative", "Rescheduled"]).default("Confirmed"),
  shootTimelineExplained: yesNo("Yes"),
  deliverablesExplained: yesNo("Yes"),
  clientConfirmationStatus: z.enum(["Confirmed", "Pending", "Awaited"]).default("Confirmed"),
  briefingRemarks: z.string().optional(),
});

const photographerBriefingBeforeShootSchema = z.object({
  briefingMode: z.enum(["Phone Call", "WhatsApp", "In Person", "Zoom"]).default("Phone Call"),
  locationShared: yesNo("Yes"),
  expectationsShared: yesNo("Yes"),
  shotListShared: yesNo("Yes"),
  reportingTime: z.string().optional(),
  contactPerson: z.string().optional(),
  photographerConfirmation: z.enum(["Yes", "No", "Tentative"]).default("Yes"),
  briefingRemarks: z.string().optional(),
});

const moodboardDeliveryToClientSchema = z.object({
  deliveryMode: z.enum(["WhatsApp & Email", "Physical Handover", "Cloud Link (Drive/Dropbox)", "Portal Upload"]).default("WhatsApp & Email"),
  deliveredBy: z.string().default("Marketing Team"),
  deliveredByName: z.string().optional(),
  acknowledgementReceived: z.enum(["Yes", "No", "Awaited"]).default("No"),
  feedbackReceived: z.enum(["Yes", "No", "In Progress"]).default("No"),
  specialInstructions: z.string().optional(),
  revisionRequired: z.enum(["No", "Yes (Minor)", "Yes (Major)"]).default("No"),
  finalApprovalReceived: z.enum(["Yes", "No", "Pending"]).default("No"),
  finalApprovalDate: z.string().optional(),
  deliveryStatus: z.enum(["Pending", "Delivered", "Closed"]).default("Pending"),
});

export const otpStageSchemas: Record<OtpStageName, z.ZodTypeAny> = {
  ORDER_RECEIVED: z.object({}), // handled by createOtpJobSchema, not the stage-advance flow
  ASSIGN_MEMBER: assignMemberSchema,
  RE_CONFIRMATION: reConfirmationSchema,
  PHOTOGRAPHER_ALLOTMENT: photographerAllotmentSchema,
  PHOTOGRAPHER_SEARCH: photographerSearchSchema,
  FINAL_PHOTOGRAPHER: finalPhotographerSchema,
  PHOTOGRAPHER_BRIEFING: photographerBriefingSchema,
  MAKE_TOKEN: makeTokenSchema,
  STORY_BRIEFING: storyBriefingSchema,
  MOODBOARD_CREATION: moodboardCreationSchema,
  CLIENT_BRIEFING_BEFORE_SHOOT: clientBriefingBeforeShootSchema,
  PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT: photographerBriefingBeforeShootSchema,
  MOODBOARD_DELIVERY_TO_CLIENT: moodboardDeliveryToClientSchema,
  COMPLETED: z.object({}), // terminal — advanceStage never validates against this, nothing moves past it
};

export const stageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export const advanceStageSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type StageListQueryInput = z.infer<typeof stageListQuerySchema>;
