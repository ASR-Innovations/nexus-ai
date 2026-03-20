'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showSuggestedPrompts?: boolean;
  maxCharacters?: number;
}

const SUGGESTED_PROMPTS = [
  'What yield strategies are available for my PAS tokens?',
  'I want to stake PAS with low risk',
  'Show top performing agents on Polkadot Hub',
  'Help me earn yield on 100 PAS',
];

export function ChatInput({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = 'Describe your DeFi goals...',
  showSuggestedPrompts = true,
  maxCharacters = 2000,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content, with min and max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 56), 200);
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxCharacters) {
      setMessage(value);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Allow Shift+Enter for new line (default behavior)
  };

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isProcessing || disabled) return;

    onSendMessage(trimmedMessage);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (isProcessing || disabled) return;
    onSendMessage(prompt);
  };

  const characterCount = message.length;
  const isNearLimit = characterCount > maxCharacters * 0.8;
  const isOverLimit = characterCount > maxCharacters;
  const canSubmit = message.trim().length > 0 && !isProcessing && !disabled;

  return (
    <div className="relative px-4 py-4 bg-light-background/80 dark:bg-dark-background/80 backdrop-blur-xl shadow-2xl shadow-light-primary/5 dark:shadow-dark-primary/5">
      {/* Suggested Prompts */}
      <AnimatePresence>
        {showSuggestedPrompts && message.length === 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="mb-3 flex flex-wrap gap-2"
          >
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                onClick={() => handleSuggestedPrompt(prompt)}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-2 rounded-full text-xs',
                  'bg-light-surface dark:bg-dark-surface',
                  'border border-light-border dark:border-dark-border',
                  'text-light-textSecondary dark:text-dark-textSecondary',
                  'hover:border-light-primary dark:hover:border-dark-primary',
                  'hover:text-light-primary dark:hover:text-dark-primary',
                  'hover:shadow-lg hover:shadow-light-primary/10 dark:hover:shadow-dark-primary/10',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20'
                )}
                aria-label={`Suggested prompt: ${prompt}`}
              >
                <Sparkles className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                <span className="line-clamp-1">{prompt}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Container */}
      <div
        className={cn(
          'relative rounded-2xl transition-all duration-200',
          'bg-white dark:bg-[#f6f6f6]',
          'border',
          isFocused
            ? 'border-gray-400 dark:border-gray-500 shadow-md'
            : 'border-gray-200 dark:border-[#38383A] shadow-sm',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || isProcessing}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'w-full px-4 py-3 pr-24 resize-none',
            'bg-transparent',
            'text-sm text-light-textPrimary dark:text-dark-textPrimary',
            'placeholder:text-light-textTertiary dark:placeholder:dark-textTertiary',
            'focus:outline-none',
            'disabled:cursor-not-allowed'
          )}
          aria-label="Chat message input"
          aria-describedby="character-count"
        />

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 pb-3">
          {/* Character Count */}
          <div
            id="character-count"
            className={cn(
              'text-xs transition-colors duration-200',
              isOverLimit
                ? 'text-light-error dark:text-dark-error'
                : isNearLimit
                ? 'text-light-warning dark:text-dark-warning'
                : 'text-light-textTertiary dark:text-dark-textTertiary'
            )}
            aria-live="polite"
          >
            {characterCount} / {maxCharacters}
          </div>

          {/* Submit Button */}
          <motion.button
            onClick={handleSubmit}
            disabled={!canSubmit}
            whileHover={canSubmit ? { scale: 1.05 } : {}}
            whileTap={canSubmit ? { scale: 0.95 } : {}}
            className={cn(
              'flex items-center justify-center',
              'w-10 h-10 rounded-full',
              'transition-all duration-200',
              canSubmit
                ? 'bg-light-primary dark:bg-dark-primary text-white shadow-lg shadow-light-primary/40 dark:shadow-dark-primary/40 hover:shadow-2xl hover:shadow-light-primary/50 dark:hover:shadow-dark-primary/50'
                : 'bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary text-light-textTertiary dark:text-dark-textTertiary cursor-not-allowed shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20'
            )}
            aria-label={isProcessing ? 'Processing message' : 'Send message'}
            aria-disabled={!canSubmit}
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Send className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Thinking Indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-4 bottom-full mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-lg shadow-light-primary/10 dark:shadow-dark-primary/10"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-4 h-4 text-light-primary dark:text-dark-primary animate-spin" />
            <span className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
              Thinking...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Hint */}
      {isFocused && !isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-2 text-xs text-light-textTertiary dark:text-dark-textTertiary text-center"
        >
          Press <kbd className="px-1.5 py-0.5 rounded bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary">Shift+Enter</kbd> for new line
        </motion.div>
      )}
    </div>
  );
}
