/**
 * Sync Conflict Resolver Component
 * Handles resolution of data synchronization conflicts
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme';
import { Button } from './Button';
import { Modal } from './Modal';
import offlineService, { SyncConflict } from '../../services/offlineService';

interface SyncConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncConflictResolver: React.FC<SyncConflictResolverProps> = ({
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConflicts(offlineService.getConflicts());
    }
  }, [isOpen]);

  const handleResolveConflict = async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    setResolving(true);
    try {
      await offlineService.resolveConflict(conflictId, resolution);
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      setSelectedConflict(null);
      
      if (conflicts.length <= 1) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const formatData = (data: any): string => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 'draft': return '📝';
      case 'contact': return '👤';
      case 'settings': return '⚙️';
      default: return '📄';
    }
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sync Conflicts"
      size="lg"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[4],
        maxHeight: '60vh',
        overflow: 'hidden'
      }}>
        {!selectedConflict ? (
          // Conflict list view
          <>
            <div style={{
              padding: theme.spacing[3],
              backgroundColor: theme.colors.semantic.warning[50],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.semantic.warning[200]}`
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
                marginBottom: theme.spacing[2]
              }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <span style={{
                  fontWeight: 600,
                  color: theme.colors.semantic.warning[700]
                }}>
                  {conflicts.length} Sync Conflict{conflicts.length > 1 ? 's' : ''} Found
                </span>
              </div>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.semantic.warning[600],
                margin: 0
              }}>
                Your local changes conflict with remote changes. Please review and resolve each conflict.
              </p>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing[3]
            }}>
              {conflicts.map((conflict) => (
                <motion.div
                  key={conflict.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: theme.spacing[3],
                    border: `1px solid ${theme.colors.border.primary}`,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: theme.colors.surface.secondary,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedConflict(conflict)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: theme.spacing[2]
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing[2]
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>
                        {getConflictTypeIcon(conflict.type)}
                      </span>
                      <div>
                        <div style={{
                          fontWeight: 600,
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.text.primary
                        }}>
                          {conflict.type.charAt(0).toUpperCase() + conflict.type.slice(1)} Conflict
                        </div>
                        <div style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.text.secondary
                        }}>
                          {new Date(conflict.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: theme.typography.fontSize.sm,
                      color: theme.colors.text.tertiary
                    }}>
                      →
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          // Conflict detail view
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              marginBottom: theme.spacing[3]
            }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedConflict(null)}
              >
                ← Back
              </Button>
              <div>
                <div style={{
                  fontWeight: 600,
                  fontSize: theme.typography.fontSize.lg
                }}>
                  {selectedConflict.type.charAt(0).toUpperCase() + selectedConflict.type.slice(1)} Conflict
                </div>
                <div style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.secondary
                }}>
                  {new Date(selectedConflict.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: theme.spacing[4],
              flex: 1,
              minHeight: 0
            }}>
              {/* Local version */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${theme.colors.semantic.warning[300]}`,
                borderRadius: theme.borderRadius.md,
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: theme.spacing[3],
                  backgroundColor: theme.colors.semantic.warning[100],
                  borderBottom: `1px solid ${theme.colors.semantic.warning[300]}`,
                  fontWeight: 600,
                  fontSize: theme.typography.fontSize.sm
                }}>
                  📱 Your Local Version
                </div>
                <div style={{
                  flex: 1,
                  padding: theme.spacing[3],
                  overflowY: 'auto',
                  backgroundColor: theme.colors.surface.primary
                }}>
                  <pre style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontFamily: theme.typography.fontFamily.mono.join(', '),
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formatData(selectedConflict.localData)}
                  </pre>
                </div>
              </div>

              {/* Remote version */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${theme.colors.semantic.success[300]}`,
                borderRadius: theme.borderRadius.md,
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: theme.spacing[3],
                  backgroundColor: theme.colors.semantic.success[100],
                  borderBottom: `1px solid ${theme.colors.semantic.success[300]}`,
                  fontWeight: 600,
                  fontSize: theme.typography.fontSize.sm
                }}>
                  ☁️ Remote Version
                </div>
                <div style={{
                  flex: 1,
                  padding: theme.spacing[3],
                  overflowY: 'auto',
                  backgroundColor: theme.colors.surface.primary
                }}>
                  <pre style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontFamily: theme.typography.fontFamily.mono.join(', '),
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formatData(selectedConflict.remoteData)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Resolution buttons */}
            <div style={{
              display: 'flex',
              gap: theme.spacing[2],
              justifyContent: 'center',
              paddingTop: theme.spacing[3],
              borderTop: `1px solid ${theme.colors.border.primary}`
            }}>
              <Button
                variant="outline"
                onClick={() => handleResolveConflict(selectedConflict.id, 'local')}
                disabled={resolving}
              >
                Use Local Version
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResolveConflict(selectedConflict.id, 'remote')}
                disabled={resolving}
              >
                Use Remote Version
              </Button>
              <Button
                variant="primary"
                onClick={() => handleResolveConflict(selectedConflict.id, 'merge')}
                disabled={resolving}
              >
                {resolving ? 'Resolving...' : 'Merge Both'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};