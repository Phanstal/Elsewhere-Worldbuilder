import { toPng } from 'html-to-image';
import type { World } from '../../domain/types';
import { filenameForWorld, worldBounds } from '../../domain/world';
import { dataUrlToBytes, saveBinaryFile } from './save';

const CANVAS_COLOR = '#f0efe9';

export async function renderWorldPng(worldEl: HTMLElement, world: World): Promise<string> {
  await document.fonts.ready;
  const bounds = worldBounds(world, 72);
  const width = Math.max(480, Math.ceil(bounds.width));
  const height = Math.max(320, Math.ceil(bounds.height));

  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'hidden',
    background: CANVAS_COLOR,
    backgroundImage: 'radial-gradient(rgba(207, 208, 202, 0.9) 0.75px, transparent 0.75px)',
    backgroundSize: '22px 22px',
    pointerEvents: 'none',
    zIndex: '-1',
  } satisfies Partial<CSSStyleDeclaration>);

  const clone = worldEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
  clone
    .querySelectorAll('.relation-port, .resize-handle, .relation-name-input')
    .forEach((element) => element.remove());
  Object.assign(clone.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '1100px',
    height: '680px',
    margin: '0',
    transformOrigin: '0 0',
    transform: `translate(${-bounds.minX}px, ${-bounds.minY}px)`,
    transition: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  stage.appendChild(clone);
  document.body.appendChild(stage);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const pixelRatio = Math.min(2, Math.max(1, 4096 / Math.max(width, height)));
    return await toPng(stage, {
      width,
      height,
      pixelRatio,
      cacheBust: true,
      backgroundColor: CANVAS_COLOR,
    });
  } finally {
    stage.remove();
  }
}

export async function exportWorldPng(worldEl: HTMLElement, world: World): Promise<boolean> {
  const dataUrl = await renderWorldPng(worldEl, world);
  const bytes = dataUrlToBytes(dataUrl);
  return saveBinaryFile(bytes, filenameForWorld(world.name, 'png'), {
    title: 'Export World as PNG',
    defaultPath: filenameForWorld(world.name, 'png'),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
}
