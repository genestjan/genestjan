import { parse } from './assistant';
test('parses commands', () => {
  expect(parse('George, book a ride to SM')).toMatchObject({ kind: 'book', service: 'ride', place: 'SM City General Santos' });
  expect(parse('play Ben&Ben on youtube')).toEqual({ kind: 'music', query: 'ben&ben', app: 'youtube' });
  expect(parse('pabili ng Jollibee chicken')).toMatchObject({ kind: 'book', service: 'pabili', items: 'jollibee chicken' });
  expect(parse('message the driver I am at the gate')).toEqual({ kind: 'message', text: 'i am at the gate' });
  expect(parse('where is my driver').kind).toBe('whereDriver');
  expect(parse('stop music').kind).toBe('stopMusic');
  expect(parse('go online').kind).toBe('goOnline');
  expect(parse('blah').kind).toBe('unknown');
});
