import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

interface StoredPassword {
  encryptedPassword: string;
  path: string;
}

interface PasswordStore {
  passwords: Record<string, StoredPassword>;
}

// Simple file-based store (since electron-store is ESM-only)
class SimpleStore {
  private filePath: string | null = null;
  private data: PasswordStore = { passwords: {} };

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = path.join(
        app.getPath('userData'),
        'sql-pro-passwords.json'
      );
    }
    return this.filePath;
  }

  private load(): void {
    try {
      const filePath = this.getFilePath();
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load password store:', error);
      this.data = { passwords: {} };
    }
  }

  private save(): void {
    try {
      const filePath = this.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save password store:', error);
    }
  }

  get(_key: 'passwords'): Record<string, StoredPassword> {
    this.load();
    return this.data.passwords || {};
  }

  set(_key: 'passwords', value: Record<string, StoredPassword>): void {
    this.data.passwords = value;
    this.save();
  }
}

const store = new SimpleStore();

class PasswordStorageService {
  /**
   * Check if encryption is available on this system
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Save a password for a database path
   */
  savePassword(dbPath: string, password: string): boolean {
    if (!this.isAvailable()) {
      console.warn('Password encryption is not available on this system');
      return false;
    }

    try {
      const encrypted = safeStorage.encryptString(password);
      const encryptedBase64 = encrypted.toString('base64');

      const passwords = store.get('passwords');
      passwords[dbPath] = {
        encryptedPassword: encryptedBase64,
        path: dbPath,
      };
      store.set('passwords', passwords);

      return true;
    } catch (error) {
      console.error('Failed to save password:', error);
      return false;
    }
  }

  /**
   * Get a saved password for a database path
   */
  getPassword(dbPath: string): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const passwords = store.get('passwords');
      const stored = passwords[dbPath];

      if (!stored) {
        return null;
      }

      const encrypted = Buffer.from(stored.encryptedPassword, 'base64');
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('Failed to retrieve password:', error);
      return null;
    }
  }

  /**
   * Check if a password is saved for a database path
   */
  hasPassword(dbPath: string): boolean {
    const passwords = store.get('passwords');
    return !!passwords[dbPath];
  }

  /**
   * Remove a saved password for a database path
   */
  removePassword(dbPath: string): boolean {
    try {
      const passwords = store.get('passwords');
      if (passwords[dbPath]) {
        delete passwords[dbPath];
        store.set('passwords', passwords);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove password:', error);
      return false;
    }
  }

  /**
   * Get all database paths that have saved passwords
   */
  getSavedPaths(): string[] {
    const passwords = store.get('passwords');
    return Object.keys(passwords);
  }
}

export const passwordStorageService = new PasswordStorageService();
