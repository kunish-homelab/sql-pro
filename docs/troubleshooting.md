# Troubleshooting

This guide covers common issues you might encounter when using SQL Pro and provides step-by-step solutions to resolve them.

[[toc]]

## Installation Issues

### Application Won't Start on macOS

**Symptom:** Double-clicking SQL Pro shows a brief loading animation but the app never opens, or you see a security warning.

**Cause:** macOS Gatekeeper is blocking the application because it's from an unidentified developer.

**Solution:**

1. Open **System Preferences** → **Security & Privacy** → **General**
2. Look for a message about SQL Pro being blocked
3. Click **Open Anyway** to allow the application
4. Alternatively, right-click the app and select **Open** from the context menu

::: tip First Launch
This security prompt only appears on first launch. After allowing it once, SQL Pro will open normally in the future.
:::

### Windows SmartScreen Warning

**Symptom:** Windows shows "Windows protected your PC" when trying to run the installer.

**Cause:** Windows SmartScreen blocks unsigned or rarely downloaded applications.

**Solution:**

1. Click **More info** on the SmartScreen dialog
2. Click **Run anyway** to proceed with installation
3. The installer will run normally

::: warning
Only proceed if you downloaded SQL Pro from the official GitHub releases page.
:::

### Linux AppImage Won't Run

**Symptom:** The AppImage file doesn't execute when double-clicked.

**Cause:** The file doesn't have execute permissions.

**Solution:**

```bash
# Add execute permission
chmod +x SQL-Pro-*.AppImage

# Run the application
./SQL-Pro-*.AppImage
```

If you're still having issues:

```bash
# Check for missing dependencies
ldd SQL-Pro-*.AppImage

# Install FUSE if needed (required for AppImages)
sudo apt install fuse libfuse2  # Debian/Ubuntu
sudo dnf install fuse fuse-libs  # Fedora
```

---

## Database Connection Issues

### Cannot Open Database File

**Symptom:** Error message "Unable to open database" or "Database file not found."

**Causes:**

- File doesn't exist at the specified path
- File is locked by another application
- Insufficient file permissions

**Solutions:**

1. **Verify the file exists:**

   ```bash
   ls -la /path/to/your/database.db
   ```

2. **Check if another process is using the file:**

   ```bash
   # Linux/macOS
   lsof /path/to/your/database.db

   # Or find processes with the file open
   fuser /path/to/your/database.db
   ```

3. **Verify file permissions:**

   ```bash
   # Grant read/write access
   chmod 644 /path/to/your/database.db
   ```

4. **If the file is on a network drive**, try copying it locally first

::: info
SQL Pro requires read/write access to the database file for editing operations. For read-only access, ensure the file has at least read permissions.
:::

### Database Is Locked

**Symptom:** Error message "Database is locked" when trying to execute queries or save changes.

**Cause:** Another process (including another SQL Pro window) has an exclusive lock on the database.

**Solutions:**

1. **Close other applications** that might be using the database
2. **Close other SQL Pro windows** connected to the same database
3. **Wait a few seconds** - some locks are temporary
4. **Restart the application** if the lock persists

::: tip WAL Mode
Databases using Write-Ahead Logging (WAL) mode allow concurrent reads but may still lock on writes. Check if you have `-wal` and `-shm` files alongside your database.
:::

### Network Drive Connection Issues

**Symptom:** Slow performance or connection drops when using databases on network drives.

**Cause:** SQLite isn't designed for network file systems due to locking mechanism limitations.

**Solutions:**

1. **Copy the database locally** for best performance
2. **Use a database server** (PostgreSQL, MySQL) for shared access needs
3. **Ensure stable network connection** if you must use network storage
4. **Consider periodic sync** instead of live connection

---

## Encrypted Database Issues

### Invalid Password or Unsupported Encryption

**Symptom:** "Invalid password or unsupported encryption format" error after entering password.

**Causes:**

- Incorrect password
- Unsupported encryption format
- Database corruption

**Solutions:**

1. **Verify the password:**
   - Check for typos
   - Try with different case (passwords are case-sensitive)
   - Ensure no extra spaces before/after

2. **Test with command line:**

   ```bash
   sqlcipher /path/to/database.db
   > .tables
   ```

3. **Try different cipher configurations** - SQL Pro auto-detects, but some exotic formats may not be supported

4. **Check database integrity:**
   ```bash
   sqlite3 /path/to/database.db "PRAGMA integrity_check;"
   ```

### Saved Password Not Working

