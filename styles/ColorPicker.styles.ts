interface ViewportInfo {
  layoutHeight: number;
  offsetTop: number;
  visualHeight: number;
  visualWidth: number;
  offsetLeft: number;
  layoutWidth?: number;
}

const colorPickerStyles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999998
  },

  panel: (viewportInfo: ViewportInfo, anchorRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null): React.CSSProperties => ({
    position: 'fixed' as const,
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    zIndex: 999999,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.5rem',
    justifyContent: 'center',
    // If an anchorRect is provided (desktop highlight), position the picker near the highlight
    top: anchorRect ? (anchorRect.bottom + 8) : (viewportInfo.offsetTop + viewportInfo.visualHeight - 100),
    left: anchorRect ? (anchorRect.left + (anchorRect.width / 2) - 60) : (viewportInfo.offsetLeft + (viewportInfo.visualWidth / 2) - 60)
  }),

  colorButton: (color: string, isSelected: boolean): React.CSSProperties => ({
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    opacity: isSelected ? 1 : 0.2,
    backgroundColor: color
  }),

  colorButtonHover: (isSelected: boolean): React.CSSProperties => ({
    border: isSelected ? undefined : "2px solid #333",
    transform: isSelected ? undefined : "scale(1.1)"
  }),

  colorButtonLeave: (isSelected: boolean): React.CSSProperties => ({
    border: isSelected ? undefined : "1px solid #666",
    transform: isSelected ? undefined : "scale(1)"
  })
};

export default colorPickerStyles;