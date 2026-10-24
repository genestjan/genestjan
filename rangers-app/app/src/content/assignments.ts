/** Ready-made home assignments. Every task is something a child can do alone in a small space and show with a short clip or a photo.
 *  Safety: no heading, no maximal fitness, no tasks that need an adult-sized pitch. A coach can edit the text before sending. */
export interface AssignmentTemplate { id: string; title: string; why: string; minAge: number; maxAge: number; tasks: string[] }
export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  { id: 'A01', title: 'Ball mastery at home', why: 'Close control is built with thousands of small touches. Ten minutes a day beats one long session.', minAge: 6, maxAge: 16,
    tasks: ['Toe taps: 30 seconds, then show a short clip', 'Inside and outside touches with each foot: 20 each, show a clip', 'Roll the ball side to side under the sole of your foot for 1 minute each foot, show a clip'] },
  { id: 'A02', title: 'Weak foot week', why: 'Players who can use both feet are harder to defend. This is for your less strong foot only.', minAge: 8, maxAge: 16,
    tasks: ['Dribble in a small square using only your weaker foot for 2 minutes, show a clip', 'Pass against a wall 20 times with your weaker foot, show a clip', 'Photo: where you practised and what you used as a target'] },
  { id: 'A03', title: 'Cone dribbling course', why: 'Dribbling at pace while looking up is a match skill.', minAge: 6, maxAge: 12,
    tasks: ['Photo: your course (5 bottles or shoes in a line, one stride apart)', 'Dribble through the course 5 times, show a clip', 'Dribble through using only the outside of your foot, show a clip'] },
  { id: 'A04', title: 'Wall passing', why: 'A wall is a free partner for first touch and passing.', minAge: 8, maxAge: 16,
    tasks: ['Pass and receive with the inside of the right foot, 20 passes, show a clip', 'Same with the left foot, 20 passes, show a clip', 'Alternate feet, 20 passes, show a clip'] },
  { id: 'A05', title: 'Juggling challenge', why: 'Juggling teaches touch and balance. Count your best and try to beat it.', minAge: 8, maxAge: 16,
    tasks: ['Juggle with your feet and thighs: best of 3 tries, show a clip of your best', 'Juggle using only your weaker foot, show a clip', 'Write your best number on paper and send a photo'] },
  { id: 'A06', title: 'Pack your football bag', why: 'Being ready is part of being a good teammate.', minAge: 6, maxAge: 10,
    tasks: ['Photo: your bag packed with boots, shin guards, socks, water bottle and towel', 'Photo: your filled water bottle', 'Photo: your boots cleaned after training'] },
  { id: 'A07', title: 'Warm-up routine', why: 'A good warm-up prevents injuries. Do it before every session.', minAge: 8, maxAge: 16,
    tasks: ['Jog on the spot 1 minute, then 10 leg swings each leg, show a clip', 'Walking lunges, 8 each leg, show a clip', 'Light stretches for legs, hold each for 20 seconds, show a clip'] },
  { id: 'A08', title: 'Quick feet', why: 'Fast, light feet help you change direction.', minAge: 8, maxAge: 16,
    tasks: ['Photo: a line of 6 small markers about 40 cm apart', 'Step quickly through the markers, one foot in each gap, 5 times, show a clip', 'Do it again with a ball at your feet, show a clip'] },
  { id: 'A09', title: 'Turning with the ball', why: 'Turning away from pressure keeps possession.', minAge: 8, maxAge: 14,
    tasks: ['Practise the inside-of-foot turn, 10 turns each foot, show a clip', 'Practise the drag-back turn, 10 times each foot, show a clip', 'Dribble, turn, and go the other way 10 times, show a clip'] },
  { id: 'A10', title: 'Goalkeeper hands', why: 'Soft hands and a ready stance make saves easier. Keep the ball low and on soft ground.', minAge: 9, maxAge: 16,
    tasks: ['Throw a ball against a wall and catch it with both hands 20 times, show a clip', 'From kneeling, catch 10 low rolled balls with two hands, show a clip', 'Photo: your ready stance (feet shoulder-width, knees bent, hands up)'] },
  { id: 'A11', title: 'Fitness at home (gentle)', why: 'Simple strength helps you run, turn and stay healthy. Stop if anything hurts.', minAge: 10, maxAge: 16,
    tasks: ['20 seconds of marching on the spot x 3, show a clip', '10 bodyweight squats x 2, show a clip', 'Plank on your knees or toes for 20 seconds, show a clip'] },
  { id: 'A12', title: 'Watch and learn', why: 'Good players study the game. Watch with a parent.', minAge: 8, maxAge: 16,
    tasks: ['Watch 10 minutes of a match and draw one thing a player did well, send a photo of your drawing', 'Write one thing you will try at training and send a photo'] },
];
export const templatesFor = (age: number) => ASSIGNMENT_TEMPLATES.filter((t) => age >= t.minAge && age <= t.maxAge);
