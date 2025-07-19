import { getRandomEmojis, calculateScore } from '@/app/lib/emojis';

describe('Emoji Utilities', () => {
  describe('getRandomEmojis', () => {
    it('should return the requested number of emojis', () => {
      const counts = [1, 5, 10, 50, 100];
      
      counts.forEach(count => {
        const emojis = getRandomEmojis(count);
        expect(emojis).toHaveLength(count);
        expect(emojis.every(e => typeof e === 'string')).toBe(true);
      });
    });

    it('should return unique emojis when count is small', () => {
      const emojis = getRandomEmojis(10);
      const uniqueEmojis = new Set(emojis);
      expect(uniqueEmojis.size).toBe(10);
    });

    it('should handle requests for more emojis than available', () => {
      // The emoji library has around 1000 emojis
      const emojis = getRandomEmojis(1500);
      expect(emojis).toHaveLength(1500);
      
      // Should contain all unique emojis at least once
      const uniqueEmojis = new Set(emojis);
      expect(uniqueEmojis.size).toBeGreaterThan(900); // Most emojis should be included
    });

    it('should return different selections on multiple calls', () => {
      const selection1 = getRandomEmojis(50);
      const selection2 = getRandomEmojis(50);
      
      // While randomness could theoretically produce identical results,
      // it's extremely unlikely with 50 items from 1000+ choices
      const identical = selection1.every((emoji, index) => emoji === selection2[index]);
      expect(identical).toBe(false);
    });

    it('should only return valid emoji strings', () => {
      const emojis = getRandomEmojis(100);
      
      emojis.forEach(emoji => {
        expect(emoji).toBeTruthy();
        expect(typeof emoji).toBe('string');
        expect(emoji.length).toBeGreaterThanOrEqual(1);
        // Check that it's not a basic ASCII character
        const codePoint = emoji.codePointAt(0);
        expect(codePoint).toBeDefined();
        // Most emojis are in Unicode ranges above 0x1F000
        // or in the range 0x2000-0x3000 for symbols
        expect(codePoint! > 127 || emoji.length > 1).toBe(true);
      });
    });

    it('should handle edge cases', () => {
      expect(getRandomEmojis(0)).toEqual([]);
      expect(getRandomEmojis(1)).toHaveLength(1);
    });

    it('should avoid consecutive duplicates when possible', () => {
      // Test with a large number that forces duplicates
      const emojis = getRandomEmojis(2000);
      
      let consecutiveDuplicates = 0;
      for (let i = 1; i < emojis.length; i++) {
        if (emojis[i] === emojis[i - 1]) {
          consecutiveDuplicates++;
        }
      }
      
      // Should have minimal consecutive duplicates relative to total
      const duplicateRatio = consecutiveDuplicates / emojis.length;
      expect(duplicateRatio).toBeLessThan(0.1); // Less than 10% consecutive duplicates
    });
  });

  describe('calculateScore (deprecated)', () => {
    it('should return 100 points for instant find (≤1 second)', () => {
      expect(calculateScore(0)).toBe(100);
      expect(calculateScore(0.5)).toBe(100);
      expect(calculateScore(1)).toBe(100);
    });

    it('should return 90 points for fast find (≤10 seconds)', () => {
      expect(calculateScore(2)).toBe(90);
      expect(calculateScore(5)).toBe(90);
      expect(calculateScore(10)).toBe(90);
    });

    it('should return decreasing points for slower finds', () => {
      expect(calculateScore(11)).toBe(80); // ≤20 seconds
      expect(calculateScore(20)).toBe(80);
      
      expect(calculateScore(21)).toBe(70); // ≤30 seconds
      expect(calculateScore(30)).toBe(70);
      
      expect(calculateScore(31)).toBe(60); // ≤40 seconds
      expect(calculateScore(40)).toBe(60);
      
      expect(calculateScore(41)).toBe(50); // ≤50 seconds
      expect(calculateScore(50)).toBe(50);
      
      expect(calculateScore(51)).toBe(40); // ≤60 seconds
      expect(calculateScore(60)).toBe(40);
    });

    it('should return 0 points for very slow finds (>60 seconds)', () => {
      expect(calculateScore(61)).toBe(0);
      expect(calculateScore(100)).toBe(0);
      expect(calculateScore(1000)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(calculateScore(-1)).toBe(100); // Negative time treated as instant
      expect(calculateScore(NaN)).toBe(0); // NaN falls through to 0
      expect(calculateScore(Infinity)).toBe(0); // Infinity > 60
    });
  });

  describe('Emoji consistency', () => {
    it('should maintain emoji integrity through normalization', () => {
      const emojis = getRandomEmojis(100);
      
      emojis.forEach(emoji => {
        // Test that emojis normalize consistently
        const normalized = emoji.normalize('NFC');
        expect(normalized).toBe(emoji.normalize('NFC'));
        
        // Test that re-normalizing doesn't change the emoji
        const doubleNormalized = normalized.normalize('NFC');
        expect(doubleNormalized).toBe(normalized);
      });
    });

    it('should handle composite emojis correctly', () => {
      // Get a sample of emojis that might include composites
      const emojis = getRandomEmojis(200);
      
      // Filter for potential composite emojis (containing ZWJ or variation selectors)
      const compositeEmojis = emojis.filter(emoji => 
        emoji.includes('\u200D') || // Zero Width Joiner
        emoji.includes('\uFE0F') || // Variation Selector-16
        emoji.includes('\uFE0E')    // Variation Selector-15
      );
      
      // If we found any composite emojis, verify they maintain structure
      if (compositeEmojis.length > 0) {
        compositeEmojis.forEach(emoji => {
          const codePoints = Array.from(emoji);
          expect(codePoints.length).toBeGreaterThanOrEqual(1);
          
          // Verify the emoji can be used in string operations
          expect(emoji.length).toBeGreaterThan(0);
          expect(typeof emoji.normalize('NFC')).toBe('string');
        });
      }
    });
  });
});