/**
 * Security Dashboard - Admin interface for security monitoring
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Eye, 
  Clock, 
  MapPin, 
  TrendingUp,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';

interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
  resolved: boolean;
}

interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  events: SecurityEvent[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  activeAlerts: number;
  resolvedAlerts: number;
  topThreats: Array<{
    type: string;
    count: number;
    lastOccurrence: Date;
  }>;
  suspiciousIPs: Array<{
    ip: string;
    eventCount: number;
    lastActivity: Date;
  }>;
}

const DashboardContainer = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 2rem;
  
  h1 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: ${props => props.theme.colors.text.primary};
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const MetricCard = styled(motion.div)<{ severity?: string }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid ${props => {
    switch (props.severity) {
      case 'critical': return props.theme.colors.error;
      case 'high': return props.theme.colors.warning;
      case 'medium': return props.theme.colors.info;
      default: return props.theme.colors.border;
    }
  }};
  box-shadow: ${props => props.theme.shadows.sm};
  
  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    
    .icon {
      padding: 0.5rem;
      border-radius: 8px;
      background: ${props => props.theme.colors.primary}20;
      color: ${props => props.theme.colors.primary};
    }
  }
  
  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: ${props => props.theme.colors.text.primary};
    margin-bottom: 0.5rem;
  }
  
  .metric-label {
    color: ${props => props.theme.colors.text.secondary};
    font-size: 0.875rem;
  }
  
  .metric-trend {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    margin-top: 0.5rem;
    
    &.up {
      color: ${props => props.theme.colors.error};
    }
    
    &.down {
      color: ${props => props.theme.colors.success};
    }
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 2rem;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const EventsSection = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
`;

const SectionHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: ${props => props.theme.colors.text.primary};
  }
`;

const EventsList = styled.div`
  max-height: 600px;
  overflow-y: auto;
`;

const EventItem = styled(motion.div)<{ severity: string }>`
  padding: 1rem 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.background};
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .event-type {
    font-weight: 600;
    color: ${props => props.theme.colors.text.primary};
    text-transform: capitalize;
  }
  
  .event-severity {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    
    &.low {
      background: ${props => props.theme.colors.success}20;
      color: ${props => props.theme.colors.success};
    }
    
    &.medium {
      background: ${props => props.theme.colors.info}20;
      color: ${props => props.theme.colors.info};
    }
    
    &.high {
      background: ${props => props.theme.colors.warning}20;
      color: ${props => props.theme.colors.warning};
    }
    
    &.critical {
      background: ${props => props.theme.colors.error}20;
      color: ${props => props.theme.colors.error};
    }
  }
  
  .event-details {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: ${props => props.theme.colors.text.secondary};
    
    .detail-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
  }
  
  .event-timestamp {
    font-size: 0.75rem;
    color: ${props => props.theme.colors.text.tertiary};
    margin-top: 0.5rem;
  }
`;

const AlertsSection = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
`;

const AlertItem = styled(motion.div)<{ severity: string }>`
  padding: 1rem 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  border-left: 4px solid ${props => {
    switch (props.severity) {
      case 'critical': return props.theme.colors.error;
      case 'high': return props.theme.colors.warning;
      case 'medium': return props.theme.colors.info;
      default: return props.theme.colors.success;
    }
  }};
  
  &:last-child {
    border-bottom: none;
  }
  
  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .alert-message {
    font-weight: 600;
    color: ${props => props.theme.colors.text.primary};
    margin-bottom: 0.5rem;
  }
  
  .alert-meta {
    font-size: 0.875rem;
    color: ${props => props.theme.colors.text.secondary};
    
    .event-count {
      font-weight: 500;
      color: ${props => props.theme.colors.text.primary};
    }
  }
  
  .alert-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid ${props => props.theme.colors.border};
    border-top: 2px solid ${props => props.theme.colors.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  color: ${props => props.theme.colors.text.secondary};
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
`;

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch metrics
      const metricsResponse = await fetch(`/api/security/metrics?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }
      
      // Fetch recent events
      const eventsResponse = await fetch('/api/security/events?limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData.data.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        })));
      }
      
      // Fetch active alerts
      const alertsResponse = await fetch('/api/security/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data.map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp),
          events: alert.events.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp)
          }))
        })));
      }
    } catch (error) {
      console.error('Error fetching security data:', error);
      setToast({ message: 'Failed to load security data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/security/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
        setToast({ message: 'Alert acknowledged successfully', type: 'success' });
      } else {
        throw new Error('Failed to acknowledge alert');
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      setToast({ message: 'Failed to acknowledge alert', type: 'error' });
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle size={16} />;
      case 'high':
        return <AlertTriangle size={16} />;
      case 'medium':
        return <Eye size={16} />;
      default:
        return <CheckCircle size={16} />;
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading && !metrics) {
    return (
      <DashboardContainer>
        <LoadingSpinner>
          <div className="spinner" />
        </LoadingSpinner>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <Header>
        <h1>
          <Shield size={32} />
          Security Dashboard
        </h1>
        <Controls>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: 'white'
            }}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        </Controls>
      </Header>

      {metrics && (
        <MetricsGrid>
          <MetricCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="metric-header">
              <div className="icon">
                <Activity size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.totalEvents.toLocaleString()}</div>
            <div className="metric-label">Total Security Events</div>
          </MetricCard>

          <MetricCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            severity={metrics.activeAlerts > 0 ? 'high' : undefined}
          >
            <div className="metric-header">
              <div className="icon">
                <AlertTriangle size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.activeAlerts}</div>
            <div className="metric-label">Active Alerts</div>
          </MetricCard>

          <MetricCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="metric-header">
              <div className="icon">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.suspiciousIPs.length}</div>
            <div className="metric-label">Suspicious IPs</div>
          </MetricCard>

          <MetricCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="metric-header">
              <div className="icon">
                <CheckCircle size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.resolvedAlerts}</div>
            <div className="metric-label">Resolved Alerts</div>
          </MetricCard>
        </MetricsGrid>
      )}

      <ContentGrid>
        <EventsSection>
          <SectionHeader>
            <h2>Recent Security Events</h2>
            <Button variant="outline" size="sm">
              <Filter size={16} />
              Filter
            </Button>
          </SectionHeader>
          <EventsList>
            <AnimatePresence>
              {events.length > 0 ? (
                events.map((event, index) => (
                  <EventItem
                    key={event.id}
                    severity={event.severity}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="event-header">
                      <div className="event-type">
                        {event.type.replace(/_/g, ' ')}
                      </div>
                      <div className={`event-severity ${event.severity}`}>
                        {event.severity}
                      </div>
                    </div>
                    <div className="event-details">
                      <div className="detail-item">
                        <MapPin size={14} />
                        {event.ipAddress}
                      </div>
                      {event.userId && (
                        <div className="detail-item">
                          <Eye size={14} />
                          User: {event.userId.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                    <div className="event-timestamp">
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </EventItem>
                ))
              ) : (
                <EmptyState>
                  <div className="icon">
                    <Shield />
                  </div>
                  <p>No security events found</p>
                </EmptyState>
              )}
            </AnimatePresence>
          </EventsList>
        </EventsSection>

        <AlertsSection>
          <SectionHeader>
            <h2>Active Alerts</h2>
          </SectionHeader>
          <AnimatePresence>
            {alerts.length > 0 ? (
              alerts.map((alert, index) => (
                <AlertItem
                  key={alert.id}
                  severity={alert.severity}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="alert-header">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-meta">
                    <span className="event-count">{alert.events.length}</span> related events
                    <br />
                    {formatTimestamp(alert.timestamp)}
                  </div>
                  <div className="alert-actions">
                    <Button
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  </div>
                </AlertItem>
              ))
            ) : (
              <EmptyState>
                <div className="icon">
                  <CheckCircle />
                </div>
                <p>No active alerts</p>
              </EmptyState>
            )}
          </AnimatePresence>
        </AlertsSection>
      </ContentGrid>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedEvent(null)}
            title="Security Event Details"
          >
            <div style={{ padding: '1rem' }}>
              <h3>{selectedEvent.type.replace(/_/g, ' ')}</h3>
              <p><strong>Severity:</strong> {selectedEvent.severity}</p>
              <p><strong>IP Address:</strong> {selectedEvent.ipAddress}</p>
              <p><strong>Timestamp:</strong> {selectedEvent.timestamp.toLocaleString()}</p>
              {selectedEvent.userId && (
                <p><strong>User ID:</strong> {selectedEvent.userId}</p>
              )}
              <p><strong>User Agent:</strong> {selectedEvent.userAgent}</p>
              
              {Object.keys(selectedEvent.details).length > 0 && (
                <>
                  <h4>Details:</h4>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '1rem', 
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </>
              )}
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
    </DashboardContainer>
  );
};