**Symptom:** Database won't open automatically even though password was saved.

**Causes:**

- Database password was changed externally
- Keychain/credential storage was cleared
- Database file was replaced

**Solution:**

1. Click **Forget saved password** in the password dialog
2. Enter the current correct password
3. Optionally save the new password

### Password Storage Unavailable

**Symptom:** "Remember password" checkbox is disabled.

**Cause:** Secure storage (OS keychain) is not available or not configured.

**Solutions:**

**macOS:**

- Ensure Keychain Access is not locked
- Grant SQL Pro keychain access when prompted

**Windows:**

- Ensure Credential Manager service is running
- Run: `services.msc` → Find "Credential Manager" → Start

**Linux:**

```bash
# Install libsecret
sudo apt install libsecret-1-0 gnome-keyring

# Start the keyring daemon
gnome-keyring-daemon --start --components=secrets
```

---

## Query Execution Issues

### Query Timeout or Slow Performance

**Symptom:** Queries take a very long time or time out.

**Causes:**

- Large dataset without proper indexing
- Complex joins or subqueries
- Database file fragmentation

**Solutions:**

1. **Add indexes** to frequently queried columns:

   ```sql
   CREATE INDEX idx_table_column ON table_name(column_name);
   ```

2. **Analyze your query** using EXPLAIN:

   ```sql
   EXPLAIN QUERY PLAN SELECT * FROM large_table WHERE condition;
   ```

3. **Limit result sets:**

   ```sql
   SELECT * FROM large_table LIMIT 1000;
   ```

4. **Vacuum the database** to defragment:

   ```sql
   VACUUM;
   ```

5. **Use the Query Optimizer** (View → Query Optimizer) to get suggestions

::: tip Performance Tip
The Query Optimizer panel provides specific recommendations for your queries, including missing indexes and query restructuring suggestions.
:::

### Syntax Error in Query

**Symptom:** "Syntax error" message when executing a query.

**Common Causes and Fixes:**

| Issue                   | Example                   | Fix                                                           |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| Missing quotes          | `WHERE name = John`       | `WHERE name = 'John'`                                         |
| Wrong quotes            | `WHERE name = "John"`     | `WHERE name = 'John'` (SQLite uses single quotes for strings) |
| Reserved word as column | `SELECT order FROM table` | `SELECT "order" FROM table`                                   |
| Missing comma           | `SELECT a b FROM`         | `SELECT a, b FROM`                                            |
| Typo in keyword         | `SELEC * FROM`            | `SELECT * FROM`                                               |

**Solution:** Use the built-in SQL formatter (<kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>) to help identify syntax issues.

### Query Returns No Results

**Symptom:** Query executes successfully but returns empty results.

**Causes:**

- Incorrect WHERE conditions
- Case sensitivity issues
- Data type mismatch

**Solutions:**

1. **Verify your conditions:**

   ```sql
   -- Check what data exists
   SELECT DISTINCT column_name FROM table_name LIMIT 10;
   ```

2. **Check case sensitivity:**

   ```sql
   -- Case-insensitive search
   SELECT * FROM users WHERE LOWER(name) = LOWER('John');
   -- Or use LIKE
   SELECT * FROM users WHERE name LIKE '%john%';
   ```

3. **Check data types:**
   ```sql
   -- If column is TEXT but you're comparing to number
   SELECT * FROM items WHERE id = '123';  -- Not: id = 123
   ```

---

## Data Editing Issues

### Cannot Edit Read-Only Database

**Symptom:** Edit operations are disabled or show "Database is read-only."

**Causes:**

- File permissions prevent writing
- Database is opened in read-only mode
- File is on read-only media

**Solutions:**

1. **Check file permissions:**

   ```bash
   ls -la database.db
   # Should show rw- permissions
   ```

2. **Grant write access:**

   ```bash
   chmod 644 database.db
   ```

3. **Copy to writable location** if on read-only media

### Changes Not Saving

**Symptom:** Edited data reverts or doesn't persist after closing.

**Causes:**

- Changes weren't applied before closing
- Transaction was rolled back due to error
- Concurrent modification conflict

**Solutions:**

1. **Check for pending changes:**
   - Press <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> to view pending changes
   - Click **Apply Changes** in the diff preview panel

2. **Look for errors in the changes panel:**
   - Failed rows are highlighted
   - Review error messages for constraint violations

3. **Verify constraints before editing:**
   ```sql
   -- Check table constraints
   SELECT sql FROM sqlite_master WHERE name = 'your_table';
   ```

