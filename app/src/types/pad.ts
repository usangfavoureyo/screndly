export interface PadTemplate {
  id: string;
  name: string;
  description: string;
  promptHint: string;
  emptyState: string;
}

export interface PadOutput {
  id: string;
  content: string;
  createdAt: string;
}

export interface PadDraftEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface PadSession {
  id: string;
  templateId: string;
  title: string;
  brief: string;
  context: string;
  latestOutput: string;
  outputs: PadOutput[];
  drafts: PadDraftEntry[];
  createdAt: string;
  updatedAt: string;
}
