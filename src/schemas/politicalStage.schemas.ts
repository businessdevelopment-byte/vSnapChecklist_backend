import { z } from "zod";

// Full Political pipeline shape, derived from Master/src/pages/Political's
// influencerConstants.js (linear happy-path mapping) plus each stage's own
// *Pending.jsx handleSave (branching). Unlike OTP (fully linear), Political
// has 2 branching stages — EditingQC and ReQC — both correctly wired in the
// source (the form sets the exact field the Pending page branches on; this
// was specifically re-checked since PMS's Data Quality Check had the
// opposite problem, a field-name mismatch bug). A Rejected/Pending decision
// at EditingQC or ReQC always routes to RE_EDIT — one retry loop (ReQC ->
// RE_EDIT), structurally identical to PMS's rejected RE_EDIT_QC -> RE_EDIT.
// Unlike PMS, there is no full-pipeline-restart loop (no Political equivalent
// of PMS's Reshoot -> SalesTeam). DOCUMENT_OF_POST is the terminal stage.
export const POLITICAL_STAGE_ORDER = [
  "JOB_CARDS",
  "INFLUENCER_DETAILS",
  "SCRIPT_WRITING",
  "SCRIPT_APPROVAL",
  "SEND_SCRIPT",
  "SHOOTING",
  "VOICEOVER",
  "EDITING",
  "EDITING_QC",
  "RE_EDIT",
  "RE_QC",
  "VIDEO_CHECK",
  "DELIVERY_POSTING",
  "DOCUMENT_OF_POST",
  "COMPLETED",
] as const;

export type PoliticalStageName = (typeof POLITICAL_STAGE_ORDER)[number];

export const politicalStageTransitions: Record<PoliticalStageName, (data: Record<string, unknown>) => PoliticalStageName | null> = {
  JOB_CARDS: () => "INFLUENCER_DETAILS",
  INFLUENCER_DETAILS: () => "SCRIPT_WRITING",
  SCRIPT_WRITING: () => "SCRIPT_APPROVAL",
  SCRIPT_APPROVAL: () => "SEND_SCRIPT",
  SEND_SCRIPT: () => "SHOOTING",
  SHOOTING: () => "VOICEOVER",
  VOICEOVER: () => "EDITING",
  EDITING: () => "EDITING_QC",
  EDITING_QC: (data) => (data.qcStatus === "Approved" ? "VIDEO_CHECK" : "RE_EDIT"),
  RE_EDIT: () => "RE_QC",
  RE_QC: (data) => (data.reQCStatus === "Approved" ? "VIDEO_CHECK" : "RE_EDIT"),
  VIDEO_CHECK: () => "DELIVERY_POSTING",
  DELIVERY_POSTING: () => "DOCUMENT_OF_POST",
  DOCUMENT_OF_POST: () => "COMPLETED",
  COMPLETED: () => null,
};

// Job Cards' own priority field has 4 options (High/Medium/Low/Urgent); every
// other stage's priority field has only 3 (High/Medium/Low) — confirmed by
// reading each stage's own Form.jsx, not assumed to be uniform.
const jobCardPriorityEnum = z.enum(["High", "Medium", "Low", "Urgent"]).default("Medium");
const priorityEnum = z.enum(["High", "Medium", "Low"]).default("Medium");
const statusEnum = z.enum(["Pending", "Completed"]).default("Pending");

const jobCardsSchema = z.object({
  priority: jobCardPriorityEnum,
  status: statusEnum,
  remarks: z.string().optional(),
});

