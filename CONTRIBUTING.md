# Contributing to Encrypted Email Service

Thank you for your interest in contributing to the Encrypted Email Service! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to help us maintain a welcoming and inclusive community.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/your-username/encrypted-email-service.git
cd encrypted-email-service
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/original-org/encrypted-email-service.git
```

## Development Setup

### 1. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the environment file with development values
# Use secure but non-production values for development
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd packages/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to project root
cd ../..
```

### 3. Start Development Environment

```bash
# Start database services
docker-compose up -d mongodb redis

# Start backend development server (Terminal 1)
cd packages/backend
npm run dev

# Start frontend development server (Terminal 2)
cd packages/frontend
npm run dev
```

### 4. Verify Setup

```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend (should open in browser)
open http://localhost:5173
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new features or improvements
- **Code Contributions**: Implement bug fixes or new features
- **Documentation**: Improve or add documentation
- **Testing**: Add or improve test coverage
- **Security**: Report security vulnerabilities

### Before You Start

1. **Check existing issues**: Look for existing issues or discussions about your idea
2. **Create an issue**: For significant changes, create an issue to discuss the approach
3. **Get feedback**: Wait for maintainer feedback before starting work on large features

### Branch Naming Convention

Use descriptive branch names that indicate the type of change:

```bash
# Feature branches
feature/user-authentication
feature/email-encryption

# Bug fix branches
fix/login-validation-error
fix/memory-leak-in-crypto

# Documentation branches
docs/installation-guide
docs/api-documentation

# Refactoring branches
refactor/auth-service
refactor/database-queries
```

## Pull Request Process

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create and switch to a new branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Run type checking
npm run type-check

# Test the application manually
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
# Format: type(scope): description
git commit -m "feat(auth): add two-factor authentication"
git commit -m "fix(email): resolve encryption key rotation issue"
git commit -m "docs(api): update authentication endpoints"
```

Commit types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create a pull request on GitHub
# Use the pull request template and provide detailed information
```

### Pull Request Requirements

Your pull request must:

- [ ] Pass all automated tests
- [ ] Include tests for new functionality
- [ ] Update documentation if needed
- [ ] Follow coding standards
- [ ] Have a clear description of changes
- [ ] Reference related issues
- [ ] Be reviewed by at least one maintainer

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Prefer functional programming patterns
- Use meaningful variable and function names

```typescript
// Good
const encryptUserEmail = async (email: string, publicKey: string): Promise<string> => {
  // Implementation
};

// Avoid
const encrypt = (e: string, k: string) => {
  // Implementation
};
```

### React Components

- Use functional components with hooks
- Implement proper TypeScript interfaces
- Use meaningful component names
- Keep components focused and small

```tsx
// Good
interface EmailComposerProps {
  onSend: (email: EncryptedEmail) => Promise<void>;
  recipients: string[];
  isLoading: boolean;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  onSend,
  recipients,
  isLoading
}) => {
  // Component implementation
};
```

### Backend Services

- Use dependency injection patterns
- Implement proper error handling
- Add comprehensive logging
- Follow REST API conventions

```typescript
// Good
export class EmailService {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly storageService: StorageService
  ) {}

  async sendEncryptedEmail(email: EmailData): Promise<void> {
    try {
      const encryptedContent = await this.cryptoService.encrypt(email.content);
      await this.storageService.save(encryptedContent);
    } catch (error) {
      logger.error('Failed to send encrypted email', { error, emailId: email.id });
      throw new EmailSendError('Failed to send email', error);
    }
  }
}
```

### Database Models

- Use proper TypeScript interfaces
- Implement validation schemas
- Add appropriate indexes
- Document relationships

```typescript
// Good
export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  publicKey: string;
  encryptedPrivateKey: string;
  storageUsed: number;
  storageLimit: number;
  subscriptionTier: 'free' | 'pro' | 'business';
  createdAt: Date;
  updatedAt: Date;
}
```

## Testing Guidelines

### Test Structure

- Write tests for all new functionality
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

```typescript
// Good
describe('EmailService', () => {
  describe('sendEncryptedEmail', () => {
    it('should encrypt email content before sending', async () => {
      // Arrange
      const mockCryptoService = createMockCryptoService();
      const emailService = new EmailService(mockCryptoService);
      const emailData = createTestEmailData();

      // Act
      await emailService.sendEncryptedEmail(emailData);

      // Assert
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(emailData.content);
    });
  });
});
```

### Test Types

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test service interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Security Tests**: Test security features and vulnerabilities

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Security Guidelines

### Security-First Development

- Never commit secrets or credentials
- Use environment variables for configuration
- Implement proper input validation
- Follow OWASP security guidelines
- Use secure coding practices

### Cryptographic Code

- Use established cryptographic libraries
- Never implement custom crypto algorithms
- Properly handle key management
- Implement secure random number generation

```typescript
// Good
import { webcrypto } from 'crypto';

const generateSecureKey = async (): Promise<CryptoKey> => {
  return await webcrypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
};
```

### Security Testing

- Test authentication and authorization
- Validate input sanitization
- Test encryption/decryption flows
- Check for common vulnerabilities

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities. Instead:

1. Email security@yourdomain.com
2. Include detailed information about the vulnerability
3. Wait for acknowledgment before public disclosure
4. Follow responsible disclosure practices

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex algorithms
- Explain security-related code
- Keep comments up to date

```typescript
/**
 * Encrypts email content using the recipient's public key
 * @param content - The email content to encrypt
 * @param publicKey - The recipient's RSA public key
 * @returns Promise resolving to encrypted content
 * @throws {EncryptionError} When encryption fails
 */
async encryptEmailContent(content: string, publicKey: string): Promise<string> {
  // Implementation
}
```

### API Documentation

- Document all API endpoints
- Include request/response examples
- Document error responses
- Keep OpenAPI spec updated

### User Documentation

- Update installation guides
- Add feature documentation
- Include troubleshooting guides
- Provide configuration examples

## Review Process

### Code Review Checklist

Reviewers will check for:

- [ ] Code follows project standards
- [ ] Tests are comprehensive and passing
- [ ] Documentation is updated
- [ ] Security considerations are addressed
- [ ] Performance impact is acceptable
- [ ] Breaking changes are documented

### Getting Your PR Reviewed

1. **Self-review**: Review your own code first
2. **Request review**: Tag appropriate reviewers
3. **Respond to feedback**: Address all review comments
4. **Update as needed**: Make requested changes
5. **Merge**: Maintainers will merge approved PRs

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Notes

- Document all changes in CHANGELOG.md
- Include migration guides for breaking changes
- Highlight security fixes
- Credit contributors

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Discord**: Real-time chat (link in README)
- **Email**: security@yourdomain.com for security issues

### Resources

- [Installation Guide](INSTALLATION.md)
- [Architecture Documentation](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Security Guide](docs/security.md)

## Recognition

We appreciate all contributions! Contributors will be:

- Listed in the CONTRIBUTORS.md file
- Mentioned in release notes
- Invited to join the contributors team
- Eligible for contributor swag (when available)

---

Thank you for contributing to the Encrypted Email Service! Your efforts help make secure communication accessible to everyone. 🚀