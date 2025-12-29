# SQLCipher Encrypted Databases

SQL Pro provides full support for SQLCipher encrypted databases, allowing you to work with password-protected SQLite files securely. The application auto-detects encrypted databases and prompts for passwords when needed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/database-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/screenshots/database.png">
  <img alt="SQL Pro working with an encrypted SQLCipher database showing the main interface" src="/screenshots/database-dark.png">
</picture>

## Key Features

| Feature                     | Description                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| **Auto-Detection**          | Automatically detects encrypted databases by checking the SQLite header                     |
| **Multiple Cipher Support** | Supports SQLCipher 1-4, ChaCha20, AES-256-CBC, RC4, and more                                |
| **Secure Password Storage** | Option to save passwords using system keychain (macOS Keychain, Windows Credential Manager) |
| **Remember Password**       | Optionally remember passwords for quick access to frequently used databases                 |
| **Password Management**     | Easily forget saved passwords when no longer needed                                         |
| **Seamless Workflow**       | Once unlocked, work with encrypted databases exactly like regular databases                 |

## Supported Encryption Formats

SQL Pro supports a wide range of encryption formats to ensure compatibility with databases created by different applications:

| Format          | Description                        | Common Use                        |
| --------------- | ---------------------------------- | --------------------------------- |
| **SQLCipher 4** | Latest SQLCipher version (default) | Most modern encrypted SQLite apps |
| **SQLCipher 3** | Legacy SQLCipher format            | Older applications                |
| **SQLCipher 2** | Older legacy format                | Legacy systems                    |
| **SQLCipher 1** | Original SQLCipher format          | Very old systems                  |
| **ChaCha20**    | Modern stream cipher               | Signal, privacy-focused apps      |
| **AES-256-CBC** | AES encryption                     | Enterprise applications           |
| **AES-128-CBC** | wxSQLite3 format                   | wxWidgets-based apps              |
| **RC4**         | Legacy cipher                      | Very old systems                  |

::: tip Automatic Format Detection
SQL Pro automatically tries different cipher configurations when opening an encrypted database. You don't need to know which encryption format was used—just provide the correct password.
:::

## Opening Encrypted Databases

### Step 1: Open the Database File

Open an encrypted database the same way you would open any database:

1. **File Menu**: Click **File** → **Open Database** (or <kbd>Cmd/Ctrl</kbd> + <kbd>O</kbd>)
2. **Welcome Screen**: Click **Open Database** on the welcome screen
3. **Recent Connections**: Click on a recently opened encrypted database

### Step 2: Enter Password

When SQL Pro detects an encrypted database, a password dialog appears:

```
┌─────────────────────────────────────────┐
│            🔒 Encrypted Database         │
│                                          │
│  Enter the password to open              │
│  "my-secure-database.db"                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ••••••••••••                       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ☑ Remember password                     │
│                                          │
│     [Cancel]        [Open]               │
└──────────────────────────────────────────┘
```

1. Enter the database password in the password field
2. Optionally check **Remember password** to save it securely
3. Click **Open** or press <kbd>Enter</kbd>

### Step 3: Work with Your Database

Once the correct password is entered, the database opens and you can:

- Browse tables and views in the sidebar
- Query data with the SQL editor
- Edit data inline
- Export data in various formats
- View the ER diagram

The encrypted database works exactly like a regular SQLite database.

## Password Storage

SQL Pro can securely store database passwords using your operating system's secure credential storage:

### How It Works

| Platform    | Storage Method             |
| ----------- | -------------------------- |
| **macOS**   | macOS Keychain             |
| **Windows** | Windows Credential Manager |
| **Linux**   | libsecret (GNOME Keyring)  |

When you check **Remember password**, the password is:

1. Encrypted using the OS secure storage API
2. Stored in a local configuration file (encrypted)
3. Associated with the specific database file path

::: info Security Note
Passwords are encrypted using Electron's `safeStorage` API, which uses the operating system's native secure storage. The actual password is never stored in plain text.
:::

