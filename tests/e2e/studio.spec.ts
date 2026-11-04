import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function openArchive(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('No saved worlds yet.')).toBeVisible();
}

async function createWorld(page: Page) {
  await page.getByRole('button', { name: /Create new world/i }).click();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.project-name')).toHaveText('Untitled World');
}

async function addNode(page: Page, type: string) {
  await page.locator('.create-large').filter({ hasText: type }).click();
}

async function renameSelectedNode(page: Page, name: string) {
  await page.locator('.inspector-title-display').click();
  const input = page.getByLabel('Node title');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.locator('.inspector-title-display')).toHaveText(name);
}

async function waitForSave(page: Page) {
  await page.waitForTimeout(800);
  await expect(page.locator('.saved')).toHaveText(/Saved/);
}

async function goHome(page: Page) {
  await page.locator('.toolbar .brand').click();
  await expect(page.locator('.home-screen')).toBeVisible();
}

async function connectFromRightPort(page: Page, fromIndex: number, toIndex: number) {
  const fromPort = await page
    .locator('.world-node')
    .nth(fromIndex)
    .locator('.relation-port.right')
    .boundingBox();
  const target = await page.locator('.world-node').nth(toIndex).boundingBox();
  await page.mouse.move(fromPort!.x + fromPort!.width / 2, fromPort!.y + fromPort!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 16,
  });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await openArchive(page);
});

test('creates a world, edits a node and reloads it', async ({ page }) => {
  await createWorld(page);
  await expect(page.getByText('Every world begins somewhere.')).toBeVisible();

  await addNode(page, 'Element');
  await expect(page.locator('.world-node')).toHaveCount(1);
  await expect(page.locator('.inspector')).toContainText('Element');
  await renameSelectedNode(page, 'The Hollow Reach');
  await page.getByLabel('Description').fill('A quiet frontier at the edge of the known map.');
  await waitForSave(page);

  await goHome(page);
  const card = page.locator('.world-row').first();
  await expect(card).toContainText('Untitled World');
  await expect(card).toContainText('1 node');
  await page.getByRole('button', { name: /Open Untitled World/i }).click();

  await expect(page.locator('.world-node')).toContainText('The Hollow Reach');
  await page.locator('.world-node').filter({ hasText: 'The Hollow Reach' }).click({ force: true });
  await expect(page.getByLabel('Description')).toHaveValue(
    'A quiet frontier at the edge of the known map.',
  );
});

test('renames a world and keeps the name in the archive', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Space');
  await page.getByRole('button', { name: 'Rename world' }).click();
  const nameInput = page.getByLabel('World name');
  await nameInput.fill('The Ashen Atlas');
  await nameInput.press('Enter');
  await expect(page.locator('.project-name')).toHaveText('The Ashen Atlas');
  await waitForSave(page);

  await goHome(page);
  await expect(page.locator('.world-row').first()).toContainText('The Ashen Atlas');
  await page.getByRole('button', { name: /Open The Ashen Atlas/i }).click();
  await expect(page.locator('.project-name')).toHaveText('The Ashen Atlas');
});

test('creates and deletes an alias without changing the base count', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await renameSelectedNode(page, 'Mira');
  const allNodesCount = page.locator('.outline-trigger small');
  await expect(allNodesCount).toHaveText('1');

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Create alias' }).click();
  await expect(page.locator('.world-node')).toHaveCount(2);
  await expect(allNodesCount).toHaveText('1');
  await expect(page.locator('.inspector')).toContainText('Element · Alias');
  await expect(page.locator('.alias-mark')).toHaveCount(1);

  await page.getByRole('button', { name: 'Delete alias' }).click();
  await expect(page.locator('.world-node')).toHaveCount(1);
  await expect(allNodesCount).toHaveText('1');
});

test('connects two nodes and renames the relation', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await renameSelectedNode(page, 'Mira');
  await addNode(page, 'Element');
  await renameSelectedNode(page, 'The Ashen Court');

  // Move the second node clear of the first.
  const second = await page.locator('.world-node').last().boundingBox();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2);
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2 + 250, second!.y + second!.height / 2 + 100, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(250);

  await connectFromRightPort(page, 0, 1);
  await expect(page.locator('.relation-layer g')).toHaveCount(1);
  await expect(page.locator('.inspector')).toContainText('Relation');
  await page.locator('#relation-name').fill('Sworn to');
  await page.locator('#relation-name').press('Enter');
  await expect(page.locator('.relation-name')).toHaveText('Sworn to');

  await page.getByRole('button', { name: 'Delete relation' }).click();
  await expect(page.locator('.relation-layer g')).toHaveCount(0);
});

