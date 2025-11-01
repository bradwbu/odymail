/**
 * Custom hook for email service operations
 */

import { useCallback } from 'react';

interface EmailListResponse {
  emails: Array<{
    id: string;
    senderId: string;
    senderEmail: string;
    subject: string;
    timestamp: Date;
    size: number;
    attachmentCount: number;
    isRead: boolean;
    deliveryStatus: string;
  }>;
  totalCount: number;
  hasMore: boolean;
}

interface EmailDetailResponse {
  metadata: {
    id: string;
    senderId: string;
    senderEmail: string;
    recipientIds: string[];
    subject: string;
    timestamp: Date;
    size: number;
    attachmentCount: number;
    isRead: boolean;
  };
  encryptedContent: string;
  encryptedSubject: string;
  encryptedAttachments: Array<{
    id: string;
    encryptedName: string;
    encryptedData: string;
    size: number;
    mimeType: string;
  }>;
  senderSignature: string;
  recipientKey: string;
}

export const useEmailService = () => {
  const apiBaseUrl = '/api';

  // Get authentication token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('authToken') || '';
  }, []);

  // Get inbox emails
  const getInbox = useCallback(async (
    page: number = 1,
    limit: number = 20,
    folder: string = 'inbox'
  ): Promise<EmailListResponse> => {
    const response = await fetch(
      `${apiBaseUrl}/email/inbox?page=${page}&limit=${limit}&folder=${folder}`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch inbox');
    }

    const data = await response.json();
    return data.data;
  }, [apiBaseUrl, getAuthToken]);

  // Get sent emails
  const getSentEmails = useCallback(async (
    page: number = 1,
    limit: number = 20
  ): Promise<EmailListResponse> => {
    const response = await fetch(
      `${apiBaseUrl}/email/sent?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch sent emails');
    }

    const data = await response.json();
    return data.data;
  }, [apiBaseUrl, getAuthToken]);

  // Get email by ID
  const getEmailById = useCallback(async (emailId: string): Promise<EmailDetailResponse> => {
    const response = await fetch(`${apiBaseUrl}/email/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email');
    }

    const data = await response.json();
    return data.data;
  }, [apiBaseUrl, getAuthToken]);

  // Delete email
  const deleteEmail = useCallback(async (emailId: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/email/${emailId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete email');
    }
  }, [apiBaseUrl, getAuthToken]);

  // Move email to folder
  const moveToFolder = useCallback(async (emailId: string, folderId: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/email/${emailId}/folder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ folderId })
    });

    if (!response.ok) {
      throw new Error('Failed to move email');
    }
  }, [apiBaseUrl, getAuthToken]);

  // Get delivery status
  const getDeliveryStatus = useCallback(async (emailId: string) => {
    const response = await fetch(`${apiBaseUrl}/email/${emailId}/delivery`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get delivery status');
    }

    const data = await response.json();
    return data.data;
  }, [apiBaseUrl, getAuthToken]);

  return {
    getInbox,
    getSentEmails,
    getEmailById,
    deleteEmail,
    moveToFolder,
    getDeliveryStatus
  };
};