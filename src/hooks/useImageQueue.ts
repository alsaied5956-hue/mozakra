import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CoverVisualSpec,
  ImageGenerationStatus,
  ImageQueueSummary,
  OutlineLesson,
  StudyGuideDocument,
  TeacherProfile,
} from '../types/studyGuide';
import { buildImageCacheKey, getCachedImage, setCachedImage } from '../utils/imageCache';
import { buildCoverImagePrompt, buildPageImagePrompt } from '../utils/imagePrompts';

interface ImageTask {
  target: 'cover' | string; // 'cover' or StudyPage.id
  customNote?: string;
  forceFresh?: boolean;
  regenNonce?: string;
}

interface UseImageQueueParams {
  document: StudyGuideDocument | null;
  setDocument: React.Dispatch<React.SetStateAction<StudyGuideDocument | null>>;
  profile: TeacherProfile;
  outline: OutlineLesson[];
  coverVisualSpec?: CoverVisualSpec;
}

const IMAGE_REQUEST_GAP_MS = 1800;
const BACKOFF_SECONDS = [3, 6, 12];

export function useImageQueue({
  document,
  setDocument,
  profile,
  outline,
  coverVisualSpec,
}: UseImageQueueParams) {
  const [autoGenerateImages, setAutoGenerateImages] = useState<boolean>(true);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(undefined);
  const [coverImageStatus, setCoverImageStatus] = useState<ImageGenerationStatus>('idle');
  const [coverImageError, setCoverImageError] = useState<string | undefined>(undefined);
  const [isRegeneratingCover, setIsRegeneratingCover] = useState<boolean>(false);
  const [regeneratingPageId, setRegeneratingPageId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

  // Refs to prevent stale closures inside the sequential async worker
  const documentRef = useRef(document);
  documentRef.current = document;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const coverSpecRef = useRef(coverVisualSpec);
  coverSpecRef.current = coverVisualSpec;
  const coverImageUrlRef = useRef(coverImageUrl);
  coverImageUrlRef.current = coverImageUrl;
  const coverImageStatusRef = useRef(coverImageStatus);
  coverImageStatusRef.current = coverImageStatus;

  const queueTasksRef = useRef<ImageTask[]>([]);
  const workerRunningRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const epochRef = useRef<number>(0);
  const lastNetworkCallAtRef = useRef<number>(0);
  const previousSubjectRef = useRef<string>(profile.subject);

  pausedRef.current = isQueuePaused;

  const updateCoverState = useCallback(
    (patch: {
      url?: string;
      status: ImageGenerationStatus;
      error?: string;
    }) => {
      if (patch.url !== undefined) {
        setCoverImageUrl(patch.url);
      }
      setCoverImageStatus(patch.status);
      setCoverImageError(patch.error);

      setDocument((prev) =>
        prev
          ? {
              ...prev,
              coverImageUrl: patch.url !== undefined ? patch.url : prev.coverImageUrl,
              coverImageStatus: patch.status,
              coverImageError: patch.error,
            }
          : prev
      );
    },
    [setDocument]
  );

  const updatePageImageState = useCallback(
    (
      pageId: string,
      patch: {
        illustrationImageUrl?: string;
        illustrationStatus: ImageGenerationStatus;
        illustrationError?: string;
        illustrationPrompt?: string;
      }
    ) => {
      setDocument((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
        };
      });
    },
    [setDocument]
  );

  const fetchImageWithBackoff = useCallback(
    async (
      prompt: string,
      taskEpoch: number
    ): Promise<
      | { ok: true; imageUrl: string }
      | { ok: false; paused: true }
      | { ok: false; paused: false; error: string }
    > => {
      for (let attempt = 0; attempt <= BACKOFF_SECONDS.length; attempt++) {
        if (epochRef.current !== taskEpoch) {
          return { ok: false, paused: true };
        }
        if (pausedRef.current) {
          return { ok: false, paused: true };
        }

        // Strict sequential spacing between API calls
        const elapsed = Date.now() - lastNetworkCallAtRef.current;
        if (lastNetworkCallAtRef.current > 0 && elapsed < IMAGE_REQUEST_GAP_MS) {
          await new Promise((r) => setTimeout(r, IMAGE_REQUEST_GAP_MS - elapsed));
        }

        if (epochRef.current !== taskEpoch || pausedRef.current) {
          return { ok: false, paused: true };
        }

        lastNetworkCallAtRef.current = Date.now();

        try {
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              aspectRatio: '16:9',
            }),
          });

          const data = (await response.json()) as {
            imageUrl?: string;
            error?: string;
            retryAfterSeconds?: number;
          };

          if (response.ok && data.imageUrl) {
            return { ok: true, imageUrl: data.imageUrl };
          }

          if (response.status === 429) {
            const serverWait = Number(data.retryAfterSeconds) || 0;
            if (serverWait > 120) {
              return {
                ok: false,
                paused: false,
                error: data.error || 'تم استنفاد حصة التوليد المجانية المؤقتة.',
              };
            }
            if (attempt < BACKOFF_SECONDS.length) {
              const waitSec = Math.min(45, Math.max(BACKOFF_SECONDS[attempt], serverWait));
              for (let rem = waitSec; rem > 0; rem--) {
                if (epochRef.current !== taskEpoch || pausedRef.current) {
                  setCooldownSeconds(null);
                  return { ok: false, paused: true };
                }
                setCooldownSeconds(rem);
                await new Promise((r) => setTimeout(r, 1000));
              }
              setCooldownSeconds(null);
              continue;
            }
          }

          return {
            ok: false,
            paused: false,
            error: data.error || 'تعذر توليد الصورة بالذكاء الاصطناعي.',
          };
        } catch (err) {
          if (attempt < BACKOFF_SECONDS.length) {
            const waitSec = BACKOFF_SECONDS[attempt];
            for (let rem = waitSec; rem > 0; rem--) {
              if (epochRef.current !== taskEpoch || pausedRef.current) {
                setCooldownSeconds(null);
                return { ok: false, paused: true };
              }
              setCooldownSeconds(rem);
              await new Promise((r) => setTimeout(r, 1000));
            }
            setCooldownSeconds(null);
            continue;
          }
          return {
            ok: false,
            paused: false,
            error:
              err instanceof Error
                ? err.message
                : 'تعذر الاتصال بخادم توليد الصور.',
          };
        }
      }

      return {
        ok: false,
        paused: false,
        error: 'تم بلوغ الحد المؤقت لتوليد الصور. يرجى المحاولة بعد قليل.',
      };
    },
    []
  );

  const runQueueWorker = useCallback(async () => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;
    const myEpoch = epochRef.current;

    try {
      while (queueTasksRef.current.length > 0) {
        if (epochRef.current !== myEpoch || pausedRef.current) {
          break;
        }

        const task = queueTasksRef.current.shift()!;
        const currentProfile = profileRef.current;
        const currentDoc = documentRef.current;
        const currentOutline = outlineRef.current;

        if (task.target === 'cover') {
          const guideTitle = currentDoc?.guideTitle || currentProfile.guideTitle;
          const cacheKey = buildImageCacheKey({
            kind: 'cover',
            subject: currentProfile.subject,
            guideTitle,
            illustrationStyle: currentProfile.illustrationStyle,
            customNote: task.customNote,
            extraSeed: task.regenNonce,
          });

          if (!task.forceFresh) {
            const cached = await getCachedImage(cacheKey);
            if (cached && epochRef.current === myEpoch) {
              updateCoverState({ url: cached, status: 'completed', error: undefined });
              continue;
            }
          }

          setIsRegeneratingCover(true);
          updateCoverState({ status: 'generating', error: undefined });
          setActiveLabel('جاري رسم صورة الغلاف بالذكاء الاصطناعي...');

          const lessonTopics = currentDoc?.pages?.length
            ? currentDoc.pages.slice(0, 4).map((p) => p.lessonTitle)
            : currentOutline.slice(0, 4).map((l) => l.title);

          const prompt = buildCoverImagePrompt({
            guideTitle,
            subject: currentProfile.subject,
            gradeLevel: currentProfile.gradeLevel,
            lessonTopics,
            teachingStyle: currentProfile.teachingStyle,
            illustrationStyle: currentProfile.illustrationStyle,
            customNote: task.customNote,
          });

          const res = await fetchImageWithBackoff(prompt, myEpoch);
          setIsRegeneratingCover(false);

          if (!res.ok) {
            if (res.paused) {
              queueTasksRef.current.unshift(task);
              updateCoverState({ status: 'queued', error: undefined });
              break;
            }
            updateCoverState({ status: 'error', error: res.error });
            continue;
          }

          await setCachedImage(cacheKey, res.imageUrl);
          if (epochRef.current === myEpoch) {
            updateCoverState({
              url: res.imageUrl,
              status: 'completed',
              error: undefined,
            });
          }
          continue;
        }

        // Page image task
        const page = currentDoc?.pages.find((p) => p.id === task.target);
        if (!page) {
          continue;
        }

        const cacheKey = buildImageCacheKey({
          kind: 'page',
          subject: currentProfile.subject || currentProfile.subjectGrade,
          guideTitle: currentDoc?.guideTitle || currentProfile.guideTitle,
          lessonTitle: page.lessonTitle,
          illustrationStyle: currentProfile.illustrationStyle,
          customNote: task.customNote,
          extraSeed: task.regenNonce || page.illustrationCaption,
        });

        if (!task.forceFresh) {
          const cached = await getCachedImage(cacheKey);
          if (cached && epochRef.current === myEpoch) {
            updatePageImageState(page.id, {
              illustrationImageUrl: cached,
              illustrationStatus: 'completed',
              illustrationError: undefined,
            });
            continue;
          }
        }

        setRegeneratingPageId(page.id);
        updatePageImageState(page.id, {
          illustrationStatus: 'generating',
          illustrationError: undefined,
        });
        setActiveLabel(`جاري رسم صفحة ${page.pageNumber}: ${page.lessonTitle}`);

        const explanationSummary = page.explanationBlocks
          .map((b) => `${b.heading}: ${b.body}`)
          .join(' ')
          .slice(0, 320);

        const prompt = buildPageImagePrompt({
          subject: currentProfile.subject || currentProfile.subjectGrade,
          lessonTitle: page.lessonTitle,
          explanationSummary,
          analogyText: page.analogyText,
          illustrationSpec: page.illustrationSpec,
          illustrationStyle: currentProfile.illustrationStyle,
          customNote: task.customNote,
        });

        const res = await fetchImageWithBackoff(prompt, myEpoch);
        setRegeneratingPageId(null);

        if (!res.ok) {
          if (res.paused) {
            queueTasksRef.current.unshift(task);
            updatePageImageState(page.id, {
              illustrationStatus: 'queued',
              illustrationError: undefined,
            });
            break;
          }
          updatePageImageState(page.id, {
            illustrationStatus: 'error',
            illustrationError: res.error,
          });
          continue;
        }

        await setCachedImage(cacheKey, res.imageUrl);
        if (epochRef.current === myEpoch) {
          updatePageImageState(page.id, {
            illustrationImageUrl: res.imageUrl,
            illustrationStatus: 'completed',
            illustrationError: undefined,
            illustrationPrompt: prompt,
          });
        }
      }
    } finally {
      workerRunningRef.current = false;
      setIsRegeneratingCover(false);
      setRegeneratingPageId(null);
      setActiveLabel(null);
      setCooldownSeconds(null);
    }
  }, [fetchImageWithBackoff, updateCoverState, updatePageImageState]);

  const enqueueTask = useCallback(
    (task: ImageTask, prioritize = false) => {
      const existingIdx = queueTasksRef.current.findIndex(
        (t) => t.target === task.target
      );
      if (existingIdx !== -1) {
        if (!prioritize && !task.forceFresh) return;
        queueTasksRef.current.splice(existingIdx, 1);
      }

      if (prioritize) {
        queueTasksRef.current.unshift(task);
      } else {
        queueTasksRef.current.push(task);
      }

      if (task.target === 'cover') {
        updateCoverState({ status: 'queued', error: undefined });
      } else {
        updatePageImageState(task.target, {
          illustrationStatus: 'queued',
          illustrationError: undefined,
        });
      }
    },
    [updateCoverState, updatePageImageState]
  );

  // Clear cover image cache state cleanly when subject changes so new subject doesn't wear old subject's artwork
  useEffect(() => {
    if (previousSubjectRef.current !== profile.subject) {
      previousSubjectRef.current = profile.subject;
      setCoverImageUrl(undefined);
      setCoverImageStatus('idle');
      setCoverImageError(undefined);
    }
  }, [profile.subject]);

  // Restore cached images from IndexedDB & auto-enqueue ungenerated items when document updates
  useEffect(() => {
    let cancelled = false;
    const syncAndQueue = async () => {
      const currentDoc = document;
      if (!currentDoc) return;

      // 1. Restore or enqueue Cover image
      const effectiveCoverUrl = currentDoc.coverImageUrl || coverImageUrlRef.current;
      const effectiveCoverStatus = currentDoc.coverImageStatus || coverImageStatusRef.current;

      if (!effectiveCoverUrl && effectiveCoverStatus === 'idle') {
        const coverKey = buildImageCacheKey({
          kind: 'cover',
          subject: profile.subject,
          guideTitle: currentDoc.guideTitle || profile.guideTitle,
          illustrationStyle: profile.illustrationStyle,
        });
        const cachedCover = await getCachedImage(coverKey);
        if (cancelled) return;

        if (cachedCover) {
          updateCoverState({ url: cachedCover, status: 'completed', error: undefined });
        } else if (autoGenerateImages && !pausedRef.current) {
          enqueueTask({ target: 'cover' });
        }
      } else if (
        currentDoc.coverImageUrl &&
        coverImageUrlRef.current !== currentDoc.coverImageUrl
      ) {
        setCoverImageUrl(currentDoc.coverImageUrl);
        setCoverImageStatus('completed');
      }

      // 2. Restore or enqueue Page images
      for (const page of currentDoc.pages) {
        if (cancelled) return;
        const pageStatus = page.illustrationStatus || 'idle';
        if (page.illustrationImageUrl) continue;
        if (pageStatus !== 'idle') continue;

        const pageKey = buildImageCacheKey({
          kind: 'page',
          subject: profile.subject || profile.subjectGrade,
          guideTitle: currentDoc.guideTitle || profile.guideTitle,
          lessonTitle: page.lessonTitle,
          illustrationStyle: profile.illustrationStyle,
          extraSeed: page.illustrationCaption,
        });

        const cachedPageImg = await getCachedImage(pageKey);
        if (cancelled) return;

        if (cachedPageImg) {
          updatePageImageState(page.id, {
            illustrationImageUrl: cachedPageImg,
            illustrationStatus: 'completed',
            illustrationError: undefined,
          });
        } else if (autoGenerateImages && !pausedRef.current) {
          enqueueTask({ target: page.id });
        }
      }

      if (!cancelled && queueTasksRef.current.length > 0 && !pausedRef.current) {
        void runQueueWorker();
      }
    };

    void syncAndQueue();
    return () => {
      cancelled = true;
    };
  }, [
    document,
    profile.subject,
    profile.subjectGrade,
    profile.guideTitle,
    profile.illustrationStyle,
    autoGenerateImages,
    enqueueTask,
    runQueueWorker,
    updateCoverState,
    updatePageImageState,
  ]);

  const handleGenerateCoverImage = useCallback(
    (customNote?: string) => {
      pausedRef.current = false;
      setIsQueuePaused(false);
      enqueueTask(
        {
          target: 'cover',
          customNote,
          forceFresh: true,
          regenNonce: String(Date.now()),
        },
        true
      );
      void runQueueWorker();
    },
    [enqueueTask, runQueueWorker]
  );

  const handleGeneratePageImage = useCallback(
    (pageId: string, customNote?: string) => {
      pausedRef.current = false;
      setIsQueuePaused(false);
      enqueueTask(
        {
          target: pageId,
          customNote,
          forceFresh: true,
          regenNonce: String(Date.now()),
        },
        true
      );
      void runQueueWorker();
    },
    [enqueueTask, runQueueWorker]
  );

  const handleStartAllPendingImages = useCallback(() => {
    pausedRef.current = false;
    setIsQueuePaused(false);
    const currentDoc = documentRef.current;
    if (!currentDoc) {
      if (!coverImageUrlRef.current && coverImageStatusRef.current !== 'generating') {
        enqueueTask({ target: 'cover' });
        void runQueueWorker();
      }
      return;
    }

    if (
      !currentDoc.coverImageUrl &&
      !coverImageUrlRef.current &&
      coverImageStatusRef.current !== 'generating'
    ) {
      enqueueTask({ target: 'cover' });
    }
    for (const page of currentDoc.pages) {
      if (
        !page.illustrationImageUrl &&
        page.illustrationStatus !== 'generating'
      ) {
        enqueueTask({ target: page.id });
      }
    }
    void runQueueWorker();
  }, [enqueueTask, runQueueWorker]);

  const handleRetryFailedImages = useCallback(() => {
    pausedRef.current = false;
    setIsQueuePaused(false);
    const currentDoc = documentRef.current;
    if (coverImageStatusRef.current === 'error') {
      enqueueTask({
        target: 'cover',
        forceFresh: true,
        regenNonce: String(Date.now()),
      });
    }
    if (currentDoc) {
      for (const page of currentDoc.pages) {
        if (page.illustrationStatus === 'error') {
          enqueueTask({
            target: page.id,
            forceFresh: true,
            regenNonce: String(Date.now()),
          });
        }
      }
    }
    void runQueueWorker();
  }, [enqueueTask, runQueueWorker]);

  const handlePauseImageQueue = useCallback(() => {
    pausedRef.current = true;
    setIsQueuePaused(true);
  }, []);

  const handleResumeImageQueue = useCallback(() => {
    pausedRef.current = false;
    setIsQueuePaused(false);
    handleStartAllPendingImages();
  }, [handleStartAllPendingImages]);

  const handleToggleAutoImages = useCallback(() => {
    setAutoGenerateImages((prev) => {
      const next = !prev;
      if (next) {
        pausedRef.current = false;
        setIsQueuePaused(false);
        setTimeout(() => {
          handleStartAllPendingImages();
        }, 0);
      } else {
        // Clear remaining queued tasks cleanly (let active task finish)
        const pending = [...queueTasksRef.current];
        queueTasksRef.current = [];
        for (const t of pending) {
          if (t.target === 'cover') {
            if (coverImageStatusRef.current === 'queued') {
              updateCoverState({ status: 'idle', error: undefined });
            }
          } else {
            updatePageImageState(t.target, {
              illustrationStatus: 'idle',
              illustrationError: undefined,
            });
          }
        }
      }
      return next;
    });
  }, [handleStartAllPendingImages, updateCoverState, updatePageImageState]);

  const resetImageQueue = useCallback(() => {
    epochRef.current += 1;
    queueTasksRef.current = [];
    pausedRef.current = false;
    setIsQueuePaused(false);
    setCoverImageUrl(undefined);
    setCoverImageStatus('idle');
    setCoverImageError(undefined);
    setIsRegeneratingCover(false);
    setRegeneratingPageId(null);
    setActiveLabel(null);
    setCooldownSeconds(null);
  }, []);

  const imageQueueSummary: ImageQueueSummary = useMemo(() => {
    const pages = document?.pages ?? [];
    const total = (document ? 1 : 0) + pages.length;

    let completed = 0;
    let queued = 0;
    let generating = 0;
    let failed = 0;

    if (document) {
      const cStatus: ImageGenerationStatus = isRegeneratingCover
        ? 'generating'
        : document.coverImageStatus ||
          coverImageStatus ||
          (coverImageUrl ? 'completed' : 'idle');
      if (cStatus === 'generating') generating++;
      else if (cStatus === 'queued') queued++;
      else if (cStatus === 'error') failed++;
      else if (document.coverImageUrl || coverImageUrl || cStatus === 'completed') {
        completed++;
      }
    } else if (isRegeneratingCover || coverImageStatus === 'generating') {
      generating++;
    } else if (coverImageStatus === 'queued') {
      queued++;
    }

    for (const p of pages) {
      const st: ImageGenerationStatus =
        regeneratingPageId === p.id ? 'generating' : p.illustrationStatus || 'idle';
      if (st === 'generating') generating++;
      else if (st === 'queued') queued++;
      else if (st === 'error') failed++;
      else if (p.illustrationImageUrl || st === 'completed') completed++;
    }

    return {
      total,
      completed,
      queued,
      generating,
      failed,
      activeLabel,
      cooldownSeconds,
      isPaused: isQueuePaused,
    };
  }, [
    document,
    coverImageUrl,
    coverImageStatus,
    isRegeneratingCover,
    regeneratingPageId,
    activeLabel,
    cooldownSeconds,
    isQueuePaused,
  ]);

  return {
    autoGenerateImages,
    coverImageUrl,
    coverImageStatus,
    coverImageError,
    isRegeneratingCover,
    regeneratingPageId,
    imageQueueSummary,
    handleGenerateCoverImage,
    handleGeneratePageImage,
    handleStartAllPendingImages,
    handlePauseImageQueue,
    handleResumeImageQueue,
    handleRetryFailedImages,
    handleToggleAutoImages,
    resetImageQueue,
  };
}
