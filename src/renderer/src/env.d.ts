/// <reference types="vite/client" />

// Declare Vite's special import syntax for workers
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
