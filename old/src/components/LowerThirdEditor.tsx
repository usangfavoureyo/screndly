import { useState, useEffect } from 'react';
import { Play, Pause, Monitor, Smartphone, Square, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { LowerThird } from './LowerThird';
import { haptics } from '../utils/haptics';
import ColorPickerPopup from './ColorPickerPopup';
import { toast } from "sonner";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface LowerThirdEditorProps {
  onSave?: (config: LowerThirdConfig) => void;
}

export interface LowerThirdConfig {
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'middle-left' | 'middle-center' | 'middle-right';
  aspectRatio: '16:9' | '9:16' | '1:1';
  size: 'small' | 'medium' | 'large';
  duration: number;
  backgroundColor: string;
  textColor: string;
}

const STORAGE_KEY = 'screndly_lower_third_config';
const TEMPLATES_STORAGE_KEY = 'screndly_saved_lower_third_templates';

// Default configuration
const defaultConfig: LowerThirdConfig = {
  position: 'bottom-left',
  aspectRatio: '16:9',
  size: 'medium',
  duration: 3.5,
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
};

interface SavedTemplate {
  name: string;
  config: LowerThirdConfig;
  savedAt: string;
}

// Load saved configuration from localStorage
const loadSavedConfig = (): LowerThirdConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Failed to load saved lower third config:', error);
  }
  return defaultConfig;
};

// Save configuration to localStorage
const saveConfigToStorage = (config: LowerThirdConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save lower third config:', error);
  }
};

