import { useState, useEffect } from 'react';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { haptics } from '../../utils/haptics';
import ColorPickerPopup from '../ColorPickerPopup';
import { Type, Palette, Layout, Sparkles, MoreVertical } from 'lucide-react';

interface CaptionEditorPanelProps {
    isOpen: boolean;
    onClose: () => void;

    template: string;
    setTemplate: (val: string) => void;
    fontFamily: string;
    setFontFamily: (val: string) => void;
    fontSize: number;
    setFontSize: (val: number) => void;
    fontWeight: string;
    setFontWeight: (val: string) => void;
    textColor: string;
    setTextColor: (val: string) => void;
    bgColor: string;
    setBgColor: (val: string) => void;
    bgOpacity: number;
    setBgOpacity: (val: number) => void;
    position: string;
    setPosition: (val: string) => void;
    alignment: string;
    setAlignment: (val: string) => void;
    strokeColor: string;
    setStrokeColor: (val: string) => void;
    strokeWidth: number;
    setStrokeWidth: (val: number) => void;
    hasShadow: boolean;
    setHasShadow: (val: boolean) => void;
    borderRadius: number;
    setBorderRadius: (val: number) => void;
    animation: string;
    setAnimation: (val: string) => void;
    wordsPerLine: number;
    setWordsPerLine: (val: number) => void;
}

// No preset templates — users create and save their own via the Custom flow
const fontFamilies = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Open Sans', 'Lato'];
const fontWeights = ['Regular', 'Medium', 'Bold', 'Black'];
const positions = ['Top', 'Center', 'Bottom-Center', 'Bottom'];
const alignments = ['Left', 'Center', 'Right'];
const animations = ['None', 'Fade In', 'Slide Up', 'Word Highlight'];

interface SavedTemplate {
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textColor: string;
    bgColor: string;
    bgOpacity: number;
    position: string;
    alignment: string;
    strokeColor: string;
    strokeWidth: number;
    shadow: boolean;
    borderRadius: number;
    animation: string;
    wordsPerLine: number;
    savedAt: string;
}

