import { useState, useCallback, useEffect } from 'react';

export interface UseSpeechResult {
  isSpeaking: boolean;
  activeMessageId: string | null;
  speak: (text: string, messageId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useSpeech(): UseSpeechResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveMessageId(null);
  }, []);

  const speak = useCallback((text: string, messageId?: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis is not supported in this browser.');
      return;
    }

    // If clicking the same active speaking message, toggle stop
    if (isSpeaking && activeMessageId === messageId) {
      stop();
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown symbols for natural speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
      .replace(/[*#`_~]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (messageId) setActiveMessageId(messageId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveMessageId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSpeaking, activeMessageId, stop]);

  const pause = useCallback(() => {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  }, []);

  const resume = useCallback(() => {
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeaking,
    activeMessageId,
    speak,
    pause,
    resume,
    stop
  };
}
