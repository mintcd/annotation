const KNOB_SIZE = 7;

const sticksStyles = {
  stick: (top: number, left: number, height: number, width: number = 1): React.CSSProperties => ({
    position: 'fixed' as const,
    top,
    left,
    width,
    height,
    backgroundColor: '#0b63b3',
    cursor: 'col-resize',
    zIndex: 10000,
  }),

  // Render a circular knob that sits on the stick edge. Use absolute positioning
  // so it can be placed at the top or bottom of the stick.
  knob: (position: 'top' | 'bottom', stickWidth: number = 1.5): React.CSSProperties => ({
    position: 'absolute' as const,
    // center the knob horizontally on the stick
    left: -(KNOB_SIZE / 2) + (stickWidth / 2),
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: '50%',
    backgroundColor: '#0b63b3', // solid blue knob
    boxShadow: '0 2px 4px rgba(11,99,179,0.2)',
    zIndex: 10001,
    // vertical placement
    top: position === 'top' ? -Math.round(KNOB_SIZE / 2) : undefined,
    bottom: position === 'bottom' ? -Math.round(KNOB_SIZE / 2) : undefined,
  })
};

export default sticksStyles;