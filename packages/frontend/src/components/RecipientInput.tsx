/**
 * Recipient Input Component with validation and animated feedback
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailRecipient } from '../types/email';

interface RecipientInputProps {
  recipients: EmailRecipient[];
  onChange: (recipients: EmailRecipient[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const RecipientInput: React.FC<RecipientInputProps> = ({
  recipients,
  onChange,
  placeholder = "Enter email addresses...",
  disabled = false,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [validationResults, setValidationResults] = useState<{ [email: string]: boolean }>({});
  const [suggestions, setSuggestions] = useState<EmailRecipient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Mock suggestions (in a real app, this would come from contacts API)
  const mockContacts: EmailRecipient[] = [
    { email: 'alice@odyssie.net', name: 'Alice Johnson' },
    { email: 'bob@odyssie.net', name: 'Bob Smith' },
    { email: 'charlie@odyssie.net', name: 'Charlie Brown' },
    { email: 'diana@odyssie.net', name: 'Diana Prince' }
  ];

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.length > 0) {
      const filtered = mockContacts.filter(contact =>
        contact.email.toLowerCase().includes(inputValue.toLowerCase()) ||
        (contact.name && contact.name.toLowerCase().includes(inputValue.toLowerCase()))
      ).filter(contact =>
        !recipients.some(recipient => recipient.email === contact.email)
      );
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, recipients]);

  // Validate email address
  const validateEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!emailRegex.test(email)) {
      return false;
    }

    // Simulate API validation
    setIsValidatingEmail(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsValidatingEmail(false);

    // Mock validation result (in a real app, this would check if the email exists)
    const isValid = email.endsWith('@odyssie.net') || Math.random() > 0.3;
    setValidationResults(prev => ({ ...prev, [email]: isValid }));
    
    return isValid;
  }, []);

  // Add recipient
  const addRecipient = useCallback(async (email: string, name?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || recipients.some(r => r.email === trimmedEmail)) {
      return;
    }

    await validateEmail(trimmedEmail);
    
    const newRecipient: EmailRecipient = {
      email: trimmedEmail,
      name: name || undefined
    };

    onChange([...recipients, newRecipient]);
    setInputValue('');
    setShowSuggestions(false);
  }, [recipients, onChange, validateEmail]);

  // Remove recipient
  const removeRecipient = useCallback((email: string) => {
    onChange(recipients.filter(r => r.email !== email));
  }, [recipients, onChange]);

  // Handle input key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ',':
      case ';':
        e.preventDefault();
        if (inputValue.trim()) {
          addRecipient(inputValue.trim());
        }
        break;
      
      case 'Backspace':
        if (!inputValue && recipients.length > 0) {
          removeRecipient(recipients[recipients.length - 1].email);
        }
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        break;
      
      case 'ArrowDown':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          // Focus first suggestion (implement keyboard navigation if needed)
        }
        break;
    }
  }, [inputValue, recipients, addRecipient, removeRecipient, showSuggestions, suggestions, disabled]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setInputValue(e.target.value);
  }, [disabled]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: EmailRecipient) => {
    addRecipient(suggestion.email, suggestion.name);
  }, [addRecipient]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Add recipient if input has valid email
    setTimeout(() => {
      if (inputValue.trim() && emailRegex.test(inputValue.trim())) {
        addRecipient(inputValue.trim());
      }
      setShowSuggestions(false);
    }, 200); // Delay to allow suggestion clicks
  }, [inputValue, addRecipient]);

  // Handle container click to focus input
  const handleContainerClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Animation variants
  const recipientVariants = {
    hidden: { opacity: 0, scale: 0.8, x: -20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      x: 0,
      transition: { duration: 0.2, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      x: 20,
      transition: { duration: 0.15, ease: 'easeIn' }
    }
  };

  const suggestionVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.2, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: { duration: 0.15, ease: 'easeIn' }
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className={`flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md cursor-text transition-colors ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'
        }`}
        onClick={handleContainerClick}
      >
        {/* Recipients */}
        <AnimatePresence>
          {recipients.map((recipient) => {
            const isValid = validationResults[recipient.email];
            const isValidatingRecipient = isValidatingEmail && !validationResults.hasOwnProperty(recipient.email);
            
            return (
              <motion.div
                key={recipient.email}
                variants={recipientVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm ${
                  isValid === false 
                    ? 'bg-red-100 text-red-800 border border-red-300' 
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {/* Validation indicator */}
                {isValidatingRecipient ? (
                  <motion.div
                    className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : isValid === false ? (
                  <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : isValid === true ? (
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
                
                <span className="truncate max-w-xs">
                  {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
                </span>
                
                {!disabled && (
                  <motion.button
                    className="ml-1 text-current hover:bg-black hover:bg-opacity-10 rounded-full p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecipient(recipient.email);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={recipients.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-0 border-none outline-none bg-transparent placeholder-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            variants={suggestionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.email}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  transition: { delay: index * 0.05, duration: 0.2 }
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    {suggestion.name && (
                      <div className="font-medium text-gray-900">{suggestion.name}</div>
                    )}
                    <div className="text-sm text-gray-600">{suggestion.email}</div>
                  </div>
                  
                  {suggestion.email.endsWith('@odyssie.net') && (
                    <div className="flex items-center text-xs text-green-600">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Encrypted
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};