import { MediaPreviewDialog } from '../media/MediaPreviewDialog';

interface TMDbImagePreviewDialogProps {
  open: boolean;
  imageUrl?: string | null;
  title?: string;
  imageType?: 'poster' | 'backdrop';
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function TMDbImagePreviewDialog({
  open,
  imageUrl,
  title,
  imageType,
  onOpenChange,
  onClose,
}: TMDbImagePreviewDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      onClose();
    }
  };

  return (
    <MediaPreviewDialog
      open={open}
      src={imageUrl}
      mediaType="image"
      title={title || 'TMDb image preview'}
      badgeLabel={imageType}
      onOpenChange={handleOpenChange}
    />
  );
}
