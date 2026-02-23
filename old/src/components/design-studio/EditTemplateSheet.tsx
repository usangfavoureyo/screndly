import { useState, useEffect } from 'react';
import { Upload, Search, X } from 'lucide-react';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { haptics } from '../../utils/haptics';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { toast } from "sonner";

interface EditTemplateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  template: DesignTemplate | null;
  initialData?: {
    headerText?: string;
    subtext?: string;
    imageUrl?: string;
  };
  onSave: (data: { headerText: string; subtext?: string; imageUrl?: string }) => void;
}

interface DesignTemplate {
  id: string;
  name: string;
  aspectRatio: string;
  thumbnailUrl: string;
  hasHeader: boolean;
  hasSubtext: boolean;
  hasImage: boolean;
}

interface TMDbSearchResult {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

export function EditTemplateSheet({
  isOpen,
  onClose,
  template,
  initialData,
  onSave
}: EditTemplateSheetProps) {
  const [headerText, setHeaderText] = useState('');
  const [subtext, setSubtext] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState<'upload' | 'tmdb'>('upload');
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TMDbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTmdbImage, setSelectedTmdbImage] = useState<string | null>(null);

  // Initialize with template data when opened
  useEffect(() => {
    if (isOpen && template) {
      setHeaderText(initialData?.headerText || '');
      setSubtext(initialData?.subtext || '');
      setImageUrl(initialData?.imageUrl || '');
      setSelectedTmdbImage(null);
      setTmdbSearchQuery('');
      setTmdbResults([]);
    }
  }, [isOpen, template, initialData]);

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    haptics.light();
    setIsSearching(true);

    try {
      const apiKey = localStorage.getItem('tmdbApiKey');
      if (!apiKey) {
        toast.error('TMDb API Key Required', {
          description: 'Please add your TMDb API key in Settings'
        });
        return;
      }

      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(tmdbSearchQuery)}&include_adult=false`
      );

      if (!response.ok) {
        throw new Error('TMDb search failed');
      }

      const data = await response.json();
      setTmdbResults(data.results.filter((r: TMDbSearchResult) => 
        r.media_type === 'movie' || r.media_type === 'tv'
      ).slice(0, 10));
    } catch (error) {
      toast.error('Search failed', {
        description: 'Please check your TMDb API key and try again'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTmdbImage = (result: TMDbSearchResult, type: 'backdrop' | 'poster') => {
    haptics.medium();
    const imagePath = type === 'backdrop' ? result.backdrop_path : result.poster_path;
    if (imagePath) {
      const fullUrl = `https://image.tmdb.org/t/p/original${imagePath}`;
      setSelectedTmdbImage(fullUrl);
      setImageUrl(fullUrl);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptics.light();

    // In production, this would upload to storage
    // For now, create a local URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageUrl(result);
      setSelectedTmdbImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!headerText.trim() && template?.hasHeader) {
      toast.error('Header text is required');
      return;
    }

    haptics.medium();
    onSave({
      headerText,
      subtext: template?.hasSubtext ? subtext : undefined,
      imageUrl: template?.hasImage ? imageUrl : undefined,
    });
    onClose();
  };

  if (!template) return null;

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">
          Edit Template
        </BottomSheetTitle>
        <BottomSheetDescription className="text-[#6B7280] dark:text-[#9CA3AF]">
          {template.name} - {template.aspectRatio}
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-4">
          {/* Header Text */}
          {template.hasHeader && (
            <div>
              <Label className="text-gray-900 dark:text-white mb-2 block">
                Header Text *
              </Label>
              <Input
                value={headerText}
                onChange={(e) => {
                  haptics.light();
                  setHeaderText(e.target.value);
                }}
                placeholder="Enter header text..."
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
          )}

          {/* Subtext */}
          {template.hasSubtext && (
            <div>
              <Label className="text-gray-900 dark:text-white mb-2 block">
                Subtext
              </Label>
              <Input
                value={subtext}
                onChange={(e) => {
                  haptics.light();
                  setSubtext(e.target.value);
                }}
                placeholder="Enter subtext (optional)..."
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Image Replacement */}
          {template.hasImage && (
            <>
              <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

              <div>
                <Label className="text-gray-900 dark:text-white mb-3 block">
                  Background Image
                </Label>

                {/* Image Source Selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      haptics.light();
                      setImageSource('upload');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      imageSource === 'upload'
                        ? 'bg-[#ec1e24] border-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setImageSource('tmdb');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      imageSource === 'tmdb'
                        ? 'bg-[#ec1e24] border-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'
                    }`}
                  >
                    <Search className="w-4 h-4 inline mr-2" />
                    TMDb
                  </button>
                </div>

                {/* Upload Mode */}
                {imageSource === 'upload' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload">
                      <div className="border-2 border-dashed border-gray-200 dark:border-[#333333] rounded-lg p-8 text-center cursor-pointer hover:border-[#ec1e24] transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                          Click to upload image
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* TMDb Search Mode */}
                {imageSource === 'tmdb' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={tmdbSearchQuery}
                        onChange={(e) => setTmdbSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTmdbSearch();
                          }
                        }}
                        placeholder="Search for movie or TV show..."
                        className="flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                      />
                      <Button
                        onClick={handleTmdbSearch}
                        disabled={isSearching}
                        className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                      >
                        {isSearching ? 'Searching...' : 'Search'}
                      </Button>
                    </div>

                    {/* TMDb Results */}
                    {tmdbResults.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tmdbResults.map((result) => (
                          <div
                            key={result.id}
                            className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg p-3"
                          >
                            <p className="text-sm text-gray-900 dark:text-white mb-2">
                              {result.title || result.name}
                              {(result.release_date || result.first_air_date) && (
                                <span className="text-gray-500 dark:text-[#6B7280] ml-2">
                                  ({(result.release_date || result.first_air_date)?.slice(0, 4)})
                                </span>
                              )}
                            </p>
                            <div className="flex gap-2">
                              {result.backdrop_path && (
                                <button
                                  onClick={() => handleSelectTmdbImage(result, 'backdrop')}
                                  className="flex-1 py-2 px-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white rounded text-sm hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors"
                                >
                                  Use Backdrop
                                </button>
                              )}
                              {result.poster_path && (
                                <button
                                  onClick={() => handleSelectTmdbImage(result, 'poster')}
                                  className="flex-1 py-2 px-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white rounded text-sm hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors"
                                >
                                  Use Poster
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Image Preview */}
                {imageUrl && (
                  <div className="mt-4">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]">
                      <ImageWithFallback
                        src={imageUrl}
                        alt="Selected image"
                        className="w-full h-48 object-cover"
                      />
                      <button
                        onClick={() => {
                          haptics.light();
                          setImageUrl('');
                          setSelectedTmdbImage(null);
                        }}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <div className="flex gap-3 w-full">
          <Button
            onClick={() => {
              haptics.light();
              onClose();
            }}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white"
          >
            Save Changes
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
