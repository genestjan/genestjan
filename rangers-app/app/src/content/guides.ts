/** "Show me how" guides. Each step opens a screen and points at a real button (marked data-tour="..." in the app). */
export interface GuideCtx { firstPlayerId?: string; nextEventId?: string; firstKidId?: string; firstTaskId?: string }
export interface GuideStep { route?: string | ((c: GuideCtx) => string | undefined); target?: string; title: string; text: string }
export interface Guide { id: string; title: string; for: 'coach' | 'parent'; steps: GuideStep[] }

export const GUIDES: Guide[] = [
  { id: 'start-coach', for: 'coach', title: 'Getting started (coaches)', steps: [
    { route: '/', target: 'today-next', title: 'Your Home screen', text: 'This is home. It shows the next training or match and how many families replied Going, Maybe or Not going.' },
    { route: '/', target: 'quick-actions', title: 'Quick actions', text: 'The jobs you do most: start a match, plan training, assign tasks, take attendance, recognise a child.' },
    { route: '/', target: 'attention', title: 'Needs your attention', text: 'Anything waiting for you shows here: messages, task photos to check, missing ID papers.' },
    { route: '/', target: 'tab-schedule', title: 'Schedule', text: 'Add trainings, matches and school meets. Families get a reminder the day before.' },
    { route: '/', target: 'tab-inbox', title: 'Inbox', text: 'Post announcements to the team and message a child\'s family privately.' },
    { route: '/', target: 'tab-squad', title: 'Team', text: 'Your players. Open a child to invite their family and see their details and ID papers.' },
    { route: '/', target: 'help-button', title: 'Help is always here', text: 'Tap Help any time to ask a question or open more "Show me how" guides.' },
  ] },
  { id: 'add-players', for: 'coach', title: 'Add players and invite families', steps: [
    { route: '/squad', target: 'squad-add', title: 'Type or paste names', text: 'One child per line, with a shirt number in front if you like, for example "7 Ana". Then tap Add.' },
    { route: (c) => (c.firstPlayerId ? `/player/${c.firstPlayerId}` : '/squad'), target: 'invite', title: 'Invite the family', text: 'Open a child and tap Create invite link. Send it privately to that child\'s parent (Messenger is fine). Each link works once.' },
  ] },
  { id: 'new-event', for: 'coach', title: 'Add a training, match or school meet', steps: [
    { route: '/schedule', target: 'new-event', title: 'New event', text: 'Tap here to add something to the calendar.' },
    { route: '/event/new', target: 'event-types', title: 'Choose the type', text: 'Training, match, tournament or school meet. For a school meet you also pick the level: Intramurals, District, GSCAA, SRAA or Palarong Pambansa.' },
    { route: '/event/new', target: 'event-save', title: 'Save', text: 'Fill in the time and place, then Save. You can repeat a training every week.' },
  ] },
  { id: 'attendance', for: 'coach', title: 'Take attendance', steps: [
    { route: '/attendance', target: 'att-take', title: 'Open today\'s session', text: 'This opens today\'s event. If it is not in the schedule, start a session with the button underneath.' },
    { route: '/attendance', target: 'att-report', title: 'The report', text: 'See each child\'s attendance and download it as a spreadsheet for the school.' },
    { title: 'Marking each child', text: 'On the session screen, tap Present, Late, Absent or Excused for each child. Parents\' "not going" replies show next to the name. It saves as you tap.' },
  ] },
  { id: 'squad', for: 'coach', title: 'Pick the squad and tell the families', steps: [
    { route: (c) => (c.nextEventId ? `/event/${c.nextEventId}` : '/schedule'), target: 'squad-section', title: 'Squad', text: 'On a match, tournament or school meet, tap Pick the squad.' },
    { route: (c) => (c.nextEventId ? `/event/${c.nextEventId}/squad` : '/schedule'), target: 'pick-list', title: 'Tick the players', text: 'For school meets you also see each child\'s category, age check and missing papers.' },
    { route: (c) => (c.nextEventId ? `/event/${c.nextEventId}/squad` : '/schedule'), target: 'pick-send', title: 'Save and tell the families', text: 'The squad is posted as a team announcement and each picked family gets a private message. Tell children who were not picked yourself first.' },
  ] },
  { id: 'assign', for: 'coach', title: 'Send a home task', steps: [
    { route: '/assign', target: 'assign-new', title: 'New assignment', text: 'Tap here to start.' },
    { route: '/assign/new', target: 'assign-templates', title: 'Pick a ready-made one', text: 'Or write your own tasks underneath.' },
    { route: '/assign/new', target: 'assign-show-how', title: 'Show them how', text: 'Paste a YouTube link (upload it as Unlisted) or add a photo of the drill.' },
    { route: '/assign/new', target: 'assign-players', title: 'Choose the players', text: 'Tick who gets it, then Send. Each child sends a photo for every task, and you approve them in Assign.' },
  ] },
  { id: 'recognise', for: 'coach', title: 'Recognise a child', steps: [
    { route: '/recognise', target: 'rec-who', title: '1. Who?', text: 'Tap one or more children. A star means nobody has recognised them for 6 weeks.' },
    { route: '/recognise', target: 'rec-value', title: '2. What did they show?', text: 'Pick the club value. The small text says what it looks like on the pitch.' },
    { route: '/recognise', target: 'rec-why', title: '3. Why?', text: 'One specific line, for example "Ran back to help Ben".' },
    { route: '/recognise', target: 'rec-save', title: 'Save', text: 'The family sees it on their Progress page. You can undo straight away.' },
  ] },
  { id: 'palaro', for: 'coach', title: 'Set up a school team (Road to Palaro)', steps: [
    { route: '/settings', target: 'school-settings', title: 'Mark it as a school team', text: 'Tick School team, and Mixed ages if the players are different ages. Add the school, district, coordinator and the age cutoffs from the DepEd memo.' },
    { route: '/pathway', target: 'ladder', title: 'The ladder', text: 'Intramurals, District, GSCAA, SRAA, Palarong Pambansa. Add the dates here and enter results after each meet.' },
    { route: '/pathway', target: 'screening', title: 'Screening papers', text: 'Tap a child to set their category, tick papers as you check them, and mark who is selected for the next level.' },
  ] },
  { id: 'start-parent', for: 'parent', title: 'Getting started (families)', steps: [
    { route: '/', target: 'home-child', title: 'Your child', text: 'Your child\'s team. Tap Progress to see what the coach has shared.' },
    { route: '/', target: 'docs-reminder', title: 'ID papers', text: 'If you see this red box, please add a photo of the student ID and PSA birth certificate. Tournament organisers ask the coach for them.' },
    { route: '/', target: 'rsvp', title: 'Going or not?', text: 'Tell the coach if your child is coming to the next session.' },
    { route: '/', target: 'tab-tasks', title: 'Tasks', text: 'Home tasks from the coach. Send a photo for each task to clear the list.' },
    { route: '/', target: 'tab-inbox', title: 'Inbox', text: 'Team news and private messages with the coach.' },
    { route: '/', target: 'help-button', title: 'Help', text: 'Tap Help to ask a question, or to see these guides again.' },
  ] },
  { id: 'task-photo', for: 'parent', title: 'Send a photo for a task', steps: [
    { route: '/tasks', target: 'task-card', title: 'Open the task', text: 'Tap a task from the coach.' },
    { route: (c) => (c.firstTaskId ? `/tasks/${c.firstTaskId}` : '/tasks'), target: 'add-photo', title: 'Add a photo', text: 'Do the task, then tap Add a photo and take or choose a picture. Each task needs one photo.' },
  ] },
  { id: 'id-papers', for: 'parent', title: 'Add the ID papers', steps: [
    { route: (c) => (c.firstKidId ? `/docs/${c.firstKidId}` : '/'), target: 'doc-studentId', title: 'Student ID', text: 'Take a clear photo of the front of the school ID.' },
    { route: (c) => (c.firstKidId ? `/docs/${c.firstKidId}` : '/'), target: 'doc-birthCert', title: 'PSA birth certificate', text: 'Lay it flat in good light so every word can be read. Only the coaches and your family can see it.' },
  ] },
  { id: 'details', for: 'parent', title: 'Fill in your child\'s details', steps: [
    { route: (c) => (c.firstKidId ? `/details/${c.firstKidId}` : '/'), target: 'details-form', title: 'Details and health', text: 'Birthday, address, emergency contacts, allergies, health conditions and medication. It saves as you type.' },
  ] },
  { id: 'message-coach', for: 'parent', title: 'Message the coach', steps: [
    { route: '/inbox', target: 'messages-tab', title: 'Messages', text: 'Tap Messages, then your child\'s name, to write to the coach privately.' },
  ] },
];
export const guidesFor = (role: 'coach' | 'parent') => GUIDES.filter((g) => g.for === role);
export const guideById = (id: string) => GUIDES.find((g) => g.id === id);
