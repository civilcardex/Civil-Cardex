import { useState, useRef, useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";

export function usePlanoFileUpload(onFiles: (files: FileList) => void) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const fl = e.dataTransfer?.files;
    if (fl && fl.length > 0) onFiles(fl);
  }, [onFiles]);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFiles(e.target.files);
    e.target.value = '';
  }, [onFiles]);

  return { drag, setDrag, fileRef, onDrop, handleFileInput };
}