### Remembering Passwords

To save a password for future use:

1. Open an encrypted database
2. Enter the correct password
3. Check the **Remember password** checkbox
4. Click **Open**

The next time you open this database, SQL Pro will:

1. Detect the saved password
2. Automatically attempt to open the database
3. Only prompt for a password if the saved one fails

### Forgetting Saved Passwords

To remove a saved password:

**Method 1: From Password Dialog**

1. Open the encrypted database (it will auto-unlock if password is saved)
2. Close and reopen the database to see the password dialog
3. Click **Forget saved password**

**Method 2: Database Won't Open**
If a saved password no longer works:

1. The password dialog will appear
2. Click **Forget saved password** to clear the old password
3. Enter the new/correct password

::: warning Password Changes
If you change the password of an encrypted database using another tool, the saved password in SQL Pro will no longer work. Simply forget the old password and enter the new one.
:::

### Storage Availability

Secure password storage requires OS support. If unavailable:

- The **Remember password** checkbox will be disabled
- A tooltip explains that secure storage is not available
- You'll need to enter the password each time

This can happen on:

- Systems without a keychain/credential manager configured
- Some Linux distributions without libsecret
- Sandboxed environments

## Working with Encrypted Databases

### Database Indicator

Encrypted databases are indicated in the UI:

- **Sidebar**: Shows a lock icon (🔒) next to encrypted database names
- **Title Bar**: Displays "(encrypted)" after the database filename
- **Connection Status**: Shows encrypted status in connection details

### All Features Supported

Once opened, encrypted databases support all SQL Pro features:

- **Schema Browser**: View tables, views, indexes, triggers
- **Data Grid**: Browse and edit data with pagination
- **Query Editor**: Write and execute SQL queries
- **Query History**: Track all executed queries
- **Query Templates**: Use built-in and custom templates
- **ER Diagram**: Visualize database relationships
- **Data Export**: Export to CSV, JSON, SQL
- **Inline Editing**: Modify data directly in the grid

### Performance Notes

Encrypted databases may have slightly different performance characteristics:

| Operation     | Impact                                           |
| ------------- | ------------------------------------------------ |
| Opening       | Slightly slower (cipher initialization)          |
| Queries       | Minimal impact (hardware-accelerated encryption) |
| Large exports | Slightly slower (decryption overhead)            |
| Bulk inserts  | Minimal impact                                   |

::: tip Performance Tip
SQLCipher uses AES-256 encryption which is hardware-accelerated on modern CPUs. You shouldn't notice significant performance differences for typical database operations.
:::

## Creating Encrypted Databases

SQL Pro currently focuses on **reading and writing** to existing encrypted databases. To create a new encrypted database:

### Using SQLCipher CLI

```bash
# Install sqlcipher (macOS)
brew install sqlcipher

# Create new encrypted database
sqlcipher new-encrypted.db
SQLCipher version 4.5.0
Enter password:
sqlite> CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
sqlite> .exit
```

### Using SQLite with SQLCipher Extension

```sql
-- After opening a new database
PRAGMA key = 'your-secret-password';

-- Create your tables
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
);
```

### Converting Existing Databases

To encrypt an existing unencrypted database:

```bash
# Using sqlcipher command line
sqlcipher plaintext.db
sqlite> ATTACH DATABASE 'encrypted.db' AS encrypted KEY 'your-password';
sqlite> SELECT sqlcipher_export('encrypted');
sqlite> DETACH DATABASE encrypted;
```

::: info Future Feature
Direct creation of encrypted databases from within SQL Pro is planned for a future release. Currently, use the command-line tools above.
:::

## Troubleshooting

### "Invalid password or unsupported encryption format"

This error appears when:

1. **Wrong password**: Double-check the password for typos
2. **Unsupported format**: The database uses an encryption format not supported
3. **Corrupted database**: The file may be damaged

**Solutions:**

