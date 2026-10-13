import { isNonEmptyString, isRecord, type ValidationResult } from "./types";

export interface MeetingMinutesSchema {
  title: string;
  date?: string;
  attendees?: string[];
  topics?: unknown[];
  nextMeeting?: string;
  summary: string;
}

export interface CommunicationAnalysisSchema {
  title: string;
  customerName?: string;
  contactPerson?: string;
  keyTopics?: string[];
  customerNeeds?: string[];
  competitiveInfo?: string;
  opportunities?: unknown[];
  risks?: unknown[];
  recommendedActions?: unknown[];
  summary: string;
}

function validateOptionalStringArray(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${field} must be a string array`);
  }
}

function validateOptionalArray(value: unknown, field: string, errors: string[]): void {
  if (value !== undefined && !Array.isArray(value)) errors.push(`${field} must be an array`);
}

export function validateMeetingMinutes<T extends MeetingMinutesSchema = MeetingMinutesSchema>(value: unknown): ValidationResult<T> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };

  const errors: string[] = [];
  if (!isNonEmptyString(value.title)) errors.push("title is required");
  if (!isNonEmptyString(value.summary)) errors.push("summary is required");
  validateOptionalStringArray(value.attendees, "attendees", errors);
  validateOptionalArray(value.topics, "topics", errors);

  return { success: errors.length === 0, data: errors.length === 0 ? value as T : undefined, errors };
}

export function validateCommunicationAnalysis<T extends CommunicationAnalysisSchema = CommunicationAnalysisSchema>(value: unknown): ValidationResult<T> {
  if (!isRecord(value)) return { success: false, errors: ["result must be a JSON object"] };

  const errors: string[] = [];
  if (!isNonEmptyString(value.title)) errors.push("title is required");
  if (!isNonEmptyString(value.summary)) errors.push("summary is required");
  validateOptionalStringArray(value.keyTopics, "keyTopics", errors);
  validateOptionalStringArray(value.customerNeeds, "customerNeeds", errors);
  validateOptionalArray(value.opportunities, "opportunities", errors);
  validateOptionalArray(value.risks, "risks", errors);
  validateOptionalArray(value.recommendedActions, "recommendedActions", errors);

  return { success: errors.length === 0, data: errors.length === 0 ? value as T : undefined, errors };
}
