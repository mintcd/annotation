"use client";

import React from "react";
import emptyStateStyles from "../styles/EmptyState.styles";

export default function EmptyState() {
  return (
    <div style={emptyStateStyles.container}>
      No annotations yet.
    </div>
  );
}
