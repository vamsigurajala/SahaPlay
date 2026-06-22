const { chromium } = require('playwright');
const { Pool } = require('../backend/node_modules/pg');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dbQuery(sql, params) {
  return pool.query(sql, params);
}

(async () => {
  console.log('Starting Read Receipts E2E Test...');
  const browser = await chromium.launch({ headless: true });

  const signupUser = async (context, username, email) => {
    const page = await context.newPage();
    console.log(`[${username}] Navigating to signup...`);
    await page.goto('http://localhost:5173/signup');
    
    // Fill signup form
    await page.fill('input[placeholder="Username"]', username);
    await page.fill('input[placeholder="name@example.com"]', email);
    await page.fill('input[placeholder="Password"]', 'Password123!');
    await page.fill('input[placeholder="Confirm your password"]', 'Password123!');
    
    // Check terms and privacy checkboxes
    console.log(`[${username}] Checking Terms and Privacy checkboxes...`);
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    
    console.log(`[${username}] Submitting signup form...`);
    await page.click('button[type="submit"]');

    // Handle Recovery Modal
    console.log(`[${username}] Waiting for Recovery Modal...`);
    // Wait for the modal container or the click overlay
    await page.waitForSelector('text=Click to reveal phrase');
    await page.click('text=Click to reveal phrase');
    
    // Check the checkbox inside the recovery modal specifically
    console.log(`[${username}] Checking recovery modal acknowledgment checkbox...`);
    await page.click('text=I have written down or securely stored');
    
    // Log the button's text to see its state
    const button = page.locator('button:has-text("Continue"), button:has-text("phrase"), button:has-text("Acknowledge")').last();
    const btnText = await button.innerText();
    console.log(`[${username}] Modal Button text: "${btnText}"`);

    await button.click();

    // Wait for redirect to login page
    console.log(`[${username}] Waiting for redirect to login page...`);
    await page.waitForURL('**/login');

    // Run verification script in database
    console.log(`[${username}] Verifying user programmatically in database...`);
    await dbQuery('UPDATE users SET "isVerified" = 1, "verificationToken" = NULL WHERE LOWER(username) = LOWER($1)', [username]);

    // Log in
    console.log(`[${username}] Logging in...`);
    await page.fill('input[placeholder="name@example.com"]', username);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"].login-submit-btn');

    // Wait for redirect to home
    await page.waitForURL('http://localhost:5173/');
    console.log(`[${username}] Signup, verification, and login complete.`);
    return page;
  };

  // Create two separate browser contexts to simulate separate users
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const rand = Math.floor(Math.random() * 1000000);
  const usernameA = `usera_${rand}`;
  const usernameB = `userb_${rand}`;

  try {
    const pageA = await signupUser(contextA, usernameA, `${usernameA}@example.com`);
    const pageB = await signupUser(contextB, usernameB, `${usernameB}@example.com`);

    // Establish friendship in database
    console.log(`[Test Setup] Establishing mutual friendship between ${usernameA} and ${usernameB}...`);
    await dbQuery(
      `INSERT INTO follows ("followerId", "followingId", status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT ("followerId", "followingId") DO UPDATE SET status = 'accepted'`, 
      [usernameA, usernameB]
    );
    await dbQuery(
      `INSERT INTO follows ("followerId", "followingId", status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT ("followerId", "followingId") DO UPDATE SET status = 'accepted'`, 
      [usernameB, usernameA]
    );

    // Let's test Private DM read receipts first
    console.log('\n--- TESTING PRIVATE DM READ RECEIPTS ---');
    
    // Generate a unique roomId and pre-create the room in the DB
    const roomId = Math.random().toString(36).substring(2, 8);
    const roomUrl = `http://localhost:5173/room/${roomId}`;
    console.log(`[Test Setup] Pre-creating room ${roomId} in database...`);
    await dbQuery(
      `INSERT INTO room_names ("roomId", "roomName", "isPublic", "hostUsername", category) 
       VALUES ($1, $2, 0, $3, 'other') 
       ON CONFLICT ("roomId") DO NOTHING`, 
      [roomId, `TestRoom_${roomId}`, usernameA]
    );

    // Both users navigate to the room
    console.log(`[${usernameA}] Navigating to room ${roomId}...`);
    await pageA.goto(roomUrl);
    await pageA.waitForURL(/\/room\/[a-zA-Z0-9_-]+/);

    console.log(`[${usernameB}] Navigating to room ${roomId}...`);
    await pageB.goto(roomUrl);
    await pageB.waitForURL(/\/room\/[a-zA-Z0-9_-]+/);
    console.log(`[${usernameB}] Joined room successfully.`);

    // Click B's name in User A's sidebar to open DM
    console.log(`[${usernameA}] Opening DM with ${usernameB} from sidebar...`);
    // Locate the user element in the side bar and click it
    await pageA.click(`button:has-text("${usernameB}")`);
    
    // Verify DM panel is open for User A
    const dmInputA = pageA.locator('input[placeholder*="message..."], input[placeholder*="Message"]').last();
    await dmInputA.waitFor();
    console.log(`[${usernameA}] DM input visible.`);

    // Send a DM message from User A to User B
    console.log(`[${usernameA}] Sending DM message to ${usernameB}...`);
    await dmInputA.fill('Hello User B, please read this!');
    await pageA.keyboard.press('Enter');
    
    // User B has not opened DM with User A yet. Let's verify that User A does NOT see "seen" status
    await pageA.waitForTimeout(2000);
    const seenExistsBefore = await pageA.locator('.read-receipt-container').isVisible().catch(() => false);
    console.log(`Is seen status visible to User A? ${seenExistsBefore ? 'Yes (ERROR)' : 'No (Correct)'}`);
    if (seenExistsBefore) {
      throw new Error('Read receipt visible before user opened DM!');
    }

    // User B opens DM with User A
    console.log(`[${usernameB}] Opening DM with ${usernameA}...`);
    await pageB.click(`button:has-text("${usernameA}")`);
    
    // Wait for User A's message to update and show "seen" status
    console.log(`[${usernameA}] Waiting for read receipt "seen" to appear...`);
    await pageA.waitForSelector('.read-receipt-container');
    const seenText = await pageA.locator('.read-receipt-container').innerText();
    console.log(`Read receipt container text: "${seenText}"`);
    
    if (!seenText.toLowerCase().includes('seen')) {
      throw new Error(`Expected read receipt text to include "seen", got: "${seenText}"`);
    }
    console.log('Private DM read receipt verification successful!');

    // --- TESTING GROUP CHAT READ RECEIPTS ---
    console.log('\n--- TESTING GROUP CHAT READ RECEIPTS ---');

    // Switch both users back to the Room Chat tab
    console.log(`[${usernameA}] Going back to chat list...`);
    await pageA.click('#room-chat-panel svg.lucide-chevron-left');
    console.log(`[${usernameA}] Opening group room chat...`);
    await pageA.click(`button:has-text("TestRoom_${roomId}")`);

    console.log(`[${usernameB}] Going back to chat list...`);
    await pageB.click('#room-chat-panel svg.lucide-chevron-left');
    console.log(`[${usernameB}] Opening group room chat...`);
    await pageB.click(`button:has-text("TestRoom_${roomId}")`);

    // User A sends a room chat message
    console.log(`[${usernameA}] Sending group message...`);
    const roomInputA = pageA.locator('#room-chat-panel input:not([type="file"]), #room-chat-panel textarea').first();
    await roomInputA.fill('Hello room!');
    await roomInputA.press('Enter');

    // User B is on the Room Chat tab, so they should automatically mark the message as read
    // Wait for User A to see User B's read receipt (avatar stack + "seen")
    console.log(`[${usernameA}] Waiting for group read receipt...`);
    await pageA.waitForSelector('.read-receipt-container');
    const groupSeenText = await pageA.locator('.read-receipt-container').innerText();
    console.log(`Group read receipt text: "${groupSeenText}"`);

    // Verify avatar stack is present (there should be an avatar or initial for User B)
    const avatarsCount = await pageA.locator('.read-receipt-container img, .read-receipt-container div div div').count();
    console.log(`Number of reader avatars shown: ${avatarsCount}`);
    
    // Hover over read receipt container and check tooltip
    console.log(`[${usernameA}] Hovering over read receipt to check tooltip...`);
    await pageA.locator('.read-receipt-container').hover();
    await pageA.waitForSelector('.read-receipt-tooltip');
    
    const tooltipText = await pageA.locator('.read-receipt-tooltip').innerText();
    console.log(`Tooltip text shown:\n${tooltipText}`);
    
    if (!tooltipText.includes(usernameB)) {
      throw new Error(`Expected tooltip to list user ${usernameB}, got: "${tooltipText}"`);
    }
    console.log('Group chat read receipt verification successful!');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! ✅');
  } catch (err) {
    console.error('\nTEST FAILED ❌:', err);
    // Take screenshots for debugging
    try {
      const pagesA = contextA.pages();
      if (pagesA && pagesA.length > 0) {
        await pagesA[0].screenshot({ path: 'screenshot_usera_error.png' });
        console.log('Error screenshot saved as screenshot_usera_error.png');
      }
      const pagesB = contextB.pages();
      if (pagesB && pagesB.length > 0) {
        await pagesB[0].screenshot({ path: 'screenshot_userb_error.png' });
        console.log('Error screenshot saved as screenshot_userb_error.png');
      }
    } catch (e) {
      console.error('Failed to capture screenshots:', e.message);
    }
    await pool.end();
    process.exit(1);
  } finally {
    await browser.close();
    await pool.end();
  }
})();
