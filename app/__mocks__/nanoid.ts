let counter = 0;

export function nanoid(size?: number): string {
  counter++;
  const id = `test-id-${counter}`;
  return size ? id.padEnd(size, '0').slice(0, size) : id;
}

export function customAlphabet(alphabet: string, size: number): () => string {
  return () => {
    let result = '';
    for (let i = 0; i < size; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  };
}

export default { nanoid, customAlphabet };