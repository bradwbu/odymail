import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Global } from '@emotion/react';
import { ThemeProvider, useTheme, globalStyles } from './theme';
import { ToastList, useToast } from './components/ui';
import { BrowserCompatibilityWarning } from './components/ui/BrowserCompatibilityWarning';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { SyncConflictResolver } from './components/ui/SyncConflictResolver';
import { EmailComposer, EmailInbox } from './components';
import { SimpleLayout } from './components/layout/SimpleLayout';
import { useOffline } from './hooks/useOffline';

function AppContent() {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isConflictResolverOpen, setIsConflictResolverOpen] = useState(false);
  const { theme } = useTheme();
  const toast = useToast();
  const { conflicts } = useOffline();

  const openComposer = () => setIsComposerOpen(true);
  const closeComposer = () => setIsComposerOpen(false);

  // Auto-open conflict resolver when conflicts are detected
  useState(() => {
    if (conflicts.length > 0 && !isConflictResolverOpen) {
      setIsConflictResolverOpen(true);
    }
  });

  return (
    <>
      <Global styles={globalStyles(theme)} />
      <BrowserCompatibilityWarning />
      <Router>
        <SimpleLayout onComposeClick={openComposer}>
          <EmailInbox />
          
          <EmailComposer
            isOpen={isComposerOpen}
            onClose={closeComposer}
            onSend={(draft) => {
              console.log('Email sent:', draft);
              toast.success('Email sent successfully!');
              closeComposer();
            }}
          />
          
          <ToastList toasts={toast.toasts} onClose={toast.removeToast} />
          <OfflineIndicator />
          <SyncConflictResolver 
            isOpen={isConflictResolverOpen}
            onClose={() => setIsConflictResolverOpen(false)}
          />
        </SimpleLayout>
      </Router>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App