export function LowerThirdEditor({ onSave }: LowerThirdEditorProps) {
  // Load saved config on initial mount
  const savedConfig = loadSavedConfig();
  
  const [position, setPosition] = useState<LowerThirdConfig['position']>(savedConfig.position);
  const [aspectRatio, setAspectRatio] = useState<LowerThirdConfig['aspectRatio']>(savedConfig.aspectRatio);
  const [size, setSize] = useState<LowerThirdConfig['size']>(savedConfig.size);
  const [duration, setDuration] = useState(savedConfig.duration);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(savedConfig.backgroundColor);
  const [textColor, setTextColor] = useState(savedConfig.textColor);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);

  // Template management state
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingTemplate, setRenamingTemplate] = useState<string | null>(null);
  const [showRenameMenu, setShowRenameMenu] = useState<string | null>(null);

  // Sample data for preview
  const sampleTitle = "Sinners";
  const sampleSubtitle = "April 13";

  // CRITICAL: Prevent keyboard popup when component first renders
  useEffect(() => {
    // Blur any focused input immediately on mount
    const timer = setTimeout(() => {
      if (document.activeElement instanceof HTMLInputElement || 
          document.activeElement instanceof HTMLTextAreaElement) {
        document.activeElement.blur();
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  // Load saved templates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved lower third templates:', e);
      }
    }
  }, []);

  const handlePreview = () => {
    haptics.light();
    setIsPreviewPlaying(true);
    
    // Auto-stop after duration
    setTimeout(() => {
      setIsPreviewPlaying(false);
    }, duration * 1000);
  };

  const handleSave = () => {
    haptics.medium();
    onSave?.({
      position,
      aspectRatio,
      size,
      duration,
      backgroundColor,
      textColor,
    });
    saveConfigToStorage({
      position,
      aspectRatio,
      size,
      duration,
      backgroundColor,
      textColor,
    });
  };

  const handleSaveTemplate = () => {
    haptics.medium();
    setTemplateName('');
    setIsRenaming(false);
    setShowNameDialog(true);
  };

  const saveTemplateWithName = () => {
    if (!templateName.trim()) return;
    
    // Check for duplicate names
    if (savedTemplates.some(t => t.name === templateName.trim())) {
      alert('A template with this name already exists. Please choose a different name.');
      return;
    }
    
    haptics.medium();
    const timestamp = new Date().toLocaleString();
    
    const templateData: SavedTemplate = {
      name: templateName.trim(),
      config: {
        position,
        aspectRatio,
        size,
        duration,
        backgroundColor,
        textColor,
      },
      savedAt: timestamp,
    };
    
    const updatedTemplates = [...savedTemplates, templateData];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    
    setShowNameDialog(false);
    toast.success('Template saved!', {
      description: `"${templateName.trim()}" has been saved to your templates.`
    });
  };

  const loadTemplate = (template: SavedTemplate) => {
    haptics.light();
    setPosition(template.config.position);
    setAspectRatio(template.config.aspectRatio);
    setSize(template.config.size);
    setDuration(template.config.duration);
    setBackgroundColor(template.config.backgroundColor);
    setTextColor(template.config.textColor);
    
    toast.success('Template loaded!', {
      description: `Applied "${template.name}" configuration.`
    });
  };

  const deleteTemplate = (templateName: string) => {
    haptics.medium();
    const updatedTemplates = savedTemplates.filter(t => t.name !== templateName);
    setSavedTemplates(updatedTemplates);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    
    toast.success('Template deleted', {
      description: `"${templateName}" has been removed.`
    });
  };

  const renameTemplate = (oldName: string) => {
    haptics.light();
    setRenamingTemplate(oldName);
    setTemplateName(oldName);
    setIsRenaming(true);
    setShowNameDialog(true);
    setShowRenameMenu(null);
  };

  const confirmRename = () => {
    if (!templateName.trim() || !renamingTemplate) return;
    
    // Check for duplicate names (excluding the current template)
    if (savedTemplates.some(t => t.name === templateName.trim() && t.name !== renamingTemplate)) {
      alert('A template with this name already exists. Please choose a different name.');
      return;
    }
    
    haptics.medium();
    const updatedTemplates = savedTemplates.map(t => 
      t.name === renamingTemplate 
        ? { ...t, name: templateName.trim() }
        : t
    );
    
    setSavedTemplates(updatedTemplates);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    
    setShowNameDialog(false);
    setRenamingTemplate(null);
    
    toast.success('Template renamed', {
      description: `Renamed to "${templateName.trim()}"`
    });
  };

  // Get preview container aspect ratio
  const getPreviewAspectRatio = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video'; // 16:9
      case '9:16':
        return 'aspect-[9/16]'; // 9:16
      case '1:1':
        return 'aspect-square'; // 1:1
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Live Preview
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={isPreviewPlaying}
              className="flex items-center gap-2 px-4 py-2 bg-[#ec1e24] text-white rounded-lg hover:bg-[#d11a20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPreviewPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span className="text-sm">Playing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="text-sm">Preview</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="relative w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className={`w-full ${getPreviewAspectRatio()} relative`}>
            {/* Simulated video background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-500 text-center">
                  <Monitor className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Video Preview Area</p>
                </div>
              </div>
            </div>

            {/* Lower Third Overlay */}
            <LowerThird
              title={sampleTitle}
              subtitle={sampleSubtitle}
              position={position}
              aspectRatio={aspectRatio}
              size={size}
              isVisible={isPreviewPlaying}
              backgroundColor={backgroundColor}
              textColor={textColor}
            />
          </div>
        </div>
      </div>

      {/* Saved Templates Section */}
      {savedTemplates.length > 0 && (
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300 mb-3 block">My Saved Templates</label>
          <div className="space-y-2">
            {savedTemplates.map((template) => (
              <div
                key={template.name}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg"
              >
                <button
                  onClick={() => loadTemplate(template)}
                  className="flex-1 text-left hover:text-[#ec1e24] transition-colors"
                >
                  <div className="text-sm text-gray-900 dark:text-white">{template.name}</div>
                  <div className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                    {template.config.position.replace(/-/g, ' ')} • {template.config.size} • {template.config.duration}s
                  </div>
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => {
                      haptics.light();
                      setShowRenameMenu(showRenameMenu === template.name ? null : template.name);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600 dark:text-[#9CA3AF]" />
                  </button>
                  
                  {showRenameMenu === template.name && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowRenameMenu(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded-lg shadow-lg z-20 overflow-hidden">
                        <button
                          onClick={() => renameTemplate(template.name)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            deleteTemplate(template.name);
                            setShowRenameMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Ratio Selection */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              haptics.light();
              setAspectRatio('16:9');
              setPosition('bottom-left'); // Reset to good default
            }}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              aspectRatio === '16:9'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            <Monitor className={`w-6 h-6 ${aspectRatio === '16:9' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
            <div className="text-center">
              <div className="text-sm text-gray-900 dark:text-white">16:9</div>
              <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Cinematic</div>
            </div>
          </button>

          <button
            onClick={() => {
              haptics.light();
              setAspectRatio('9:16');
              setPosition('bottom-center'); // Reset to good default
            }}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              aspectRatio === '9:16'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            <Smartphone className={`w-6 h-6 ${aspectRatio === '9:16' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
            <div className="text-center">
              <div className="text-sm text-gray-900 dark:text-white">9:16</div>
              <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Vertical</div>
            </div>
          </button>

          <button
            onClick={() => {
              haptics.light();
              setAspectRatio('1:1');
              setPosition('bottom-center'); // Reset to good default
            }}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              aspectRatio === '1:1'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            <Square className={`w-6 h-6 ${aspectRatio === '1:1' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
            <div className="text-center">
              <div className="text-sm text-gray-900 dark:text-white">1:1</div>
              <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Square</div>
            </div>
          </button>
        </div>
      </div>

      {/* Position Selection */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Position
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              haptics.light();
              setPosition('bottom-left');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'bottom-left'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Bottom Left
          </button>
          <button
            onClick={() => {
              haptics.light();
              setPosition('bottom-center');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'bottom-center'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Bottom Center
          </button>
          <button
            onClick={() => {
              haptics.light();
              setPosition('bottom-right');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'bottom-right'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Bottom Right
          </button>
          <button
            onClick={() => {
              haptics.light();
              setPosition('middle-left');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'middle-left'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Middle Left
          </button>
          <button
            onClick={() => {
              haptics.light();
              setPosition('middle-center');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'middle-center'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Middle Center
          </button>
          <button
            onClick={() => {
              haptics.light();
              setPosition('middle-right');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              position === 'middle-right'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Middle Right
          </button>
        </div>
      </div>

      {/* Size Selection */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Size
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              haptics.light();
              setSize('small');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              size === 'small'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Small
          </button>
          <button
            onClick={() => {
              haptics.light();
              setSize('medium');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              size === 'medium'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Medium
          </button>
          <button
            onClick={() => {
              haptics.light();
              setSize('large');
            }}
            className={`p-3 rounded-xl border-2 text-sm transition-all ${
              size === 'large'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            Large
          </button>
        </div>
      </div>

      {/* Duration Slider */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Display Duration: <span className="text-[#ec1e24]">{duration.toFixed(1)}s</span>
        </label>
        <div className="relative">
          <input
            type="range"
            min="2"
            max="6"
            step="0.5"
            value={duration}
            onChange={(e) => {
              haptics.light();
              setDuration(parseFloat(e.target.value));
            }}
            onKeyDown={(e) => {
              // Prevent arrow keys from propagating to parent keyboard shortcuts
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.stopPropagation();
                e.stopImmediatePropagation();
              }
            }}
            onFocus={(e) => {
              // Blur other elements and ensure this input is the activeElement
              e.currentTarget.focus();
            }}
            className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer slider-thumb"
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-[#9CA3AF]">
            <span>2s</span>
            <span>4s</span>
            <span>6s</span>
          </div>
        </div>
      </div>

      {/* Text Color Picker */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Text Color
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptics.light();
              setShowTextColorPicker(true);
            }}
            className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
            style={{ backgroundColor: textColor }}
            title={textColor}
          />
          <input
            type="text"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            onFocus={(e) => haptics.light()}
            autoFocus={false}
            className="flex-1 px-4 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white uppercase text-sm focus:outline-none focus:border-[#292929]"
            placeholder="#FFFFFF"
          />
        </div>
      </div>

      {/* Background Color Picker */}
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
          Background Color
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptics.light();
              setShowBgColorPicker(true);
            }}
            className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
            style={{ backgroundColor: backgroundColor }}
            title={backgroundColor}
          />
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            onFocus={(e) => haptics.light()}
            autoFocus={false}
            className="flex-1 px-4 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white uppercase text-sm focus:outline-none focus:border-[#292929]"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
        <h4 className="text-sm text-gray-900 dark:text-white mb-3">Configuration</h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Aspect Ratio:</span>
            <span className="text-gray-900 dark:text-white">{aspectRatio}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Position:</span>
            <span className="text-gray-900 dark:text-white">{position.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Size:</span>
            <span className="text-gray-900 dark:text-white">{size.charAt(0).toUpperCase() + size.slice(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Duration:</span>
            <span className="text-gray-900 dark:text-white">{duration}s per title</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Background Color:</span>
            <span className="text-gray-900 dark:text-white">{backgroundColor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9CA3AF]">Text Color:</span>
            <span className="text-gray-900 dark:text-white">{textColor}</span>
          </div>
        </div>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveTemplate}
          className="flex-1 py-3 bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-2 border-gray-200 dark:border-[#333333] rounded-xl hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-colors flex items-center justify-center gap-2"
        >
          Save Template
        </button>
        
        {onSave && (
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-[#ec1e24] text-white rounded-xl hover:bg-[#d11a20] transition-colors"
          >
            Save Configuration
          </button>
        )}
      </div>

      {/* Template Name Dialog */}
      <BottomSheet open={showNameDialog} onOpenChange={setShowNameDialog}>
        <BottomSheetHeader>
          <BottomSheetTitle className="text-gray-900 dark:text-white">
            {isRenaming ? 'Rename Template' : 'Save Template'}
          </BottomSheetTitle>
          <BottomSheetDescription className="text-gray-600 dark:text-[#9CA3AF]">
            {isRenaming ? 'Enter a new name for your template.' : 'Enter a name for your lower third template.'}
          </BottomSheetDescription>
        </BottomSheetHeader>
        
        <BottomSheetBody>
          <Input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (isRenaming) {
                  confirmRename();
                } else {
                  saveTemplateWithName();
                }
              }
            }}
            placeholder="Enter template name..."
            className="w-full bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            autoFocus
          />
        </BottomSheetBody>
        
        <BottomSheetFooter>
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => {
                haptics.light();
                setShowNameDialog(false);
                setRenamingTemplate(null);
              }}
              variant="outline"
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (isRenaming) {
                  confirmRename();
                } else {
                  saveTemplateWithName();
                }
              }}
              disabled={!templateName.trim()}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d11a20] text-white disabled:opacity-50"
            >
              {isRenaming ? 'Rename' : 'Save'}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Color Picker Popups */}
      <ColorPickerPopup
        isOpen={showBgColorPicker}
        onClose={() => setShowBgColorPicker(false)}
        currentColor={backgroundColor}
        onColorSelect={(color) => {
          haptics.light();
          setBackgroundColor(color);
        }}
      />

      <ColorPickerPopup
        isOpen={showTextColorPicker}
        onClose={() => setShowTextColorPicker(false)}
        currentColor={textColor}
        onColorSelect={(color) => {
          haptics.light();
          setTextColor(color);
        }}
      />
    </div>
  );
}