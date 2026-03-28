import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { CommentReplySettings } from '../../components/settings/CommentReplySettings';

const apiClientMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const commentAutomationMock = vi.hoisted(() => ({
  recordTestReply: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: apiClientMock,
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
  },
}));

vi.mock('../../contexts/CommentAutomationContext', () => ({
  useCommentAutomation: () => commentAutomationMock,
}));

vi.mock('../../components/settings/AnalyticsSelfOptimization', () => ({
  AnalyticsSelfOptimization: () => <div>Analytics</div>,
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button type="button" onClick={() => onCheckedChange(!checked)}>
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

vi.mock('../../components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('../../components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('../../components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => <span>Select</span>,
}));

const settings = {
  commentReplyFrequency: 'instant',
  commentThrottle: 'low',
  commentReplyModel: 'gpt-5.4-mini',
  xCommentBlacklist: { active: true, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  threadsCommentBlacklist: { active: true, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  facebookCommentBlacklist: { active: true, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  instagramCommentBlacklist: { active: true, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  youtubeCommentBlacklist: { active: false, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  tiktokCommentBlacklist: { active: false, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
  pinterestCommentBlacklist: { active: false, usernames: '', keywords: '', noEmojiOnly: false, noLinks: false, pauseOldPosts: false, pauseAfterHours: '24' },
};

describe('CommentReplySettings', () => {
  beforeEach(() => {
    apiClientMock.post.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    commentAutomationMock.recordTestReply.mockReset();
  });

  it('sends a test reply for a supported platform', async () => {
    apiClientMock.post.mockResolvedValue({
      success: true,
      data: {
        platform: 'X',
        username: 'tester',
        comment: 'Loved this clip',
        reply: 'Thanks for watching!',
        postTitle: 'Launch teaser',
        repliedAt: '2026-03-28T12:00:00.000Z',
        commentId: 'comment-1',
      },
    });

    const user = userEvent.setup();

    render(
      <CommentReplySettings
        settings={settings}
        updateSetting={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Test Reply' })[0]);

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith('/api/comments/automation/test-reply', { platform: 'X' });
    });

    expect(commentAutomationMock.recordTestReply).toHaveBeenCalledWith('X', {
      id: 'comment-1',
      username: 'tester',
      comment: 'Loved this clip',
      reply: 'Thanks for watching!',
      postTitle: 'Launch teaser',
      time: '2026-03-28T12:00:00.000Z',
    });
    expect(toastMock.success).toHaveBeenCalledWith('Test reply sent on X.', {
      description: 'Replied to @tester • Post: Launch teaser • Comment: "Loved this clip"',
    });
  });

  it('shows unsupported placeholders for platforms without comment reply support', () => {
    render(
      <CommentReplySettings
        settings={settings}
        updateSetting={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Test reply is not available for YouTube comment automation in this build.')).toBeInTheDocument();
    expect(screen.getByText('Test reply is not available for TikTok comment automation in this build.')).toBeInTheDocument();
    expect(screen.getByText('Test reply is not available for Pinterest comment automation in this build.')).toBeInTheDocument();
  });
});
