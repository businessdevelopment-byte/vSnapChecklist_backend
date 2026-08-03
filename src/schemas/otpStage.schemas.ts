import { z } from "zod";

// Ordered sequence of the 13 OTP stages, used for stage-param validation.
// COMPLETED is the true terminal marker — completing the last real stage
// (PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT) moves a job here instead of failing
// with "no next stage." No page ever queries pending-at-COMPLETED, so
// completed jobs simply stop appearing in any stage's Pending list.
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
  "MOODBOARD_DELIVERY_TO_CLIENT",
  "CLIENT_BRIEFING_BEFORE_SHOOT",
  "PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT",
  "COMPLETED",
] as const;

export type OtpStageName = (typeof OTP_STAGE_ORDER)[number];

const yesNo = (def: "Yes" | "No") => z.enum(["Yes", "No"]).default(def);

const assignMemberSchema = z.object({
  assignedMember: z.string().optional(),
  venue: z.string().optional(),
  confirmedDate: z.string().optional(),
  confirmationStatus: yesNo("No"),
  moodboardRequired: yesNo("No"),
  manualInterferenceRequired: yesNo("No"),
  remarks: z.string().optional(),
});

const reConfirmationSchema = z.object({
  venue: z.string().optional(),
  confirmedDate: z.string().optional(),
  confirmationStatus: yesNo("No"),
  moodboardRequired: yesNo("No"),
  manualInterferenceRequired: yesNo("No"),
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

// Mirrors the source "Photographer Briefing Form" (Google Forms) field-for-field.
const photographerBriefingSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  photographerName: z.string().optional(),
  contactNumber: z.string().optional(),
  assistantPhotographer: z.enum(["Yes", "No"]).default("No"),
  videographerAssigned: z.enum(["Yes", "No"]).default("No"),
  equipmentList: z.array(z.string()).default([]),
  photographyCost: z.string().optional(),
  allotmentConfirmationStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  briefingRemarks: z.string().optional(),
});

// Mirrors the source "Make Token Payment Form" (Google Forms) field-for-field.
const makeTokenSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  tokenAmount: z.string().optional(),
  paymentMode: z.enum(["UPI", "Cash", "Bank Transfer"]).default("UPI"),
  paymentPaidDate: z.string().optional(),
  receiptNumber: z.string().optional(),
  paymentAgain: z.enum(["Yes", "No"]).default("No"),
  paymentScreenshotUrl: z.string().optional(),
  paymentRemarks: z.string().optional(),
});

// Mirrors the source "Story Briefing From Client Form" (Google Forms) field-for-field.
const storyBriefingSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  briefingMode: z.enum(["Call", "WhatsApp", "Meeting"]).default("Call"),
  themeVision: z.string().optional(),
  shootStyle: z.string().optional(),
  keyMoments: z.string().optional(),
  referenceLink: z.string().optional(),
  preferredLocations: z.string().optional(),
  outfitsBride: z.string().optional(),
  outfitsGroom: z.string().optional(),
  editingStyle: z.enum(["Funky & flashy", "Classy & smooth"]).default("Funky & flashy"),
  additionalRequirement: z.string().optional(),
  specialInstructions: z.string().optional(),
  voiceUploadUrl: z.string().optional(),
  shotListReceived: z.enum(["Yes", "No"]).default("No"),
  sharedWithCreative: yesNo("Yes"),
  finalBriefStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  submittedBy: z.string().optional(),
});

// Mirrors the source "Moodboard Creation Form" (Google Forms) field-for-field.
const moodboardCreationSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  moodboardRequired: yesNo("Yes"),
  creativeTeam: z.enum(["Operation Team", "Creative Team", "Editing Team"]).default("Creative Team"),
  createdByName: z.string().optional(),
  refInputsReceived: yesNo("Yes"),
  referenceLink: z.string().optional(),
  sharedWithClient: yesNo("Yes"),
  clientFeedbackStatus: z.enum(["Approved", "Changes", "Pending"]).default("Pending"),
  revisionCount: z.coerce.number().int().nonnegative().default(0),
  finalApprovalDate: z.string().optional(),
  finalMoodboardStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  submittedBy: z.string().optional(),
});

// Mirrors the source "Client Briefing Before Shoot" (Google Forms) field-for-field.
const clientBriefingBeforeShootSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  briefingMode: z.enum(["WhatsApp Call", "Phone Call", "Zoom Call", "Physical Meeting"]).default("WhatsApp Call"),
  clientAvailability: z.enum(["Confirmed", "Tentative", "Rescheduled"]).default("Confirmed"),
  shootTimelineExplained: yesNo("Yes"),
  deliverablesExplained: yesNo("Yes"),
  clientOutfitChecked: z.string().optional(),
  clientOutfitImageUrl: z.string().optional(),
  clientConfirmationStatus: z.enum(["Confirmed", "Pending", "Awaited"]).default("Confirmed"),
  briefingRemarks: z.string().optional(),
  submittedBy: z.string().optional(),
});

