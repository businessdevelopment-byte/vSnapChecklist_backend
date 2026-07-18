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
  "PROJECT_ORDER",
  "JOB_CARD_PLANNING",
  "INFLUENCER_DETAILS_UPDATE",
  "INFLUENCER_SCRIPT_WRITING",
  "INFLUENCER_SCRIPT_APPROVAL",
  "SEND_SCRIPT_TO_INFLUENCER",
  "GET_VIDEO_FROM_INFLUENCER",
  "INHOUSE_SCRIPT_WRITING",
  "INHOUSE_SCRIPT_APPROVAL",
  "SHOOTING",
  "VOICEOVER",
  "EDITING",
  "EDITING_QC",
  "RE_EDIT",
  "RE_QC",
  "DELIVERY_POSTING",
  "DOCUMENT_OF_POST",
  "COMPLETED",
] as const;

export type PoliticalStageName = (typeof POLITICAL_STAGE_ORDER)[number];

export const politicalStageTransitions: Record<PoliticalStageName, (data: Record<string, unknown>) => PoliticalStageName | null> = {
  PROJECT_ORDER: () => "JOB_CARD_PLANNING",
  JOB_CARD_PLANNING: (data) =>
    data.contentType === "Influencer" ? "INFLUENCER_DETAILS_UPDATE" : "INHOUSE_SCRIPT_WRITING",
  INFLUENCER_DETAILS_UPDATE: () => "INFLUENCER_SCRIPT_WRITING",
  INFLUENCER_SCRIPT_WRITING: () => "INFLUENCER_SCRIPT_APPROVAL",
  INFLUENCER_SCRIPT_APPROVAL: () => "SEND_SCRIPT_TO_INFLUENCER",
  SEND_SCRIPT_TO_INFLUENCER: () => "GET_VIDEO_FROM_INFLUENCER",
  GET_VIDEO_FROM_INFLUENCER: () => "DELIVERY_POSTING",
  INHOUSE_SCRIPT_WRITING: () => "INHOUSE_SCRIPT_APPROVAL",
  INHOUSE_SCRIPT_APPROVAL: () => "SHOOTING",
  SHOOTING: () => "VOICEOVER",
  VOICEOVER: () => "EDITING",
  EDITING: () => "EDITING_QC",
  EDITING_QC: (data) => (data.qcApproval === "Approved" ? "DELIVERY_POSTING" : "RE_EDIT"),
  RE_EDIT: () => "RE_QC",
  RE_QC: (data) => (data.status === "Closed (Done)" ? "DELIVERY_POSTING" : "RE_EDIT"),
  DELIVERY_POSTING: () => "DOCUMENT_OF_POST",
  DOCUMENT_OF_POST: () => "COMPLETED",
  COMPLETED: () => null,
};

const priorityEnum = z.enum(["High", "Medium", "Low"]).default("Medium");
const statusEnum = z.enum(["Pending", "Completed"]).default("Pending");

const projectOrderSchema = z.object({
  projectName: z.string(),
  reportingPersonName: z.string(),
  reportingPersonWhatsapp: z.string(),
  reportingGroupName: z.string(),
  instagramPages: z.string(),
  currentFollowers: z.string(),
  openingViews: z.string(),
  monthlyViewsTarget: z.string(),
  remarks: z.string().optional(),
});

const jobCardPlanningSchema = z.object({
  plannedDate: z.string(),
  contentType: z.enum(["Influencer", "Inhouse/Non-Face"]),
  ideaDetailsTopic: z.string(),
  linkOrAttachment: z.string().optional(),
  editorName: z.string(),
});

const influencerDetailsUpdateSchema = z.object({
  influencerName: z.string(),
  linkOfChannel: z.string(),
  price: z.string(),
});

const influencerScriptWritingSchema = z.object({
  scriptTextUpload: z.string(),
});

const inhouseScriptWritingSchema = z.object({
  scriptTextUpload: z.string(),
});

const influencerScriptApprovalSchema = z.object({
  status: z.enum(["Approved", "Rejected"]),
});

const inhouseScriptApprovalSchema = z.object({
  status: z.enum(["Approved", "Rejected"]),
});

const sendScriptToInfluencerSchema = z.object({
  jobCardNumber: z.string(),
  status: z.enum(["Completed", "Pending"]),
  scriptFileUpload: z.string().optional(),
});

const shootingSchema = z.object({
  status: z.enum(["Completed", "Pending"]),
});

const voiceOverSchema = z.object({
  jobCardNumber: z.string(),
  status: z.enum(["Completed", "Pending"]),
  videoUpload: z.string().optional(),
});

const editingSchema = z.object({
  status: z.enum(["Completed"]),
  videoUpload: z.string(),
});

const editingQCSchema = z.object({
  qcApproval: z.enum(["Okay", "Not Okay"]),
});

const reEditSchema = z.object({
  status: z.enum(["Okay"]),
  videoUpload: z.string(),
});

const reQCSchema = z.object({
  status: z.enum(["Okay", "Not Okay"]),
});

const getVideoFromInfluencerSchema = z.object({
  status: z.enum(["Okay", "Not Okay"]),
  videoUpload: z.string(),
});

const deliveryPostingSchema = z.object({
  status: z.enum(["Completed", "Pending"]),
  linkOfPost: z.string(),
  sharedInClientGroup: z.enum(["Yes", "No"]),
});

const documentOfPostSchema = z.object({
  status: z.enum(["Completed", "Pending"]),
  linkOfPost: z.string(),
  currentViews: z.string(),
  likes: z.string(),
  comments: z.string(),
  shares: z.string(),
});

export const politicalStageSchemas: Partial<Record<PoliticalStageName, z.ZodTypeAny>> = {
  PROJECT_ORDER: projectOrderSchema,
  JOB_CARD_PLANNING: jobCardPlanningSchema,
  INFLUENCER_DETAILS_UPDATE: influencerDetailsUpdateSchema,
  INFLUENCER_SCRIPT_WRITING: influencerScriptWritingSchema,
  INFLUENCER_SCRIPT_APPROVAL: influencerScriptApprovalSchema,
  SEND_SCRIPT_TO_INFLUENCER: sendScriptToInfluencerSchema,
  GET_VIDEO_FROM_INFLUENCER: getVideoFromInfluencerSchema,
  INHOUSE_SCRIPT_WRITING: inhouseScriptWritingSchema,
  INHOUSE_SCRIPT_APPROVAL: inhouseScriptApprovalSchema,
  SHOOTING: shootingSchema,
  VOICEOVER: voiceOverSchema,
  EDITING: editingSchema,
  EDITING_QC: editingQCSchema,
  RE_EDIT: reEditSchema,
  RE_QC: reQCSchema,
  DELIVERY_POSTING: deliveryPostingSchema,
  DOCUMENT_OF_POST: documentOfPostSchema,
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
