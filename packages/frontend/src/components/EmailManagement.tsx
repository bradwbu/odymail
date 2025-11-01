/**
 * Email management component with search, folders, and spam filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailService } from '../services/emailService';
import { SearchService, SearchOptions, SearchResult } from '../services/searchService';
import { FolderService, EmailFolder, EmailLabel } from '../services/folderService';
import { SpamService, SpamRule } from '../services/spamService';

interface EmailManagementProps {
  className?: string;
}

export const EmailManagement: React.FC<EmailManagementProps> = ({ className = '' }) => {
  const [emailService] = useState(() => new EmailService());
  const [searchService] = useState(() => new SearchService());
  const [folderService] = useState(() => new FolderService());
  const [spamService] = useState(() => new SpamService());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOptions] = useState<SearchOptions>({
    query: '',
    folder: 'inbox',
    limit: 50
  });

  // Folder state
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');

  // Label state
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#10B981');

  // Spam state
  const [spamRules, setSpamRules] = useState<SpamRule[]>([]);
  const [showCreateSpamRule, setShowCreateSpamRule] = useState(false);
  const [newSpamRule, setNewSpamRule] = useState({
    type: 'sender' as const,
    pattern: '',
    action: 'spam' as const,
    isRegex: false,
    isActive: true
  });

  // Selected emails for bulk actions
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // Load initial data
  useEffect(() => {
    loadFolders();
    loadLabels();
    loadSpamRules();
  }, []);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const folderList = await folderService.getFolders();
      setFolders(folderList);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, [folderService]);

  // Load labels
  const loadLabels = useCallback(async () => {
    try {
      const labelList = await folderService.getLabels();
      setLabels(labelList);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  }, [folderService]);

  // Load spam rules
  const loadSpamRules = useCallback(async () => {
    try {
      const rules = await spamService.getSpamRules();
      setSpamRules(rules);
    } catch (error) {
      console.error('Failed to load spam rules:', error);
    }
  }, [spamService]);

  // Search emails
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const options: SearchOptions = {
        ...searchOptions,
        query: searchQuery
      };
      
      const results = await searchService.searchEmails(options);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchOptions, searchService]);

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    try {
      await folderService.createFolder(newFolderName, newFolderColor);
      setNewFolderName('');
      setShowCreateFolder(false);
      loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  }, [newFolderName, newFolderColor, folderService, loadFolders]);

  // Create label
  const handleCreateLabel = useCallback(async () => {
    if (!newLabelName.trim()) return;

    try {
      await folderService.createLabel(newLabelName, newLabelColor);
      setNewLabelName('');
      setShowCreateLabel(false);
      loadLabels();
    } catch (error) {
      console.error('Failed to create label:', error);
    }
  }, [newLabelName, newLabelColor, folderService, loadLabels]);

  // Create spam rule
  const handleCreateSpamRule = useCallback(async () => {
    if (!newSpamRule.pattern.trim()) return;

    try {
      await spamService.createSpamRule(newSpamRule);
      setNewSpamRule({
        type: 'sender',
        pattern: '',
        action: 'spam',
        isRegex: false,
        isActive: true
      });
      setShowCreateSpamRule(false);
      loadSpamRules();
    } catch (error) {
      console.error('Failed to create spam rule:', error);
    }
  }, [newSpamRule, spamService, loadSpamRules]);

  // Bulk move emails
  const handleBulkMoveToFolder = useCallback(async (folderId: string) => {
    if (selectedEmails.length === 0) return;

    try {
      await emailService.moveEmailsToFolder(selectedEmails, folderId);
      setSelectedEmails([]);
      // Refresh current view
    } catch (error) {
      console.error('Failed to move emails:', error);
    }
  }, [selectedEmails, emailService]);

  return (
    <div className={`flex h-full bg-white ${className}`}>
      {/* Sidebar */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isSearching && (
              <motion.div
                className="absolute right-3 top-2.5 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
          
          <motion.button
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={handleSearch}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Search
          </motion.button>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Folders</h3>
              <motion.button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setShowCreateFolder(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
            </div>

            <ul className="space-y-1">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <motion.button
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between ${
                      selectedFolder === folder.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedFolder(folder.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center">
                      {folder.color && (
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: folder.color }}
                        />
                      )}
                      <span>{folder.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {folder.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {folder.unreadCount}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{folder.emailCount}</span>
                    </div>
                  </motion.button>
                </li>
              ))}
            </ul>
          </div>

          {/* Labels */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Labels</h3>
              <motion.button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setShowCreateLabel(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
            </div>

            <ul className="space-y-1">
              {labels.map((label) => (
                <li key={label.id}>
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-gray-700">{label.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{label.emailCount}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Spam Rules */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Spam Rules</h3>
              <motion.button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => setShowCreateSpamRule(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
            </div>

            <ul className="space-y-1">
              {spamRules.slice(0, 5).map((rule) => (
                <li key={rule.id}>
                  <div className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 truncate">{rule.pattern}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rule.action === 'block' ? 'bg-red-100 text-red-700' :
                        rule.action === 'spam' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {rule.action}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {rule.type} • {rule.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        {selectedEmails.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedEmails.length} email(s) selected
              </span>
              <div className="flex space-x-2">
                <motion.button
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  onClick={() => handleBulkMoveToFolder('archive')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Archive
                </motion.button>
                <motion.button
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  onClick={() => handleBulkMoveToFolder('trash')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Delete
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Search results or email list */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchResults.length > 0 ? (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Search Results ({searchResults.length})
              </h2>
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <motion.div
                    key={result.emailId}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {result.metadata.senderEmail}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(result.metadata.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Match in {result.matchType}: {result.matchedContent}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Score: {result.score}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(result.emailId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmails([...selectedEmails, result.emailId]);
                          } else {
                            setSelectedEmails(selectedEmails.filter(id => id !== result.emailId));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8">
              {searchQuery ? 'No search results found' : 'Select a folder to view emails'}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Create Folder Modal */}
        {showCreateFolder && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-96"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Folder</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter folder name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <motion.button
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => setShowCreateFolder(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleCreateFolder}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Create Label Modal */}
        {showCreateLabel && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-96"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Label</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label Name
                  </label>
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter label name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <motion.button
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => setShowCreateLabel(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleCreateLabel}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Create Spam Rule Modal */}
        {showCreateSpamRule && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-96"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Spam Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={newSpamRule.type}
                    onChange={(e) => setNewSpamRule({ ...newSpamRule, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="sender">Sender</option>
                    <option value="subject">Subject</option>
                    <option value="content">Content</option>
                    <option value="attachment">Attachment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern
                  </label>
                  <input
                    type="text"
                    value={newSpamRule.pattern}
                    onChange={(e) => setNewSpamRule({ ...newSpamRule, pattern: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter pattern to match"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  <select
                    value={newSpamRule.action}
                    onChange={(e) => setNewSpamRule({ ...newSpamRule, action: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="spam">Move to Spam</option>
                    <option value="block">Block</option>
                    <option value="quarantine">Quarantine</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRegex"
                    checked={newSpamRule.isRegex}
                    onChange={(e) => setNewSpamRule({ ...newSpamRule, isRegex: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isRegex" className="ml-2 text-sm text-gray-700">
                    Use regular expression
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <motion.button
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => setShowCreateSpamRule(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleCreateSpamRule}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};