import { useState, useEffect, useRef } from 'react';

export function useCommentEditing() {
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Set cursor to end of textarea when comment editing starts
  useEffect(() => {
    if (editingCommentId && commentTextareaRef.current) {
      const textarea = commentTextareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(commentDraft.length, commentDraft.length);
    }
  }, [editingCommentId, commentDraft.length]);

  return {
    commentDraft,
    setCommentDraft,
    editingCommentId,
    setEditingCommentId,
    commentTextareaRef,
  };
}