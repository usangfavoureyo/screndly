import { MediaPreviewDialog } from '../media/MediaPreviewDialog';

function formatImageTypeLabel(value?: 'poster' | 'backdrop' | 'logo') {
  if (!value) {
    return undefined;
  }

  if (value === 'logo') {
    return 'Logo';
  }

  return value === 'poster' ? 'Poster' : 'Backdrop';
}

interface TMDbImagePreviewDialogProps {
  open: boolean;
  imageUrl?: string | null;
  imageUrls?: string[];
  title?: string;
  imageType?: 'poster' | 'backdrop' | 'logo';
  imageTypes?: Array<'poster' | 'backdrop' | 'logo'>;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function TMDbImagePreviewDialog({
  open,
  imageUrl,
  imageUrls,
  title,
  imageType,
  imageTypes,
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
      imageSources={imageUrls}
      mediaType="image"
      title={title || 'TMDb image preview'}
      badgeLabel={formatImageTypeLabel(imageType)}
      badgeLabels={imageTypes?.map((value) => formatImageTypeLabel(value) || '')}
      onOpenChange={handleOpenChange}
    />
  );
}
