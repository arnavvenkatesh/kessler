import type { CursorState, RenderMetrics } from '../render/boardRenderer';

export interface InputHandlers {
  onCursorMove: (cursor: CursorState) => void;
  onPlace: (x: number, y: number, rot: 0 | 1) => void;
  onRotate: (rot: 0 | 1) => void;
  onUndo: () => void;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private cursor: CursorState = { x: 0, y: 0, active: false, rot: 0 };
  private metrics: RenderMetrics = { boardSizePx: 0, cellSize: 0, offsetX: 0, offsetY: 0 };
  private boardCols = 7;
  private boardRows = 7;
  private handlers: InputHandlers;

  constructor(canvas: HTMLCanvasElement, handlers: InputHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;

    this.attachListeners();
  }

  public updateMetrics(metrics: RenderMetrics, cols: number, rows: number): void {
    this.metrics = metrics;
    this.boardCols = cols;
    this.boardRows = rows;
  }

  public getCursor(): CursorState {
    return this.cursor;
  }

  public setRotation(rot: 0 | 1): void {
    this.cursor.rot = rot;
    this.handlers.onRotate(rot);
  }

  private attachListeners(): void {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('click', this.handleClick);

    this.canvas.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouch, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });

    window.addEventListener('keydown', this.handleKeyDown);
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    this.updateGridCursor(px, py);
  };

  private handleMouseLeave = (): void => {
    // Keep active if controlled by keyboard, but can deactivate on mouse leave
    // We keep cursor.active = false if mouse left without keyboard focus
  };

  private handleClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cell = this.pixelToGrid(px, py);
    if (cell) {
      this.cursor.x = cell.gx;
      this.cursor.y = cell.gy;
      this.cursor.active = true;
      this.handlers.onPlace(cell.gx, cell.gy, this.cursor.rot);
    }
  };

  private handleTouch = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;

    const rect = this.canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;

    this.updateGridCursor(px, py);
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.cursor.active) {
      this.handlers.onPlace(this.cursor.x, this.cursor.y, this.cursor.rot);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    let handled = false;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.cursor.active = true;
        this.cursor.y = Math.max(0, this.cursor.y - 1);
        handled = true;
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        this.cursor.active = true;
        this.cursor.y = Math.min(this.boardRows - 1, this.cursor.y + 1);
        handled = true;
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.cursor.active = true;
        this.cursor.x = Math.max(0, this.cursor.x - 1);
        handled = true;
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        this.cursor.active = true;
        this.cursor.x = Math.min(this.boardCols - 1, this.cursor.x + 1);
        handled = true;
        break;

      case 'r':
      case 'R':
        this.cursor.rot = this.cursor.rot === 1 ? 0 : 1;
        this.handlers.onRotate(this.cursor.rot);
        handled = true;
        break;

      case ' ':
      case 'Enter':
        if (this.cursor.active) {
          this.handlers.onPlace(this.cursor.x, this.cursor.y, this.cursor.rot);
        }
        handled = true;
        break;

      case 'u':
      case 'U':
        this.handlers.onUndo();
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      this.handlers.onCursorMove(this.cursor);
    }
  };

  private updateGridCursor(px: number, py: number): void {
    const cell = this.pixelToGrid(px, py);
    if (cell) {
      this.cursor.x = cell.gx;
      this.cursor.y = cell.gy;
      this.cursor.active = true;
      this.handlers.onCursorMove(this.cursor);
    }
  }

  private pixelToGrid(px: number, py: number): { gx: number; gy: number } | null {
    const { offsetX, offsetY, cellSize } = this.metrics;
    if (cellSize <= 0) return null;

    const relX = px - offsetX;
    const relY = py - offsetY;

    if (
      relX < 0 ||
      relX >= this.boardCols * cellSize ||
      relY < 0 ||
      relY >= this.boardRows * cellSize
    ) {
      return null;
    }

    const gx = Math.floor(relX / cellSize);
    const gy = Math.floor(relY / cellSize);

    return { gx, gy };
  }

  public destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('touchstart', this.handleTouch);
    this.canvas.removeEventListener('touchmove', this.handleTouch);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
