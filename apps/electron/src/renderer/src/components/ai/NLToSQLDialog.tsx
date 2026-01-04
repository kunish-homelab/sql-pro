import type { SchemaInfo } from '@shared/types';
import { Button } from '@sqlpro/ui/button';
import { Textarea } from '@sqlpro/ui/textarea';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { ProGate } from '@/components/pro/ProGate';
import { SettingsDialog } from '@/components/SettingsDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { useNLToSQL } from '@/hooks/useAI';

interface NLToSQLDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: SchemaInfo[];
  onSQLGenerated: (sql: string) => void;
}

export function NLToSQLDialog({
  open,
  onOpenChange,
  schema,
  onSQLGenerated,
}: NLToSQLDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const { generateSQL, generatedSQL, isGenerating, error, isConfigured } =
    useNLToSQL({
      schema,
    });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await generateSQL(prompt);
  };

  const handleUseSQL = () => {
    if (generatedSQL) {
      onSQLGenerated(generatedSQL);
      onOpenChange(false);
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-150">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Natural Language to SQL
            </DialogTitle>
            <DialogDescription>
              Describe what you want to query in plain English, and AI will
              generate the SQL for you.
            </DialogDescription>
          </DialogHeader>

          <ProGate feature="ai-nl-to-sql">
            <div className="grid gap-4 py-4">
              {/* Configuration Warning */}
              {!isConfigured && (
                <div className="bg-warning/10 border-warning/50 flex items-start gap-3 rounded-lg border p-3">
                  <AlertCircle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI not configured</p>
                    <p className="text-muted-foreground text-xs">
                      Please configure your AI provider and API key to use this
                      feature.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings2 className="mr-1 h-3 w-3" />
                    Configure
                  </Button>
                </div>
              )}

              {/* Prompt Input */}
              <div className="grid gap-2">
                <Textarea
                  placeholder="e.g., Show me all users who signed up in the last 30 days..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  disabled={isGenerating}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Press Cmd/Ctrl+Enter to generate
                  </p>
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating || !isConfigured}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate SQL
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 border-destructive/50 flex items-start gap-3 rounded-lg border p-3">
                  <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-destructive text-sm font-medium">
                      Error
                    </p>
                    <p className="text-destructive/80 text-xs">{error}</p>
                  </div>
                </div>
              )}

              {/* Generated SQL */}
              {generatedSQL && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Generated SQL</p>
                    <Button size="sm" onClick={handleUseSQL}>
                      Use this SQL
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-muted max-h-50 overflow-auto rounded-lg p-4">
                    <SqlHighlight code={generatedSQL} className="text-sm" />
                  </div>
                </div>
              )}

              {/* Schema Context Info */}
              <div className="text-muted-foreground border-t pt-4 text-xs">
                <p>
                  <strong>Available tables:</strong>{' '}
                  {schema
                    .flatMap((s) =>
                      [...s.tables, ...s.views].map((t) => t.name)
                    )
                    .join(', ') || 'No tables loaded'}
                </p>
              </div>
            </div>
          </ProGate>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
