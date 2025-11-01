/**
 * FileUpload component tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '../FileUpload';
import { FileUploadService } from '../../services/fileUploadService';

// Mock the file upload service
vi.mock('../../services/fileUploadService', () => ({
  FileUploadService: {
    uploadMultipleFiles: vi.fn(),
    validateFiles: vi.fn(),
    cancelUpload: vi.fn()
  }
}));

// Mock the crypto hook
vi.mock('../../hooks/useCrypto', () => ({
  useCrypto: () => ({
    userKey: {} as CryptoKey
  })
}));

// Mock drag and drop events
const createDragEvent = (type: string, files: File[] = []) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types: ['Files']
    }
  });
  return event;
};

describe('FileUpload Component', () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnUploadProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful validation by default
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [],
      invalid: []
    });
  });

  it('should render upload zone', () => {
    render(<FileUpload />);
    
    expect(screen.getByText('Drag & drop files here')).toBeInTheDocument();
    expect(screen.getByText('or click to select files')).toBeInTheDocument();
  });

  it('should handle drag and drop events', async () => {
    render(<FileUpload />);
    
    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    expect(dropZone).toBeInTheDocument();

    // Test drag enter
    fireEvent(dropZone!, createDragEvent('dragenter'));
    expect(dropZone).toHaveClass('border-blue-500');

    // Test drag leave
    fireEvent(dropZone!, createDragEvent('dragleave'));
    
    // Test drop
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });
    
    vi.mocked(FileUploadService.uploadMultipleFiles).mockResolvedValue([
      { success: true, fileId: 'test-id' }
    ]);

    const dropEvent = createDragEvent('drop', [testFile]);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(FileUploadService.uploadMultipleFiles).toHaveBeenCalledWith(
        [testFile],
        expect.any(Object),
        {},
        expect.any(Function)
      );
    });
  });

  it('should handle file selection via input', async () => {
    render(<FileUpload />);
    
    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const fileInput = dropZone?.querySelector('input[type="file"]') as HTMLInputElement;
    
    expect(fileInput).toBeInTheDocument();

    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });
    
    vi.mocked(FileUploadService.uploadMultipleFiles).mockResolvedValue([
      { success: true, fileId: 'test-id' }
    ]);

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      writable: false
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(FileUploadService.uploadMultipleFiles).toHaveBeenCalled();
    });
  });

  it('should show upload progress', async () => {
    const onUploadProgress = vi.fn();
    render(<FileUpload onUploadProgress={onUploadProgress} />);
    
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });

    // Mock upload with progress callback
    vi.mocked(FileUploadService.uploadMultipleFiles).mockImplementation(
      async (files, userKey, options, progressCallback) => {
        if (progressCallback) {
          progressCallback('test-id', {
            fileId: 'test-id',
            filename: 'test.txt',
            progress: 50,
            status: 'uploading',
            uploadedBytes: 50,
            totalBytes: 100
          });
        }
        return [{ success: true, fileId: 'test-id' }];
      }
    );

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', [testFile]);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('Uploading Files (1)')).toBeInTheDocument();
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(screen.getByText('uploading')).toBeInTheDocument();
    });
  });

  it('should handle upload errors', async () => {
    render(<FileUpload />);
    
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });
    
    vi.mocked(FileUploadService.uploadMultipleFiles).mockResolvedValue([
      { success: false, error: 'Upload failed' }
    ]);

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', [testFile]);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  it('should handle file validation errors', async () => {
    render(<FileUpload />);
    
    const invalidFile = new File([''], '', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [],
      invalid: [{ file: invalidFile, errors: ['File name is required'] }]
    });

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', [invalidFile]);
    fireEvent(dropZone!, dropEvent);

    // Should not attempt upload for invalid files
    expect(FileUploadService.uploadMultipleFiles).not.toHaveBeenCalled();
  });

  it('should allow canceling uploads', async () => {
    render(<FileUpload />);
    
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });

    // Mock upload that doesn't complete immediately
    vi.mocked(FileUploadService.uploadMultipleFiles).mockImplementation(
      async (files, userKey, options, progressCallback) => {
        if (progressCallback) {
          progressCallback('test-id', {
            fileId: 'test-id',
            filename: 'test.txt',
            progress: 25,
            status: 'uploading',
            uploadedBytes: 25,
            totalBytes: 100
          });
        }
        // Don't resolve immediately to allow cancellation
        return new Promise(() => {});
      }
    );

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', [testFile]);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('uploading')).toBeInTheDocument();
    });

    // Find and click cancel button
    const cancelButton = screen.getByTitle('Cancel upload') || screen.getByRole('button', { name: /cancel/i });
    if (cancelButton) {
      fireEvent.click(cancelButton);
      expect(FileUploadService.cancelUpload).toHaveBeenCalledWith('test-id');
    }
  });

  it('should respect file limits', async () => {
    render(<FileUpload maxFiles={2} />);
    
    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
      new File(['test3'], 'test3.txt', { type: 'text/plain' })
    ];
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: files.slice(0, 2), // Only first 2 files should be processed
      invalid: []
    });
    
    vi.mocked(FileUploadService.uploadMultipleFiles).mockResolvedValue([
      { success: true, fileId: 'test-id-1' },
      { success: true, fileId: 'test-id-2' }
    ]);

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', files);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(FileUploadService.uploadMultipleFiles).toHaveBeenCalledWith(
        files.slice(0, 2),
        expect.any(Object),
        {},
        expect.any(Function)
      );
    });
  });

  it('should call onUploadComplete when uploads finish', async () => {
    const onUploadComplete = vi.fn();
    render(<FileUpload onUploadComplete={onUploadComplete} />);
    
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    vi.mocked(FileUploadService.validateFiles).mockReturnValue({
      valid: [testFile],
      invalid: []
    });
    
    const uploadResults = [{ success: true, fileId: 'test-id' }];
    vi.mocked(FileUploadService.uploadMultipleFiles).mockResolvedValue(uploadResults);

    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    const dropEvent = createDragEvent('drop', [testFile]);
    fireEvent(dropZone!, dropEvent);

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith(uploadResults);
    });
  });

  it('should show file size limits', () => {
    render(<FileUpload maxFiles={5} />);
    
    expect(screen.getByText('Maximum 5 files')).toBeInTheDocument();
  });

  it('should handle click to select files', () => {
    render(<FileUpload />);
    
    const dropZone = screen.getByText('Drag & drop files here').closest('div');
    
    // Mock click event
    const fileInput = dropZone?.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    
    fireEvent.click(dropZone!);
    
    expect(clickSpy).toHaveBeenCalled();
  });
});