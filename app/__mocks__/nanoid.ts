let counter = 0;

export function nanoid(size?: number): string {
  counter++;
  const id = `test-id-${counter}`;
  return size ? id.padEnd(size, '0').slice(0, size) : id;
}

export default { nanoid };