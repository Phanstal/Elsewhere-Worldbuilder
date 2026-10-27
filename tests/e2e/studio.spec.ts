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
  await expect(page.locator('.project-title')).toHaveText('Untitled World');
}

async function addNode(page: Page, type: string) {
  await page.locator('.create-row').filter({ hasText: type }).click();
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

test.beforeEach(async ({ page }) => {
  await openArchive(page);
});

test('creates a world, edits a node and reloads it', async ({ page }) => {
  await createWorld(page);
  await expect(page.getByText('Every world begins somewhere.')).toBeVisible();

  await addNode(page, 'Character');
  await expect(page.locator('.world-node')).toHaveCount(1);
  await expect(page.locator('.inspector')).toContainText('Character');
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
  await addNode(page, 'Place');
  await page.getByRole('button', { name: 'Rename world' }).click();
  const nameInput = page.getByLabel('World name');
  await nameInput.fill('The Ashen Atlas');
  await nameInput.press('Enter');
  await expect(page.locator('.project-title')).toHaveText('The Ashen Atlas');
  await waitForSave(page);

  await goHome(page);
  await expect(page.locator('.world-row').first()).toContainText('The Ashen Atlas');
  await page.getByRole('button', { name: /Open The Ashen Atlas/i }).click();
  await expect(page.locator('.project-title')).toHaveText('The Ashen Atlas');
});

test('creates and deletes an alias without changing the base count', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Character');
  await renameSelectedNode(page, 'Mira');
  const allNodesCount = page
    .locator('.side-row')
    .filter({ hasText: 'All Nodes' })
    .locator('.node-count');
  await expect(allNodesCount).toHaveText('1');

  await page.getByRole('button', { name: 'Create alias' }).click();
  await expect(page.locator('.world-node')).toHaveCount(2);
  await expect(allNodesCount).toHaveText('1');
  await expect(page.locator('.inspector')).toContainText('Character · Alias');
  await expect(page.locator('.alias-mark')).toHaveCount(1);

  await page.getByRole('button', { name: 'Delete alias' }).first().click();
  await expect(page.locator('.world-node')).toHaveCount(1);
  await expect(allNodesCount).toHaveText('1');
});

test('connects two nodes and renames the relation', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Character');
  await renameSelectedNode(page, 'Mira');
  await addNode(page, 'Faction');
  await renameSelectedNode(page, 'The Ashen Court');

  const faction = page.locator('.world-node').last();
  const box = await faction.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 230, box!.y + box!.height / 2 - 30, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const from = await faction.locator('.relation-port.right').boundingBox();
  const target = await page.locator('.world-node').first().boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 16,
  });
  await page.mouse.up();

  await expect(page.locator('.relation-lines g')).toHaveCount(1);
  await expect(page.locator('.inspector')).toContainText('Relation');
  await page.locator('#relation-name').fill('Sworn to');
  await page.locator('#relation-name').press('Enter');
  await expect(page.locator('.relation-name')).toHaveText('Sworn to');

  await page.getByRole('button', { name: 'Delete relation' }).click();
  await expect(page.locator('.relation-lines g')).toHaveCount(0);
});

test('exports a .elsew file and a PNG', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Place');
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
  expect(parsed.nodes[0].width).toBe(560);

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
  await expect(page.locator('.project-title')).toHaveText('Imported Reach');
  await expect(page.locator('.world-node')).toHaveCount(2);
  await expect(page.locator('.world-node').first()).toContainText('The Hollow Reach');
  await waitForSave(page);

  await goHome(page);
  await expect(page.locator('.world-row').first()).toContainText('Imported Reach');
});

test('explores a world in read-only mode', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Character');
  await renameSelectedNode(page, 'Mira');
  await addNode(page, 'Faction');
  const faction = page.locator('.world-node').last();
  const bounds = await faction.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 230, bounds!.y + bounds!.height / 2 - 30, {
    steps: 10,
  });
  await page.mouse.up();
  await page.waitForTimeout(250);
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

test('resizes a place and undoes the resize', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Place');
  const note = page.locator('.place-size-note');
  await expect(note).toContainText('560 × 360');

  const handle = page.locator('.resize-handle');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 45, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(note).toContainText(/6\d\d × 4\d\d/);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(note).toContainText('560 × 360');
});

test('deletes a world from the archive', async ({ page }) => {
  await createWorld(page);
  await addNode(page, 'Place');
  await waitForSave(page);
  await goHome(page);

  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.world-row').first().hover();
  await page.getByRole('button', { name: /Options for Untitled World/i }).click();
  await page.getByRole('menuitem', { name: 'Delete world' }).click();
  await expect(page.getByText('No saved worlds yet.')).toBeVisible();
});

test.describe('compact layout', () => {
  test.use({ viewport: { width: 720, height: 820 } });

  test('creates a node through the mobile quick-add palette', async ({ page }) => {
    await createWorld(page);
    await expect(page.locator('.sidebar')).toBeHidden();
    await page.getByRole('button', { name: 'Quick add node' }).click();
    await expect(page.locator('.quick-palette')).toBeVisible();
    await page.locator('.quick-palette-grid button').filter({ hasText: 'Place' }).click();
    await expect(page.locator('.world-node')).toHaveCount(1);
    await expect(page.locator('.inspector')).toBeVisible();
    await expect(page.getByLabel('Node title')).toHaveCount(0);
  });
});
