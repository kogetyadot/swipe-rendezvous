import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('/home/antigravity/swipe-rendezvous/verify_shots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const errors = [];
  const failedRequests = [];

  try {
    // =========================================================================
    // 1. Desktop Test (1280x720)
    // =========================================================================
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`CONSOLE_ERROR: ${msg.text()}`);
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(`REQ_FAIL: ${req.url()} (${req.failure()?.errorText || 'unknown'})`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`HTTP_${res.status()}: ${res.url()}`);
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    await page.screenshot({ path: path.join(OUT_DIR, '01_title_desktop.png') });

    // Verify BGM and SE toggles on title screen
    await page.click('#btn-toggle-bgm');
    await page.waitForTimeout(120);
    await page.click('#btn-toggle-bgm');
    await page.click('#btn-toggle-se');
    await page.waitForTimeout(120);
    await page.click('#btn-toggle-se');

    // Start Normal game
    await page.click('#btn-start-game');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT_DIR, '02_gameplay_initial.png') });

    // Simultaneous mouse swipe + keyboard steering test
    const cardStage = await page.locator('#card-stage').boundingBox();
    if (cardStage) {
      const cx = cardStage.x + cardStage.width / 2;
      const cy = cardStage.y + cardStage.height / 2;

      await page.keyboard.down('KeyD');
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy - 15, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      await page.keyboard.up('KeyD');

      await page.keyboard.down('KeyA');
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 150, cy - 10, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      await page.keyboard.up('KeyA');
    }

    // Swipe right on 4 more characters rapidly to test Z-staggering & crowded sidewalk
    for (let i = 0; i < 4; i++) {
      await page.click('#btn-swipe-right');
      await page.waitForTimeout(260);
    }

    // Advance simulation smoothly in steps to bring matches into Phase-2 reveal zone
    await page.evaluate(() => {
      const g = window.__GAME__;
      if (g) {
        for (let i = 0; i < 52; i++) g.stepSimulation(0.05);
      }
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '03_gameplay_simultaneous_action.png') });

    // Steer protagonist directly toward the closest approaching 'good' match to test actual contact & toast!
    await page.evaluate(() => {
      const g = window.__GAME__;
      if (!g) return;
      for (let i = 0; i < 70; i++) {
        const scene = g.sidewalkScene;
        const goodMatch = scene.activeMatches
          .filter((m) => !m.contacted && !m.avoided && m.character.category === 'good')
          .sort((a, b) => b.z - a.z)[0];
        if (goodMatch) {
          g.touchDirectTargetX = goodMatch.x;
        }
        g.stepSimulation(0.05);
      }
      g.touchDirectTargetX = null;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '04_gameplay_reveal_and_contact.png') });

    const desktopMetrics = await page.evaluate(() => {
      const leftRect = document.getElementById('left-pane')?.getBoundingClientRect();
      const rightRect = document.getElementById('right-pane')?.getBoundingClientRect();
      const cardPhoto = document.querySelector('.active-card .card-photo');
      const badges = document.querySelectorAll('.match-badge').length;
      const toasts = document.querySelectorAll('.contact-toast').length;
      const scoreText = document.getElementById('hud-score-val')?.textContent || '0';
      return {
        splitNoOverlap: leftRect && rightRect ? leftRect.right <= rightRect.left + 2 : false,
        leftWidth: leftRect ? Math.round(leftRect.width) : 0,
        rightWidth: rightRect ? Math.round(rightRect.width) : 0,
        portraitRendered: Boolean(cardPhoto && cardPhoto.complete && cardPhoto.naturalWidth > 200),
        activeOverheadBadges: badges,
        contactToastsVisible: toasts,
        scoreText,
      };
    });

    // Finish round & inspect Result Screen with populated review log
    await page.evaluate(() => {
      const g = window.__GAME__;
      if (g) {
        g.elapsedSec = g.config.durationSec - 0.02;
        g.stepSimulation(0.05);
      }
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT_DIR, '05_result_screen_desktop.png') });

    const resultMetrics = await page.evaluate(() => {
      const retryBtn = document.getElementById('btn-retry')?.getBoundingClientRect();
      const reviewItems = document.querySelectorAll('.review-item').length;
      const finalScore = document.getElementById('result-final-score')?.textContent || '';
      return {
        retryFitsIn720p: retryBtn ? retryBtn.bottom <= 720 && retryBtn.top >= 0 : false,
        reviewItems,
        finalScore,
      };
    });

    // Test Hard Mode from Title Screen
    await page.click('#btn-back-title');
    await page.waitForTimeout(300);
    await page.click('#diff-hard');
    await page.waitForTimeout(200);
    await page.click('#btn-start-game');
    await page.waitForTimeout(400);
    await page.click('#btn-swipe-right');
    await page.waitForTimeout(260);
    await page.click('#btn-swipe-right');
    await page.waitForTimeout(260);
    await page.click('#btn-swipe-right');
    await page.evaluate(() => {
      const g = window.__GAME__;
      if (g) {
        for (let i = 0; i < 48; i++) g.stepSimulation(0.05);
      }
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '06_hard_mode_gameplay.png') });

    await context.close();

    // =========================================================================
    // 2. Smartphone Landscape Test (844x390)
    // =========================================================================
    const mobileLandCtx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const mLandPage = await mobileLandCtx.newPage();
    mLandPage.on('pageerror', (err) => errors.push(`MOBILE_LAND_PAGEERROR: ${err.message}`));
    mLandPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`MOBILE_LAND_CONSOLE_ERROR: ${msg.text()}`);
    });

    await mLandPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mLandPage.waitForTimeout(700);
    await mLandPage.screenshot({ path: path.join(OUT_DIR, '07_mobile_landscape_title.png') });

    const mobileLandTitleCheck = await mLandPage.evaluate(() => {
      const btn = document.getElementById('btn-start-game')?.getBoundingClientRect();
      return {
        startBtnFitsIn390h: btn ? btn.bottom <= 390 && btn.top >= 0 : false,
        startBtnBottom: btn ? Math.round(btn.bottom) : -1,
      };
    });

    await mLandPage.click('#btn-start-game');
    await mLandPage.waitForTimeout(500);
    await mLandPage.click('#btn-swipe-right');
    await mLandPage.waitForTimeout(260);
    await mLandPage.click('#btn-swipe-right');
    await mLandPage.evaluate(() => {
      const g = window.__GAME__;
      if (g) {
        for (let i = 0; i < 36; i++) g.stepSimulation(0.05);
      }
    });
    await mLandPage.waitForTimeout(250);
    await mLandPage.screenshot({ path: path.join(OUT_DIR, '08_mobile_landscape_play.png') });

    const mobileLandPlayCheck = await mLandPage.evaluate(() => {
      const nameRect = document.querySelector('.active-card .card-name')?.getBoundingClientRect();
      const bioRect = document.querySelector('.active-card .card-bio')?.getBoundingClientRect();
      return {
        nameVisible: Boolean(nameRect && nameRect.height > 8 && nameRect.bottom <= 390),
        bioVisible: Boolean(bioRect && bioRect.height > 10 && bioRect.bottom <= 390),
      };
    });
    await mobileLandCtx.close();

    // =========================================================================
    // 3. Smartphone Portrait Test (390x844)
    // =========================================================================
    const mobilePortCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const mPortPage = await mobilePortCtx.newPage();
    mPortPage.on('pageerror', (err) => errors.push(`MOBILE_PORT_PAGEERROR: ${err.message}`));
    mPortPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`MOBILE_PORT_CONSOLE_ERROR: ${msg.text()}`);
    });

    await mPortPage.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mPortPage.waitForTimeout(900);
    await mPortPage.screenshot({ path: path.join(OUT_DIR, '09a_mobile_portrait_title.png') });
    await mPortPage.click('#btn-how-to-play');
    await mPortPage.waitForTimeout(350);
    await mPortPage.screenshot({ path: path.join(OUT_DIR, '09b_mobile_portrait_howto.png') });
    await mPortPage.click('#btn-howto-ok');
    await mPortPage.waitForTimeout(250);
    await mPortPage.click('#btn-start-game');
    await mPortPage.waitForTimeout(500);
    await mPortPage.click('#btn-swipe-right');
    await mPortPage.evaluate(() => {
      const g = window.__GAME__;
      if (g) {
        for (let i = 0; i < 34; i++) g.stepSimulation(0.05);
      }
    });
    await mPortPage.waitForTimeout(250);
    await mPortPage.screenshot({ path: path.join(OUT_DIR, '09_mobile_portrait_play.png') });

    const mobilePortCheck = await mPortPage.evaluate(() => {
      const menuBtn = document.getElementById('hud-btn-menu')?.getBoundingClientRect();
      const bgmBtn = document.getElementById('hud-btn-bgm')?.getBoundingClientRect();
      return {
        menuBtnFitsIn390w: menuBtn ? menuBtn.right <= 390 : false,
        bgmBtnFitsIn390w: bgmBtn ? bgmBtn.right <= 390 : false,
        menuBtnRight: menuBtn ? Math.round(menuBtn.right) : -1,
      };
    });
    await mobilePortCtx.close();

    console.log(
      JSON.stringify(
        {
          ok: errors.length === 0 && failedRequests.length === 0,
          desktopMetrics,
          resultMetrics,
          mobileLandTitleCheck,
          mobileLandPlayCheck,
          mobilePortCheck,
          errorCount: errors.length,
          errors,
          failedRequests,
        },
        null,
        2,
      ),
    );
    if (errors.length > 0 || failedRequests.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
