const { chromium } = require('playwright');

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
    
    console.log(`[${username}] Submitting signup form...`);
    await page.click('button[type="submit"]');

    // Handle Recovery Modal
    console.log(`[${username}] Waiting for Recovery Modal...`);
    await page.click('text=Click to reveal phrase');
    await page.check('input[type="checkbox"]');
    await page.click("text=I've saved it — Continue →");

    // Wait for redirect to home
    await page.waitForURL('http://localhost:5173/');
    console.log(`[${username}] Signup complete and logged in successfully.`);
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

    // Let's test Private DM read receipts first
    console.log('\n--- TESTING PRIVATE DM READ RECEIPTS ---');
    
    // User A opens Global Chat widget (if closed, but by default it is open or has a toggle button)
    // Wait, let's verify if they can start a DM. How do they start a DM?
    // In SahaPlay, to start a DM, a user can search for a user in the Friends list or start chat from room.
    // Let's check how DMs are initiated in GlobalChatWidget.jsx or Room.jsx.
    // Let's search for how DMs are started.
    // In Room.jsx, we have a search users or click on a user in the user list.
    // Wait! Let's check if there is an easy way for User A to direct message User B.
    // Let's look at the GlobalChatWidget UI or Room.jsx UI.
    // In Room.jsx, they can join the same Room, click on B's name in the sidebar user list, and click "Direct Message".
    // Let's test by joining a room together.
    
    // Let's create a room with User A
    console.log(`[${usernameA}] Creating a new room...`);
    await pageA.click('button:has-text("Create Room")');
    await pageA.waitForSelector('input[placeholder="Room Name"]');
    await pageA.fill('input[placeholder="Room Name"]', `TestRoom_${rand}`);
    await pageA.click('button:has-text("Create")');
    
    // Wait for the room page to load
    await pageA.waitForURL(/\/room\/[a-zA-Z0-9_-]+/);
    const roomUrl = pageA.url();
    const roomId = roomUrl.split('/').pop();
    console.log(`[${usernameA}] Created room ${roomId}. Room URL: ${roomUrl}`);

    // User B joins the room
    console.log(`[${usernameB}] Joining room ${roomId}...`);
    await pageB.goto(roomUrl);
    await pageB.waitForURL(/\/room\/[a-zA-Z0-9_-]+/);
    console.log(`[${usernameB}] Joined room successfully.`);

    // Click B's name in User A's sidebar to open DM
    console.log(`[${usernameA}] Opening DM with ${usernameB} from sidebar...`);
    // Locate the user element in the side bar and click it
    await pageA.click(`text=${usernameB}`);
    await pageA.click('text=Direct Message');
    
    // Verify DM panel is open for User A
    await pageA.waitForSelector('textarea[placeholder^="Message"]');
    console.log(`[${usernameA}] DM input visible.`);

    // Send a DM message from User A to User B
    console.log(`[${usernameA}] Sending DM message to ${usernameB}...`);
    await pageA.fill('textarea[placeholder^="Message"]', 'Hello User B, please read this!');
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
    await pageB.click(`text=${usernameA}`);
    await pageB.click('text=Direct Message');
    
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

    // Switch both users back to the Room Chat tab in the sidebar
    console.log(`[${usernameA}] Switching back to room chat tab...`);
    await pageA.click('text=Room Chat');
    console.log(`[${usernameB}] Switching back to room chat tab...`);
    await pageB.click('text=Room Chat');

    // User A sends a room chat message
    console.log(`[${usernameA}] Sending group message...`);
    // Find the room chat input
    const roomInputA = pageA.locator('input[placeholder="Type a message..."], textarea[placeholder="Type a message..."]').first();
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
      await contextA.pages()[0].screenshot({ path: 'screenshot_usera_error.png' });
      await contextB.pages()[0].screenshot({ path: 'screenshot_userb_error.png' });
      console.log('Error screenshots saved as screenshot_usera_error.png and screenshot_userb_error.png.');
    } catch (e) {
      console.error('Failed to capture screenshots:', e.message);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