test('exports a .elsew file and a PNG', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Space');
  await renameSelectedNode(page, 'The Hollow Reach');
  await waitForSave(page);

  const elsewDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save \.elsew/i }).click();
  const elsew = await elsewDownload;
  expect(elsew.suggestedFilename()).toBe('Untitled World.elsew');
  const elsewPath = await elsew.path();
  const parsed = JSON.parse(readFileSync(elsewPath, 'utf8'));
  expect(parsed).toMatchObject({ format: 'elsew', version: 1, name: 'Untitled World' });
  expect(parsed.nodes).toHaveLength(1);
  expect(parsed.nodes[0]).toMatchObject({ type: 'Space', width: 560, height: 360 });

  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe('Untitled World.png');
  const pngPath = await png.path();
  const bytes = readFileSync(pngPath);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.length).toBeGreaterThan(5_000);
});

test('imports a .elsew world from the archive', async ({ page }) => {
  await page
    .locator('[data-testid="import-input"]')
    .setInputFiles('tests/fixtures/import-world.elsew');
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.project-name')).toHaveText('Imported Reach');
  await expect(page.locator('.world-node')).toHaveCount(2);
  await expect(page.locator('.world-node').first()).toContainText('The Hollow Reach');
  await waitForSave(page);

  await goHome(page);
  await expect(page.locator('.world-row').first()).toContainText('Imported Reach');
});

test('explores a world in read-only mode', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await renameSelectedNode(page, 'Mira');
  await addNode(page, 'Event');
  await expect(page.locator('.world-node')).toHaveCount(2);
  await page.getByRole('button', { name: 'Explore' }).click();

  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.locator('.inspector')).toHaveCount(0);
  await expect(page.locator('.canvas')).toHaveClass(/explore/);
  await page.locator('.world-node').filter({ hasText: 'Mira' }).click({ force: true });
  await expect(page.locator('.explore-panel')).toBeVisible();
  await expect(page.locator('.explore-panel')).toContainText('Mira');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await expect(page.locator('.explore-panel')).toHaveCount(0);
});

test('resizes a space and undoes the resize', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Space');
  const node = page.locator('.world-node');
  const before = await node.boundingBox();
  const handle = page.locator('.resize-handle.br');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 45, {
    steps: 10,
  });
  await page.mouse.up();
  const after = await node.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width + 40);

  await page.getByRole('button', { name: 'Undo' }).click();
  const restored = await node.boundingBox();
  expect(Math.abs(restored!.width - before!.width)).toBeLessThan(2);
});

test('creates time snapshots and keeps their nodes separate', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Space');
  await page.locator('.add-time').click();
  await expect(page.locator('.time-caption')).toHaveText(/2\/3/);

  await addNode(page, 'Element');
  await expect(page.locator('.world-node')).toHaveCount(2);
  await page.locator('.time-track button').first().click();
  await expect(page.locator('.time-caption')).toHaveText(/1\/3/);
  await expect(page.locator('.world-node')).toHaveCount(1);
  await page.locator('.time-track button').nth(1).click();
  await expect(page.locator('.world-node')).toHaveCount(2);

  await page.locator('.time-name').fill('After the Silence');
  await page.locator('.time-name').press('Tab');
  await expect(page.locator('.time-track button').nth(1)).toContainText('After the Silence');
});

test('deletes a world from the archive', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Space');
  await waitForSave(page);
  await goHome(page);

  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.world-row').first().hover();
  await page.getByRole('button', { name: /Options for Untitled World/i }).click();
  await page.getByRole('menuitem', { name: 'Delete world' }).click();
  await expect(page.getByText('No saved worlds yet.')).toBeVisible();
});

