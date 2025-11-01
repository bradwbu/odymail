/**
 * Email search service for searching decrypted email content
 */

import { CryptoEngine } from './crypto';
import { KeyManager } from './keyManager';
import { EmailMetadata, EmailDetailResponse } from '../types/email';

export interface SearchResult {
  emailId: string;
  metadata: EmailMetadata;
  matchedContent: string;
  matchType: 'subject' | 'body' | 'attachment';
  score: number;
}

export interface SearchOptions {
  query: string;
  folder?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sender?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  limit?: number;
}

export class SearchService {
  private keyManager: KeyManager;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api') {
    this.keyManager = new KeyManager();
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Search emails by decrypting and matching content
   */
  async searchEmails(options: SearchOptions): Promise<SearchResult[]> {
    try {
      // Get user's current key pair for decryption
      const userKeyId = localStorage.getItem('currentKeyId');
      const userPassword = sessionStorage.getItem('userPassword');
      
      if (!userKeyId || !userPassword) {
        throw new Error('User authentication required for search');
      }

      // Fetch emails from server based on metadata filters
      const emailList = await this.fetchEmailsForSearch(options);
      
      // Decrypt and search through email content
      const searchResults: SearchResult[] = [];
      
      for (const email of emailList) {
        try {
          // Get full email details
          const emailDetails = await this.fetchEmailDetails(email.id);
          
          // Decrypt email content
          const decryptedContent = await this.decryptEmailForSearch(
            emailDetails, 
            userKeyId, 
            userPassword
          );
          
          // Search in decrypted content
          const matches = this.searchInContent(decryptedContent, options.query);
          
          if (matches.length > 0) {
            searchResults.push(...matches.map(match => ({
              emailId: email.id,
              metadata: email,
              matchedContent: match.content,
              matchType: match.type,
              score: match.score
            })));
          }
        } catch (error) {
          console.warn(`Failed to search email ${email.id}:`, error);
          // Continue with other emails
        }
      }
      
      // Sort by relevance score
      return searchResults.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Fetch emails from server with metadata filters
   */
  private async fetchEmailsForSearch(options: SearchOptions): Promise<EmailMetadata[]> {
    const params = new URLSearchParams();
    
    if (options.folder) params.append('folder', options.folder);
    if (options.dateFrom) params.append('dateFrom', options.dateFrom.toISOString());
    if (options.dateTo) params.append('dateTo', options.dateTo.toISOString());
    if (options.sender) params.append('sender', options.sender);
    if (options.hasAttachments !== undefined) params.append('hasAttachments', options.hasAttachments.toString());
    if (options.isRead !== undefined) params.append('isRead', options.isRead.toString());
    if (options.limit) params.append('limit', options.limit.toString());

    const response = await fetch(`${this.apiBaseUrl}/email/search-metadata?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch emails for search');
    }

    const data = await response.json();
    return data.emails;
  }

  /**
   * Fetch full email details
   */
  private async fetchEmailDetails(emailId: string): Promise<EmailDetailResponse> {
    const response = await fetch(`${this.apiBaseUrl}/email/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email details');
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Decrypt email content for searching
   */
  private async decryptEmailForSearch(
    emailDetails: EmailDetailResponse,
    userKeyId: string,
    userPassword: string
  ): Promise<{ subject: string; body: string; attachments: { name: string; content: string }[] }> {
    try {
      // Get user's key pair
      const userKeyPair = await this.keyManager.getKeyPair(userKeyId, userPassword);
      
      // Decrypt the AES key using user's private key
      const encryptedAESKey = CryptoEngine.base64ToArrayBuffer(emailDetails.recipientKey);
      const aesKeyBuffer = await CryptoEngine.decryptRSA(encryptedAESKey, userKeyPair.privateKey);
      
      // Import the AES key
      const aesKey = await CryptoEngine.importKey(
        aesKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt subject
      const encryptedSubject = CryptoEngine.base64ToArrayBuffer(emailDetails.encryptedSubject);
      const subjectDecrypted = await CryptoEngine.decryptAES({ data: encryptedSubject, iv: new Uint8Array(12) }, aesKey);
      const subject = CryptoEngine.arrayBufferToString(subjectDecrypted);
      
      // Decrypt body
      const emailContent = JSON.parse(emailDetails.encryptedContent);
      const encryptedBody = CryptoEngine.base64ToArrayBuffer(emailContent.body);
      const bodyDecrypted = await CryptoEngine.decryptAES({ data: encryptedBody, iv: new Uint8Array(12) }, aesKey);
      const body = CryptoEngine.arrayBufferToString(bodyDecrypted);
      
      // Decrypt attachments
      const attachments = [];
      for (const attachment of emailDetails.encryptedAttachments) {
        try {
          const encryptedName = CryptoEngine.base64ToArrayBuffer(attachment.encryptedName);
          const nameDecrypted = await CryptoEngine.decryptAES({ data: encryptedName, iv: new Uint8Array(12) }, aesKey);
          const name = CryptoEngine.arrayBufferToString(nameDecrypted);
          
          // For search, we'll only decrypt text-based attachments
          if (attachment.mimeType.startsWith('text/')) {
            const encryptedData = CryptoEngine.base64ToArrayBuffer(attachment.encryptedData);
            const dataDecrypted = await CryptoEngine.decryptAES({ data: encryptedData, iv: new Uint8Array(12) }, aesKey);
            const content = CryptoEngine.arrayBufferToString(dataDecrypted);
            
            attachments.push({ name, content });
          } else {
            attachments.push({ name, content: '' });
          }
        } catch (error) {
          console.warn('Failed to decrypt attachment for search:', error);
        }
      }
      
      return { subject, body, attachments };
      
    } catch (error) {
      throw new Error(`Failed to decrypt email for search: ${error}`);
    }
  }

  /**
   * Search within decrypted content
   */
  private searchInContent(
    content: { subject: string; body: string; attachments: { name: string; content: string }[] },
    query: string
  ): { content: string; type: 'subject' | 'body' | 'attachment'; score: number }[] {
    const matches = [];
    const queryLower = query.toLowerCase();
    
    // Search in subject
    if (content.subject.toLowerCase().includes(queryLower)) {
      const context = this.getSearchContext(content.subject, query);
      matches.push({
        content: context,
        type: 'subject' as const,
        score: 100 // Highest score for subject matches
      });
    }
    
    // Search in body
    if (content.body.toLowerCase().includes(queryLower)) {
      const context = this.getSearchContext(content.body, query);
      matches.push({
        content: context,
        type: 'body' as const,
        score: 80 // High score for body matches
      });
    }
    
    // Search in attachments
    for (const attachment of content.attachments) {
      if (attachment.name.toLowerCase().includes(queryLower) || 
          attachment.content.toLowerCase().includes(queryLower)) {
        const context = attachment.name.toLowerCase().includes(queryLower) 
          ? `Attachment: ${attachment.name}`
          : this.getSearchContext(attachment.content, query);
        
        matches.push({
          content: context,
          type: 'attachment' as const,
          score: 60 // Lower score for attachment matches
        });
      }
    }
    
    return matches;
  }

  /**
   * Get search context around matched text
   */
  private getSearchContext(text: string, query: string, contextLength: number = 100): string {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);
    
    if (index === -1) return text.substring(0, contextLength);
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + query.length + contextLength / 2);
    
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}