import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Scoreboard from '@/app/components/Scoreboard';
import { Player } from '@/app/types/game';

describe('Scoreboard', () => {
  const createMockPlayer = (overrides?: Partial<Player>): Player => ({
    id: 'player-1',
    nickname: 'Player 1',
    avatar: '😊',
    score: 100,
    roundScores: [
      { round: 1, timeToFind: 5.2, points: 100 },
    ],
    isHost: false,
    ...overrides,
  });

  const mockPlayers: Player[] = [
    createMockPlayer({
      id: 'player-1',
      nickname: 'Alice',
      avatar: '🎮',
      score: 250,
      roundScores: [
        { round: 1, timeToFind: 3.5, points: 150 },
        { round: 2, timeToFind: 8.2, points: 100 },
      ],
    }),
    createMockPlayer({
      id: 'player-2',
      nickname: 'Bob',
      avatar: '🎯',
      score: 200,
      roundScores: [
        { round: 1, timeToFind: 5.0, points: 120 },
        { round: 2, timeToFind: 10.0, points: 80 },
      ],
    }),
    createMockPlayer({
      id: 'player-3',
      nickname: 'Charlie',
      avatar: '🎨',
      score: 150,
      roundScores: [
        { round: 1, timeToFind: 7.5, points: 100 },
        { round: 2, timeToFind: 12.0, points: 50 },
      ],
    }),
    createMockPlayer({
      id: 'player-4',
      nickname: 'Dave',
      avatar: '🎪',
      score: 50,
      roundScores: [
        { round: 1, timeToFind: 15.0, points: 50 },
        // Did not find in round 2
      ],
    }),
  ];

  it('should display round results with correct title', () => {
    render(<Scoreboard players={mockPlayers} currentRound={2} />);

    expect(screen.getByText('Round 2 Results')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('should display final scores with correct title', () => {
    render(<Scoreboard players={mockPlayers} isFinal={true} />);

    expect(screen.getByText('Final Scores')).toBeInTheDocument();
    // Trophy emoji appears multiple times, so check if at least one exists
    const trophies = screen.getAllByText('🏆');
    expect(trophies.length).toBeGreaterThan(0);
  });

  it('should sort players by score in descending order', () => {
    render(<Scoreboard players={mockPlayers} />);

    const playerNames = screen.getAllByText(/Alice|Bob|Charlie|Dave/);
    expect(playerNames[0]).toHaveTextContent('Alice');
    expect(playerNames[1]).toHaveTextContent('Bob');
    expect(playerNames[2]).toHaveTextContent('Charlie');
    expect(playerNames[3]).toHaveTextContent('Dave');
  });

  it('should display medal emojis for top 3 players', () => {
    render(<Scoreboard players={mockPlayers} />);

    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('should display player avatars and scores', () => {
    render(<Scoreboard players={mockPlayers} />);

    // Check avatars
    expect(screen.getByText('🎮')).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByText('🎨')).toBeInTheDocument();
    expect(screen.getByText('🎪')).toBeInTheDocument();

    // Check scores
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should display round-specific performance', () => {
    render(<Scoreboard players={mockPlayers} currentRound={2} />);

    // Alice's round 2 performance
    expect(screen.getByText('Found in 8.2s')).toBeInTheDocument();
    expect(screen.getByText('+100pts')).toBeInTheDocument();

    // Bob's round 2 performance
    expect(screen.getByText('Found in 10.0s')).toBeInTheDocument();
    expect(screen.getByText('+80pts')).toBeInTheDocument();

    // Dave didn't find in round 2
    const dnfElements = screen.getAllByText('DNF');
    expect(dnfElements.length).toBeGreaterThan(0);
  });

  it('should show DNF for players who did not find the emoji', () => {
    const playersWithDNF = [
      createMockPlayer({
        id: 'player-1',
        nickname: 'Alice',
        score: 100,
        roundScores: [
          { round: 1, timeToFind: 5.0, points: 100 },
          // No round 2 score
        ],
      }),
    ];

    render(<Scoreboard players={playersWithDNF} currentRound={2} />);

    expect(screen.getByText('DNF')).toBeInTheDocument();
  });

  it('should show play again button for final scores when callback provided', async () => {
    const mockPlayAgain = jest.fn();
    const user = userEvent.setup();

    render(
      <Scoreboard
        players={mockPlayers}
        isFinal={true}
        onPlayAgain={mockPlayAgain}
      />
    );

    const playAgainButton = screen.getByRole('button', { name: /play again/i });
    expect(playAgainButton).toBeInTheDocument();

    await user.click(playAgainButton);
    expect(mockPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('should show main menu button for final scores when callback provided', async () => {
    const mockMainMenu = jest.fn();
    const user = userEvent.setup();

    render(
      <Scoreboard
        players={mockPlayers}
        isFinal={true}
        onMainMenu={mockMainMenu}
      />
    );

    const mainMenuButton = screen.getByRole('button', { name: /main menu/i });
    expect(mainMenuButton).toBeInTheDocument();

    await user.click(mainMenuButton);
    expect(mockMainMenu).toHaveBeenCalledTimes(1);
  });

  it('should not show action buttons for round results', () => {
    render(<Scoreboard players={mockPlayers} currentRound={2} />);

    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /main menu/i })).not.toBeInTheDocument();
  });

  it('should handle empty player list', () => {
    render(<Scoreboard players={[]} currentRound={1} />);

    expect(screen.getByText('Round 1 Results')).toBeInTheDocument();
    // Should not crash with empty players
  });

  it('should apply winner styling to first place in final scores', () => {
    const { container } = render(<Scoreboard players={mockPlayers} isFinal={true} />);

    const playerElements = container.querySelectorAll('[class*="from-yellow-600"]');
    expect(playerElements.length).toBeGreaterThan(0);
  });

  it('should apply top 3 styling appropriately', () => {
    const { container } = render(<Scoreboard players={mockPlayers} isFinal={true} />);

    // Check for special styling on top 3 players
    const top3Elements = container.querySelectorAll('[class*="from-indigo-600"]');
    expect(top3Elements.length).toBe(2); // 2nd and 3rd place get indigo styling
  });

  it('should display both action buttons when both callbacks provided', () => {
    const mockPlayAgain = jest.fn();
    const mockMainMenu = jest.fn();

    render(
      <Scoreboard
        players={mockPlayers}
        isFinal={true}
        onPlayAgain={mockPlayAgain}
        onMainMenu={mockMainMenu}
      />
    );

    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /main menu/i })).toBeInTheDocument();
  });

  it('should handle players with no round scores', () => {
    const playersNoScores = [
      createMockPlayer({
        id: 'player-1',
        nickname: 'Alice',
        score: 0,
        roundScores: [],
      }),
    ];

    render(<Scoreboard players={playersNoScores} currentRound={1} />);

    expect(screen.getByText('DNF')).toBeInTheDocument();
  });

  it('should display score trophy icon for each player', () => {
    render(<Scoreboard players={mockPlayers} />);

    const trophyIcons = screen.getAllByText('🏆');
    // Each player has a trophy icon for their score display
    expect(trophyIcons.length).toBe(mockPlayers.length);
  });
});