### Foreign Key Constraint Violations

**Symptom:** "FOREIGN KEY constraint failed" when inserting or updating data.

**Cause:** The value you're inserting doesn't exist in the referenced table.

**Solutions:**

1. **Check what values exist in the parent table:**

   ```sql
   SELECT id FROM parent_table;
   ```

2. **Insert the parent record first**, then the child record

3. **View foreign key relationships** in the ER Diagram (View → ER Diagram)

4. **Temporarily disable foreign keys** (not recommended for production):
   ```sql
   PRAGMA foreign_keys = OFF;
   -- Make your changes
   PRAGMA foreign_keys = ON;
   ```

---

## User Interface Issues

### Dark/Light Theme Not Applying

**Symptom:** Theme doesn't change after selecting a different option.

**Solutions:**

1. **Use Command Palette:**
   - Press <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd>
   - Type "theme"
   - Select your preferred theme option

2. **Check Settings:**
   - Press <kbd>Cmd/Ctrl</kbd> + <kbd>,</kbd>
   - Navigate to **Appearance** section
   - Select theme: Light, Dark, or System

3. **System theme not detected:**
   - Choose explicit Light or Dark instead of System
   - On some Linux distributions, system theme detection may not work

### Sidebar/Panel Not Visible

**Symptom:** Schema sidebar, query history, or other panels are missing.

**Solutions:**

1. **Resize panels:**
   - Panels can be collapsed by dragging dividers
   - Look for thin divider lines at panel edges
   - Drag to resize

2. **Reset layout:**
   - Close and reopen the database
   - Or restart the application

3. **Toggle panels:**
   - Query History: <kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd>
   - Schema sidebar is always visible when a database is open

### Text/UI Elements Too Small or Large

**Symptom:** Interface elements are difficult to read.

**Solutions:**

1. **Adjust system display scaling:**
   - macOS: System Preferences → Displays → Resolution
   - Windows: Settings → Display → Scale
   - Linux: Display settings in your desktop environment

2. **Use browser-style zoom (Electron apps):**
   - <kbd>Cmd/Ctrl</kbd> + <kbd>+</kbd> to zoom in
   - <kbd>Cmd/Ctrl</kbd> + <kbd>-</kbd> to zoom out
   - <kbd>Cmd/Ctrl</kbd> + <kbd>0</kbd> to reset

---

## Keyboard Shortcut Issues

### Shortcuts Not Working

**Symptom:** Pressing keyboard shortcuts has no effect.

**Causes:**

- Wrong panel/element focused
- Vim mode intercepting keys
- System/browser shortcut conflict

**Solutions:**

1. **Check focus:**
   - Click on the area where you want to use shortcuts
   - SQL Editor shortcuts only work when editor is focused
   - Data Grid shortcuts only work when grid is focused

2. **Check Vim mode:**
   - If Vim mode is enabled, many keys have different meanings
   - Press <kbd>Escape</kbd> to ensure you're in normal mode
   - Disable Vim mode in Settings if not needed

3. **System conflicts:**
   - Some shortcuts may be captured by the OS
   - Try using Command Palette as alternative
   - Press <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> and search for the command

::: tip
Press <kbd>Cmd/Ctrl</kbd> + <kbd>/</kbd> to see all available keyboard shortcuts for your current context.
:::

### Vim Mode Keys Not Responding

**Symptom:** Vim keybindings like `j`, `k`, `h`, `l` don't navigate.

**Causes:**

- Vim mode not enabled
- Currently in insert mode
- Focus not on Vim-enabled component

**Solutions:**

1. **Enable Vim mode:**
   - Press <kbd>Cmd/Ctrl</kbd> + <kbd>,</kbd> to open Settings
   - Enable **Editor Vim Mode** for SQL editor
   - Enable **App Vim Mode** for sidebar/grid navigation

2. **Check current mode:**
   - Look at the mode indicator (NORMAL, INSERT, VISUAL)
   - Press <kbd>Escape</kbd> to return to normal mode

3. **Verify focus:**
   - App Vim Mode works in sidebar and data grid
   - Editor Vim Mode works in the SQL editor

---

## Performance Issues

### High Memory Usage

**Symptom:** SQL Pro using excessive RAM, system becoming slow.

**Causes:**

- Very large query results loaded in memory
- Multiple large databases open
- Memory leak (rare)

**Solutions:**

1. **Limit query results:**

   ```sql
   SELECT * FROM large_table LIMIT 10000;
   ```

