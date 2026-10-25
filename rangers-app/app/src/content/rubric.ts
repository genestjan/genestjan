import type { ContentBand } from '../lib/model';
export interface Skill { id: string; corner: 'Technical' | 'Tactical' | 'Physical' | 'Psychological and social'; label: string }
const T = (id: string, label: string): Skill => ({ id, corner: 'Technical', label });
const A = (id: string, label: string): Skill => ({ id, corner: 'Tactical', label });
const P = (id: string, label: string): Skill => ({ id, corner: 'Physical', label });
const S = (id: string, label: string): Skill => ({ id, corner: 'Psychological and social', label });
export const RUBRIC: Record<ContentBand, Skill[]> = {
  U8: [T('close', 'Keeps the ball close'), T('feet', 'Uses both feet'), T('stop', 'Stops the ball'), A('forward', 'Goes forward with the ball'), P('agility', 'Agility and balance'), S('retry', 'Tries again after mistakes'), S('turns', 'Takes turns and listens')],
  U10: [T('touch', 'First touch'), T('pass', 'Inside-foot passing'), T('moves', '1v1 moves'), A('space', 'Finds space to receive'), A('goalside', 'Stays goal-side'), P('speed', 'Speed and agility'), S('effort', 'Effort and attitude after mistakes'), S('talk', 'Talks to teammates')],
  U12: [T('touch', 'First touch away from pressure'), T('pass', 'Passing range and weight'), T('weak', 'Weaker foot'), T('finish', 'Finishing'), A('shape', 'Position in our shape'), A('decide', 'Pass, dribble or shoot decision'), P('speed', 'Speed, agility, balance'), S('focus', 'Focus and confidence'), S('team', 'Teamwork and leadership')],
  U14: [T('receive', 'Receiving under pressure'), T('pass', 'Short and long passing'), T('head', 'Heading (within the club rules)'), A('units', 'Playing in units (pressure and cover)'), A('trans', 'Transitions'), P('stamina', 'Stamina'), P('strength', 'Bodyweight strength'), S('resil', 'Resilience'), S('coach', 'Coachability and leadership')],
  U16: [T('receive', 'Receiving under pressure'), T('pass', 'Passing range'), T('cross', 'Crossing and finishing under pressure'), A('press', 'Pressing triggers'), A('manage', 'Game management'), P('power', 'Speed and power'), P('stamina', 'Stamina'), S('lead', 'Leadership'), S('review', 'Self-review')],
};
export const SKILL_BADGES = ['Sole Roll', 'Toe Taps 50', 'Cruyff Turn', 'Drag-back', 'Inside Hook', 'Outside Hook', 'Step-over', 'Scissors', 'Body Feint', 'La Croqueta', 'Wall Pass', 'First Touch Away', 'Weaker Foot Pass', 'Laces Strike', 'Placed Finish', 'Jockey Master', 'Keeper Ready'];
export const BAND_FOR_AGE = (age: number): ContentBand => (age <= 8 ? 'U8' : age <= 10 ? 'U10' : age <= 12 ? 'U12' : age <= 14 ? 'U14' : 'U16');
