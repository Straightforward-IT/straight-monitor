import { test, expect } from '@playwright/test';

test('navigate calendar forward 6 days', async ({ page }) => {
  await page.goto('http://localhost:5173/auftraege');
  
  // Wait for the calendar to load
  await page.waitForSelector('.nav-btn-mobile:last-of-type');

  for (let i = 0; i < 6; i++) {
    await page.click('.nav-btn-mobile:last-of-type');
    // Small wait for transition/update
    await page.waitForTimeout(500);
    const dateText = await page.innerText('.mobile-date-display');
    console.log(\`After click \${i + 1}: \${dateText}\`);
  }

  await page.screenshot({ path: 'calendar_mon_25_05.png' });

  const holidayChip = await page.locator('.mobile-holiday-chip, [class*="holiday-chip"]').first();
  if (await holidayChip.isVisible()) {
    const holidayText = await holidayChip.innerText();
    console.log(\`Holiday chip detected: \${holidayText}\`);
  } else {
    console.log('No holiday chip detected.');
  }
  
  const dateDisplayAreaText = await page.innerText('.mobile-date-display');
  console.log(\`Final date display area text: \${dateDisplayAreaText}\`);
});
