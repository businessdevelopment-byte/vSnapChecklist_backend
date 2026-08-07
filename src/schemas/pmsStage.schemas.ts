import { z } from "zod";

// Full PMS pipeline shape, derived from Master/src/pages/PMS/pmsStorage.js's
// `mapping` array (linear happy path) plus each stage's own *Pending.jsx
// handleSave (branching), later corrected against real Google Forms. Unlike
// OTP, PMS is a real directed graph, not a flat sequence: EditingQC branches
// on an Approved/Rejected field, ReEditQC branches on a Closed(Done)/Sent-
// back-for-Re-Edit field, both can loop back to Re-Edit; DATA_QUALITY_CHECK
// branches to RESHOOT_CLOSED when reshoot is required. COMPLETED is the
// terminal marker after FinalDelivery.
// SALES_TEAM (intake) and the old RESHOOT (a loop back to Sales Team) were
// removed per explicit direction — PMS jobs arrive via a hand-off from the
// OTP pipeline instead; see docs/migration/DECISIONS.md. RESHOOT_CLOSED
// (below) is the new, deliberately minimal replacement: a terminal marker
// only, not a full stage — no page ever queries pending-at-RESHOOT_CLOSED,
// same pattern as COMPLETED. A fuller reshoot flow (e.g. spawning a fresh
// job) will be specified later.
export const PMS_STAGE_ORDER = [
  "REPORTING_CHECK",
  "DURING_SHOOT_FEEDBACK",
  "AFTER_SHOOT_CONFIRMATION",
  "DATA_COLLECTION",
  "DATA_QUALITY_CHECK",
  "RESHOOT_CLOSED",
  "EDITING",
  "EDITING_QC",
  "RE_EDIT",
  "RE_EDIT_QC",
  "WATERMARK_DELIVERY",
  "PAYMENT_COLLECTION",
  "FINAL_DELIVERY",
  "COMPLETED",
] as const;

export type PmsStageName = (typeof PMS_STAGE_ORDER)[number];

// Each transition takes the *parsed* data submitted at that stage and returns
// the next stage. Most are unconditional; three branch (DataQualityCheck,
// EditingQC, ReEditQC). DATA_QUALITY_CHECK branches on `reshootRequired`:
// "Yes" closes the job at RESHOOT_CLOSED (terminal — frontend gates this
// behind a confirmation dialog before submitting, since it ends the job's
// active pipeline), "No" proceeds to Editing as before. See DECISIONS.md.
export const pmsStageTransitions: Record<PmsStageName, (data: Record<string, unknown>) => PmsStageName | null> = {
  REPORTING_CHECK: (data) => (data.status1 === "Pending" ? "REPORTING_CHECK" : "DURING_SHOOT_FEEDBACK"),
  DURING_SHOOT_FEEDBACK: (data) => (data.status2 === "Pending" ? "DURING_SHOOT_FEEDBACK" : "AFTER_SHOOT_CONFIRMATION"),
  AFTER_SHOOT_CONFIRMATION: (data) => (data.afterShootStatus === "Pending" ? "AFTER_SHOOT_CONFIRMATION" : "DATA_COLLECTION"),
  DATA_COLLECTION: (data) => (data.dataUploadStatus === "Pending" ? "DATA_COLLECTION" : "DATA_QUALITY_CHECK"),
  DATA_QUALITY_CHECK: (data) => (data.reshootRequired === "Yes" ? "RESHOOT_CLOSED" : "EDITING"),
  RESHOOT_CLOSED: () => null,
  EDITING: (data) => (data.finalEditingStatus === "In Progress" ? "EDITING" : "EDITING_QC"),
  EDITING_QC: (data) => {
    if (data.editQCStatus === "No") return "EDITING_QC";
    return data.qcApproval === "Approved" ? "WATERMARK_DELIVERY" : "RE_EDIT";
  },
  RE_EDIT: (data) => (data.finalReEditingStatus === "Pending" ? "RE_EDIT" : "RE_EDIT_QC"),
  RE_EDIT_QC: (data) => {
    if (data.reEditQCStatus === "Pending") return "RE_EDIT_QC";
    return data.reEditQCClosureStatus === "Closed (Done)" ? "WATERMARK_DELIVERY" : "RE_EDIT";
  },
  WATERMARK_DELIVERY: () => "PAYMENT_COLLECTION",
  PAYMENT_COLLECTION: (data) =>
    data.paymentStatus === "Pending" || data.financeConfirmation === "Pending" ? "PAYMENT_COLLECTION" : "FINAL_DELIVERY",
  FINAL_DELIVERY: (data) => (data.deliveryFinalStatus === "Pending" ? "FINAL_DELIVERY" : "COMPLETED"),
  COMPLETED: () => null,
};

const yesNo = (def: "Yes" | "No") => z.enum(["Yes", "No"]).default(def);