export function CaptionEditorPanel({
    isOpen, onClose,
    template, setTemplate,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    fontWeight, setFontWeight,
    textColor, setTextColor,
    bgColor, setBgColor,
    bgOpacity, setBgOpacity,
    position, setPosition,
    alignment, setAlignment,
    strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth,
    hasShadow, setHasShadow,
    borderRadius, setBorderRadius,
    animation, setAnimation,
    wordsPerLine, setWordsPerLine
}: CaptionEditorPanelProps) {

    // Local state for color pickers (now managed inside this panel to keep parent clean)
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [showBgColorPicker, setShowBgColorPicker] = useState(false);
    const [showStrokeColorPicker, setShowStrokeColorPicker] = useState(false);

    // Tab state for organization
    const [activeTab, setActiveTab] = useState<'text' | 'style' | 'layout' | 'animate'>('style');

    // Aspect ratio state for live preview
    const [previewAspectRatio, setPreviewAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('16:9');

    // Aspect ratio dimensions for preview
    const aspectRatioDimensions: Record<string, { height: string; aspectRatio: string }> = {
        '9:16': { height: '200px', aspectRatio: '9/16' },
        '16:9': { height: '120px', aspectRatio: '16/9' },
        '1:1': { height: '160px', aspectRatio: '1/1' },
        '4:5': { height: '180px', aspectRatio: '4/5' },
    };

    // Saved templates state
    const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
    const [showTemplateActions, setShowTemplateActions] = useState(false);
    const [templateActionsIndex, setTemplateActionsIndex] = useState<number | null>(null);
    const [activeSavedIndex, setActiveSavedIndex] = useState<number | null>(null);
    const [updateConfirm, setUpdateConfirm] = useState(false);

    // Load saved templates from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('screndly_saved_caption_templates');
        if (stored) {
            try { setSavedTemplates(JSON.parse(stored)); } catch { /* ignore */ }
        }
    }, []);

    const saveTemplate = () => {
        if (!templateName.trim()) return;
        haptics.medium();
        const newTemplate: SavedTemplate = {
            name: templateName.trim(),
            fontFamily, fontSize, fontWeight, textColor, bgColor, bgOpacity,
            position, alignment, strokeColor, strokeWidth,
            shadow: hasShadow, borderRadius, animation, wordsPerLine,
            savedAt: new Date().toLocaleString(),
        };
        const updated = [...savedTemplates, newTemplate];
        setSavedTemplates(updated);
        localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updated));
        setTemplateName('');
        setShowSaveDialog(false);
    };

    const renameTemplate = (index: number) => {
        if (!templateName.trim()) return;
        haptics.light();
        const updated = savedTemplates.map((t, i) =>
            i === index ? { ...t, name: templateName.trim() } : t
        );
        setSavedTemplates(updated);
        localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updated));
        setTemplateName('');
        setIsRenaming(false);
        setRenamingIndex(null);
        setShowSaveDialog(false);
    };

    const deleteTemplate = (index: number) => {
        haptics.medium();
        const updated = savedTemplates.filter((_, i) => i !== index);
        setSavedTemplates(updated);
        localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updated));
    };

    const loadTemplate = (t: SavedTemplate, index: number) => {
        haptics.light();
        if (activeSavedIndex === index) {
            setActiveSavedIndex(null);
            return;
        }
        setActiveSavedIndex(index);
        setTemplate(t.name);
        setFontFamily(t.fontFamily);
        setFontSize(t.fontSize);
        setFontWeight(t.fontWeight);
        setTextColor(t.textColor);
        setBgColor(t.bgColor);
        setBgOpacity(t.bgOpacity);
        setPosition(t.position);
        setAlignment(t.alignment);
        setStrokeColor(t.strokeColor);
        setStrokeWidth(t.strokeWidth);
        setHasShadow(t.shadow);
        setBorderRadius(t.borderRadius);
        setAnimation(t.animation);
        setWordsPerLine(t.wordsPerLine);
    };

    const TabButton = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
        <button
            onClick={() => {
                haptics.light();
                setActiveTab(id);
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${activeTab === id
                ? 'bg-[#ec1e24] text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222]'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    );

    return (
        <>
            <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <BottomSheetHeader>
                    <BottomSheetTitle className="text-gray-900 dark:text-white flex items-center justify-between">
                        <span>Caption Styles</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-[#222]"
                        >
                            <span className="sr-only">Close</span>
                        </Button>
                    </BottomSheetTitle>
                    <BottomSheetDescription className="text-gray-500 dark:text-[#6B7280]">
                        Customize the look and feel of your subtitles
                    </BottomSheetDescription>
                </BottomSheetHeader>

                <BottomSheetBody className="pt-2">
                    {/* Saved Templates */}
                    <div className="mb-6">
                        <Label className="text-gray-900 dark:text-white mb-2 block text-xs">Saved Templates</Label>
                        <div className="overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                            <div className="flex gap-2">
                                {/* Custom button — always first */}
                                <button
                                    onClick={() => {
                                        haptics.light();
                                        setActiveSavedIndex(null);
                                        setTemplate('Custom');
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${activeSavedIndex === null
                                        ? 'bg-[#ec1e24] text-white border-transparent'
                                        : 'bg-white dark:bg-[#000000] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#333] hover:border-gray-300 focus:border-gray-200 dark:focus:border-[#333]'
                                        }`}
                                >
                                    Custom
                                </button>
                                {/* User-saved templates */}
                                {savedTemplates.map((t, i) => (
                                    <button
                                        key={i}
                                        onClick={() => loadTemplate(t, i)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${activeSavedIndex === i
                                            ? 'bg-[#ec1e24] text-white border-transparent'
                                            : 'bg-white dark:bg-[#000000] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#333] hover:border-gray-300 focus:border-gray-200 dark:focus:border-[#333]'
                                            }`}
                                    >
                                        <span>{t.name}</span>
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                haptics.light();
                                                setTemplateActionsIndex(i);
                                                setShowTemplateActions(true);
                                            }}
                                            className={`ml-0.5 p-0.5 rounded-full ${activeSavedIndex === i ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-[#333]'}`}
                                        >
                                            <MoreVertical className={`w-3 h-3 ${activeSavedIndex === i ? 'text-white' : ''}`} />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Live Caption Preview */}
                    <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 dark:border-[#333]">
                        {/* Aspect Ratio Selector */}
                        <div className="bg-gray-100 dark:bg-[#000000] px-3 py-2 flex items-center gap-2">
                            {(['9:16', '16:9', '1:1', '4:5'] as const).map((ratio) => (
                                <button
                                    key={ratio}
                                    onClick={() => {
                                        haptics.light();
                                        setPreviewAspectRatio(ratio);
                                    }}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${previewAspectRatio === ratio
                                        ? 'bg-[#ec1e24] text-white'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#222]'
                                        }`}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                        {/* Preview Area */}
                        <div className="w-full flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] py-4 px-4">
                            <div
                                className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black flex flex-col overflow-hidden rounded-lg"
                                style={{
                                    width: '100%',
                                    maxWidth: previewAspectRatio === '9:16' ? '120px' : previewAspectRatio === '4:5' ? '150px' : previewAspectRatio === '1:1' ? '160px' : '100%',
                                    height: aspectRatioDimensions[previewAspectRatio].height,
                                    aspectRatio: aspectRatioDimensions[previewAspectRatio].aspectRatio,
                                    padding: '12px',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {/* Simulated film grain overlay */}
                                <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWJsZW5jZSBzdGl0Y2hUaWxlcz0ic3RpdGNoIiB0eXBlPSJmcmFjdGFsTm9pc2UiLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIwLjE1Ii8+PC9zdmc+')]" />

                                {/* Top spacer: controls vertical position */}
                                <div style={{ flex: position === 'Top' ? 0 : position === 'Center' ? 1 : position === 'Bottom-Center' ? 3 : 1 }} />

                                <span
                                    style={{
                                        fontFamily: fontFamily,
                                        fontSize: `${Math.min(fontSize, previewAspectRatio === '9:16' ? 16 : 24)}px`,
                                        fontWeight: fontWeight === 'Black' ? 900 : fontWeight === 'Bold' ? 700 : fontWeight === 'Medium' ? 500 : 400,
                                        color: textColor,
                                        backgroundColor: `${bgColor}${Math.round(bgOpacity * 2.55).toString(16).padStart(2, '0')}`,
                                        textAlign: alignment.toLowerCase() as any,
                                        borderRadius: `${borderRadius}px`,
                                        padding: bgOpacity > 0 ? '4px 8px' : '0',
                                        textShadow: hasShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                        WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
                                        lineHeight: 1.3,
                                        transition: 'all 0.2s ease',
                                        alignSelf: alignment === 'Left' ? 'flex-start' : alignment === 'Right' ? 'flex-end' : 'center',
                                    }}
                                >
                                    {Array.from({ length: Math.min(wordsPerLine, 5) }, (_, i) => ['Sample', 'caption', 'text', 'goes', 'here'][i]).join(' ')}
                                </span>

                                {/* Bottom spacer */}
                                <div style={{ flex: position === 'Top' ? 1 : position === 'Center' ? 1 : position === 'Bottom-Center' ? 1 : 0 }} />
                            </div>
                        </div>
                        <div className="bg-gray-100 dark:bg-[#000000] px-3 py-1.5 flex items-center justify-between">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">LIVE PREVIEW</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{template} · {fontFamily} {fontSize}px</span>
                        </div>
                    </div>

                    <div className="bg-gray-100 dark:bg-[#000000] rounded-xl p-1 mb-6 flex justify-between">
                        <TabButton id="style" icon={Palette} label="Style" />
                        <TabButton id="text" icon={Type} label="Typography" />
                        <TabButton id="layout" icon={Layout} label="Layout" />
                        <TabButton id="animate" icon={Sparkles} label="Effects" />
                    </div>

                    <div className="space-y-6 min-h-[250px]">
                        {activeTab === 'style' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                {/* Text Color */}
                                <div className="flex items-center justify-between">
                                    <Label className="text-gray-900 dark:text-white">Text Color</Label>
                                    <button
                                        onClick={() => setShowTextColorPicker(true)}
                                        className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#333] shadow-sm relative overflow-hidden"
                                        style={{ backgroundColor: textColor }}
                                    >
                                        <div className="absolute inset-0 ring-1 ring-black/5 dark:ring-white/10 rounded-full" />
                                    </button>
                                </div>

                                {/* Background Color & Opacity */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-gray-900 dark:text-white">Background</Label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">{bgOpacity}%</span>
                                            <button
                                                onClick={() => setShowBgColorPicker(true)}
                                                className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#333] shadow-sm relative"
                                                style={{ backgroundColor: bgColor }}
                                            />
                                        </div>
                                    </div>
                                    <Slider
                                        value={[bgOpacity]}
                                        min={0}
                                        max={100}
                                        step={5}
                                        onValueChange={(val) => {
                                            if (val[0] !== bgOpacity) haptics.light();
                                            setBgOpacity(val[0]);
                                        }}
                                        className="py-2"
                                    />
                                </div>

                                {/* Stroke Color & Width */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-gray-900 dark:text-white">Outline</Label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">{strokeWidth}px</span>
                                            <button
                                                onClick={() => setShowStrokeColorPicker(true)}
                                                className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#333] shadow-sm relative"
                                                style={{ backgroundColor: strokeColor }}
                                            />
                                        </div>
                                    </div>
                                    <Slider
                                        value={[strokeWidth]}
                                        min={0}
                                        max={10}
                                        step={1}
                                        onValueChange={(val) => {
                                            if (val[0] !== strokeWidth) haptics.light();
                                            setStrokeWidth(val[0]);
                                        }}
                                        className="py-2"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'text' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-900 dark:text-white">Font Family</Label>
                                        <Select value={fontFamily} onValueChange={setFontFamily}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fontFamilies.map(f => (
                                                    <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-900 dark:text-white">Weight</Label>
                                        <Select value={fontWeight} onValueChange={setFontWeight}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fontWeights.map(w => (
                                                    <SelectItem key={w} value={w}>{w}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-gray-900 dark:text-white">Font Size</Label>
                                        <span className="text-xs text-gray-500">{fontSize}px</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs">A</span>
                                        <Slider
                                            value={[fontSize]}
                                            min={8}
                                            max={72}
                                            step={1}
                                            onValueChange={(val) => {
                                                if (val[0] !== fontSize) haptics.light();
                                                setFontSize(val[0]);
                                            }}
                                            className="flex-1"
                                        />
                                        <span className="text-lg font-bold">A</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'layout' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="space-y-2">
                                    <Label className="text-gray-900 dark:text-white">Position</Label>
                                    <Select value={position} onValueChange={setPosition}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {positions.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-gray-900 dark:text-white">Alignment</Label>
                                    <div className="flex bg-gray-100 dark:bg-[#000000] rounded-lg p-1">
                                        {alignments.map(a => (
                                            <button
                                                key={a}
                                                onClick={() => {
                                                    haptics.light();
                                                    setAlignment(a);
                                                }}
                                                className={`flex-1 py-1.5 text-xs rounded-md transition-all ${alignment === a
                                                    ? 'bg-[#ec1e24] text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                            >
                                                {a}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-gray-900 dark:text-white">Words Per Line</Label>
                                        <span className="text-xs text-gray-500">{wordsPerLine} words</span>
                                    </div>
                                    <Slider
                                        value={[wordsPerLine]}
                                        min={1}
                                        max={10}
                                        step={1}
                                        onValueChange={(val) => {
                                            if (val[0] !== wordsPerLine) haptics.light();
                                            setWordsPerLine(val[0]);
                                        }}
                                        className="py-2"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <Label className="text-gray-900 dark:text-white">Corner Radius</Label>
                                    <Select
                                        value={borderRadius.toString()}
                                        onValueChange={(v) => setBorderRadius(parseInt(v))}
                                    >
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 4, 8, 12, 16, 24].map(r => (
                                                <SelectItem key={r} value={r.toString()}>{r}px</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'animate' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="space-y-2">
                                    <Label className="text-gray-900 dark:text-white">Animation Style</Label>
                                    <Select value={animation} onValueChange={setAnimation}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {animations.map(a => (
                                                <SelectItem key={a} value={a}>{a}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <Label className="text-gray-900 dark:text-white">Drop Shadow</Label>
                                    <Switch
                                        checked={hasShadow}
                                        onCheckedChange={(checked) => {
                                            haptics.light();
                                            setHasShadow(checked);
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-3 space-y-2">
                        <Button
                            variant="outline"
                            className="w-full border-gray-200 dark:border-[#333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111]"
                            onClick={() => {
                                haptics.light();
                                if (activeSavedIndex !== null && savedTemplates[activeSavedIndex]) {
                                    const updated = savedTemplates.map((t, i) =>
                                        i === activeSavedIndex ? {
                                            ...t,
                                            fontFamily, fontSize, fontWeight, textColor, bgColor, bgOpacity,
                                            position, alignment, strokeColor, strokeWidth,
                                            shadow: hasShadow, borderRadius, animation, wordsPerLine,
                                            savedAt: new Date().toLocaleString(),
                                        } : t
                                    );
                                    setSavedTemplates(updated);
                                    localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updated));
                                    setUpdateConfirm(true);
                                    setTimeout(() => setUpdateConfirm(false), 1500);
                                } else {
                                    setIsRenaming(false);
                                    setRenamingIndex(null);
                                    setTemplateName('');
                                    setShowSaveDialog(true);
                                }
                            }}
                        >
                            {updateConfirm ? 'Updated!' : activeSavedIndex !== null ? 'Update Template' : 'Save Template'}
                        </Button>

                        <Button
                            className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                            onClick={onClose}
                        >
                            Apply Changes
                        </Button>
                    </div>

                </BottomSheetBody>
            </BottomSheet>

            {/* Save / Rename Template Dialog */}
            <BottomSheet open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <BottomSheetHeader>
                    <BottomSheetTitle className="text-gray-900 dark:text-white">
                        {isRenaming ? 'Rename Template' : 'Save Template'}
                    </BottomSheetTitle>
                    <BottomSheetDescription className="text-gray-500 dark:text-[#6B7280]">
                        {isRenaming ? 'Enter a new name for your template' : 'Give your caption template a name'}
                    </BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="space-y-4 pt-4">
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onFocus={() => haptics.light()}
                            placeholder="Template name"
                            className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24] transition-colors"
                        />
                        <Button
                            className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                            onClick={() => {
                                if (isRenaming && renamingIndex !== null) {
                                    renameTemplate(renamingIndex);
                                } else {
                                    saveTemplate();
                                }
                            }}
                            disabled={!templateName.trim()}
                        >
                            {isRenaming ? 'Rename' : 'Save'}
                        </Button>
                    </div>
                </BottomSheetBody>
            </BottomSheet>

            {/* Template Actions Bottom Sheet */}
            <BottomSheet open={showTemplateActions} onOpenChange={setShowTemplateActions}>
                <BottomSheetHeader>
                    <BottomSheetTitle className="text-gray-900 dark:text-white">
                        {templateActionsIndex !== null && savedTemplates[templateActionsIndex]
                            ? savedTemplates[templateActionsIndex].name
                            : 'Template Actions'}
                    </BottomSheetTitle>
                    <BottomSheetDescription className="text-gray-500 dark:text-[#6B7280]">
                        Choose an action for this template
                    </BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="space-y-2 pt-2">
                        <button
                            onClick={() => {
                                if (templateActionsIndex === null) return;
                                haptics.light();
                                setShowTemplateActions(false);
                                setIsRenaming(true);
                                setRenamingIndex(templateActionsIndex);
                                setTemplateName(savedTemplates[templateActionsIndex].name);
                                setTimeout(() => setShowSaveDialog(true), 300);
                            }}
                            className="w-full p-3 rounded-lg text-sm text-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111] transition-colors"
                        >
                            Rename Template
                        </button>
                        <button
                            onClick={() => {
                                if (templateActionsIndex === null) return;
                                deleteTemplate(templateActionsIndex);
                                setShowTemplateActions(false);
                                setTemplateActionsIndex(null);
                            }}
                            className="w-full p-3 rounded-lg text-sm text-center text-[#ec1e24] hover:bg-gray-100 dark:hover:bg-[#111] transition-colors"
                        >
                            Delete Template
                        </button>
                    </div>
                </BottomSheetBody>
            </BottomSheet>

            {/* Color Pickers */}
            <ColorPickerPopup
                isOpen={showTextColorPicker}
                onClose={() => setShowTextColorPicker(false)}
                currentColor={textColor}
                onColorSelect={(color) => {
                    haptics.light();
                    setTextColor(color);
                }}
            />
            <ColorPickerPopup
                isOpen={showBgColorPicker}
                onClose={() => setShowBgColorPicker(false)}
                currentColor={bgColor}
                onColorSelect={(color) => {
                    haptics.light();
                    setBgColor(color);
                }}
            />
            <ColorPickerPopup
                isOpen={showStrokeColorPicker}
                onClose={() => setShowStrokeColorPicker(false)}
                currentColor={strokeColor}
                onColorSelect={(color) => {
                    haptics.light();
                    setStrokeColor(color);
                }}
            />
        </>
    );
}
