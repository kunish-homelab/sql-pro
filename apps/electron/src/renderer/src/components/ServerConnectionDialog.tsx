/**
 * Server Connection Dialog
 * Dialog for configuring MySQL, PostgreSQL, and Supabase connections
 */

import type { DatabaseConnectionConfig, DatabaseType } from '@shared/types';
import { Button } from '@sqlpro/ui/button';
import { Checkbox } from '@sqlpro/ui/checkbox';
import { Input } from '@sqlpro/ui/input';
import { Label } from '@sqlpro/ui/label';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_PORTS: Record<DatabaseType, number> = {
  sqlite: 0,
  mysql: 3306,
  postgresql: 5432,
  supabase: 5432,
};

const DATABASE_LABELS: Record<DatabaseType, string> = {
  sqlite: 'SQLite',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  supabase: 'Supabase',
};

interface ServerConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  databaseType: DatabaseType;
  onConnect: (config: DatabaseConnectionConfig) => void;
  isConnecting?: boolean;
  error?: string | null;
}

export function ServerConnectionDialog({
  open,
  onOpenChange,
  databaseType,
  onConnect,
  isConnecting = false,
  error,
}: ServerConnectionDialogProps) {
  const isSupabase = databaseType === 'supabase';

  // Form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState(DEFAULT_PORTS[databaseType].toString());
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [useSSL, setUseSSL] = useState(isSupabase); // Supabase always uses SSL
  const [readOnly, setReadOnly] = useState(false);

  // Supabase-specific
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Reset form when dialog opens or database type changes
  useEffect(() => {
    if (open) {
      setHost('');
      setPort(DEFAULT_PORTS[databaseType].toString());
      setDatabase(databaseType === 'supabase' ? 'postgres' : '');
      setUsername(databaseType === 'supabase' ? 'postgres' : '');
      setPassword('');
      setDisplayName('');
      setUseSSL(databaseType === 'supabase');
      setReadOnly(false);
      setSupabaseUrl('');
      setSupabaseKey('');
    }
  }, [open, databaseType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: DatabaseConnectionConfig = {
      type: databaseType,
      name:
        displayName ||
        (isSupabase ? supabaseUrl : `${host}:${port}/${database}`),
      readOnly,
    };

    if (isSupabase) {
      config.supabaseUrl = supabaseUrl;
      config.supabaseKey = supabaseKey;
      config.ssl = true;
      // Pass host if user provided one (for pooler connections)
      if (host) {
        config.host = host;
      }
      // Pass port if user provided one
      if (port && port !== DEFAULT_PORTS[databaseType].toString()) {
        config.port = Number.parseInt(port, 10);
      }
      // Pass username if user provided one
      if (username) {
        config.username = username;
      }
    } else {
      config.host = host;
      config.port = Number.parseInt(port, 10);
      config.database = database;
      config.username = username;
      config.password = password;
      config.ssl = useSSL;
    }

    onConnect(config);
  };

  const isFormValid = isSupabase
    ? supabaseUrl && supabaseKey
    : host && database;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogHeader className="pb-4">
            <DialogTitle>
              Connect to {DATABASE_LABELS[databaseType]}
            </DialogTitle>
            <DialogDescription>
              {isSupabase
                ? 'Enter your Supabase project details to connect'
                : `Configure your ${DATABASE_LABELS[databaseType]} connection`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {/* Display name (optional) */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Connection Name (optional)</Label>
              <Input
                id="displayName"
                placeholder="My Database"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {isSupabase ? (
              <>
                {/* Supabase URL */}
                <div className="space-y-2">
                  <Label htmlFor="supabaseUrl">
                    Project URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="supabaseUrl"
                    type="url"
                    placeholder="https://your-project.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Found in Project Settings → General
                  </p>
                </div>

                {/* Supabase Host (optional, for pooler connections) */}
                <div className="space-y-2">
                  <Label htmlFor="supabaseHost">
                    Database Host{' '}
                    <span className="text-muted-foreground text-xs">
                      (recommended)
                    </span>
                  </Label>
                  <Input
                    id="supabaseHost"
                    placeholder="aws-0-us-east-1.pooler.supabase.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Found in Project Settings → Database → Connection string.
                    Use pooler host for better performance.
                  </p>
                </div>

                {/* Port for Supabase */}
                <div className="space-y-2">
                  <Label htmlFor="supabasePort">
                    Port{' '}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="supabasePort"
                    type="number"
                    placeholder="5432 or 6543 for transaction mode"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>

                {/* Username for Supabase */}
                <div className="space-y-2">
                  <Label htmlFor="supabaseUsername">
                    Username{' '}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="supabaseUsername"
                    placeholder="postgres or postgres.[project-ref]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    For pooler: postgres.[project-ref]. Auto-detected if empty.
                  </p>
                </div>

                {/* Supabase Key/Password */}
                <div className="space-y-2">
                  <Label htmlFor="supabaseKey">
                    Database Password{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="supabaseKey"
                    type="password"
                    placeholder="Your database password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    The password you set when creating the project
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Host */}
                <div className="space-y-2">
                  <Label htmlFor="host">
                    Host <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="host"
                    placeholder="localhost"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    required
                  />
                </div>

                {/* Port */}
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder={DEFAULT_PORTS[databaseType].toString()}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>

                {/* Database */}
                <div className="space-y-2">
                  <Label htmlFor="database">
                    Database <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="database"
                    placeholder={
                      databaseType === 'postgresql' ? 'postgres' : 'mydb'
                    }
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder={databaseType === 'mysql' ? 'root' : 'postgres'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {/* SSL */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ssl"
                    checked={useSSL}
                    onCheckedChange={(checked) => setUseSSL(checked === true)}
                  />
                  <Label htmlFor="ssl" className="font-normal">
                    Use SSL/TLS
                  </Label>
                </div>
              </>
            )}

            {/* Read-only */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="readOnly"
                checked={readOnly}
                onCheckedChange={(checked) => setReadOnly(checked === true)}
              />
              <Label htmlFor="readOnly" className="font-normal">
                Read-only connection
              </Label>
            </div>

            {/* Error message */}
            {error && (
              <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
