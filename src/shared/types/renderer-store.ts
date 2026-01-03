// Renderer store persistence types
// This module defines types for persisting renderer (UI) state via IPC to electron-store

import type { FontSettings } from './font';

// ============ Diagram Types (shared for persistence) ============

export interface DiagramViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

// ============ Settings Store ============

export interface RendererSettingsState {
  editorVimMode: boolean;
  appVimMode: boolean;
  fonts: FontSettings;
  tabSize: number;
  pageSize: number | 'all';
  restoreSession: boolean;
  sidebarCollapsed: boolean;
}

// ============ Diagram Store ============

export interface RendererDiagramState {
  nodePositionsMap: Record<string, Record<string, NodePosition>>;
  viewportMap: Record<string, DiagramViewport>;
  showColumns: boolean;
  showTypes: boolean;
}

// ============ Panel Widths ============

export interface RendererPanelWidths {
  [key: string]: number;
}

// ============ Connection Store ============

export interface RendererConnectionState {
  activeConnectionId: string | null;
  expandedFolderIds: string[];
  connectionTabOrder: string[];
  connectionColors: Record<string, string>;
}

// ============ Combined Renderer Store Schema ============

export interface RendererStoreSchema {
  settings: RendererSettingsState;
  diagram: RendererDiagramState;
  panelWidths: RendererPanelWidths;
  connectionUi: RendererConnectionState;
}

// ============ IPC Request/Response Types ============

export interface GetRendererStateRequest {
  key: keyof RendererStoreSchema;
}

export interface GetRendererStateResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SetRendererStateRequest<T = unknown> {
  key: keyof RendererStoreSchema;
  value: T;
}

export interface SetRendererStateResponse {
  success: boolean;
  error?: string;
}

export interface UpdateRendererStateRequest<T = unknown> {
  key: keyof RendererStoreSchema;
  updates: Partial<T>;
}

export interface UpdateRendererStateResponse {
  success: boolean;
  error?: string;
}

// ============ IPC Channel Constants ============

export const RENDERER_STORE_CHANNELS = {
  GET: 'renderer-store:get',
  SET: 'renderer-store:set',
  UPDATE: 'renderer-store:update',
  RESET: 'renderer-store:reset',
} as const;
