export interface ViewportLayout {
  isLandscape: boolean;
  containerWidth: number;
  containerHeight: number;
  dpr: number;
}

/**
 * Manages responsive canvas sizing and integer pixel scaling.
 */
export class LayoutEngine {
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private onResizeCallback: ((layout: ViewportLayout) => void) | null = null;
  private currentLayout: ViewportLayout;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.currentLayout = this.calculateLayout();

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
  }

  public onResize(callback: (layout: ViewportLayout) => void): void {
    this.onResizeCallback = callback;
  }

  public getLayout(): ViewportLayout {
    return this.currentLayout;
  }

  public updateCanvasSize(): ViewportLayout {
    const layout = this.calculateLayout();
    this.currentLayout = layout;

    const { containerWidth, containerHeight, dpr } = layout;

    // Set CSS display size
    this.canvas.style.width = `${containerWidth}px`;
    this.canvas.style.height = `${containerHeight}px`;

    // Set backing store dimensions for Retina / high-DPI
    this.canvas.width = Math.round(containerWidth * dpr);
    this.canvas.height = Math.round(containerHeight * dpr);

    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
    }

    return layout;
  }

  private calculateLayout(): ViewportLayout {
    const rect = this.container.getBoundingClientRect();
    const containerWidth = Math.max(100, Math.floor(rect.width));
    const containerHeight = Math.max(100, Math.floor(rect.height));
    const isLandscape = window.innerWidth > window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    return {
      isLandscape,
      containerWidth,
      containerHeight,
      dpr,
    };
  }

  private handleResize = (): void => {
    const layout = this.updateCanvasSize();
    if (this.onResizeCallback) {
      this.onResizeCallback(layout);
    }
  };

  public destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  }
}
