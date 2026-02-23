import React, { useState } from 'react';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { haptics } from '../../utils/haptics';
import ColorPickerPopup from '../ColorPickerPopup';
import { Type, Palette, Layout, Move, Sparkles, Check } from 'lucide-react';

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

const captionTemplates = ['Netflix Style', 'YouTube Style', 'TikTok', 'Minimal', 'Cinematic', 'Custom'];
const fontFamilies = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Open Sans', 'Lato'];
const fontWeights = ['Regular', 'Medium', 'Bold', 'Black'];
const positions = ['Top', 'Center', 'Bottom-Center', 'Bottom'];
const alignments = ['Left', 'Center', 'Right'];
const animations = ['None', 'Fade In', 'Slide Up', 'Word Highlight'];

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

    const TabButton = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
        <button
            onClick={() => {
                haptics.light();
                setActiveTab(id);
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${activeTab === id
                    ? 'bg-[#ec1e24]/10 text-[#ec1e24]'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#111]'
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
                    {/* Template Quick Select */}
                    <div className="mb-6 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                        <div className="flex gap-2">
                            {captionTemplates.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        haptics.light();
                                        setTemplate(t);
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${template === t
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-transparent'
                                            : 'bg-white dark:bg-[#111] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#333] hover:border-gray-300'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#111] rounded-xl p-1 mb-6 flex justify-between">
                        <TabButton id="style" icon={Palette} label="Style" />
                        <TabButton id="text" icon={Type} label="Typography" />
                        <TabButton id="layout" icon={Layout} label="Layout" />
                        <TabButton id="animate" icon={Sparkles} label="Effects" />
                    </div>

                    <div className="space-y-6 min-h-[300px]">
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
                                            min={12}
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
                                    <div className="flex bg-gray-100 dark:bg-[#111] rounded-lg p-1">
                                        {alignments.map(a => (
                                            <button
                                                key={a}
                                                onClick={() => {
                                                    haptics.light();
                                                    setAlignment(a);
                                                }}
                                                className={`flex-1 py-1.5 text-xs rounded-md transition-all ${alignment === a
                                                        ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white'
                                                        : 'text-gray-500'
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

                    <div className="mt-6">
                        <Button
                            className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                            onClick={onClose}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Apply Changes
                        </Button>
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
