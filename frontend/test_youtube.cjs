const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');
  
  console.log('Clicking Create New Room');
  await page.click('text=Create New Room');
  
  await page.waitForSelector('text=No Media Selected');
  console.log('In room. Waiting for input...');
  
  await page.fill('input[placeholder*="Paste YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.click('text=Update Media');
  
  console.log('Clicked update media. Waiting 5 seconds to see what renders...');
  await page.waitForTimeout(5000);
  
  const videoHtml = await page.evaluate(() => {
    const playerDiv = document.querySelector('.glass-panel > div[style*="position: absolute"]');
    return playerDiv ? playerDiv.innerHTML : 'Player not found';
  });
  
  console.log('Player HTML:');
  console.log(videoHtml);
  
  await browser.close();
})();
