/**
 * Rich Text Editor Component for email composition
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface FormatButton {
  command: string;
  icon: React.ReactNode;
  title: string;
  isActive?: () => boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Write your message...",
  disabled = false,
  className = ''
}) => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
    }
  }, [onChange]);

  // Handle selection changes
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const selectedText = selection.toString();
      setSelectedText(selectedText);
      setIsToolbarVisible(selectedText.length > 0);
    } else {
      setSelectedText('');
      setIsToolbarVisible(false);
    }
  }, []);

  // Execute formatting command
  const executeCommand = useCallback((command: string, value?: string) => {
    if (disabled) return;
    
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [disabled, handleInput]);

  // Check if command is active
  const isCommandActive = useCallback((command: string): boolean => {
    return document.queryCommandState(command);
  }, []);

  // Format buttons configuration
  const formatButtons: FormatButton[] = [
    {
      command: 'bold',
      title: 'Bold (Ctrl+B)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      ),
      isActive: () => isCommandActive('bold')
    },
    {
      command: 'italic',
      title: 'Italic (Ctrl+I)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4l4 16M6 8h12M4 16h12" />
        </svg>
      ),
      isActive: () => isCommandActive('italic')
    },
    {
      command: 'underline',
      title: 'Underline (Ctrl+U)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v8a5 5 0 0010 0V4M5 20h14" />
        </svg>
      ),
      isActive: () => isCommandActive('underline')
    },
    {
      command: 'insertUnorderedList',
      title: 'Bullet List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      isActive: () => isCommandActive('insertUnorderedList')
    },
    {
      command: 'insertOrderedList',
      title: 'Numbered List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      ),
      isActive: () => isCommandActive('insertOrderedList')
    },
    {
      command: 'createLink',
      title: 'Insert Link',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    }
  ];

  // Handle link creation
  const handleCreateLink = useCallback(() => {
    if (selectedText) {
      const url = prompt('Enter URL:');
      if (url) {
        executeCommand('createLink', url);
      }
    }
  }, [selectedText, executeCommand]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          executeCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          executeCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          executeCommand('underline');
          break;
        case 'k':
          e.preventDefault();
          handleCreateLink();
          break;
      }
    }
  }, [disabled, executeCommand, handleCreateLink]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (!disabled) {
      setIsToolbarVisible(true);
    }
  }, [disabled]);

  // Handle blur
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't hide toolbar if clicking on toolbar buttons
    if (toolbarRef.current && toolbarRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    
    setTimeout(() => {
      setIsToolbarVisible(false);
      setSelectedText('');
    }, 100);
  }, []);

  // Handle paste to clean up formatting
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (disabled) return;

    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  }, [disabled, handleInput]);

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ 
          opacity: isToolbarVisible ? 1 : 0,
          y: isToolbarVisible ? 0 : -10
        }}
        transition={{ duration: 0.2 }}
        className={`flex items-center space-x-1 p-2 border-b border-gray-200 bg-gray-50 ${
          isToolbarVisible ? 'block' : 'hidden'
        }`}
      >
        {formatButtons.map((button) => (
          <motion.button
            key={button.command}
            type="button"
            title={button.title}
            className={`p-2 rounded-md transition-colors ${
              button.isActive?.() 
                ? 'bg-blue-100 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (button.command === 'createLink') {
                handleCreateLink();
              } else {
                executeCommand(button.command);
              }
            }}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
          >
            {button.icon}
          </motion.button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Text color */}
        <motion.button
          type="button"
          title="Text Color"
          className="p-2 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          onClick={() => {
            const color = prompt('Enter color (hex, rgb, or name):');
            if (color) {
              executeCommand('foreColor', color);
            }
          }}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1M7 23v-2M15 21a4 4 0 004-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4zM15 3V1M15 23v-2" />
          </svg>
        </motion.button>

        {/* Clear formatting */}
        <motion.button
          type="button"
          title="Clear Formatting"
          className="p-2 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          onClick={() => executeCommand('removeFormat')}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        className={`min-h-[300px] p-4 outline-none focus:ring-0 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        }`}
        style={{
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}
        data-placeholder={placeholder}
      />


    </div>
  );
};