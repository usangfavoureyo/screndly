import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
}

export function LiveDesignPreview({ templatePreviewUrl, designData }: LiveDesignPreviewProps) {
  const hasPendingRenderChanges = Boolean(
    designData?.headerText ||
      designData?.subtext ||
      designData?.backgroundImage ||
      designData?.overlayEnabled,
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={templatePreviewUrl}
        alt="Template preview"
        className="w-full h-full object-cover"
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 text-left">
        <div className="inline-flex items-center rounded-full bg-black/65 px-3 py-1 text-[11px] text-white">
          {hasPendingRenderChanges ? 'Pending PSD edits apply on render' : 'Original PSD preview'}
        </div>
      </div>

      {hasPendingRenderChanges ? (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-[#ec1e24] px-3 py-1 text-[11px] text-white">
          Render required
        </div>
      ) : null}
    </div>
  );
}