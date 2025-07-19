// Mock implementation of bad-words for testing
export class Filter {
  private badWords: Set<string>;

  constructor() {
    // Simple list of test bad words - in real implementation this comes from the library
    this.badWords = new Set([
      'fuck',
      'shit',
      'damn',
      'hell',
      'ass',
      'dick',
      'cock',
      'cunt',
      'bitch',
      'piss',
      // Add some 4-letter combinations that might appear in our codes
      'fvck',
      'sht1',
      'azz5',
      'd1ck',
      'c0ck',
      'b1ch',
      'h3ll',
    ]);
  }

  isProfane(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Check if the text contains any bad words
    for (const badWord of this.badWords) {
      if (lowerText.includes(badWord)) {
        return true;
      }
    }
    
    return false;
  }

  clean(text: string): string {
    let cleanedText = text;
    
    for (const badWord of this.badWords) {
      const regex = new RegExp(badWord, 'gi');
      cleanedText = cleanedText.replace(regex, '*'.repeat(badWord.length));
    }
    
    return cleanedText;
  }

  addWords(words: string[]): void {
    words.forEach(word => this.badWords.add(word.toLowerCase()));
  }

  removeWords(words: string[]): void {
    words.forEach(word => this.badWords.delete(word.toLowerCase()));
  }
}