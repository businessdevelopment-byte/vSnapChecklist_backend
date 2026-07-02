import { z } from "zod";

// Full PMS pipeline shape, derived from Master/src/pages/PMS/pmsStorage.js's
// `mapping` array (linear happy path) plus each stage's own *Pending.jsx
// handleSave (branching). Unlike OTP, PMS is a real directed graph, not a flat
// sequence: DataQualityCheck/EditingQC/ReEditQC branch on an Approved/Rejected
// field, and Reshoot/a rejected ReEditQC loop back to an earlier stage instead
// of always moving forward. COMPLETED is the terminal marker after FinalDelivery.
export const PMS_STAGE_ORDER = [
  "SALES_TEAM",
  "REPORTING_CHECK",
  "DURING_SHOOT_FEEDBACK",
  "AFTER_SHOOT_CONFIRMATION",
  "DATA_COLLECTION",
  "DATA_QUALITY_CHECK",
  "RESHOOT",
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
// the next stage. Most are unconditional; three branch. Source note: the
// live DataQualityCheck source has a bug — its Pending page checks
// `formData.qcStatus` (never set by the form; the form sets
// `qcApprovalStatus`), so every job in Master's own app is silently routed to
// Reshoot regardless of the QC decision. Ported the *intended* rule
// (Approved -> Editing, Rejected -> Reshoot) using the field the form
// actually sets, not the literal bug — see docs/migration/DECISIONS.md.
export const pmsStageTransitions: Record<PmsStageName, (data: Record<string, unknown>) => PmsStageName | null> = {
  SALES_TEAM: () => "REPORTING_CHECK",
  REPORTING_CHECK: () => "DURING_SHOOT_FEEDBACK",
  DURING_SHOOT_FEEDBACK: () => "AFTER_SHOOT_CONFIRMATION",
  AFTER_SHOOT_CONFIRMATION: () => "DATA_COLLECTION",
  DATA_COLLECTION: () => "DATA_QUALITY_CHECK",
  DATA_QUALITY_CHECK: (data) => (data.qcApprovalStatus === "Approved" ? "EDITING" : "RESHOOT"),
  RESHOOT: () => "SALES_TEAM",
  EDITING: () => "EDITING_QC",
  EDITING_QC: (data) => (data.qcApproval === "Approved" ? "WATERMARK_DELIVERY" : "RE_EDIT"),
  RE_EDIT: () => "RE_EDIT_QC",
  RE_EDIT_QC: (data) => (data.reEditQCStatus === "Approved" ? "WATERMARK_DELIVERY" : "RE_EDIT"),
  WATERMARK_DELIVERY: () => "PAYMENT_COLLECTION",
  PAYMENT_COLLECTION: () => "FINAL_DELIVERY",
  FINAL_DELIVERY: () => "COMPLETED",
  COMPLETED: () => null,
};

const yesNo = (def: "Yes" | "No") => z.enum(["Yes", "No"]).default(def);

const salesTeamSchema = z.object({
  salesPersonName: z.string().min(1, "Sales person is required"),
  salesCoordinator: z.string().optional(),
  clientPOCName: z.string().optional(),
  clientContact: z.string().optional(),
  shootDate: z.string().optional(),
  shootCity: z.string().optional(),
  shootVenue: z.string().optional(),
  serviceType: z.enum(["Photo", "Video", "Both"]).default("Photo"),
  totalShootValue: z.string().optional(),
  advancePaymentStatus: z.enum(["Received", "Pending"]).default("Pending"),
  jobSharedWithOps: yesNo("No"),
  salesRemarks1: z.string().optional(),
});

const reportingCheckSchema = z.object({
  photographerReached: yesNo("No"),
  clientReached: yesNo("No"),
  delayRemarks: z.string().optional(),
  initialFeedback: z.string().optional(),
  photographerFeedback1: z.string().optional(),
  opsRemarks1: z.string().optional(),
  status1: z.enum(["Pending", "Completed", "Delayed"]).default("Pending"),
});

const duringShootFeedbackSchema = z.object({
  totalShootDays: z.string().optional(),
  shootDayNumber: z.string().optional(),
  photographerFeedback2: z.string().optional(),
  clientFeedback: z.string().optional(),
  photographerGrooming: z.enum(["Good", "Average", "Poor"]).default("Good"),
  photoAttachment: z.string().optional(),
  issuesIdentified: z.string().optional(),
  correctiveAction: z.string().optional(),
  opsRemarks2: z.string().optional(),
  status2: z.enum(["Pending", "Completed", "Delayed"]).default("Pending"),
});

const afterShootConfirmationSchema = z.object({
  shootCompleted: yesNo("Yes"),
  photographerSignOff: yesNo("No"),
  clientConfirmation: yesNo("No"),
  equipmentIssues: z.string().optional(),
  pendingCoverage: z.string().optional(),
  feedbackVideo: z.enum(["Shared", "Not Shared"]).default("Not Shared"),
  noReviewReason: z.string().optional(),
  afterShootStatus: z.enum(["Completed", "Partial", "Pending"]).default("Completed"),
  opsRemarks3: z.string().optional(),
});

const dataCollectionSchema = z.object({
  collectionMode: z.enum(["Online", "Physical"]).default("Online"),
  numFilesCollected: z.string().optional(),
  sharedWithCreative: yesNo("No"),
  qualityCheckDone: yesNo("No"),
  opsRemarks4: z.string().optional(),
  collectionStatus: z.enum(["Collected", "Pending", "Issues"]).default("Collected"),
});

// Ported the *intended* rule (Approved -> Editing, Rejected -> Reshoot) using
// the field the form actually sets (`qcApprovalStatus`) — see the note above
// `pmsStageTransitions` and docs/migration/DECISIONS.md for the source bug
// this deliberately does not reproduce.
const dataQualityCheckSchema = z.object({
  dataVerifiedByOps: yesNo("No"),
  dataSharedWithCreative: yesNo("No"),
  creativeFeedbackRating: z.string().default("5"),
  qcApprovalStatus: z.enum(["Approved", "Rejected"]).default("Approved"),
  reshootRequired: yesNo("No"),
  actionBadData: z.string().optional(),
  qcRemarks: z.string().optional(),
});

const reshootSchema = z.object({
  reshootReason: z.string().optional(),
  newJobCreated: yesNo("No"),
  newJobId: z.string().optional(),
  opsRemarks4: z.string().optional(),
});

const editingSchema = z.object({
  editingType: z.enum(["Photo", "Video", "Both"]).default("Photo"),
  editorAssigned: z.string().optional(),
  editorAssignedBy: z.string().optional(),
  numCutsDelivered1: z.string().optional(),
  timeConsumption: z.string().optional(),
  numRevisions: z.string().default("0"),
  clientApproval: yesNo("No"),
  finalEditingStatus: z.enum(["Completed", "Pending"]).default("Pending"),
  editingRemarks: z.string().optional(),
});

// qcApproval is the field EditingQCPending.jsx actually branches on
// (Approved -> Watermark Delivery, Rejected -> Re-Edit) — editQCStatus is a
// separate, non-branching 3-way display field also present in the source form.
const editingQCSchema = z.object({
  qcDoneBy: z.string().optional(),
  qcRating: z.string().default("5"),
  qcApproval: z.enum(["Approved", "Rejected"]).default("Approved"),
  issuesFound: z.string().optional(),
  qcFeedbackSummary: z.string().optional(),
  sentBackReEdit1: yesNo("No"),
  editQCStatus: z.enum(["Approved", "Pending", "Rejected"]).default("Approved"),
  finalNumEdits: z.string().optional(),
  finalClientApproval1: yesNo("Yes"),
  opsRemarks5: z.string().optional(),
});

const reEditSchema = z.object({
  reEditorAssigned: z.string().optional(),
  reAssignedBy: z.string().optional(),
  timeConsumption: z.string().optional(),
  numCutsDelivered2: z.string().optional(),
  finalReEditingStatus: z.enum(["Pending", "Completed"]).default("Pending"),
  reEditRemarks: z.string().optional(),
});

// reEditQCStatus is the field ReEditQCPending.jsx branches on (Approved ->
// Watermark Delivery, Rejected -> back to Re-Edit) — reEditQCApproval is a
// separate, non-branching 2-way display field also present in the source form.
const reEditQCSchema = z.object({
  reEditQCDoneBy: z.string().optional(),
  reEditQCRating: z.string().default("5"),
  reEditQCApproval: z.enum(["Approved", "Rejected"]).default("Approved"),
  reEditIssuesFound: z.string().optional(),
  reEditQCFeedback: z.string().optional(),
  sentBackReEdit2: yesNo("No"),
  reEditQCStatus: z.enum(["Approved", "Pending", "Rejected"]).default("Approved"),
  finalNumEdits2: z.string().optional(),
  finalClientApproval2: yesNo("Yes"),
  opsRemarks6: z.string().optional(),
});

const watermarkDeliverySchema = z.object({
  watermarkStatus: z.enum(["Sent", "Pending"]).default("Pending"),
  watermarkSharedDate: z.string().optional(),
  deliveryMethod: z.enum(["WhatsApp", "E-mail", "Drive"]).default("WhatsApp"),
  clientReviewWatermark: z.string().optional(),
  opsRemarks7: z.string().optional(),
  deliveryStatus: z.enum(["Delivered", "Pending"]).default("Pending"),
});

const paymentCollectionSchema = z.object({
  remainingPaymentStatus: z.enum(["Pending", "Partial", "Paid"]).default("Pending"),
  invoiceShared: yesNo("No"),
  invoiceNumber: z.string().optional(),
  paymentMethod: z.enum(["Online", "Cash", "Transfer"]).default("Online"),
  transactionDate: z.string().optional(),
  transactionId: z.string().optional(),
  accountsConfirmation: z.enum(["Confirmed", "Pending"]).default("Pending"),
  opsRemarks8: z.string().optional(),
  paymentCollectionStatus: z.enum(["Collected", "Pending"]).default("Pending"),
});

const finalDeliverySchema = z.object({
  finalLinkShared: yesNo("No"),
  finalLinkURL: z.string().optional(),
  allDeliverablesShared: yesNo("No"),
  clientReviewProduct: z.enum(["Good", "Average", "Bad"]).default("Good"),
  googleReview: yesNo("No"),
  fullJobClosure: z.enum(["Closed", "Pending"]).default("Pending"),
  finalMemberAssigned: z.string().optional(),
  opsRemarks9: z.string().optional(),
  deliveryFinalStatus: z.enum(["Delivered", "Pending"]).default("Pending"),
});

export const pmsStageSchemas: Partial<Record<PmsStageName, z.ZodTypeAny>> = {
  SALES_TEAM: salesTeamSchema,
  REPORTING_CHECK: reportingCheckSchema,
  DURING_SHOOT_FEEDBACK: duringShootFeedbackSchema,
  AFTER_SHOOT_CONFIRMATION: afterShootConfirmationSchema,
  DATA_COLLECTION: dataCollectionSchema,
  DATA_QUALITY_CHECK: dataQualityCheckSchema,
  RESHOOT: reshootSchema,
  EDITING: editingSchema,
  EDITING_QC: editingQCSchema,
  RE_EDIT: reEditSchema,
  RE_EDIT_QC: reEditQCSchema,
  WATERMARK_DELIVERY: watermarkDeliverySchema,
  PAYMENT_COLLECTION: paymentCollectionSchema,
  FINAL_DELIVERY: finalDeliverySchema,
  // Terminal marker — a no-op schema so advanceStage() falls through to its
  // "already completed" check (pmsStageTransitions.COMPLETED returns null)
  // instead of misreporting a completed job as "not migrated yet".
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
