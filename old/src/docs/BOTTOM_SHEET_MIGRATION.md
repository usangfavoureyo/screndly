# Bottom Sheet Migration Guide

**Date**: December 25, 2024  
**Purpose**: Unify all pop-up interfaces into a modern, mobile-native bottom sheet system

---

## Overview

This migration replaces all Dialog/Modal components with a standardized BottomSheet component featuring:

✅ **Slide-in from bottom** with bounce/spring entrance  
✅ **Interactive swipe-down dismissal** with elastic drag  
✅ **Smart close detection** (velocity + distance threshold)  
✅ **Spring animations** for all interactions  
✅ **Backdrop dimming** while active  
✅ **Dynamic heights** (auto, half, full)  
✅ **No scroll conflict** with internal content  
✅ **Accessibility** and keyboard support

---

## Component API

### BottomSheet (Core Component)

```tsx
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { useBottomSheet } from '../hooks/useBottomSheet';

function MyComponent() {
  const sheet = useBottomSheet();

  return (
    <>
      <Button onClick={sheet.open}>Open Sheet</Button>
      
      <BottomSheet 
        open={sheet.isOpen} 
        onOpenChange={sheet.setIsOpen}
        heightMode="auto" // 'auto' | 'half' | 'full'
        showHandle={true}
        disableSwipe={false}
        disableBackdropClose={false}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Title</BottomSheetTitle>
          <BottomSheetDescription>Description text</BottomSheetDescription>
        </BottomSheetHeader>
        
        <BottomSheetBody>
          {/* Your content here */}
        </BottomSheetBody>
        
        <BottomSheetFooter>
          <Button variant="outline" onClick={sheet.close}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </BottomSheetFooter>
      </BottomSheet>
    </>
  );
}
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | boolean | required | Open/close state |
| `onOpenChange` | (open: boolean) => void | required | State change handler |
| `heightMode` | 'auto' \| 'half' \| 'full' | 'auto' | Height mode |
| `showHandle` | boolean | true | Show drag handle |
| `disableSwipe` | boolean | false | Disable swipe-to-dismiss |
| `disableBackdropClose` | boolean | false | Disable backdrop click to close |
| `className` | string | undefined | Custom class for content |

---

## Migration Examples

### Before: Dialog Component

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

function OldComponent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Add New Channel</DialogTitle>
          <DialogDescription>Enter the channel details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Content */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### After: Bottom Sheet

```tsx
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody } from './ui/bottom-sheet';
import { useBottomSheet } from '../hooks/useBottomSheet';

