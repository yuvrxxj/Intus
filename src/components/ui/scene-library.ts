import { buildScene, type Scene, type SceneArt, type SceneId } from './scene-engine.ts';
import { MOTIONS } from './scene-motion.ts';

/**
 * The size of each picture in characters. It is known up front so a page can lay the picture out before its art has
 * arrived, and test/scene.test.ts fails if it ever differs from the generated art.
 */
export const SCENE_SIZE: Record<SceneId, { cols: number; rows: number }> = {
  hourglass: { cols: 146, rows: 150 },
  archery: { cols: 181, rows: 140 },
  bloodwork: { cols: 184, rows: 120 },
  supplements: { cols: 197, rows: 100 },
  sisyphus: { cols: 198, rows: 100 },
};

/** Each picture is its own chunk of about 20 kB, fetched only when a page that shows it opens. */
export const SCENE_ART: Record<SceneId, () => Promise<SceneArt>> = {
  hourglass: () => import('../art/scene-hourglass.ts').then((m) => ({ cols: m.HOURGLASS_COLS, rows: m.HOURGLASS_ROWS, ramp: m.HOURGLASS_RAMP, text: m.HOURGLASS_TEXT })),
  archery: () => import('../art/scene-archery.ts').then((m) => ({ cols: m.ARCHERY_COLS, rows: m.ARCHERY_ROWS, ramp: m.ARCHERY_RAMP, text: m.ARCHERY_TEXT })),
  bloodwork: () => import('../art/scene-bloodwork.ts').then((m) => ({ cols: m.BLOODWORK_COLS, rows: m.BLOODWORK_ROWS, ramp: m.BLOODWORK_RAMP, text: m.BLOODWORK_TEXT })),
  supplements: () => import('../art/scene-supplements.ts').then((m) => ({ cols: m.SUPPLEMENTS_COLS, rows: m.SUPPLEMENTS_ROWS, ramp: m.SUPPLEMENTS_RAMP, text: m.SUPPLEMENTS_TEXT })),
  sisyphus: () => import('../art/scene-sisyphus.ts').then((m) => ({ cols: m.SISYPHUS_COLS, rows: m.SISYPHUS_ROWS, ramp: m.SISYPHUS_RAMP, text: m.SISYPHUS_TEXT })),
};

const loaded = new Map<SceneId, Promise<Scene>>();

/** The picture ready to draw. Built once, then shared: a frame is made in one go, so two canvases cannot clash. */
export function loadScene(id: SceneId): Promise<Scene> {
  let scene = loaded.get(id);
  if (!scene) {
    scene = SCENE_ART[id]().then((art) => buildScene(art, MOTIONS[id]));
    // a failed fetch must not be remembered, or the picture could never load again until a reload
    scene.catch(() => loaded.delete(id));
    loaded.set(id, scene);
  }
  return scene;
}