- Verify the password is correct
- Try the password with different case
- Check if the database opens with other tools (sqlcipher CLI)
- Verify the file isn't corrupted

### "Database appears to be encrypted"

This message appears when SQL Pro detects the file doesn't have a standard SQLite header.

**Solutions:**

- Enter the correct password
- If the database isn't actually encrypted, it may be corrupted
- Try opening with SQLite CLI to verify file integrity

### Password Not Being Saved

If the "Remember password" checkbox is disabled or passwords aren't being saved:

1. **Check system keychain**: Ensure your OS keychain is unlocked
2. **Permissions**: The app may need keychain access permission
3. **Linux**: Ensure libsecret is installed and configured

**macOS:**

- Open Keychain Access
- Check if "sql-pro" entries exist
- Grant access if prompted

**Windows:**

- Open Credential Manager
- Check for sql-pro entries

**Linux:**

```bash
# Install libsecret if needed
sudo apt install libsecret-1-0

# Ensure GNOME Keyring is running
gnome-keyring-daemon --start
```

### Saved Password No Longer Works

If a previously working saved password stops working:

1. The database password was changed externally
2. The password storage was cleared
3. The database file was replaced

**Solution:**

1. Click **Forget saved password** in the dialog
2. Enter the current correct password
3. Optionally save the new password

### Slow Opening Times

If encrypted databases take long to open:

1. **First attempt**: SQL Pro tries multiple cipher configurations
2. **Correct password found**: Future opens will be faster
3. **Hardware**: Older systems may have slower encryption

::: tip
Once SQL Pro finds the correct cipher configuration for your database, it will use that configuration for subsequent opens, making them faster.
:::

## Security Best Practices

### Password Selection

- Use strong, unique passwords for each encrypted database
- Consider using a password manager
- Avoid passwords that are easy to guess

### Password Storage

- Only save passwords on trusted devices
- Use disk encryption on your computer
- Log out or lock your computer when away

### Sharing Databases

When sharing encrypted databases:

- Share the password through a separate, secure channel
- Consider creating database-specific passwords
- Never include passwords in file names or nearby text files

### Backup Considerations

- Encrypted databases can be backed up like regular files
- The backup remains encrypted with the same password
- Store password recovery information securely

## Keyboard Shortcuts

| Action          | macOS                         | Windows/Linux                  |
| --------------- | ----------------------------- | ------------------------------ |
| Open database   | <kbd>Cmd</kbd> + <kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Submit password | <kbd>Enter</kbd>              | <kbd>Enter</kbd>               |
| Cancel dialog   | <kbd>Esc</kbd>                | <kbd>Esc</kbd>                 |

## Technical Details

### Encryption Detection

SQL Pro detects encryption by checking the first 16 bytes of the database file:

- **Unencrypted**: Starts with `SQLite format 3\0`
- **Encrypted**: Different header (encrypted data)

### Cipher Auto-Detection

When a password is provided, SQL Pro tries these configurations in order:

1. SQLCipher 4 (default, most common)
2. SQLCipher 4 with hex key
3. SQLCipher 3 (legacy)
4. SQLCipher 2
5. SQLCipher 1
6. ChaCha20
7. AES-256-CBC
8. RC4
9. wxSQLite3 AES-128
10. Various KDF iteration counts (64000, 4000, 1)

Each configuration is tried until one successfully decrypts the database.

### Under the Hood

SQL Pro uses the `better-sqlite3-multiple-ciphers` library, which:

- Provides native SQLite bindings for Node.js
- Supports multiple encryption formats
- Offers excellent performance
- Is actively maintained

## Next Steps

- [Write SQL Queries](/features/query-editor) - Query your encrypted databases
- [Browse Schema Details](/features/schema-browser) - Explore database structure
- [Edit Data Inline](/features/data-editing) - Modify data directly
- [View ER Diagrams](/features/er-diagram) - Visualize relationships
- [Learn All Shortcuts](/shortcuts) - Keyboard navigation reference
