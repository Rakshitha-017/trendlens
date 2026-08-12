import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCameraResult {
  isOpen: boolean;
  isStreaming: boolean;
  capturedImage: string | null;
  error: string | null;
  facingMode: 'user' | 'environment';
  videoRef: React.RefObject<HTMLVideoElement | null>;
  openCamera: () => Promise<void>;
  closeCamera: () => void;
  capturePhoto: () => string | null;
  retakePhoto: () => void;
  toggleFacingMode: () => Promise<void>;
}

export function useCamera(isModalOpen: boolean = false): UseCameraResult {
  const [isOpen, setIsOpen] = useState(isModalOpen);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const openCamera = useCallback(async () => {
    setError(null);
    setCapturedImage(null);
    setIsOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or environment.');
      }

      stopStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.log('Video play muted fallback:', e);
        }
        setIsStreaming(true);
      } else {
        // Retry attaching stream once ref attaches
        setTimeout(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(console.error);
            setIsStreaming(true);
          }
        }, 100);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(err?.message || 'Could not access camera. Please check browser permissions.');
      setIsStreaming(false);
    }
  }, [facingMode, stopStream]);

  const closeCamera = useCallback(() => {
    stopStream();
    setIsOpen(false);
    setCapturedImage(null);
    setError(null);
  }, [stopStream]);

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Flip horizontally if front camera for natural mirror effect
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopStream();
    return dataUrl;
  }, [facingMode, stopStream]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    openCamera();
  }, [openCamera]);

  const toggleFacingMode = useCallback(async () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // Trigger camera start when modal becomes open
  useEffect(() => {
    if (isModalOpen && !capturedImage) {
      openCamera();
    } else if (!isModalOpen) {
      closeCamera();
    }
  }, [isModalOpen, facingMode]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    isOpen,
    isStreaming,
    capturedImage,
    error,
    facingMode,
    videoRef,
    openCamera,
    closeCamera,
    capturePhoto,
    retakePhoto,
    toggleFacingMode
  };
}
