# Test Setup Guide for Emoji Hunt

This guide provides comprehensive instructions for setting up and running tests for the Emoji Hunt game.

## Test Framework

The project uses the following testing tools:
- **Jest**: JavaScript testing framework
- **React Testing Library**: For testing React components
- **ts-jest**: TypeScript preprocessor for Jest
- **@testing-library/jest-dom**: Custom Jest matchers for DOM testing
- **@testing-library/user-event**: For simulating user interactions

## Installation

The testing dependencies have been added to the project. To install them:

```bash
npm install
```

## Configuration Files

### jest.config.js
The main Jest configuration file that:
- Integrates with Next.js using `next/jest`
- Sets up module path aliases
- Configures test environment as `jsdom` for React component testing
- Defines test file patterns and coverage collection
- Excludes layout and page files from coverage by default

### jest.setup.js
Global test setup that:
- Imports `@testing-library/jest-dom` for enhanced DOM matchers
- Sets test environment variables for Upstash Redis
- Clears all mocks after each test

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## Test Structure

Tests are organized following this structure:

```
app/
├── __tests__/
│   ├── lib/
│   │   ├── game-engine.test.ts
│   │   ├── game-state-async.test.ts
│   │   ├── emojis.test.ts
│   │   └── ...
│   ├── api/
│   │   ├── game/
│   │   │   ├── click.test.ts
│   │   │   ├── start.test.ts
│   │   │   └── ...
│   │   └── lobby/
│   │       ├── create.test.ts
│   │       ├── join.test.ts
│   │       └── ...
│   └── components/
│       ├── GameCanvas.test.tsx
│       ├── Scoreboard.test.tsx
│       └── ...
```

## Writing Tests

### Testing Philosophy
- **Minimal Mocking**: Only mock external dependencies when absolutely necessary
- **Integration Focus**: Prefer integration tests that test real interactions
- **User-Centric**: Test from the user's perspective when testing UI components
- **Edge Cases**: Include tests for error conditions and edge cases

### Unit Tests for Pure Functions

```typescript
// Example: Testing emoji utilities
describe('getRandomEmojis', () => {
  it('should return requested number of emojis', () => {
    const emojis = getRandomEmojis(5);
    expect(emojis).toHaveLength(5);
  });

  it('should not return duplicate emojis', () => {
    const emojis = getRandomEmojis(10);
    const uniqueEmojis = new Set(emojis);
    expect(uniqueEmojis.size).toBe(10);
  });
});
```

### Testing React Components

```typescript
// Example: Testing GameCanvas component
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameCanvas from '@/app/components/GameCanvas';

describe('GameCanvas', () => {
  it('should handle emoji clicks', async () => {
    const user = userEvent.setup();
    const mockOnClick = jest.fn();
    
    render(<GameCanvas emojis={['🎮', '🎯']} onEmojiClick={mockOnClick} />);
    
    const emoji = screen.getByText('🎮');
    await user.click(emoji);
    
    expect(mockOnClick).toHaveBeenCalledWith('🎮', expect.any(Number));
  });
});
```

### Testing API Routes

```typescript
// Example: Testing API route handlers
import { POST } from '@/app/api/game/start/route';
import { NextRequest } from 'next/server';

describe('POST /api/game/start', () => {
  it('should create a new game session', async () => {
    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({ lobbyId: 'test-lobby' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('gameId');
    expect(data).toHaveProperty('round', 1);
  });
});
```

### Testing with External Dependencies

When testing code that uses external services (like Upstash Redis), you have options:

1. **Mock the service** (for unit tests):
```typescript
jest.mock('@/app/lib/upstash-redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
}));
```

2. **Use test doubles** (for integration tests):
```typescript
// Create a test implementation of your storage interface
class InMemoryStorage implements GameStorage {
  private store = new Map();
  
  async get(key: string) {
    return this.store.get(key);
  }
  
  async set(key: string, value: any) {
    this.store.set(key, value);
  }
}
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Use Descriptive Test Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert Pattern**: Structure tests clearly with setup, execution, and verification
4. **Keep Tests Independent**: Each test should be able to run in isolation
5. **Test Edge Cases**: Include tests for error conditions, empty states, and boundary values

## Debugging Tests

### Run a single test file
```bash
npm test -- app/__tests__/lib/game-engine.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="should calculate score correctly"
```

### Debug in VS Code
Add this configuration to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Coverage Goals

Aim for:
- **Statements**: 80% minimum
- **Branches**: 75% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

Critical paths (game logic, scoring, state management) should have near 100% coverage.

## Continuous Integration

The `test:ci` script is optimized for CI environments:
- Runs with `--ci` flag for optimized output
- Generates coverage reports
- Limits worker processes to prevent memory issues
- Fails if coverage thresholds aren't met

## Common Issues and Solutions

### Issue: Tests fail with "Cannot find module"
**Solution**: Ensure your tsconfig.json paths are properly configured and match jest.config.js moduleNameMapper

### Issue: React component tests fail with "not wrapped in act()"
**Solution**: Use `@testing-library/user-event` for user interactions and ensure all state updates are awaited

### Issue: Tests timeout
**Solution**: Increase timeout for specific tests:
```typescript
test('long running test', async () => {
  // test code
}, 10000); // 10 second timeout
```

## Current Test Coverage

The project now has comprehensive test coverage including:

### ✅ Completed Tests

1. **Game Engine Logic** (`app/__tests__/lib/game-engine.test.ts`)
   - Game start/reset functionality
   - Emoji click handling and scoring
   - Point calculation algorithms
   - Edge cases and error conditions

2. **Utility Functions** (`app/__tests__/lib/emojis.test.ts`)
   - Random emoji generation
   - Score calculation
   - Unicode handling

3. **API Routes** 
   - `/api/game/click` - Emoji click handling
   - `/api/game/start` - Game initialization
   - `/api/lobby/create` - Lobby creation

4. **React Components**
   - `GameCanvas` - Main game interface
   - `Scoreboard` - Player rankings display

### ⚠️ Known Issues

Some tests fail due to ESM module compatibility issues with:
- `@upstash/redis` 
- `nanoid` (partially resolved by downgrading to v3)

These can be resolved by:
1. Mocking the modules completely
2. Using a test-specific Redis implementation
3. Upgrading the test setup to support ESM

### 📊 Test Results Summary

- **Total Test Suites**: 9
- **Passing Suites**: 5
- **Total Tests**: 68
- **Passing Tests**: 65

## Next Steps

1. Run `npm test` to see current test status
2. Fix remaining ESM compatibility issues
3. Add integration tests for complete user workflows
4. Set up pre-commit hooks to run tests before commits
5. Configure CI/CD to run tests on pull requests
6. Add E2E tests using Playwright or Cypress
7. Implement code coverage thresholds in CI

## Unused Code Report

See `UNUSED_CODE_ANALYSIS.md` for a detailed report on:
- Unused functions and exports
- Dead code paths
- Missing error handling
- Functionality gaps
- Security recommendations