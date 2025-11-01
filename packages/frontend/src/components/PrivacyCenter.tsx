/**
 * Privacy Center - GDPR compliance and privacy management interface
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { 
  Shield, 
  Download, 
  Trash2, 
  Settings, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';

interface ConsentRecord {
  id: string;
  consentType: string;
  granted: boolean;
  timestamp: Date;
  version: string;
  expiresAt?: Date;
}

interface DataExportRequest {
  id: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  format: string;
}

interface DataDeletionRequest {
  id: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  deletionType: string;
}

interface PrivacySettings {
  dataRetentionDays: number;
  autoDeleteEmails: boolean;
  autoDeleteFiles: boolean;
  allowAnalytics: boolean;
  allowMarketing: boolean;
  emailNotifications: boolean;
  shareUsageData: boolean;
  updatedAt: Date;
}

const PrivacyCenterContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
  
  h1 {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    color: ${props => props.theme.colors.text.primary};
    font-size: 2.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  
  p {
    color: ${props => props.theme.colors.text.secondary};
    font-size: 1.125rem;
    max-width: 600px;
    margin: 0 auto;
  }
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 1rem 2rem;
  border: none;
  background: none;
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.text.secondary};
  font-weight: ${props => props.active ? '600' : '400'};
  border-bottom: 2px solid ${props => props.active ? props.theme.colors.primary : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const Section = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  padding: 2rem;
  margin-bottom: 2rem;
  
  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    color: ${props => props.theme.colors.text.primary};
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  p {
    color: ${props => props.theme.colors.text.secondary};
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }
`;

const ConsentItem = styled.div<{ granted: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  margin-bottom: 1rem;
  
  .consent-info {
    flex: 1;
    
    .consent-type {
      font-weight: 600;
      color: ${props => props.theme.colors.text.primary};
      margin-bottom: 0.25rem;
      text-transform: capitalize;
    }
    
    .consent-description {
      font-size: 0.875rem;
      color: ${props => props.theme.colors.text.secondary};
    }
    
    .consent-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.875rem;
      
      &.granted {
        color: ${props => props.theme.colors.success};
      }
      
      &.denied {
        color: ${props => props.theme.colors.error};
      }
    }
  }
  
  .consent-toggle {
    margin-left: 1rem;
  }
`;

const ToggleSwitch = styled.label<{ checked: boolean }>`
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${props => props.checked ? props.theme.colors.primary : props.theme.colors.border};
    transition: 0.3s;
    border-radius: 24px;
    
    &:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: ${props => props.checked ? '29px' : '3px'};
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }
`;

const RequestCard = styled(motion.div)<{ status: string }>`
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  
  .request-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    
    .request-info {
      .request-type {
        font-weight: 600;
        color: ${props => props.theme.colors.text.primary};
        margin-bottom: 0.25rem;
      }
      
      .request-date {
        font-size: 0.875rem;
        color: ${props => props.theme.colors.text.secondary};
      }
    }
    
    .request-status {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      
      &.pending {
        background: ${props => props.theme.colors.warning}20;
        color: ${props => props.theme.colors.warning};
      }
      
      &.processing {
        background: ${props => props.theme.colors.info}20;
        color: ${props => props.theme.colors.info};
      }
      
      &.completed {
        background: ${props => props.theme.colors.success}20;
        color: ${props => props.theme.colors.success};
      }
      
      &.failed {
        background: ${props => props.theme.colors.error}20;
        color: ${props => props.theme.colors.error};
      }
    }
  }
  
  .request-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
`;

const SettingsGrid = styled.div`
  display: grid;
  gap: 1.5rem;
`;

const SettingItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  
  .setting-info {
    flex: 1;
    
    .setting-name {
      font-weight: 600;
      color: ${props => props.theme.colors.text.primary};
      margin-bottom: 0.25rem;
    }
    
    .setting-description {
      font-size: 0.875rem;
      color: ${props => props.theme.colors.text.secondary};
    }
  }
  
  .setting-control {
    margin-left: 1rem;
  }
`;

const NumberInput = styled.input`
  width: 80px;
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  text-align: center;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const InfoBox = styled.div<{ type: 'info' | 'warning' | 'success' }>`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  background: ${props => {
    switch (props.type) {
      case 'warning': return props.theme.colors.warning + '10';
      case 'success': return props.theme.colors.success + '10';
      default: return props.theme.colors.info + '10';
    }
  }};
  border: 1px solid ${props => {
    switch (props.type) {
      case 'warning': return props.theme.colors.warning + '30';
      case 'success': return props.theme.colors.success + '30';
      default: return props.theme.colors.info + '30';
    }
  }};
  
  .icon {
    color: ${props => {
      switch (props.type) {
        case 'warning': return props.theme.colors.warning;
        case 'success': return props.theme.colors.success;
        default: return props.theme.colors.info;
      }
    }};
    margin-top: 0.125rem;
  }
  
  .content {
    flex: 1;
    font-size: 0.875rem;
    color: ${props => props.theme.colors.text.secondary};
    line-height: 1.5;
  }
`;

export const PrivacyCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState('consent');
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [exportRequests, setExportRequests] = useState<DataExportRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DataDeletionRequest[]>([]);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const consentDescriptions = {
    essential: 'Required for basic functionality and security',
    analytics: 'Help us improve the service with usage analytics',
    marketing: 'Receive updates about new features and services',
    functional: 'Enhanced features and personalization',
    data_processing: 'Process your data for service delivery',
    email_communications: 'Receive important service notifications'
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch consent records
      const consentResponse = await fetch('/api/privacy/consent', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (consentResponse.ok) {
        const consentData = await consentResponse.json();
        setConsents(consentData.data.map((consent: any) => ({
          ...consent,
          timestamp: new Date(consent.timestamp),
          expiresAt: consent.expiresAt ? new Date(consent.expiresAt) : undefined
        })));
      }
      
      // Fetch export requests
      const exportResponse = await fetch('/api/privacy/exports', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (exportResponse.ok) {
        const exportData = await exportResponse.json();
        setExportRequests(exportData.data.map((request: any) => ({
          ...request,
          requestedAt: new Date(request.requestedAt),
          completedAt: request.completedAt ? new Date(request.completedAt) : undefined,
          expiresAt: request.expiresAt ? new Date(request.expiresAt) : undefined
        })));
      }
      
      // Fetch deletion requests
      const deletionResponse = await fetch('/api/privacy/deletions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (deletionResponse.ok) {
        const deletionData = await deletionResponse.json();
        setDeletionRequests(deletionData.data.map((request: any) => ({
          ...request,
          requestedAt: new Date(request.requestedAt),
          completedAt: request.completedAt ? new Date(request.completedAt) : undefined
        })));
      }
      
      // Fetch privacy settings
      const settingsResponse = await fetch('/api/privacy/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setPrivacySettings({
          ...settingsData.data,
          updatedAt: new Date(settingsData.data.updatedAt)
        });
      }
    } catch (error) {
      console.error('Error fetching privacy data:', error);
      setToast({ message: 'Failed to load privacy data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateConsent = async (consentType: string, granted: boolean) => {
    try {
      const response = await fetch('/api/privacy/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consentType,
          granted,
          policyVersion: '1.0'
        })
      });
      
      if (response.ok) {
        await fetchData();
        setToast({ message: 'Consent updated successfully', type: 'success' });
      } else {
        throw new Error('Failed to update consent');
      }
    } catch (error) {
      console.error('Error updating consent:', error);
      setToast({ message: 'Failed to update consent', type: 'error' });
    }
  };

  const requestDataExport = async (format: string, options: any) => {
    try {
      const response = await fetch('/api/privacy/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          format,
          ...options
        })
      });
      
      if (response.ok) {
        await fetchData();
        setShowExportModal(false);
        setToast({ message: 'Data export requested successfully', type: 'success' });
      } else {
        throw new Error('Failed to request data export');
      }
    } catch (error) {
      console.error('Error requesting data export:', error);
      setToast({ message: 'Failed to request data export', type: 'error' });
    }
  };

  const updatePrivacySettings = async (settings: Partial<PrivacySettings>) => {
    try {
      const response = await fetch('/api/privacy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        const data = await response.json();
        setPrivacySettings({
          ...data.data,
          updatedAt: new Date(data.data.updatedAt)
        });
        setToast({ message: 'Privacy settings updated', type: 'success' });
      } else {
        throw new Error('Failed to update privacy settings');
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      setToast({ message: 'Failed to update privacy settings', type: 'error' });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getConsentStatus = (consentType: string) => {
    const consent = consents.find(c => c.consentType === consentType);
    return consent?.granted || false;
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <PrivacyCenterContainer>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e2e8f0', 
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading privacy settings...</p>
        </div>
      </PrivacyCenterContainer>
    );
  }

  return (
    <PrivacyCenterContainer>
      <Header>
        <h1>
          <Shield size={40} />
          Privacy Center
        </h1>
        <p>
          Manage your privacy settings, consent preferences, and data rights in compliance with GDPR and other privacy regulations.
        </p>
      </Header>

      <TabContainer>
        <Tab active={activeTab === 'consent'} onClick={() => setActiveTab('consent')}>
          Consent Management
        </Tab>
        <Tab active={activeTab === 'data'} onClick={() => setActiveTab('data')}>
          Data Rights
        </Tab>
        <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Privacy Settings
        </Tab>
      </TabContainer>

      <AnimatePresence mode="wait">
        {activeTab === 'consent' && (
          <Section
            key="consent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2>
              <CheckCircle size={24} />
              Consent Management
            </h2>
            <p>
              Control how we use your data by managing your consent preferences. You can change these settings at any time.
            </p>

            <InfoBox type="info">
              <Info size={16} className="icon" />
              <div className="content">
                Essential cookies and data processing are required for the service to function and cannot be disabled.
                Other preferences are optional and help us improve your experience.
              </div>
            </InfoBox>

            {Object.entries(consentDescriptions).map(([type, description]) => (
              <ConsentItem key={type} granted={getConsentStatus(type)}>
                <div className="consent-info">
                  <div className="consent-type">{type.replace('_', ' ')}</div>
                  <div className="consent-description">{description}</div>
                  <div className={`consent-status ${getConsentStatus(type) ? 'granted' : 'denied'}`}>
                    {getConsentStatus(type) ? (
                      <>
                        <CheckCircle size={14} />
                        Granted
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} />
                        Not granted
                      </>
                    )}
                  </div>
                </div>
                <div className="consent-toggle">
                  <ToggleSwitch checked={getConsentStatus(type)}>
                    <input
                      type="checkbox"
                      checked={getConsentStatus(type)}
                      onChange={(e) => updateConsent(type, e.target.checked)}
                      disabled={type === 'essential'}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </ConsentItem>
            ))}
          </Section>
        )}

        {activeTab === 'data' && (
          <Section
            key="data"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2>
              <FileText size={24} />
              Data Rights
            </h2>
            <p>
              Exercise your data rights under GDPR and other privacy regulations. You can export or delete your data at any time.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Export Your Data</h3>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                  Download a copy of all your data in a portable format.
                </p>
                <Button onClick={() => setShowExportModal(true)}>
                  <Download size={16} />
                  Request Data Export
                </Button>
              </div>
              
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Delete Your Data</h3>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                  Permanently delete your account and all associated data.
                </p>
                <Button variant="outline" onClick={() => setShowDeleteModal(true)}>
                  <Trash2 size={16} />
                  Request Data Deletion
                </Button>
              </div>
            </div>

            {exportRequests.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Export Requests</h3>
                {exportRequests.map((request) => (
                  <RequestCard key={request.id} status={request.status}>
                    <div className="request-header">
                      <div className="request-info">
                        <div className="request-type">Data Export ({request.format.toUpperCase()})</div>
                        <div className="request-date">Requested: {formatDate(request.requestedAt)}</div>
                      </div>
                      <div className={`request-status ${request.status}`}>
                        {request.status}
                      </div>
                    </div>
                    {request.status === 'completed' && request.downloadUrl && (
                      <div className="request-actions">
                        <Button size="sm" onClick={() => window.open(request.downloadUrl, '_blank')}>
                          <Download size={14} />
                          Download
                        </Button>
                      </div>
                    )}
                  </RequestCard>
                ))}
              </div>
            )}

            {deletionRequests.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Deletion Requests</h3>
                {deletionRequests.map((request) => (
                  <RequestCard key={request.id} status={request.status}>
                    <div className="request-header">
                      <div className="request-info">
                        <div className="request-type">Data Deletion ({request.deletionType})</div>
                        <div className="request-date">Requested: {formatDate(request.requestedAt)}</div>
                      </div>
                      <div className={`request-status ${request.status}`}>
                        {request.status}
                      </div>
                    </div>
                  </RequestCard>
                ))}
              </div>
            )}
          </Section>
        )}

        {activeTab === 'settings' && privacySettings && (
          <Section
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2>
              <Settings size={24} />
              Privacy Settings
            </h2>
            <p>
              Configure how long we keep your data and other privacy-related preferences.
            </p>

            <SettingsGrid>
              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Data Retention Period</div>
                  <div className="setting-description">
                    How long to keep your data before automatic deletion (30-3650 days)
                  </div>
                </div>
                <div className="setting-control">
                  <NumberInput
                    type="number"
                    min="30"
                    max="3650"
                    value={privacySettings.dataRetentionDays}
                    onChange={(e) => updatePrivacySettings({ dataRetentionDays: parseInt(e.target.value) })}
                  />
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>days</span>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Auto-delete Emails</div>
                  <div className="setting-description">
                    Automatically delete emails after the retention period
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.autoDeleteEmails}>
                    <input
                      type="checkbox"
                      checked={privacySettings.autoDeleteEmails}
                      onChange={(e) => updatePrivacySettings({ autoDeleteEmails: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Auto-delete Files</div>
                  <div className="setting-description">
                    Automatically delete uploaded files after the retention period
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.autoDeleteFiles}>
                    <input
                      type="checkbox"
                      checked={privacySettings.autoDeleteFiles}
                      onChange={(e) => updatePrivacySettings({ autoDeleteFiles: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Analytics</div>
                  <div className="setting-description">
                    Allow collection of usage analytics to improve the service
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.allowAnalytics}>
                    <input
                      type="checkbox"
                      checked={privacySettings.allowAnalytics}
                      onChange={(e) => updatePrivacySettings({ allowAnalytics: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Marketing Communications</div>
                  <div className="setting-description">
                    Receive marketing emails about new features and updates
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.allowMarketing}>
                    <input
                      type="checkbox"
                      checked={privacySettings.allowMarketing}
                      onChange={(e) => updatePrivacySettings({ allowMarketing: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Email Notifications</div>
                  <div className="setting-description">
                    Receive important service notifications via email
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.emailNotifications}>
                    <input
                      type="checkbox"
                      checked={privacySettings.emailNotifications}
                      onChange={(e) => updatePrivacySettings({ emailNotifications: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>

              <SettingItem>
                <div className="setting-info">
                  <div className="setting-name">Share Usage Data</div>
                  <div className="setting-description">
                    Share anonymized usage data to help improve the service
                  </div>
                </div>
                <div className="setting-control">
                  <ToggleSwitch checked={privacySettings.shareUsageData}>
                    <input
                      type="checkbox"
                      checked={privacySettings.shareUsageData}
                      onChange={(e) => updatePrivacySettings({ shareUsageData: e.target.checked })}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                </div>
              </SettingItem>
            </SettingsGrid>

            <InfoBox type="info">
              <Info size={16} className="icon" />
              <div className="content">
                Last updated: {formatDate(privacySettings.updatedAt)}
              </div>
            </InfoBox>
          </Section>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <Modal
            isOpen={true}
            onClose={() => setShowExportModal(false)}
            title="Request Data Export"
          >
            <div style={{ padding: '1rem' }}>
              <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
                Choose what data to include in your export and the format you prefer.
              </p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Export Format:
                </label>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xml">XML</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Include:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" defaultChecked />
                    Email messages
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" defaultChecked />
                    Uploaded files
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" defaultChecked />
                    Account metadata
                  </label>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => setShowExportModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => requestDataExport('json', { includeEmails: true, includeFiles: true, includeMetadata: true })}>
                  Request Export
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </PrivacyCenterContainer>
  );
};