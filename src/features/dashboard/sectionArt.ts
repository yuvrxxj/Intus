import type { AsciiShape } from '../../components/ui/ascii-engine.ts';
import type { SectionId } from './sections.ts';

/** The drawing beside each section's title, one shape each. A Record, so a new section cannot be added without one. */
export const SECTION_ART: Record<SectionId, AsciiShape> = {
  today: 'sphere',
  progress: 'bars',
  goals: 'ring',
  bloodwork: 'drop',
  supplements: 'capsule',
  screening: 'cross',
  history: 'stack',
  account: 'cube',
};

/** The size every section drawing is made at (characters). The tests check no shape is clipped at this size. */
export const SECTION_ART_COLS = 40;
export const SECTION_ART_ROWS = 20;
