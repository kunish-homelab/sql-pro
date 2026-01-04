import { toPng, toSvg } from 'html-to-image';

interface ExportOptions {
  filename?: string;
  backgroundColor?: string;
}

/**
 * Exports a React Flow diagram element as PNG
 */
export async function exportDiagramAsPng(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = `er-diagram-${Date.now()}.png`, backgroundColor } =
    options;

  // Determine background color based on theme
  const bgColor =
    backgroundColor ||
    (document.documentElement.classList.contains('dark')
      ? '#18181b'
      : '#ffffff');

  try {
    const dataUrl = await toPng(element, {
      backgroundColor: bgColor,
      pixelRatio: 2, // Higher quality
      filter: (node) => {
        // Exclude certain elements from export if needed
        const exclusionClasses = [
          'react-flow__minimap',
          'react-flow__controls',
        ];
        return !exclusionClasses.some((cls) =>
          (node as HTMLElement).classList?.contains(cls)
        );
      },
    });

    // Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Failed to export diagram as PNG:', error);
    throw error;
  }
}

/**
 * Exports a React Flow diagram element as SVG
 */
export async function exportDiagramAsSvg(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = `er-diagram-${Date.now()}.svg`, backgroundColor } =
    options;

  const bgColor =
    backgroundColor ||
    (document.documentElement.classList.contains('dark')
      ? '#18181b'
      : '#ffffff');

  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: bgColor,
      filter: (node) => {
        const exclusionClasses = [
          'react-flow__minimap',
          'react-flow__controls',
        ];
        return !exclusionClasses.some((cls) =>
          (node as HTMLElement).classList?.contains(cls)
        );
      },
    });

    // Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Failed to export diagram as SVG:', error);
    throw error;
  }
}
