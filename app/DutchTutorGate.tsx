"use client";

import { useEffect, useState } from "react";
import DutchTutorV5 from "./DutchTutorV5";

const PROGRESS_KEY = "dutch-tutor-progress-v5";
const ACTIVE_KEY = "dutch-tutor-active-v5";

function hasPlaceholder(value: unknown) {
  const text = String(value ?? "");
  return text.includes("…") || text.includes("...");
}

export default function DutchTutorGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const rawProgress = localStorage.getItem(PROGRESS_KEY);
      if (rawProgress) {
        const progress = JSON.parse(rawProgress);
        if (Array.isArray(progress.vocabulary)) {
          progress.vocabulary = progress.vocabulary.filter((item: any) => !hasPlaceholder(item?.dutch));
          progress.wordsLearned = progress.vocabulary.length;
        }
        if (Array.isArray(progress.notebookDue)) {
          progress.notebookDue = progress.notebookDue.filter((item: any) => !hasPlaceholder(item?.dutch));
        }
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      }

      const rawActive = localStorage.getItem(ACTIVE_KEY);
      if (rawActive) {
        const active = JSON.parse(rawActive);
        const containsBadSavedTarget = [
          ...(Array.isArray(active.reviewQueue) ? active.reviewQueue : []),
          ...(Array.isArray(active.lessonItems) ? active.lessonItems : []),
          ...(Array.isArray(active.sessionLearned) ? active.sessionLearned : []),
        ].some((item: any) => hasPlaceholder(item?.dutch));

        if (containsBadSavedTarget || hasPlaceholder(active?.pendingRetry?.better)) {
          localStorage.removeItem(ACTIVE_KEY);
        }
      }
    } catch {
      // If old saved state is malformed, let V5 start clean rather than blocking the tutor.
      try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    }

    setReady(true);
  }, []);

  if (!ready) return null;
  return <DutchTutorV5 />;
}
