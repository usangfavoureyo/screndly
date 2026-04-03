import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { VisuallyHidden } from './ui/visually-hidden';
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
  const colorPalette = [
    ['#00E5FF', '#00BCD4', '#0288D1', '#1565C0', '#1E88E5'],
    ['#42A5F5', '#FF6D00', '#FF9800', '#FFC107', '#C0B100'],
    ['#8D6E63', '#6D4C41', '#ec1e24', '#f45247', '#C62828'],
    ['#E91E63', '#F44336', '#EC407A', '#AD1457', '#6A1B9A'],
    ['#9C27B0', '#BA68C8', '#00796B', '#00897B', '#26A69A'],
    ['#43A047', '#8BC34A', '#76FF03', '#212121', '#546E7A'],
    ['#B0BEC5', '#78909C', '#607D8B', '#90A4AE', '#FFFFFF'],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm border border-gray-200 bg-white p-0 dark:border-[#333333] dark:bg-[#0A0A0A]">
        <VisuallyHidden>
          <DialogTitle>Select Color</DialogTitle>
          <DialogDescription>Choose a text or overlay color for your design.</DialogDescription>
        </VisuallyHidden>

        <div className="border-b border-gray-200 px-5 py-4 dark:border-[#333333]">
          <p className="text-base text-gray-900 dark:text-white">Select Color</p>
        </div>

        <div className="px-5 py-5">
          <div className="mb-6 space-y-3">
            {colorPalette.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-3">
                {row.map((color, colIndex) => {
                  const isSelected = color.toUpperCase() === currentColor.toUpperCase();

                  return (
                    <button
                      key={colIndex}
                      type="button"
                      onClick={() => {
                        haptics.light();
                        onColorSelect(color);
                        onClose();
                      }}
                      className={`h-12 w-12 rounded-full border transition-transform hover:scale-110 ${
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

          <div className="mb-4">
            <label className="mb-2 block text-sm text-gray-900 dark:text-white">Custom Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={currentColor}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  onColorSelect(e.target.value);
                }}
                className="h-12 w-12 cursor-pointer rounded-lg border border-gray-200 dark:border-[#333333]"
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
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 uppercase text-gray-900 transition-colors focus:outline-none focus:border-[#292929] dark:border-[#333333] dark:bg-[#0A0A0A] dark:text-white"
                placeholder="#000000"
              />
            </div>
          </div>

          <Button type="button" variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColorPickerPopup;