// Mirrors the source "Photographer and Client reporting check" (Google Forms) field-for-field.
const reportingCheckSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  photographerReached: yesNo("No"),
  clientReached: yesNo("No"),
  delayRemarks: z.string().optional(),
  initialFeedback: z.string().optional(),
  photographerFeedback1: z.string().optional(),
  opsRemarks1: z.string().optional(),
  status1: z.enum(["Completed", "Pending"]).default("Pending"),
});

// Mirrors the source "During Shoot Feedback" (Google Forms) field-for-field.
const duringShootFeedbackSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  totalShootDays: z.string().optional(),
  shootDayNumber: z.string().optional(),
  photographerFeedback2: z.string().optional(),
  clientFeedback: z.string().optional(),
  photographerGrooming: yesNo("Yes"),
  photoAttachment: z.string().optional(),
  issuesIdentified: yesNo("No"),
  correctiveActionTaken: yesNo("No"),
  opsRemarks2: z.string().optional(),
  status2: z.enum(["Completed", "Pending"]).default("Pending"),
});

// Mirrors the source "Aftershoot Confirmation" (Google Forms) field-for-field.
const afterShootConfirmationSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  shootCompleted: yesNo("Yes"),
  photographerSignOff: yesNo("No"),
  clientConfirmation: yesNo("No"),
  equipmentIssues: yesNo("No"),
  pendingCoverage: z.string().optional(),
  feedbackVideoUrl: z.string().optional(),
  noReviewReason: z.string().optional(),
  opsRemarks3: z.string().optional(),
  afterShootStatus: z.enum(["Completed", "Pending"]).default("Completed"),
});

// Mirrors the source "Data Collection from Photographer" (Google Forms) field-for-field.
const dataCollectionSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  dataUploadMode: z.enum(["Google Drive", "HDD", "Link", "VsnapU Panel"]).default("Google Drive"),
  collectedDataType: z.array(z.enum(["Image", "Video"])).default([]),
  numFilesCollected: z.string().optional(),
  dataQualityVerified: yesNo("No"),
  missingData: yesNo("No"),
  backupCreated: yesNo("No"),
  opsVerificationDone: yesNo("No"),
  dataUploadStatus: z.enum(["Completed", "Pending"]).default("Pending"),
});

// Mirrors the source "Data Quality Check" (Google Forms) field-for-field.
// qcApprovalStatus/reshootRequired are kept as display/tracking fields on this
// form even though the transition no longer branches on them — see the note
// above `pmsStageTransitions`. qcApprovalStatus changed from Approved/Rejected
// to Yes/No to match the real form's radio options — see DECISIONS.md.
const dataQualityCheckSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  dataVerifiedByOps: yesNo("No"),
  dataSharedWithCreative: yesNo("No"),
  creativeFeedbackRating: z.string().default("5"),
  qcApprovalStatus: yesNo("Yes"),
  reshootRequired: yesNo("No"),
  actionBadData: yesNo("No"),
  qcDoneBy: z.string().optional(),
  qcRemarks: z.string().optional(),
});

// Mirrors the source "Edit" (Google Forms) field-for-field.
const editingSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  editingType: z.enum(["Photo", "Video", "Reel", "E Invite"]).default("Photo"),
  editorAssigned: z.string().optional(),
  editorAssignedBy: z.string().optional(),
  numCutsDelivered1: z.string().optional(),
  timeConsumption: z.string().optional(),
  numRevisions: z.string().optional(),
  clientApproval: yesNo("No"),
  finalEditingStatus: z.enum(["In Progress", "Completed"]).default("In Progress"),
  editingRemarks: z.string().optional(),
});

// Mirrors the source "Edit QC" (Google Forms) field-for-field. qcApproval is
// still the field EDITING_QC's transition actually branches on (Approved ->
// Watermark Delivery, Rejected -> Re-Edit — see pmsStageTransitions);
// editQCStatus is a separate, non-branching display field, changed from the
// old 3-way Approved/Pending/Rejected to the real form's Yes/No.
const editingQCSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  qcDoneBy: z.enum(["Aman Raj Dewangan", "Ashish Kumar Sahu", "Ghanshyam Choudhary"]).default("Aman Raj Dewangan"),
  qcRating: z.string().default("5"),
  qcApproval: z.enum(["Approved", "Rejected"]).default("Approved"),
  issuesFound: yesNo("No"),
  qcFeedbackSummary: z.string().optional(),
  sentBackReEdit1: yesNo("No"),
  editQCStatus: yesNo("Yes"),
  finalNumEdits: z.string().optional(),
  finalClientApproval1: yesNo("Yes"),
  opsRemarks5: z.string().optional(),
});

// Mirrors the source "Re-Edit Require" (Google Forms) field-for-field.
const reEditSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  sentBackForReEdit: yesNo("Yes"),
  reEditTriggerSource: z.enum(["Internal QC", "Client Feedback"]).default("Internal QC"),
  reEditorAssigned: z.string().optional(),
  reAssignedBy: z.string().optional(),
  numCutsDelivered2: z.string().optional(),
  finalReEditingStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  finalClientApprovalReEdit: yesNo("Yes"),
  reEditRemarks: z.string().optional(),
});

