import { Panel, useReactFlow } from '@xyflow/react';
import { Download, ImageIcon, LayoutGrid, Maximize } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportDiagramAsPng, exportDiagramAsSvg } from './utils/export-diagram';

interface ERControlsProps {
  onResetLayout: () => void;
}

export function ERControls({ onResetLayout }: ERControlsProps) {
  const { fitView } = useReactFlow();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async (format: 'png' | 'svg') => {
    setIsExporting(true);
    try {
      // Get the React Flow viewport element
      const element = document.querySelector(
        '.react-flow__viewport'
      ) as HTMLElement;

      if (!element) {
        console.error('Could not find React Flow viewport element');
        return;
      }

      // Get the parent container for full diagram export
      const container = element.closest('.react-flow') as HTMLElement;
      if (!container) {
        console.error('Could not find React Flow container');
        return;
      }

      if (format === 'png') {
        await exportDiagramAsPng(container);
      } else {
        await exportDiagramAsSvg(container);
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 200 });
  }, [fitView]);

  return (
    <Panel position="top-right" className="flex items-center gap-2">
      {/* Fit View */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleFitView}
        title="Fit to view"
      >
        <Maximize className="h-4 w-4" />
      </Button>

      {/* Reset Layout */}
      <Button
        variant="outline"
        size="sm"
        onClick={onResetLayout}
        title="Reset layout"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>

      {/* Export Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline" size="sm" disabled={isExporting}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport('png')}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Export as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('svg')}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Export as SVG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Panel>
  );
}