const influencerDetailsSchema = z.object({
  influencerName: z.string().optional(),
  linkOfChannel: z.string().optional(),
  price: z.string().optional(),
  influencerContact: z.string().optional(),
  instagramId: z.string().optional(),
  youtubeChannel: z.string().optional(),
  remarks: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const scriptWritingSchema = z.object({
  scriptWritingStatus: statusEnum,
  scriptAttachmentLink: z.string().optional(),
  scriptFileUpload: z.string().optional(),
  scriptNotes: z.string().optional(),
  writerName: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const scriptApprovalSchema = z.object({
  approvalStatus: z.enum(["Pending", "Approved", "Rejected"]).default("Pending"),
  approvedBy: z.string().optional(),
  approvalNotes: z.string().optional(),
  scriptAttachmentLink: z.string().optional(),
  scriptFileUpload: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const sendScriptSchema = z.object({
  sendStatus: z.enum(["Pending", "Sent"]).default("Pending"),
  sharedPlatform: z.string().optional(),
  sharedBy: z.string().optional(),
  scriptAttachmentLink: z.string().optional(),
  scriptFileUpload: z.string().optional(),
  remarks: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const shootingSchema = z.object({
  shootingStatus: statusEnum,
  shootingAttachmentLink: z.string().optional(),
  shootingFileUpload: z.string().optional(),
  shootDate: z.string().optional(),
  shootLocation: z.string().optional(),
  remarks: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const voiceOverSchema = z.object({
  voiceoverStatus: statusEnum,
  voiceoverLink: z.string().optional(),
  voiceoverFileUpload: z.string().optional(),
  voiceoverArtist: z.string().optional(),
  language: z.string().optional(),
  remarks: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const editingSchema = z.object({
  editingStatus: z.enum(["Pending", "In Progress", "Completed"]).default("Pending"),
  videoLink: z.string().optional(),
  videoFileUpload: z.string().optional(),
  assignedEditor: z.string().optional(),
  editingSoftware: z.string().optional(),
  remarks: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

// qcStatus is the field EditingQCPending.jsx branches on (Approved -> Video
// Check, anything else -> Re-Edit) — verified correct against the source
// form, unlike PMS's Data Quality Check which had a field-name mismatch bug.
const editingQCSchema = z.object({
  qcStatus: z.enum(["Pending", "Approved", "Rejected"]).default("Pending"),
  qcDoneBy: z.string().optional(),
  qcRating: z.string().optional(),
  qcFeedback: z.string().optional(),
  videoLink: z.string().optional(),
  videoFileUpload: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const reEditSchema = z.object({
  reEditStatus: statusEnum,
  videoLink: z.string().optional(),
  videoFileUpload: z.string().optional(),
  assignedEditor: z.string().optional(),
  reEditReason: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

// reQCStatus is the field ReQCPending.jsx branches on (Approved -> Video
// Check, anything else -> back to Re-Edit) — verified correct against the
// source form.
const reQCSchema = z.object({
  reQCStatus: z.enum(["Pending", "Approved", "Rejected"]).default("Pending"),
  qcDoneBy: z.string().optional(),
  qcRating: z.string().optional(),
  qcFeedback: z.string().optional(),
  videoLink: z.string().optional(),
  videoFileUpload: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const videoCheckSchema = z.object({
  videoReceiveStatus: z.enum(["Pending", "Received"]).default("Pending"),
  videoLink: z.string().optional(),
  videoFileUpload: z.string().optional(),
  checkedBy: z.string().optional(),
  checkStatus: z.enum(["Pending", "Passed", "Failed"]).default("Pending"),
  priority: priorityEnum,
  status: statusEnum,
});

// Source's `remarks` field is declared in DeliveryPostingForm.jsx's initial
// state but has no corresponding input anywhere in its JSX — a dead field in
// the source that's unreachable via the UI. Deliberately omitted here rather
// than ported, since there is no real functionality to preserve — see
// docs/migration/DECISIONS.md.
const deliveryPostingSchema = z.object({
  deliveryStatus: z.enum(["Pending", "Posted"]).default("Pending"),
  linkOfPost: z.string().optional(),
  sharedInClientGroup: z.enum(["Yes", "No"]).default("No"),
  postedPlatform: z.string().optional(),
  postedBy: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

const documentOfPostSchema = z.object({
  postStatus: z.enum(["Pending", "Live"]).default("Pending"),
  linkOfPost: z.string().optional(),
  currentViews: z.string().optional(),
  likes: z.string().optional(),
  comments: z.string().optional(),
  shares: z.string().optional(),
  db: z.string().optional(),
  priority: priorityEnum,
  status: statusEnum,
});

// Only stages that have been migrated get a real schema — every other stage
// is a real future Political module (#29-41), not yet built. Attempting to
// advance a job sitting at an unimplemented stage is rejected by
// politicalStage.service.ts with a clear "not yet implemented" error rather
// than silently accepting arbitrary data.
export const politicalStageSchemas: Partial<Record<PoliticalStageName, z.ZodTypeAny>> = {
  JOB_CARDS: jobCardsSchema,
  INFLUENCER_DETAILS: influencerDetailsSchema,
  SCRIPT_WRITING: scriptWritingSchema,
  SCRIPT_APPROVAL: scriptApprovalSchema,
  SEND_SCRIPT: sendScriptSchema,
  SHOOTING: shootingSchema,
  VOICEOVER: voiceOverSchema,
  EDITING: editingSchema,
  EDITING_QC: editingQCSchema,
  RE_EDIT: reEditSchema,
  RE_QC: reQCSchema,
  VIDEO_CHECK: videoCheckSchema,
  DELIVERY_POSTING: deliveryPostingSchema,
  DOCUMENT_OF_POST: documentOfPostSchema,
  // Terminal marker — a no-op schema so advanceStage() falls through to its
  // "already completed" check instead of misreporting a completed job as
  // "not migrated yet" (mirrors the fix applied to pmsStageSchemas.COMPLETED).
  COMPLETED: z.object({}),
};

export const politicalStageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PoliticalStageListQueryInput = z.infer<typeof politicalStageListQuerySchema>;

export const advanceStageBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});
