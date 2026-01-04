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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Connect to {DATABASE_LABELS[databaseType]}
            </DialogTitle>
            <DialogDescription>
              {isSupabase
                ? 'Enter your Supabase project details to connect'
                : `Configure your ${DATABASE_LABELS[databaseType]} connection`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                    Found in your Supabase project settings
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
                    Found in Project Settings → Database
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

          <DialogFooter>
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