2. **Close unused databases:**
   - Close tabs/windows with databases you're not actively using

3. **Restart the application** to clear memory

4. **Use pagination:**
   - The data grid automatically paginates
   - Avoid "SELECT \* FROM" on very large tables

### Slow Startup

**Symptom:** Application takes a long time to start.

**Causes:**

- Many recent connections trying to validate
- Large databases in recent list
- System resource constraints

**Solutions:**

1. **Clear recent connections:**
   - Remove databases you no longer need from recent list
   - Encrypted databases are validated on startup

2. **Check disk speed:**
   - Move database files to SSD if on HDD
   - Ensure no disk bottlenecks

3. **Close other applications** to free system resources

### Data Grid Slow to Scroll

**Symptom:** Scrolling through data grid is laggy or stuttering.

**Causes:**

- Very wide tables (many columns)
- Complex cell rendering
- Large number of visible rows

**Solutions:**

1. **Select specific columns:**

   ```sql
   SELECT id, name, email FROM users;
   -- Instead of: SELECT * FROM users;
   ```

2. **Use filters** to reduce visible data

3. **Hardware acceleration:**
   - Ensure your system has hardware graphics acceleration enabled

---

## Export and Import Issues

### Export Fails with Large Tables

**Symptom:** Export operation times out or crashes with large datasets.

**Solutions:**

1. **Export in batches:**

   ```sql
   -- Export in chunks
   SELECT * FROM large_table LIMIT 100000 OFFSET 0;
   SELECT * FROM large_table LIMIT 100000 OFFSET 100000;
   -- etc.
   ```

2. **Use command line for very large exports:**

   ```bash
   sqlite3 database.db ".mode csv" ".output data.csv" "SELECT * FROM table;"
   ```

3. **Increase system resources:**
   - Close other applications
   - Ensure sufficient disk space for output

### CSV Import Character Encoding Issues

**Symptom:** Special characters appear garbled after import.

**Cause:** Character encoding mismatch between file and database.

**Solutions:**

1. **Ensure UTF-8 encoding:**
   - Save your CSV file as UTF-8 before importing
   - Most modern editors can convert encoding

2. **Check file encoding:**

   ```bash
   file -i your_file.csv
   ```

3. **Convert encoding if needed:**
   ```bash
   iconv -f ISO-8859-1 -t UTF-8 input.csv > output.csv
   ```

---

## Platform-Specific Issues

### macOS: Application Damaged Message

**Symptom:** "SQL Pro is damaged and can't be opened" message.

**Cause:** Extended attribute quarantine flag.

**Solution:**

```bash
# Remove quarantine attribute
xattr -cr /Applications/SQL\ Pro.app
```

### Windows: DLL Not Found Errors

**Symptom:** Missing DLL error when starting the application.

**Solution:**

1. Install the latest **Visual C++ Redistributable:**
   - Download from Microsoft's website
   - Install both x64 and x86 versions

2. **Update Windows** to latest version

### Linux: Blank Screen or Rendering Issues

**Symptom:** Application opens but shows blank or corrupted content.

**Causes:**

- GPU driver issues
- Missing libraries

**Solutions:**

1. **Try disabling GPU acceleration:**

   ```bash
   ./SQL-Pro-*.AppImage --disable-gpu
   ```

2. **Install required libraries:**

   ```bash
   # Debian/Ubuntu
   sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils

   # Fedora
   sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils
   ```

3. **Update graphics drivers**

---

## Getting More Help

### Reporting Issues

If you can't resolve an issue using this guide:

1. **Search existing issues** on [GitHub Issues](https://github.com/kunish-homelab/sql-pro/issues)
2. **Create a new issue** with:
   - SQL Pro version
   - Operating system and version
   - Steps to reproduce
   - Error messages (screenshots if helpful)
   - Database type (regular SQLite or encrypted)

### Debug Information

To help troubleshoot, gather this information:

1. **Application version:** Check in Help → About
2. **Operating system:** Include version number
3. **Database details:** Size, encryption status, source application
4. **Console logs:** Open Developer Tools (<kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>) → Console tab

::: info
When reporting issues, never share actual database content or passwords. Use dummy data to reproduce issues if needed.
:::

## Next Steps

- [Getting Started Guide](/getting-started/) - Setup and first connection
- [Feature Documentation](/features/) - Learn about all features
- [Keyboard Shortcuts](/shortcuts) - Complete shortcuts reference
- [GitHub Issues](https://github.com/kunish-homelab/sql-pro/issues) - Report bugs and request features
