export interface PadTemplate {
  id: string;
  name: string;
  description: string;
  promptHint: string;
  emptyState: string;
}

export interface PadAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}

export interface PadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: PadAttachment[];
}

export interface PadOutput {
  id: string;
  content: string;
  createdAt: string;
}

export interface PadSession {
  id: string;
  templateId: string;
  title: string;
  systemPrompt: string;
  pinned: boolean;
  messages: PadMessage[];
  latestOutput: string;
  outputs: PadOutput[];
  createdAt: string;
  updatedAt: string;
}
