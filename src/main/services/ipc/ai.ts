import type {
  AIAgentQueryRequest,
  AICancelStreamRequest,
  AIFetchAnthropicRequest,
  AIFetchOpenAIRequest,
  AIStreamAnthropicRequest,
  AIStreamOpenAIRequest,
} from '@shared/types';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { promisify } from 'node:util';
import { query as claudeAgentQuery } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import OpenAI from 'openai';
import { getAISettings, saveAISettings } from '../store';
import { createHandler } from './utils';

const execAsync = promisify(exec);

/**
 * Common installation paths for Claude Code executable.
 */
const COMMON_CLAUDE_PATHS =
  process.platform === 'win32'
    ? [
        `${process.env.LOCALAPPDATA}\\Programs\\claude\\claude.exe`,
        `${process.env.APPDATA}\\npm\\claude.cmd`,
        `${process.env.USERPROFILE}\\.claude\\bin\\claude.exe`,
        'C:\\Program Files\\Claude\\claude.exe',
        'C:\\Program Files (x86)\\Claude\\claude.exe',
      ]
    : [
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        `${os.homedir()}/.local/bin/claude`,
        `${os.homedir()}/.claude/bin/claude`,
        `${os.homedir()}/.npm-global/bin/claude`,
        '/snap/bin/claude',
      ];

/**
 * Find all available Claude Code executables.
 */
export async function findClaudeCodePaths(): Promise<string[]> {
  const foundPaths = new Set<string>();
  const isWindows = process.platform === 'win32';

  // Check common paths
  for (const commonPath of COMMON_CLAUDE_PATHS) {
    const resolvedPath = commonPath.replace('~', os.homedir());
    if (fs.existsSync(resolvedPath)) {
      foundPaths.add(resolvedPath);
    }
  }

  // Search in PATH environment variable
  try {
    if (isWindows) {
      const { stdout } = await execAsync('where claude 2>nul');
      const pathsFromWhere = stdout
        .trim()
        .split('\r\n')
        .filter((p) => p.length > 0);
      for (const p of pathsFromWhere) {
        if (fs.existsSync(p)) {
          foundPaths.add(p);
        }
      }
    } else {
      const { stdout } = await execAsync('which -a claude 2>/dev/null');
      const pathsFromWhich = stdout
        .trim()
        .split('\n')
        .filter((p) => p.length > 0);
      for (const p of pathsFromWhich) {
        if (fs.existsSync(p)) {
          foundPaths.add(p);
        }
      }
    }
  } catch {
    // Command failed, ignore
  }

  // Also check npm global installations
  try {
    const npmPrefix = isWindows
      ? await execAsync('npm config get prefix').then((r) => r.stdout.trim())
      : await execAsync('npm config get prefix 2>/dev/null').then((r) =>
          r.stdout.trim()
        );
    const npmClaudePath = isWindows
      ? `${npmPrefix}\\claude.cmd`
      : `${npmPrefix}/bin/claude`;
    if (fs.existsSync(npmClaudePath)) {
      foundPaths.add(npmClaudePath);
    }
  } catch {
    // npm not available or failed
  }

  return Array.from(foundPaths);
}

export function setupAIHandlers(): void {
  // AI: Get Settings
  ipcMain.handle(IPC_CHANNELS.AI_GET_SETTINGS, async () => {
    try {
      const settings = getAISettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get AI settings',
      };
    }
  });

  // AI: Save Settings
  ipcMain.handle(IPC_CHANNELS.AI_SAVE_SETTINGS, async (_event, request) => {
    try {
      const settings = saveAISettings(request.settings);
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save AI settings',
      };
    }
  });

  // AI: Query
  ipcMain.handle(
    IPC_CHANNELS.AI_QUERY,
    createHandler(async (request: AIAgentQueryRequest) => {
      const settings = getAISettings();

      if (!settings) {
        throw new Error('AI settings not configured');
      }

      if (request.provider === 'anthropic') {
        const client = new Anthropic({
          apiKey: settings.anthropicApiKey,
        });

        const response = await client.messages.create({
          model: request.model || 'claude-3-5-sonnet-20241022',
          max_tokens: request.maxTokens || 2048,
          messages: (request.messages ||
            []) as Anthropic.Messages.MessageParam[],
          system: request.systemPrompt || undefined,
        });

        return {
          success: true,
          response: {
            content:
              response.content[0].type === 'text'
                ? response.content[0].text
                : '',
            stopReason: response.stop_reason,
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
            },
          },
        };
      } else if (request.provider === 'openai') {
        const client = new OpenAI({
          apiKey: settings.openaiApiKey,
        });

        const response = await client.chat.completions.create({
          model: request.model || 'gpt-4-turbo-preview',
          max_tokens: request.maxTokens || 2048,
          messages: (request.messages || []).map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        });

        return {
          success: true,
          response: {
            content: response.choices[0].message.content || '',
            stopReason: response.choices[0].finish_reason,
            usage: {
              inputTokens: response.usage?.prompt_tokens || 0,
              outputTokens: response.usage?.completion_tokens || 0,
            },
          },
        };
      } else if (request.provider === 'claude-agent') {
        const response = await claudeAgentQuery({
          prompt: request.systemPrompt || '',
        });

        return {
          success: true,
          response: {
            content: String(response || ''),
            stopReason: 'stop',
            usage: {
              inputTokens: 0,
              outputTokens: 0,
            },
          },
        };
      }

      throw new Error('Unsupported provider');
    })
  );

  // AI: Stream
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM,
    async (
      _event,
      _request: AIStreamAnthropicRequest | AIStreamOpenAIRequest
    ) => {
      return { success: false, error: 'Streaming not yet implemented' };
    }
  );

  // AI: Fetch (Anthropic)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_ANTHROPIC,
    createHandler(async (request: AIFetchAnthropicRequest) => {
      const client = new Anthropic({
        apiKey: request.apiKey,
      });

      const response = await client.messages.create({
        model: request.model || 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 2048,
        messages: (request.messages || []) as Anthropic.Messages.MessageParam[],
      });

      return {
        success: true,
        response: {
          content:
            response.content[0].type === 'text' ? response.content[0].text : '',
          stopReason: response.stop_reason,
        },
      };
    })
  );

  // AI: Fetch (OpenAI)
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_OPENAI,
    createHandler(async (request: AIFetchOpenAIRequest) => {
      const client = new OpenAI({
        apiKey: request.apiKey,
      });

      const response = await client.chat.completions.create({
        model: request.model || 'gpt-4-turbo-preview',
        max_tokens: request.maxTokens || 2048,
        messages: request.messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      });

      return {
        success: true,
        response: {
          content: response.choices[0].message.content || '',
          stopReason: response.choices[0].finish_reason,
        },
      };
    })
  );

  // AI: Cancel Stream
  ipcMain.handle(
    IPC_CHANNELS.AI_CANCEL_STREAM,
    createHandler(async (_request: AICancelStreamRequest) => {
      return { success: true };
    })
  );

  // System: Find Claude Paths
  ipcMain.handle(IPC_CHANNELS.SYSTEM_FIND_CLAUDE_PATHS, async () => {
    try {
      const paths = await findClaudeCodePaths();
      return { success: true, paths };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to find Claude paths',
      };
    }
  });
}
