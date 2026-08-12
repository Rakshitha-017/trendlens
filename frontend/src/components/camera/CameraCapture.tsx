import React from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture
}) => {
  const {
    isStreaming,
    capturedImage,
    error,
    facingMode,
    videoRef,
    openCamera,
    capturePhoto,
    retakePhoto,
    toggleFacingMode
  } = useCamera(isOpen);

  if (!isOpen) return null;

  const handleDone = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-[#FFFCF8] dark:bg-[#26221F] rounded-3xl overflow-hidden border border-[#E7DED2] dark:border-[#3E3832] shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7DED2] dark:border-[#3E3832]">
          <div className="flex items-center gap-2 text-[#3B342E] dark:text-[#F8F5F0]">
            <Camera className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />
            <span className="font-serif text-lg font-medium">Capture Photo</span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close camera"
            className="p-1.5 rounded-full hover:bg-[#F8F5F0] dark:hover:bg-[#1C1815] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Stage / Video View */}
        <div className="relative aspect-video bg-[#1C1815] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs text-[#A8A096] leading-relaxed">{error}</p>
              <button
                onClick={openCamera}
                className="px-4 py-2 rounded-xl bg-[#8A6A4A] text-[#FFFCF8] text-xs font-medium hover:bg-[#73553A] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* Switch facing mode toggle */}
          {isStreaming && !capturedImage && (
            <button
              onClick={toggleFacingMode}
              aria-label="Switch camera"
              title="Flip camera"
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#F8F5F0] dark:bg-[#1C1815] border-t border-[#E7DED2] dark:border-[#3E3832] flex items-center justify-between">
          {capturedImage ? (
            <>
              <button
                onClick={retakePhoto}
                className="px-4 py-2 rounded-xl border border-[#E7DED2] dark:border-[#3E3832] text-xs font-medium text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
              >
                Retake
              </button>

              <button
                onClick={handleDone}
                className="px-5 py-2 rounded-xl bg-[#8A6A4A] hover:bg-[#73553A] text-[#FFFCF8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Use Photo</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => capturePhoto()}
                disabled={!isStreaming}
                className="px-6 py-2.5 rounded-xl bg-[#8A6A4A] hover:bg-[#73553A] disabled:opacity-40 text-[#FFFCF8] text-xs font-medium flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
