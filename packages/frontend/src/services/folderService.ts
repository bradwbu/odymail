/**
 * Folder and label management service
 */

export interface EmailFolder {
  id: string;
  name: string;
  type: 'system' | 'custom';
  color?: string;
  icon?: string;
  emailCount: number;
  unreadCount: number;
  parentId?: string;
  order: number;
}

export interface EmailLabel {
  id: string;
  name: string;
  color: string;
  emailCount: number;
}

export interface FolderStats {
  totalEmails: number;
  unreadEmails: number;
  storageUsed: number;
}

export class FolderService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Get all folders for the user
   */
  async getFolders(): Promise<EmailFolder[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/folders`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }

      const data = await response.json();
      return data.folders;
    } catch (error) {
      throw new Error(`Failed to get folders: ${error}`);
    }
  }

  /**
   * Create a new custom folder
   */
  async createFolder(name: string, color?: string, icon?: string, parentId?: string): Promise<EmailFolder> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          name,
          color,
          icon,
          parentId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create folder');
      }

      const data = await response.json();
      return data.folder;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  /**
   * Update folder properties
   */
  async updateFolder(folderId: string, updates: Partial<Pick<EmailFolder, 'name' | 'color' | 'icon' | 'order'>>): Promise<EmailFolder> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update folder');
      }

      const data = await response.json();
      return data.folder;
    } catch (error) {
      throw new Error(`Failed to update folder: ${error}`);
    }
  }

  /**
   * Delete a custom folder
   */
  async deleteFolder(folderId: string, moveEmailsToFolderId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (moveEmailsToFolderId) {
        params.append('moveToFolder', moveEmailsToFolderId);
      }

      const response = await fetch(`${this.apiBaseUrl}/folders/${folderId}?${params}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete folder');
      }
    } catch (error) {
      throw new Error(`Failed to delete folder: ${error}`);
    }
  }

  /**
   * Move email to folder
   */
  async moveEmailToFolder(emailId: string, folderId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}/folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ folderId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to move email');
      }
    } catch (error) {
      throw new Error(`Failed to move email to folder: ${error}`);
    }
  }

  /**
   * Move multiple emails to folder
   */
  async moveEmailsToFolder(emailIds: string[], folderId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/bulk/folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ emailIds, folderId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to move emails');
      }
    } catch (error) {
      throw new Error(`Failed to move emails to folder: ${error}`);
    }
  }

  /**
   * Get folder statistics
   */
  async getFolderStats(folderId: string): Promise<FolderStats> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/folders/${folderId}/stats`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch folder stats');
      }

      const data = await response.json();
      return data.stats;
    } catch (error) {
      throw new Error(`Failed to get folder stats: ${error}`);
    }
  }

  /**
   * Get all labels for the user
   */
  async getLabels(): Promise<EmailLabel[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/labels`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch labels');
      }

      const data = await response.json();
      return data.labels;
    } catch (error) {
      throw new Error(`Failed to get labels: ${error}`);
    }
  }

  /**
   * Create a new label
   */
  async createLabel(name: string, color: string): Promise<EmailLabel> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ name, color })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create label');
      }

      const data = await response.json();
      return data.label;
    } catch (error) {
      throw new Error(`Failed to create label: ${error}`);
    }
  }

  /**
   * Update label properties
   */
  async updateLabel(labelId: string, updates: Partial<Pick<EmailLabel, 'name' | 'color'>>): Promise<EmailLabel> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/labels/${labelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update label');
      }

      const data = await response.json();
      return data.label;
    } catch (error) {
      throw new Error(`Failed to update label: ${error}`);
    }
  }

  /**
   * Delete a label
   */
  async deleteLabel(labelId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/labels/${labelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete label');
      }
    } catch (error) {
      throw new Error(`Failed to delete label: ${error}`);
    }
  }

  /**
   * Add label to email
   */
  async addLabelToEmail(emailId: string, labelId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ labelId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add label');
      }
    } catch (error) {
      throw new Error(`Failed to add label to email: ${error}`);
    }
  }

  /**
   * Remove label from email
   */
  async removeLabelFromEmail(emailId: string, labelId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}/labels/${labelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove label');
      }
    } catch (error) {
      throw new Error(`Failed to remove label from email: ${error}`);
    }
  }

  /**
   * Get default system folders
   */
  getSystemFolders(): EmailFolder[] {
    return [
      {
        id: 'inbox',
        name: 'Inbox',
        type: 'system',
        icon: 'inbox',
        emailCount: 0,
        unreadCount: 0,
        order: 1
      },
      {
        id: 'sent',
        name: 'Sent',
        type: 'system',
        icon: 'send',
        emailCount: 0,
        unreadCount: 0,
        order: 2
      },
      {
        id: 'drafts',
        name: 'Drafts',
        type: 'system',
        icon: 'draft',
        emailCount: 0,
        unreadCount: 0,
        order: 3
      },
      {
        id: 'archive',
        name: 'Archive',
        type: 'system',
        icon: 'archive',
        emailCount: 0,
        unreadCount: 0,
        order: 4
      },
      {
        id: 'spam',
        name: 'Spam',
        type: 'system',
        icon: 'warning',
        emailCount: 0,
        unreadCount: 0,
        order: 5
      },
      {
        id: 'trash',
        name: 'Trash',
        type: 'system',
        icon: 'trash',
        emailCount: 0,
        unreadCount: 0,
        order: 6
      }
    ];
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}