// Mirrors the source "Photographer Briefing Before Shoot" (Google Forms) field-for-field.
const photographerBriefingBeforeShootSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  briefingMode: z.enum(["Phone Call", "WhatsApp", "In Person", "Zoom"]).default("Phone Call"),
  locationShared: yesNo("Yes"),
  locationsList: z.string().optional(),
  expectationsShared: yesNo("Yes"),
  clientReferenceLink: z.string().optional(),
  shotListShared: yesNo("Yes"),
  equipmentCheck: yesNo("Yes"),
  equipmentList: z.string().optional(),
  reportingTime: z.string().optional(),
  clientDetailsShared: yesNo("Yes"),
  photographerConfirmation: z.enum(["Yes", "No", "Tentative"]).default("Yes"),
  briefingRemarks: z.string().optional(),
});

// Mirrors the source "Moodboard Delivery Form" (Google Forms) field-for-field.
const moodboardDeliveryToClientSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  deliveryMode: z.enum(["Whatsapp", "Email", "Drive"]).default("Whatsapp"),
  deliveredBy: z.enum(["Operation Team", "Creative Team"]).default("Operation Team"),
  deliveredByName: z.string().optional(),
  acknowledgementReceived: z.enum(["Yes", "No"]).default("No"),
  feedbackReceived: z.enum(["Yes", "No"]).default("No"),
  specialInstructions: z.string().optional(),
  revisionRequired: z.enum(["Yes", "No"]).default("No"),
  finalApprovalReceived: z.enum(["Yes", "No"]).default("No"),
  finalApprovalDate: z.string().optional(),
  deliveryStatus: z.enum(["Completed", "Pending"]).default("Pending"),
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
  MOODBOARD_DELIVERY_TO_CLIENT: moodboardDeliveryToClientSchema,
  CLIENT_BRIEFING_BEFORE_SHOOT: clientBriefingBeforeShootSchema,
  PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT: photographerBriefingBeforeShootSchema,
  COMPLETED: z.object({}), // terminal — advanceStage never validates against this, nothing moves past it
};

// Every stage's next-stage rule, keyed the same way as otpStageSchemas —
// mirrors PMS's pmsStageTransitions (pmsStage.schemas.ts). Most stages are
// unconditional; PHOTOGRAPHER_ALLOTMENT branches on whether staff already
// have a photographer (skip straight to Final Photographer) or need one
// found (go to Photographer Search first).
export const otpStageTransitions: Record<OtpStageName, (data: Record<string, unknown>) => OtpStageName | null> = {
  ORDER_RECEIVED: () => "ASSIGN_MEMBER",
  ASSIGN_MEMBER: () => "RE_CONFIRMATION",
  RE_CONFIRMATION: (data) =>
    data.confirmationStatus === "No" ? "RE_CONFIRMATION" : "PHOTOGRAPHER_ALLOTMENT",
  PHOTOGRAPHER_ALLOTMENT: (data) =>
    data.photographerAvailable === "Yes" ? "FINAL_PHOTOGRAPHER" : "PHOTOGRAPHER_SEARCH",
  PHOTOGRAPHER_SEARCH: () => "FINAL_PHOTOGRAPHER",
  FINAL_PHOTOGRAPHER: () => "PHOTOGRAPHER_BRIEFING",
  // These 5 stages each have their own "is this actually done" status field
  // that staff can leave at "Pending" — in that case the job stays put
  // (returns its own stage, a no-op for advanceStage()) instead of moving on
  // as if the work were finished. Every other stage below has no such field
  // and stays unconditional.
  PHOTOGRAPHER_BRIEFING: (data) =>
    data.allotmentConfirmationStatus === "Pending" ? "PHOTOGRAPHER_BRIEFING" : "MAKE_TOKEN",
  MAKE_TOKEN: (data) =>
    data.paymentAgain === "No" ? "MAKE_TOKEN" : "STORY_BRIEFING",
  STORY_BRIEFING: (data) =>
    data.finalBriefStatus === "Pending" ? "STORY_BRIEFING" : "MOODBOARD_CREATION",
  MOODBOARD_CREATION: (data) =>
    data.finalMoodboardStatus === "Pending" ? "MOODBOARD_CREATION" : "MOODBOARD_DELIVERY_TO_CLIENT",
  MOODBOARD_DELIVERY_TO_CLIENT: (data) =>
    data.deliveryStatus === "Pending" ? "MOODBOARD_DELIVERY_TO_CLIENT" : "CLIENT_BRIEFING_BEFORE_SHOOT",
  CLIENT_BRIEFING_BEFORE_SHOOT: (data) =>
    data.clientConfirmationStatus === "Pending" ? "CLIENT_BRIEFING_BEFORE_SHOOT" : "PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT",
  PHOTOGRAPHER_BRIEFING_BEFORE_SHOOT: () => "COMPLETED",
  COMPLETED: () => null,
};

export const stageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  client: z.string().optional(),
  jobId: z.string().optional(),
  projectId: z.string().optional(),
  poc: z.string().optional(),
  // Only ever honored on the ASSIGN_MEMBER stage's history (see
  // otpStage.service.ts) — assignedMember lives in that stage's own
  // OtpStageEvent.data, not on OtpJob, so it's meaningless elsewhere.
  assignedMember: z.string().optional(),
});

export const advanceStageSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type StageListQueryInput = z.infer<typeof stageListQuerySchema>;
