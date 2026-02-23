import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';

interface ColorPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onColorSelect: (color: string) => void;
}

const ColorPickerPopup = ({
  isOpen,
  onClose,
  currentColor,
  onColorSelect,
}: ColorPickerPopupProps) => {
  // Predefined color palette (optimized for video captions)
  const colorPalette = [
    // Row 1 - Cyans & Blues
    ['#00E5FF', '#00BCD4', '#0288D1', '#1565C0', '#1E88E5'],
    // Row 2 - Light Blue & Oranges/Yellows
    ['#42A5F5', '#FF6D00', '#FF9800', '#FFC107', '#C0B100'],
    // Row 3 - Browns & Reds (with Screndly brand reds)
    ['#8D6E63', '#6D4C41', '#ec1e24', '#f45247', '#C62828'],
    // Row 4 - Pinks & Purples
    ['#E91E63', '#F44336', '#EC407A', '#AD1457', '#6A1B9A'],
    // Row 5 - Purples & Teals & Greens
    ['#9C27B0', '#BA68C8', '#00796B', '#00897B', '#26A69A'],
    // Row 6 - Greens & Lime & Grays
    ['#43A047', '#8BC34A', '#76FF03', '#212121', '#546E7A'],
    // Row 7 - Additional Grays & White
    ['#B0BEC5', '#78909C', '#607D8B', '#90A4AE', '#FFFFFF'],
  ];

  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetHeader>
        <BottomSheetTitle>Select Color</BottomSheetTitle>
      </BottomSheetHeader>
      <BottomSheetBody>
        {/* Color Grid */}
        <div className="space-y-3 mb-6">
          {colorPalette.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-3">
              {row.map((color, colIndex) => {
                if (!color) return <div key={colIndex} className="w-12 h-12" />;
                
                const isSelected = color.toUpperCase() === currentColor.toUpperCase();
                
                return (
                  <button
                    key={colIndex}
                    onClick={() => {
                      haptics.light();
                      onColorSelect(color);
                      onClose();
                    }}
                    className={`w-12 h-12 rounded-full transition-transform hover:scale-110 border ${
                      color === '#FFFFFF' ? 'border-gray-300 dark:border-gray-600' : 'border-transparent'
                    } ${
                      isSelected ? 'ring-4 ring-[#ec1e24] ring-offset-2 dark:ring-offset-[#000000]' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Custom Color Input */}
        <div className="mb-4">
          <label className="text-gray-900 dark:text-white text-sm mb-2 block">Custom Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={currentColor}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                onColorSelect(e.target.value);
              }}
              className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer"
            />
            <input
              type="text"
              value={currentColor}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  haptics.light();
                  onColorSelect(value);
                }
              }}
              className="flex-1 px-3 py-2 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#292929] transition-colors uppercase"
              placeholder="#000000"
            />
          </div>
        </div>
      </BottomSheetBody>
      <BottomSheetFooter>
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  );
};

export default ColorPickerPopup;