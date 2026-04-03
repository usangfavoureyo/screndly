import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
}

export function LiveDesignPreview({ templatePreviewUrl, designData }: LiveDesignPreviewProps) {
  void designData;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={templatePreviewUrl}
        alt="Template preview"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