function NewComponent() {
  const sheet = useBottomSheet();

  return (
    <>
      <Button onClick={sheet.open}>Open</Button>
      
      <BottomSheet open={sheet.isOpen} onOpenChange={sheet.setIsOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Add New Channel</BottomSheetTitle>
          <BottomSheetDescription>Enter the channel details.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            {/* Content */}
          </div>
        </BottomSheetBody>
      </BottomSheet>
    </>
  );
}
```

---

## Hook Usage

### Single Bottom Sheet

```tsx
import { useBottomSheet } from '../hooks/useBottomSheet';

const sheet = useBottomSheet();

// Methods:
sheet.open();        // Open the sheet
sheet.close();       // Close the sheet
sheet.toggle();      // Toggle open/closed
sheet.setIsOpen(true); // Set directly
sheet.isOpen;        // Current state
```

### Multiple Bottom Sheets

```tsx
import { useBottomSheet } from '../hooks/useBottomSheet';

const addSheet = useBottomSheet();
const editSheet = useBottomSheet();
const deleteSheet = useBottomSheet();

// Use independently
<BottomSheet open={addSheet.isOpen} onOpenChange={addSheet.setIsOpen}>...</BottomSheet>
<BottomSheet open={editSheet.isOpen} onOpenChange={editSheet.setIsOpen}>...</BottomSheet>
<BottomSheet open={deleteSheet.isOpen} onOpenChange={deleteSheet.setIsOpen}>...</BottomSheet>
```

---

## Animation Behavior

### Entrance Animation
- **Slide in from bottom** (translate3d 0 → 100%)
- **Bounce/spring effect** with slight overshoot
- **Timing**: `cubic-bezier(0.34, 1.56, 0.64, 1)` over 450ms
- **Backdrop**: Fades in simultaneously

### Swipe Interaction
1. **Drag down**: Elastic resistance (`0.55` multiplier)
2. **Drag up**: High resistance (`0.2` multiplier - rubber band)
3. **Velocity tracking**: Real-time calculation for snap detection
4. **Threshold detection**: 
   - Distance: 100px
   - Velocity: 0.5 pixels/ms

### Exit Animation
- **Elastic snap-down** if dismissed
- **Spring snap-back** if threshold not met
- **Timing**: `cubic-bezier(0.32, 0.72, 0, 1)` over 350ms
- **Backdrop**: Fades out simultaneously

### Close Triggers
- ✅ Swipe down (if threshold met)
- ✅ Backdrop click (unless disabled)
- ✅ ESC key press
- ✅ Close button click
- ✅ Programmatic close

---

## Scroll Handling

The bottom sheet intelligently handles nested scrollable content:

```tsx
<BottomSheet open={isOpen} onOpenChange={setIsOpen}>
  <BottomSheetBody>
    {/* This content scrolls */}
    <div className="space-y-4" data-scrollable>
      {longList.map(item => <div>{item}</div>)}
    </div>
  </BottomSheetBody>
</BottomSheet>
```

**Behavior**:
- ✅ Drag handle always triggers swipe gesture
- ✅ Scrollable content scrolls normally
- ✅ Only triggers swipe when scrolled to top
- ✅ No gesture conflicts

---

## Height Modes

### Auto Height (Default)
```tsx
<BottomSheet heightMode="auto">
  {/* Height determined by content, max 90vh */}
</BottomSheet>
```

### Half Height
```tsx
<BottomSheet heightMode="half">
  {/* Fixed at 50vh */}
</BottomSheet>
```

### Full Height
```tsx
<BottomSheet heightMode="full">
  {/* 100vh minus safe area */}
</BottomSheet>
```

---

## Accessibility Features

### Keyboard Support
- **ESC**: Close the sheet
- **Tab**: Focus trap within sheet
- **Enter/Space**: Activate buttons

### ARIA Attributes
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="bottom-sheet-title"
>
```

### Screen Reader Support
- Close button includes `sr-only` label
- Title properly labeled with ID
- Focus management on open/close

---

## Migration Checklist

### Components to Migrate

- [x] **ChannelsPage** - Add/Edit channel dialogs → Bottom sheets
- [x] **PlatformConnectionModal** - OAuth connection → Bottom sheet
- [x] **ColorPickerPopup** - Color selection → Bottom sheet
- [x] **SceneImportDialog** - Spreadsheet import → Bottom sheet
- [x] **TrailerScenesDialog** - Scene selection (full height) → Bottom sheet

### Side Panels (Keep as-is or convert)
- **SettingsPanel** - Consider full-height bottom sheet
- **NotificationPanel** - Consider full-height bottom sheet

---

## Performance Considerations

### Optimizations
- ✅ **will-change-transform** on animated element
- ✅ **transform3d** for GPU acceleration
- ✅ **Portal rendering** to avoid z-index issues
- ✅ **Body scroll lock** when open
- ✅ **RequestAnimationFrame** for smooth dragging

### Memory Management
- ✅ Event listeners cleaned up on unmount
- ✅ Animation frames cancelled properly
- ✅ No memory leaks from refs

---

## Testing Checklist

### Functional Tests
- [ ] Opens with bounce animation
- [ ] Closes with snap-down animation
- [ ] Swipe down dismisses correctly
- [ ] Swipe up has rubber-band resistance
- [ ] Backdrop click closes (when enabled)
- [ ] ESC key closes
- [ ] Close button works
- [ ] Haptic feedback triggers

### Edge Cases
- [ ] Rapid open/close doesn't break animations
- [ ] Multiple sheets don't conflict
- [ ] Scrollable content doesn't trigger swipe
- [ ] Swipe only triggers when scrolled to top
- [ ] Works on mobile and desktop
- [ ] Handles different content heights
- [ ] Safe area insets respected

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces properly
- [ ] Focus trapped within sheet
- [ ] Close announced to screen readers

---

## Common Patterns

### Form in Bottom Sheet
```tsx
<BottomSheet open={isOpen} onOpenChange={setIsOpen}>
  <BottomSheetHeader>
    <BottomSheetTitle>Add Item</BottomSheetTitle>
  </BottomSheetHeader>
  <BottomSheetBody>
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input placeholder="Name" />
      <Input placeholder="Description" />
    </form>
  </BottomSheetBody>
  <BottomSheetFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button type="submit" form="myForm">Save</Button>
  </BottomSheetFooter>
</BottomSheet>
```

### Confirmation Sheet
```tsx
<BottomSheet 
  open={isOpen} 
  onOpenChange={setIsOpen}
  heightMode="auto"
  disableSwipe={true} // Prevent accidental dismissal
>
  <BottomSheetHeader>
    <BottomSheetTitle>Confirm Delete</BottomSheetTitle>
    <BottomSheetDescription>This action cannot be undone.</BottomSheetDescription>
  </BottomSheetHeader>
  <BottomSheetFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
  </BottomSheetFooter>
</BottomSheet>
```

### Scrollable List
```tsx
<BottomSheet open={isOpen} onOpenChange={setIsOpen} heightMode="half">
  <BottomSheetHeader>
    <BottomSheetTitle>Select Item</BottomSheetTitle>
  </BottomSheetHeader>
  <BottomSheetBody>
    <div className="space-y-2" data-scrollable>
      {items.map(item => (
        <button key={item.id} onClick={() => handleSelect(item)}>
          {item.name}
        </button>
      ))}
    </div>
  </BottomSheetBody>
</BottomSheet>
```

---

## Benefits of Migration

### User Experience
- ✅ **Native mobile feel** with swipe gestures
- ✅ **Smooth animations** with spring physics
- ✅ **Predictable behavior** across all modals
- ✅ **Better touch targets** (drag handle)
- ✅ **Reduced cognitive load** (consistent pattern)

### Developer Experience
- ✅ **Single source of truth** for modal logic
- ✅ **Reusable hook** for state management
- ✅ **Type-safe API** with TypeScript
- ✅ **Easy to maintain** centralized code
- ✅ **Consistent styling** across app

### Performance
- ✅ **GPU-accelerated** animations
- ✅ **Optimized rendering** with portals
- ✅ **No layout thrashing** from transforms
- ✅ **Smooth 60fps** interactions

---

## Migration Status

**Completed**: 5 / 8 major components  
**In Progress**: Core dialogs complete ✅  
**Next Up**: Remaining specialized pickers (can stay as dialogs)

**Target Completion**: December 26, 2024

---

## Components Migrated

### ✅ Completed (5/8 major components)
- [x] **ChannelsPage** - Add/Edit channel dialogs → Bottom sheets
- [x] **PlatformConnectionModal** - OAuth connection → Bottom sheet
- [x] **ColorPickerPopup** - Color selection → Bottom sheet
- [x] **SceneImportDialog** - Spreadsheet import → Bottom sheet
- [x] **TrailerScenesDialog** - Scene selection (full height) → Bottom sheet

### ⚠️ Kept as Center Dialogs (Appropriate)
- [ ] **TMDbActivityPage** - Date/Time pickers (modal pickers, not content displays)
- [ ] **Other picker dialogs** - Quick selection modals

### 📝 Note on Remaining Dialogs
Some dialogs are appropriately kept as center-screen modals:
- **Date/Time pickers**: Quick selection tools that shouldn't slide from bottom
- **Confirmation dialogs**: Brief yes/no prompts
- **Small form modals**: 2-3 fields that don't need full bottom sheet treatment

The bottom sheet system is now fully implemented for **content-heavy dialogs** and **multi-step forms** where a mobile-native slide-up experience makes sense.

---

## Support

For questions or issues during migration:
1. Check this guide for examples
2. Review `/components/ChannelsPage.tsx` for reference implementation
3. Test all interactions (swipe, backdrop, ESC, close button)
4. Ensure haptic feedback is present on all interactions

---

**Last Updated**: December 25, 2024  
**Status**: ✅ System implemented and ready for migration

## 🎯 Drag-to-Dismiss Physics

- **Dismiss Threshold**: 80px drag distance (lowered for easier dismissal)
- **Velocity Threshold**: 0.3px/ms (quick flick to dismiss)
- **Elastic Resistance**: 0.55 (rubber band feel when dragging)
- **Spring Animation**: Smooth bounce on open/close