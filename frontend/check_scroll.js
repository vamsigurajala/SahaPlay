import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Set localStorage dummy token before the page scripts load
  await context.addInitScript(() => {
    window.localStorage.setItem('watch_is_guest', 'true');
    window.localStorage.setItem('watch_username', 'GuestUser');
    window.localStorage.setItem('watch_theme', 'light');
  });

  const page = await context.newPage();
  
  // Set viewport to iPad Pro
  await page.setViewportSize({ width: 1024, height: 1366 });
  
  // Navigate to dev server
  await page.goto('http://localhost:5173');
  
  // Wait for page to render
  await page.waitForTimeout(3000);
  
  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  // Save screenshot as artifact
  await page.screenshot({ path: 'screenshot_scroll_bottom_light.png', fullPage: false });
  console.log('Light screenshot saved.');

  const scrollInfo = await page.evaluate(() => {
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      scrollY: window.scrollY,
      scrollHeight: document.body.scrollHeight,
      innerHeight: window.innerHeight,
      footerBoundingRect: document.querySelector('.home-footer')?.getBoundingClientRect()
    };
  });
  
  console.log('Scroll Info:', JSON.stringify(scrollInfo, null, 2));
  
  await browser.close();
}

run().catch(console.error);
