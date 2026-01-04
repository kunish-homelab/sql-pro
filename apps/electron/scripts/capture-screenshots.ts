/**
 * Screenshot capture script for SQL Pro
 * Uses Playwright to capture screenshots of different app states
 *
 * Usage:
 *   pnpm screenshots              # Capture all screenshots (dark mode)
 *   pnpm screenshots --page=welcome  # Capture specific page
 *   pnpm screenshots --light      # Capture light mode only
 *   pnpm screenshots --all        # Capture both light and dark modes
 *   pnpm screenshots --list       # List available pages
 */

import type { ChildProcess } from 'node:child_process';
import type { Page } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const screenshotsDir = join(projectRoot, 'screenshots');

// Parse command line arguments
const args = process.argv.slice(2);
const pageFilter = args.find((a) => a.startsWith('--page='))?.split('=')[1];
const allModes = args.includes('--all');
const lightModeOnly = args.includes('--light');
// Default to dark mode only unless --light or --all is specified
const darkModeOnly = !lightModeOnly && !allModes;
const listPages = args.includes('--list');
const helpRequested = args.includes('--help') || args.includes('-h');

interface ScreenshotConfig {
  id: string;
  name: string;
  description: string;
  /** Action to perform before screenshot */
  setup?: (page: Page, baseUrl: string) => Promise<void>;
  /** Delay before taking screenshot (ms) */
  delay?: number;
  /** Specific element to screenshot (optional) */
  selector?: string;
}

const screenshots: ScreenshotConfig[] = [
  {
    id: 'welcome',
    name: 'welcome',
    description: 'Welcome screen with recent connections',
    setup: async (page, baseUrl) => {
      // Navigate to welcome screen with mock mode and skipAutoConnect to prevent auto-navigation to database
      await page.goto(`${baseUrl}/#/?mock=true&skipAutoConnect=true`);
      await page.waitForTimeout(1000);
    },
    delay: 500,
  },
  {
    id: 'database',
    name: 'database',
    description: 'Database view with sidebar and table list',
    setup: async (page, baseUrl) => {
      // Navigate to mock database view
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
    },
    delay: 500,
  },
  {
    id: 'table',
    name: 'table',
    description: 'Users table with data',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Click on users table
      const usersItem = page.locator('text=users').first();
      if (await usersItem.isVisible().catch(() => false)) {
        await usersItem.click();
        await page.waitForTimeout(800);
      }
    },
    delay: 300,
  },
  {
    id: 'products',
    name: 'products',
    description: 'Products table with data',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Click on products table
      const productsItem = page.locator('text=products').first();
      if (await productsItem.isVisible().catch(() => false)) {
        await productsItem.click();
        await page.waitForTimeout(800);
      }
    },
    delay: 300,
  },
  {
    id: 'orders',
    name: 'orders',
    description: 'Orders table with data',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Click on orders table
      const ordersItem = page.locator('text=orders').first();
      if (await ordersItem.isVisible().catch(() => false)) {
        await ordersItem.click();
        await page.waitForTimeout(800);
      }
    },
    delay: 300,
  },
  {
    id: 'query',
    name: 'query',
    description: 'SQL query editor with sample query',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Click on Query tab
      const queryTab = page
        .locator('button:has-text("Query"), [role="tab"]:has-text("Query")')
        .first();
      if (await queryTab.isVisible().catch(() => false)) {
        await queryTab.click();
        await page.waitForTimeout(500);
      }
    },
    delay: 500,
  },
  {
    id: 'sidebar-expanded',
    name: '07-sidebar-tables',
    description: 'Sidebar with tables expanded',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Expand tables section if collapsed
      const tablesHeader = page.locator('text=Tables').first();
      if (await tablesHeader.isVisible().catch(() => false)) {
        await tablesHeader.click();
        await page.waitForTimeout(300);
      }
    },
    delay: 300,
  },
  {
    id: 'sidebar-views',
    name: '08-sidebar-views',
    description: 'Sidebar with views section',
    setup: async (page, baseUrl) => {
      await page.goto(`${baseUrl}/#/?mock=true`);
      await page.waitForTimeout(2000);
      // Click on Views section
      const viewsHeader = page.locator('text=Views').first();
      if (await viewsHeader.isVisible().catch(() => false)) {
        await viewsHeader.click();
        await page.waitForTimeout(300);
      }
    },
    delay: 300,
  },
];

function printHelp() {
  console.log(`
📸 SQL Pro Screenshot Capture Tool

Usage:
  pnpm screenshots [options]

Options:
  --page=<id>    Capture only specific page (e.g., --page=welcome)
  --dark         Capture dark mode screenshots only
  --light        Capture light mode screenshots only
  --list         List all available pages
  --help, -h     Show this help message

Examples:
  pnpm screenshots                    # Capture all screenshots (light + dark)
  pnpm screenshots --page=welcome     # Capture welcome page only
  pnpm screenshots --dark             # Capture all pages in dark mode
  pnpm screenshots --page=database --dark  # Capture database page in dark mode
`);
}

