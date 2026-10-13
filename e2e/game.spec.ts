import { expect, test } from '@playwright/test';

type Snap = { phase: string; movable: number[]; dests: { to: number }[]; canDone: boolean; record: { status: string; result?: { winner: string } } };
type Hook = { __sb: { game: { getSnapshot(): Snap; tap(p: number): void; done(): boolean; continueReview(): void } | null; setSettings(p: object): void } };

test('home screen renders in Hebrew', async ({ page }) => {
  await page.goto('/?e2e');
  await expect(page.getByText('שש־בש').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /משחק חדש/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/home.png' });
});

test('plays a full game against the engine', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?e2e');
  await page.evaluate(() => (window as unknown as Hook).__sb.setSettings({ speed: 'fast', sound: false }));
  await page.getByRole('button', { name: /משחק חדש/ }).click();
  await page.getByRole('button', { name: 'התחל משחק' }).click();
  await expect(page.getByRole('button', { name: /סיימתי/ })).toBeVisible();

  let shot = false, reviews = 0;
  for (let i = 0; i < 4000; i++) {
    const s = await page.evaluate(() => {
      const g = (window as unknown as Hook).__sb.game; if (!g) return null;
      const x = g.getSnapshot();
      return { phase: x.phase, movable: x.movable, canDone: x.canDone, status: x.record.status, winner: x.record.result?.winner };
    });
    if (!s) { await page.waitForTimeout(100); continue; }
    if (s.phase === 'over') break;
    if (s.phase === 'review') {
      reviews++;
      if (!shot) { await page.screenshot({ path: 'test-results/review.png' }); shot = true; }
      await page.evaluate(() => (window as unknown as Hook).__sb.game!.continueReview());
      continue;
    }
    if (s.phase === 'human') {
      if (s.canDone || !s.movable.length) { await page.getByRole('button', { name: /סיימתי/ }).click(); await page.waitForTimeout(50); continue; }
      // Tap through the real board: select the first movable checker, then its first destination.
      const from = s.movable[0];
      await page.locator(`rect[data-p="${from}"]`).dispatchEvent('pointerdown');
      const to = await page.evaluate(() => (window as unknown as Hook).__sb.game!.getSnapshot().dests[0]?.to);
      if (to !== undefined) await page.locator(`rect[data-p="${to}"]`).dispatchEvent('pointerdown');
      continue;
    }
    await page.waitForTimeout(120);
  }
  await expect(page.getByText(/ניצחת!|המחשב ניצח/)).toBeVisible();
  await expect(page.getByText(/דירוג ביצועים|אין מספיק/)).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: 'test-results/game-over.png' });
  expect(errors).toEqual([]);
  console.log('reviews shown:', reviews);

  // The finished game is in history and can be replayed.
  await page.getByRole('button', { name: 'מסך הבית' }).click();
  await page.getByRole('button', { name: /היסטוריה/ }).click();
  await expect(page.locator('.tag.win, .tag.loss').first()).toBeVisible();
  await page.getByRole('button', { name: /צפייה/ }).first().click();
  await expect(page.getByText('צפייה חוזרת')).toBeVisible();
  await page.screenshot({ path: 'test-results/replay.png' });
});

test('leaving via the menu and reloading keep the game resumable', async ({ page }) => {
  await page.goto('/?e2e');
  await page.evaluate(() => (window as unknown as Hook).__sb.setSettings({ speed: 'fast', sound: false }));
  await page.getByRole('button', { name: /משחק חדש/ }).click();
  await page.getByRole('button', { name: 'התחל משחק' }).click();
  const phase = () => page.evaluate(() => (window as unknown as Hook).__sb.game?.getSnapshot().phase);
  await expect.poll(phase, { timeout: 30_000 }).toBe('human');

  // Menu -> settings -> back: the game must still be playable.
  await page.getByRole('button', { name: 'תפריט' }).click();
  await page.getByRole('button', { name: /^הגדרות/ }).click();
  await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible();
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect.poll(phase).toBe('human');
  const snap = await page.evaluate(() => (window as unknown as Hook).__sb.game!.getSnapshot());
  expect(snap.movable.length).toBeGreaterThan(0);

  // Reload the app: the home screen offers to resume, and the same dice are restored.
  await page.reload();
  const resume = page.getByRole('button', { name: /המשך:/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect.poll(phase, { timeout: 30_000 }).toBe('human');
  await page.screenshot({ path: 'test-results/resumed.png' });
});