test('marquee-selects elements and moves the group together', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await addNode(page, 'Element');
  const nodes = page.locator('.world-node');
  await expect(nodes).toHaveCount(2);

  const boxes = await nodes.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }),
  );
  const left = Math.min(...boxes.map((box) => box.left)) - 34;
  const top = Math.min(...boxes.map((box) => box.top)) - 34;
  const right = Math.max(...boxes.map((box) => box.right)) + 34;
  const bottom = Math.max(...boxes.map((box) => box.bottom)) + 34;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.world-node.selected')).toHaveCount(2);

  const before = await nodes.evaluateAll((elements) =>
    elements.map((element) => Number(element.style.left)),
  );
  const first = await nodes.first().boundingBox();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(first!.x + first!.width / 2 + 70, first!.y + first!.height / 2 + 45, {
    steps: 12,
  });
  await page.mouse.up();
  const after = await nodes.evaluateAll((elements) =>
    elements.map((element) => Number(element.style.left)),
  );
  expect(after[0] - before[0]).toBeGreaterThan(20);
  expect(Math.abs(after[0] - before[0] - (after[1] - before[1]))).toBeLessThanOrEqual(2);
  await expect(page.locator('.inspector')).toContainText('2 elements selected');
});

test('copies and pastes selected nodes', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await page.locator('.world-node').click({ force: true });
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.world-node')).toHaveCount(2);
  await expect(page.locator('.world-node.selected')).toHaveCount(1);
});

test('changes a node layer from the right-click menu', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await addNode(page, 'Event');
  const first = page.locator('.world-node').first();
  const before = Number(await first.evaluate((element) => getComputedStyle(element).zIndex));
  await first.click({ button: 'right', force: true });
  await expect(page.getByRole('menu', { name: 'Node layer' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Bring to front' }).click();
  const after = Number(await first.evaluate((element) => getComputedStyle(element).zIndex));
  expect(after).toBeGreaterThan(before);
});

test('renders spaces at 80 percent opacity and keeps All Elements above Create', async ({
  page,
}) => {
  await createWorld(page);
  await expect(page.getByLabel('Search world')).toHaveCount(0);
  const trigger = page.locator('.outline-trigger');
  const create = page.locator('.create-section');
  await expect(trigger).toBeVisible();
  const triggerBox = await trigger.boundingBox();
  const createBox = await create.boundingBox();
  expect(triggerBox!.y).toBeLessThan(createBox!.y);
  await addNode(page, 'Space');
  await expect(page.locator('.world-node')).toHaveCSS('opacity', '0.8');
});

test('pans with two-finger scroll and zooms with pinching', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  const world = page.locator('.world');
  await page.mouse.move(760, 500);
  const beforePan = await world.evaluate((element) => element.style.transform);
  await page.mouse.wheel(0, 140);
  await expect.poll(() => world.evaluate((element) => element.style.transform)).not.toBe(beforePan);

  const zoom = page.locator('.zoom-control span');
  const beforeZoom = await zoom.textContent();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -320);
  await page.keyboard.up('Control');
  await expect.poll(() => zoom.textContent(), { timeout: 2500 }).not.toBe(beforeZoom);
});

test('commits a description when clicking outside the field', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Element');
  await page.getByLabel('Description').fill('A note that should survive.');
  await page.locator('.canvas').click({ position: { x: 760, y: 520 } });
  await waitForSave(page);
  await goHome(page);
  await page.getByRole('button', { name: /Open Untitled World/i }).click();
  await page.locator('.world-node').click({ force: true });
  await expect(page.getByLabel('Description')).toHaveValue('A note that should survive.');
});

test.describe('compact layout', () => {
  test.use({ viewport: { width: 720, height: 820 } });

  test('creates a node through the quick-add palette', async ({ page }) => {
    await createWorld(page);
    await expect(page.locator('.sidebar')).toBeHidden();
    await page.getByRole('button', { name: 'Quick add node' }).click();
    await expect(page.locator('.quick-palette')).toBeVisible();
    await page.locator('.quick-palette-grid button').filter({ hasText: 'Space' }).click();
    await expect(page.locator('.world-node')).toHaveCount(1);
    await expect(page.locator('.inspector')).toBeVisible();
    await expect(page.locator('.inspector')).toContainText('Space');
    await expect(page.getByLabel('Node title')).toHaveCount(0);
  });
});