function printPageList() {
  console.log('\n📋 Available Pages:\n');
  for (const config of screenshots) {
    console.log(`  ${config.id.padEnd(20)} - ${config.description}`);
  }
  console.log('');
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(200);
}

async function captureScreenshot(
  page: Page,
  config: ScreenshotConfig,
  theme: 'light' | 'dark',
  baseUrl: string
) {
  const suffix = theme === 'dark' ? '-dark' : '';
  const filename = `${config.name}${suffix}.png`;
  const filepath = join(screenshotsDir, filename);

  console.log(`  📷 ${config.id} (${theme})`);

  try {
    // Run setup
    if (config.setup) {
      await config.setup(page, baseUrl);
    }

    // Set theme
    await setTheme(page, theme);

    // Wait before screenshot
    if (config.delay) {
      await page.waitForTimeout(config.delay);
    }

    // Take screenshot
    if (config.selector) {
      const element = page.locator(config.selector);
      await element.screenshot({ path: filepath });
    } else {
      await page.screenshot({ path: filepath, fullPage: false });
    }

    console.log(`     ✅ ${filename}`);
  } catch (error) {
    console.error(`     ❌ Failed: ${(error as Error).message}`);
  }
}

async function startDevServer(): Promise<{
  process: ChildProcess;
  port: number;
}> {
  console.log('🚀 Starting dev server in mock mode...');

  const devProcess = spawn('pnpm', ['dev:mock'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_MOCK_MODE: 'true',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });

  // Wait for server to be ready by checking the output
  return new Promise((resolve, reject) => {
    let output = '';
    let port = 5173; // default port

    devProcess.stdout?.on('data', (data) => {
      output += data.toString();
      // Extract the actual port from output like "http://localhost:5175/"
      const portMatch = output.match(/localhost:(\d+)/);
      if (portMatch) {
        port = Number.parseInt(portMatch[1], 10);
      }
      if (output.includes('Local:') || output.includes('localhost:')) {
        // Server is ready
        setTimeout(() => resolve({ process: devProcess, port }), 2000);
      }
    });

    devProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });

    devProcess.on('error', reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!output.includes('localhost:')) {
        reject(new Error('Dev server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

async function captureScreenshots() {
  if (helpRequested) {
    printHelp();
    return;
  }

  if (listPages) {
    printPageList();
    return;
  }

  // Ensure screenshots directory exists
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('\n📸 SQL Pro Screenshot Capture\n');

  let devProcess: ChildProcess | null = null;
  let serverPort = 5173;

  try {
    // Start dev server
    const server = await startDevServer();
    devProcess = server.process;
    serverPort = server.port;
    const baseUrl = `http://localhost:${serverPort}`;
    console.log(`✅ Dev server ready at ${baseUrl}\n`);

    // Import playwright
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2, // Retina quality
    });

    const page = await context.newPage();

    // Filter screenshots if page filter is specified
    const screenshotsToCapture = pageFilter
      ? screenshots.filter(
          (s) => s.id === pageFilter || s.name.includes(pageFilter)
        )
      : screenshots;

    if (screenshotsToCapture.length === 0) {
      console.error(`❌ No pages found matching: ${pageFilter}`);
      console.log('   Use --list to see available pages');
      await browser.close();
      return;
    }

    // Determine which themes to capture
    const themes: Array<'light' | 'dark'> = [];
    if (!darkModeOnly) themes.push('light');
    if (!lightModeOnly) themes.push('dark');

    console.log(
      `📋 Capturing ${screenshotsToCapture.length} page(s) in ${themes.join(' & ')} mode(s)\n`
    );

    for (const config of screenshotsToCapture) {
      console.log(`\n🎯 ${config.description}`);

      for (const theme of themes) {
        await captureScreenshot(page, config, theme, baseUrl);
      }
    }

    await browser.close();
    console.log('\n✨ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${screenshotsDir}\n`);
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  } finally {
    // Clean up dev server - kill entire process group
    if (devProcess && devProcess.pid) {
      try {
        // Kill the process group (negative PID)
        process.kill(-devProcess.pid, 'SIGTERM');
      } catch {
        // Fallback: try to kill with pkill
        try {
          execSync('pkill -f "electron.*sql-pro"', { stdio: 'ignore' });
        } catch {
          // Ignore errors - process may already be dead
        }
      }
    }
    // Ensure script exits
    process.exit(0);
  }
}

// Run the script
captureScreenshots().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
