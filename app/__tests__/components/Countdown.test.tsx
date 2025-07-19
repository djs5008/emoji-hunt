import { render, screen } from '@testing-library/react';
import Countdown from '@/app/components/Countdown';

describe('Countdown Component', () => {
  it('should render countdown number when count is greater than 0', () => {
    render(<Countdown count={3} />);
    
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('GO!')).not.toBeInTheDocument();
  });

  it('should render different countdown numbers', () => {
    const { rerender } = render(<Countdown count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(<Countdown count={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();

    rerender(<Countdown count={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('should render GO! when count is 0', () => {
    render(<Countdown count={0} />);
    
    expect(screen.getByText('GO!')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should render GO! when count is negative', () => {
    render(<Countdown count={-1} />);
    
    expect(screen.getByText('GO!')).toBeInTheDocument();
    expect(screen.queryByText('-1')).not.toBeInTheDocument();
  });

  it('should have correct CSS classes for fullscreen overlay', () => {
    const { container } = render(<Countdown count={3} />);
    const overlayDiv = container.firstChild as HTMLElement;
    
    expect(overlayDiv).toHaveClass('fixed', 'inset-0', 'bg-black', 'flex', 'items-center', 'justify-center', 'z-50');
  });

  it('should have correct CSS classes for countdown number', () => {
    render(<Countdown count={2} />);
    const numberDiv = screen.getByText('2');
    
    expect(numberDiv).toHaveClass('text-9xl', 'font-bold', 'animate-pulse');
  });

  it('should have correct CSS classes for GO! text', () => {
    render(<Countdown count={0} />);
    const goDiv = screen.getByText('GO!');
    
    expect(goDiv).toHaveClass('text-6xl', 'font-bold', 'animate-pulse');
  });

  it('should have text-white class on inner container', () => {
    const { container } = render(<Countdown count={1} />);
    const textContainer = container.querySelector('.text-white');
    
    expect(textContainer).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('should be accessible with screen readers', () => {
      render(<Countdown count={3} />);
      
      // The countdown text should be readable
      expect(screen.getByText('3')).toBeVisible();
    });

    it('should handle high contrast mode', () => {
      const { container } = render(<Countdown count={2} />);
      
      // Text should be white on black background for high contrast
      expect(container.firstChild).toHaveClass('bg-black');
      expect(container.querySelector('.text-white')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      render(<Countdown count={999} />);
      
      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('should handle zero count', () => {
      render(<Countdown count={0} />);
      
      expect(screen.getByText('GO!')).toBeInTheDocument();
    });

    it('should handle float numbers (should display as-is)', () => {
      render(<Countdown count={2.5} />);
      
      expect(screen.getByText('2.5')).toBeInTheDocument();
    });
  });

  describe('visual appearance', () => {
    it('should create fullscreen overlay effect', () => {
      const { container } = render(<Countdown count={1} />);
      const overlay = container.firstChild as HTMLElement;
      
      // Should cover entire screen
      expect(overlay).toHaveClass('fixed', 'inset-0');
      
      // Should be on top of other content
      expect(overlay).toHaveClass('z-50');
      
      // Should center content
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('should use different text sizes for numbers vs GO!', () => {
      const { rerender } = render(<Countdown count={1} />);
      const numberElement = screen.getByText('1');
      expect(numberElement).toHaveClass('text-9xl');

      rerender(<Countdown count={0} />);
      const goElement = screen.getByText('GO!');
      expect(goElement).toHaveClass('text-6xl');
    });

    it('should apply pulse animation to both number and GO!', () => {
      const { rerender } = render(<Countdown count={1} />);
      expect(screen.getByText('1')).toHaveClass('animate-pulse');

      rerender(<Countdown count={0} />);
      expect(screen.getByText('GO!')).toHaveClass('animate-pulse');
    });
  });

  describe('component structure', () => {
    it('should have correct DOM structure', () => {
      const { container } = render(<Countdown count={2} />);
      
      // Should have outer div with overlay classes
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.tagName).toBe('DIV');
      expect(outerDiv).toHaveClass('fixed', 'inset-0', 'bg-black');
      
      // Should have inner div with text-white
      const innerDiv = outerDiv.firstChild as HTMLElement;
      expect(innerDiv.tagName).toBe('DIV');
      expect(innerDiv).toHaveClass('text-white');
      
      // Should have text div with styling
      const textDiv = innerDiv.firstChild as HTMLElement;
      expect(textDiv.tagName).toBe('DIV');
      expect(textDiv).toHaveClass('text-9xl', 'font-bold', 'animate-pulse');
    });
  });
});