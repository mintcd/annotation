"use client";
import React, { useMemo } from 'react';
import { useHotkey, useMobile } from "../hooks";
import colorPickerStyles from "../styles/ColorPicker.styles";
import { highlightBoundingRect } from "../utils/highlight";

type ColorPickerProps = {
  onColorSelect: (color: string) => void;
  onClose: () => void;
  currentColor?: string;
  // Accept either a precomputed anchor rect or an annotation id so the picker
  // can compute its own anchor rect lazily.
  anchorRect?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  anchorId?: string | null;
};

const HIGHLIGHT_COLORS = [
  { name: "Blue", value: "#87ceeb" },
  { name: "Green", value: "#90ee90" },
  { name: "Red", value: "#ff6b6b" },
  { name: "Gray", value: "#d3d3d3" },
];

export default function ColorPicker({
  onColorSelect,
  onClose,
  currentColor,
  anchorRect,
  anchorId,
}: ColorPickerProps) {
  const { viewportInfo } = useMobile();

  const computedAnchorRect = useMemo(() => {
    if (!anchorId) return anchorRect ?? null;
    return highlightBoundingRect(anchorId);
  }, [anchorId, anchorRect]);

  useHotkey((e) => e.key === 'Escape', onClose);

  return (
    <>
      {/* Backdrop to close when clicking outside */}
      <div
        style={colorPickerStyles.backdrop}
        onClick={onClose}
      />

      {/* Color picker panel */}
      <div
        role="dialog"
        aria-label="Color picker"
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.preventDefault()}
        style={colorPickerStyles.panel(viewportInfo, computedAnchorRect)}
      >
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onColorSelect(color.value)}
            title={`${color.name} highlight`}
            style={colorPickerStyles.colorButton(color.value, currentColor === color.value)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, colorPickerStyles.colorButtonHover(currentColor === color.value));
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, colorPickerStyles.colorButtonLeave(currentColor === color.value));
            }}
            aria-label={`Select ${color.name} color`}
            aria-pressed={currentColor === color.value}
          >
          </button>
        ))}
      </div>
    </>
  );
}