// Mirrors the source "Re-Editing QC" (Google Forms) field-for-field.
// reEditQCClosureStatus is the field the transition actually branches on now
// ("Closed (Done)" -> Watermark Delivery, "Sent back for Re-Edit" -> back to
// Re-Edit) — reEditQCStatus is a separate, non-branching Completed/Pending
// display field. This replaces the old reEditQCApproval/reEditQCStatus
// (Approved/Rejected) branching pair, which don't exist in the real form —
// see docs/migration/DECISIONS.md.
const reEditQCSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  reEditQCDoneBy: z.string().optional(),
  finalNumEdits2: z.string().optional(),
  reEditQCStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  reEditQCRating: z.coerce.number().int().min(1).max(10).default(5),
  finalClientApproval2: yesNo("Yes"),
  reEditQCClosureStatus: z.enum(["Closed (Done)", "Sent back for Re-Edit"]).default("Closed (Done)"),
  opsRemarks6: z.string().optional(),
});

// Mirrors the source "Watermark Delivery" (Google Forms) field-for-field.
// Watermark Applied/Client Feedback Received/Rework Required/Client Approval
// Status are all collapsed "Choose" dropdowns in the screenshot (options not
// visible) — modeled as Yes/No, the same pattern every other similarly-named
// field in this pipeline uses; flag for confirmation if the real options
// differ. Delivery Mode's real options are likewise unconfirmed — kept the
// existing WhatsApp/E-mail/Drive set since nothing contradicts it.
const watermarkDeliverySchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  watermarkApplied: yesNo("Yes"),
  deliveryMethod: z.enum(["WhatsApp", "E-mail", "Drive"]).default("WhatsApp"),
  numWatermarkFilesShared: z.string().optional(),
  clientFeedbackReceivedWatermark: yesNo("No"),
  reworkRequiredWatermark: yesNo("No"),
  clientApprovalStatusWatermark: yesNo("Yes"),
  opsRemarks7: z.string().optional(),
});

// Mirrors the source "Final Payment" (Google Forms) field-for-field.
// Invoice Generated/Payment Mode/Payment Status/Finance Confirmation are all
// collapsed "Choose" dropdowns in the screenshot (options not visible) —
// Invoice Generated modeled as Yes/No; Payment Mode/Payment Status/Finance
// Confirmation kept their existing plausible option sets since nothing
// contradicts them. Flag for confirmation if the real options differ.
const paymentCollectionSchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  invoiceGenerated: yesNo("No"),
  invoiceNumber: z.string().optional(),
  paidAmount: z.string().optional(),
  paymentMode: z.enum(["Online", "Cash", "Transfer"]).default("Online"),
  paymentStatus: z.enum(["Pending", "Partial", "Paid"]).default("Pending"),
  paymentReceivedDate: z.string().optional(),
  tdsAdjustments: z.string().optional(),
  financeConfirmation: z.enum(["Confirmed", "Pending"]).default("Pending"),
  opsRemarks8: z.string().optional(),
});

// Mirrors the source "Delivery" (Google Forms) field-for-field. googleReview
// changed from Yes/No to free text — the real form shows this as a text
// field ("Client Google Review/Video Review"), not a radio.
const finalDeliverySchema = z.object({
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  deliveryMode: z.enum(["Drive", "Link", "HDD", "Shared via Whatsapp Document"]).default("Drive"),
  deliverablesShared: yesNo("Yes"),
  clientAcknowledgementReceived: yesNo("Yes"),
  clientSatisfactionStatus: z.enum(["Satisfied", "Changes", "Unsatisfied"]).default("Satisfied"),
  reworkRequiredFinal: yesNo("No"),
  deliveryFinalStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  googleReview: z.string().optional(),
  opsRemarks9: z.string().optional(),
});

export const pmsStageSchemas: Partial<Record<PmsStageName, z.ZodTypeAny>> = {
  REPORTING_CHECK: reportingCheckSchema,
  DURING_SHOOT_FEEDBACK: duringShootFeedbackSchema,
  AFTER_SHOOT_CONFIRMATION: afterShootConfirmationSchema,
  DATA_COLLECTION: dataCollectionSchema,
  DATA_QUALITY_CHECK: dataQualityCheckSchema,
  EDITING: editingSchema,
  EDITING_QC: editingQCSchema,
  RE_EDIT: reEditSchema,
  RE_EDIT_QC: reEditQCSchema,
  WATERMARK_DELIVERY: watermarkDeliverySchema,
  PAYMENT_COLLECTION: paymentCollectionSchema,
  FINAL_DELIVERY: finalDeliverySchema,
  // Terminal markers — no-op schemas so advanceStage() falls through to its
  // "already completed" check (both transitions return null) instead of
  // misreporting a closed/completed job as "not migrated yet".
  RESHOOT_CLOSED: z.object({}),
  COMPLETED: z.object({}),
};

export const pmsStageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PmsStageListQueryInput = z.infer<typeof pmsStageListQuerySchema>;

export const advanceStageBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});
