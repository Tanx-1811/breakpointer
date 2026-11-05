import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import {
  createBaseLayer,
  createTextMeasure,
  isReleased,
  loadMarkupImage,
  paintMarkup,
  releaseMarkupImage,
  renderMarkup,
  type MarkupSource,
} from '../../services/markup-render';
import {
  addMark,
  canRedo,
  canUndo,
  clampPoint,
  clipRect,
  COLOR_VALUES,
  constrainBox,
  constrainLine,
  constrainMove,
  createHistory,
  DEFAULT_COLOR,
  DEFAULT_SIZE,
  DEFAULT_TOOL,
  dragHandle,
  estimateTextWidth,
  findMark,
  fitScale,
  handleAt,
  hitTest,
  isMeaningful,
  isStyled,
  MARKUP_COLORS,
  MARKUP_SIZES,
  MARKUP_TOOLS,
  markupScale,
  moveMark,
  nextStepNumber,
  push,
  rectFromPoints,
  redo,
  removeMark,
  restyle,
  textBox,
  textColorOn,
  textLayout,
  undo,
  updateMark,
  appendPoint,
  type HandleId,
  type Mark,
  type MarkupColor,
  type MarkupHistory,
  type MarkupSize,
  type MarkupTool,
  type Point,
} from '../../state/markup';
import { createId } from '../../utils/id';
import { isMac, modShortcut } from '../../utils/platform';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import styles from './MarkupDialog.module.css';

/** A captured PNG (object URL), its size in pixels and the file name to suggest. */
export type MarkupImage = { url: string; width: number; height: number; name: string };

type Props = {
  open: boolean;
  /** Null while the screenshot is being captured. */
  image: MarkupImage | null;
  onClose: () => void;
  onSave: (blob: Blob, fileName: string) => void;
  onCopy: (blob: Blob) => void;
};

const TOOL_KEYS: Record<MarkupTool, MessageKey> = {
  select: 'markup.tool.select',
  arrow: 'markup.tool.arrow',
  rect: 'markup.tool.rect',
  pen: 'markup.tool.pen',
  highlight: 'markup.tool.highlight',
  text: 'markup.tool.text',
  step: 'markup.tool.step',
  blur: 'markup.tool.blur',
};

const TOOL_ICONS: Record<MarkupTool, IconName> = {
  select: 'pointer',
  arrow: 'arrowUpRight',
  rect: 'box',
  pen: 'pencil',
  highlight: 'highlighter',
  text: 'text',
  step: 'step',
  blur: 'pixelate',
};

/** One-letter shortcuts, matched on the physical key so they work with any layout or input method. */
const TOOL_SHORTCUTS: Record<MarkupTool, string> = {
  select: 'V',
  arrow: 'A',
  rect: 'R',
  pen: 'P',
  highlight: 'H',
  text: 'T',
  step: 'N',
  blur: 'B',
};

const TOOL_FOR_CODE = Object.fromEntries(
  MARKUP_TOOLS.map((tool) => [`Key${TOOL_SHORTCUTS[tool]}`, tool]),
) as Partial<Record<string, MarkupTool>>;

const COLOR_KEYS: Record<MarkupColor, MessageKey> = {
  red: 'markup.color.red',
  orange: 'markup.color.orange',
  yellow: 'markup.color.yellow',
  green: 'markup.color.green',
  blue: 'markup.color.blue',
  black: 'markup.color.black',
  white: 'markup.color.white',
};

const SIZE_KEYS: Record<MarkupSize, MessageKey> = {
  thin: 'markup.size.thin',
  medium: 'markup.size.medium',
  thick: 'markup.size.thick',
};

const HANDLE_CURSORS: Record<HandleId, string> = {
  from: 'crosshair',
  to: 'crosshair',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

const EMPTY_HISTORY = createHistory();

type Session = { url: string | null; history: MarkupHistory };

/**
 * Annotates a screenshot before it is saved or copied: arrows, boxes,
 * freehand lines, a highlighter, labels, numbered steps and pixelated areas
 * that hide private details. Marks last until the image changes.
 */
export function MarkupDialog({ open, image, onClose, onSave, onCopy }: Props) {
  const { t } = useI18n();
  const url = image?.url ?? null;
  // The marks belong to one image: a new capture starts from none.
  const [session, setSession] = useState<Session>(() => ({ url, history: EMPTY_HISTORY }));
  const history = session.url === url ? session.history : EMPTY_HISTORY;
  const changeHistory = useCallback(
    (change: (history: MarkupHistory) => MarkupHistory) =>
      setSession((current) => ({ url, history: change(current.url === url ? current.history : EMPTY_HISTORY) })),
    [url],
  );
  const apply = useCallback(
    (change: (marks: Mark[]) => Mark[]) => changeHistory((current) => push(current, change(current.present))),
    [changeHistory],
  );
  const [tool, setTool] = useState<MarkupTool>(DEFAULT_TOOL);
  const [color, setColor] = useState<MarkupColor>(DEFAULT_COLOR);
  const [size, setSize] = useState<MarkupSize>(DEFAULT_SIZE);
  const source = useDecodedImage(url);
  const busy = useRef(false);

  const exportImage = async (action: 'save' | 'copy') => {
    if (!source || !image || busy.current) return;
    busy.current = true;
    try {
      const blob = await renderMarkup(source, history.present);
      if (action === 'save') onSave(blob, image.name);
      else onCopy(blob);
    } catch (error) {
      console.error('Breakpointer: the annotated image could not be made', error);
    } finally {
      busy.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      title={t('markup.title')}
      description={t('markup.description')}
      icon="pencil"
      onClose={onClose}
      width={1000}
      footer={
        <>
          <Button
            variant="secondary"
            icon="copy"
            disabled={!source}
            data-testid="markup-copy"
            onClick={() => void exportImage('copy')}
          >
            {t('markup.copy')}
          </Button>
          <Button
            variant="primary"
            icon="download"
            disabled={!source}
            data-testid="markup-save"
            onClick={() => void exportImage('save')}
          >
            {t('markup.save')}
          </Button>
        </>
      }
    >
      {image ? (
        <Editor
          key={image.url}
          image={image}
          source={source}
          history={history}
          apply={apply}
          onUndo={() => changeHistory(undo)}
          onRedo={() => changeHistory(redo)}
          tool={tool}
          color={color}
          size={size}
          onTool={setTool}
          onColor={setColor}
          onSize={setSize}
        />
      ) : (
        <div className={styles.capturing} role="status" data-testid="markup-capturing">
          <span className={styles.spinner} aria-hidden="true" />
          <span>{t('markup.capturing')}</span>
        </div>
      )}
    </Dialog>
  );
}

/** The screenshot decoded once (and released when it changes or the dialog goes away). */
function useDecodedImage(url: string | null): MarkupSource | null {
  const [decoded, setDecoded] = useState<{ url: string; source: MarkupSource } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let loaded: MarkupSource | null = null;
    loadMarkupImage(url).then(
      (source) => {
        if (cancelled) {
          releaseMarkupImage(source);
          return;
        }
        loaded = source;
        setDecoded({ url, source });
      },
      (error: unknown) => console.warn('Breakpointer: the screenshot could not be decoded', error),
    );
    return () => {
      cancelled = true;
      if (loaded) releaseMarkupImage(loaded);
    };
  }, [url]);
  return decoded && decoded.url === url && !isReleased(decoded.source) ? decoded.source : null;
}

type EditorProps = {
  image: MarkupImage;
  source: MarkupSource | null;
  history: MarkupHistory;
  apply: (change: (marks: Mark[]) => Mark[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  tool: MarkupTool;
  color: MarkupColor;
  size: MarkupSize;
  onTool: (tool: MarkupTool) => void;
  onColor: (color: MarkupColor) => void;
  onSize: (size: MarkupSize) => void;
};

/** A pointer drag in progress: drawing a new mark, moving one, or reshaping one by a handle. */
type Gesture =
  | { kind: 'draw'; pointerId: number; start: Point; mark: Mark }
  | { kind: 'move'; pointerId: number; id: string; start: Point; original: Mark; preview: Mark }
  | { kind: 'handle'; pointerId: number; id: string; handle: HandleId; original: Mark; preview: Mark };

/** A label being typed: a new one at `at`, or the existing mark `id`. */
type Editing = { id: string | null; at: Point; text: string };

/** Stage padding and border, around the canvas. */
const STAGE_INSET = 26;
/** The dialog body's width (1000 px dialog) before the stage is measured. */
const DEFAULT_STAGE_WIDTH = 956 - STAGE_INSET;
const maxStageHeight = () => Math.max(200, Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * 0.6));

/** Arrow keys, Home and End in a radio group: the index to move to, or null. */
function radioTarget(event: ReactKeyboardEvent, index: number, count: number): number | null {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

function Editor(props: EditorProps) {
  const { t } = useI18n();
  const { image, source, history, apply, tool, color, size } = props;
  const marks = history.present;
  const width = source?.width ?? image.width;
  const height = source?.height ?? image.height;
  const scale = markupScale(width, height);
  const measure = useMemo(() => createTextMeasure(), []);
  const hintId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toolRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const colorRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const refocus = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  const [available, setAvailable] = useState(() => ({
    width: DEFAULT_STAGE_WIDTH,
    height: maxStageHeight() - STAGE_INSET,
  }));

  const selected = findMark(marks, selectedId) ?? null;
  const editingMark = findMark(marks, editing?.id);

  // Shown size: fits the stage; the canvas has as many pixels as the screen shows (no more than the image).
  const fit = fitScale(width, height, available.width, available.height);
  const viewWidth = Math.max(1, Math.round(width * fit));
  const viewHeight = Math.max(1, Math.round(height * fit));
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const backingWidth = Math.max(1, Math.min(width, Math.round(viewWidth * dpr)));
  const backingHeight = Math.max(1, Math.round((backingWidth * height) / width));
  /** Image pixels per CSS pixel on screen. */
  const imagePerCss = width / viewWidth;
  const tolerance = 6 * imagePerCss;

  const base = useMemo(
    () => (source ? createBaseLayer(source, backingWidth, backingHeight) : null),
    [source, backingWidth, backingHeight],
  );

  // Fit the canvas to the stage, and again when the dialog or window is resized.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measureStage = () => {
      const style = getComputedStyle(stage);
      const inner = stage.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
      if (!(inner > 0)) return;
      const next = { width: Math.max(160, Math.floor(inner)), height: maxStageHeight() - STAGE_INSET };
      setAvailable((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureStage);
    observer?.observe(stage);
    window.addEventListener('resize', measureStage);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureStage);
    };
  }, []);

  /* ---------- Drawing ---------- */

  const latest = useRef({ source, marks, selectedId: null as string | null, hiddenId: null as string | null, base });

  const paint = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { source: image, marks: current, selectedId: selection, hiddenId, base: layer } = latest.current;
    const active = gesture.current;
    let shown = current;
    if (active?.kind === 'draw') shown = [...current, active.mark];
    else if (active) shown = current.map((mark) => (mark.id === active.id ? active.preview : mark));
    paintMarkup(canvas, image, shown, {
      base: layer,
      selectedId: active?.kind === 'draw' ? null : selection,
      hiddenId,
    });
  }, []);

  /** Pointer moves redraw once per frame. */
  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useLayoutEffect(() => {
    latest.current = { source, marks, selectedId: selected?.id ?? null, hiddenId: editing?.id ?? null, base };
    paint();
  }, [paint, source, marks, selected, editing?.id, base, backingWidth, backingHeight]);

  useEffect(() => {
    const frames = frame;
    return () => cancelAnimationFrame(frames.current);
  }, []);

  /* ---------- Labels ---------- */

  const editingOpen = editing !== null;
  useEffect(() => {
    if (editingOpen) inputRef.current?.focus({ preventScroll: true });
  }, [editingOpen]);

  const startEditing = (value: Editing) => {
    editingRef.current = value;
    setEditing(value);
    setSelectedId(null);
  };

  /** Ends typing a label: kept (an empty one is dropped) or cancelled. */
  const finishEditing = (commit: boolean, focusCanvas: boolean) => {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    setEditing(null);
    const text = current.text.trim();
    if (commit && current.id) {
      const id = current.id;
      apply((all) =>
        text
          ? updateMark(all, id, (mark) => (mark.kind === 'text' && mark.text !== text ? { ...mark, text } : mark))
          : removeMark(all, id),
      );
    } else if (commit && text) {
      const id = createId();
      const box = textBox({ id, kind: 'text', at: current.at, text, color, size }, scale, measure);
      // Keep the whole label on the image.
      const at = {
        x: Math.max(0, Math.min(current.at.x, width - box.width)),
        y: Math.max(0, Math.min(current.at.y, height - box.height)),
      };
      apply((all) => addMark(all, { id, kind: 'text', at, text, color, size }));
    }
    if (focusCanvas) canvasRef.current?.focus({ preventScroll: true });
  };

  const textAt = (point: Point) => {
    const id = hitTest(
      marks.filter((mark) => mark.kind === 'text'),
      point,
      tolerance,
      scale,
      measure,
    );
    const mark = findMark(marks, id);
    return mark?.kind === 'text' ? mark : null;
  };

  /* ---------- Tools and styles ---------- */

  const chooseTool = (next: MarkupTool) => {
    finishEditing(true, false);
    if (next !== 'select') setSelectedId(null);
    if (canvasRef.current) canvasRef.current.style.cursor = '';
    props.onTool(next);
  };

  /** The mark a colour or width change applies to: the selected one, or the label being edited. */
  const target = selected ?? editingMark ?? null;
  const styleDisabled = target ? !isStyled(target) : tool === 'blur';
  const shownColor = target && isStyled(target) ? target.color : color;
  const shownSize = target && isStyled(target) ? target.size : size;

  const chooseColor = (next: MarkupColor) => {
    props.onColor(next);
    if (target) apply((all) => updateMark(all, target.id, (mark) => restyle(mark, { color: next })));
  };

  const chooseSize = (next: MarkupSize) => {
    props.onSize(next);
    if (target) apply((all) => updateMark(all, target.id, (mark) => restyle(mark, { size: next })));
  };

  const deleteSelected = () => {
    if (!selected) return;
    const id = selected.id;
    apply((all) => removeMark(all, id));
    setSelectedId(null);
  };

  /** After a button disables itself (nothing left to undo, delete or clear), focus goes to the image. */
  const afterAction = (action: () => void) => {
    action();
    refocus.current = true;
  };

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) {
      canvasRef.current?.focus({ preventScroll: true });
    }
  });

  /* ---------- Pointer ---------- */

  const toImage = (event: { clientX: number; clientY: number }): Point => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const scaleX = width / (rect?.width || viewWidth);
    const scaleY = height / (rect?.height || viewHeight);
    return clampPoint(
      { x: (event.clientX - (rect?.left ?? 0)) * scaleX, y: (event.clientY - (rect?.top ?? 0)) * scaleY },
      width,
      height,
    );
  };

  const newMark = (point: Point): Mark | null => {
    const id = createId();
    switch (tool) {
      case 'arrow':
        return { id, kind: 'arrow', from: point, to: point, color, size };
      case 'rect':
        return { id, kind: 'rect', rect: { x: point.x, y: point.y, width: 0, height: 0 }, color, size };
      case 'blur':
        return { id, kind: 'blur', rect: { x: point.x, y: point.y, width: 0, height: 0 } };
      case 'pen':
      case 'highlight':
        return { id, kind: tool, points: [point], color, size };
      default:
        return null;
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || gesture.current) return;
    // Keeps the focus where it is (the label field) until we decide where it goes.
    event.preventDefault();
    const canvas = event.currentTarget;
    const point = toImage(event);
    if (editingRef.current) {
      // The first click outside a label being typed only finishes it.
      finishEditing(true, true);
      return;
    }
    if (tool === 'text') {
      const label = textAt(point);
      startEditing(label ? { id: label.id, at: label.at, text: label.text } : { id: null, at: point, text: '' });
      return;
    }
    canvas.focus({ preventScroll: true });
    if (tool === 'step') {
      const id = createId();
      apply((all) => addMark(all, { id, kind: 'step', at: point, number: nextStepNumber(all), color, size }));
      return;
    }
    if (tool === 'select') {
      const handle = selected ? handleAt(selected, point, tolerance * 1.5) : null;
      if (selected && handle) {
        gesture.current = {
          kind: 'handle',
          pointerId: event.pointerId,
          id: selected.id,
          handle,
          original: selected,
          preview: selected,
        };
      } else {
        const mark = findMark(marks, hitTest(marks, point, tolerance, scale, measure));
        setSelectedId(mark?.id ?? null);
        if (!mark) return;
        gesture.current = { kind: 'move', pointerId: event.pointerId, id: mark.id, start: point, original: mark, preview: mark };
      }
    } else {
      const mark = newMark(point);
      if (!mark) return;
      gesture.current = { kind: 'draw', pointerId: event.pointerId, start: point, mark };
    }
    canvas.setPointerCapture?.(event.pointerId);
    schedule();
  };

  const updateCursor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'select') return;
    const point = toImage(event);
    const handle = selected ? handleAt(selected, point, tolerance * 1.5) : null;
    event.currentTarget.style.cursor = handle
      ? HANDLE_CURSORS[handle]
      : hitTest(marks, point, tolerance, scale, measure)
        ? 'move'
        : '';
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = gesture.current;
    if (!active) {
      updateCursor(event);
      return;
    }
    if (event.pointerId !== active.pointerId) return;
    const point = toImage(event);
    const constrain = event.shiftKey;
    if (active.kind === 'draw') {
      const mark = active.mark;
      let next: Mark = mark;
      if (mark.kind === 'arrow') next = { ...mark, to: constrain ? constrainLine(mark.from, point) : point };
      else if (mark.kind === 'rect' || mark.kind === 'blur') {
        next = { ...mark, rect: rectFromPoints(active.start, constrain ? constrainBox(active.start, point) : point) };
      } else if (mark.kind === 'pen' || mark.kind === 'highlight') {
        // Every sample since the last frame, for smooth freehand lines.
        const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
        let points = mark.points;
        for (const sample of samples.length ? samples : [event]) {
          points = appendPoint(points, toImage(sample), 1.5 * imagePerCss);
        }
        next = { ...mark, points };
      }
      gesture.current = { ...active, mark: next };
    } else if (active.kind === 'move') {
      const delta = { x: point.x - active.start.x, y: point.y - active.start.y };
      const { x, y } = constrain ? constrainMove(delta.x, delta.y) : delta;
      gesture.current = { ...active, preview: moveMark(active.original, x, y) };
    } else {
      gesture.current = { ...active, preview: dragHandle(active.original, active.handle, point, constrain) };
    }
    schedule();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (active.kind === 'draw') {
      let mark = active.mark;
      if (mark.kind === 'blur') {
        const rect = clipRect(mark.rect, width, height);
        if (rect) mark = { ...mark, rect };
      }
      // A click without a drag draws nothing.
      if (isMeaningful(mark, 4 * imagePerCss)) {
        apply((all) => addMark(all, mark));
        return;
      }
    } else if (active.preview !== active.original) {
      const { id, preview } = active;
      apply((all) => updateMark(all, id, () => preview));
      return;
    }
    schedule();
  };

  const onPointerCancel = () => {
    gesture.current = null;
    schedule();
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'select') return;
    const label = textAt(toImage(event));
    if (label) startEditing({ id: label.id, at: label.at, text: label.text });
  };

  /* ---------- Keyboard ---------- */

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const dialog = rootRef.current?.closest('dialog');
    const node = event.target instanceof Node ? event.target : null;
    if (!dialog || !node || !dialog.contains(node) || event.defaultPrevented || event.isComposing) return;
    // Fields keep their own keys (undo while typing undoes the typing).
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return;
    if (node instanceof HTMLElement && node.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.code === 'KeyZ') {
        event.preventDefault();
        if (event.shiftKey) props.onRedo();
        else props.onUndo();
      } else if (event.code === 'KeyY' && !event.shiftKey) {
        event.preventDefault();
        props.onRedo();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      // Escape first lets go of a drag or the selection; then it closes the dialog.
      if (gesture.current) {
        event.preventDefault();
        gesture.current = null;
        schedule();
      } else if (selected) {
        event.preventDefault();
        setSelectedId(null);
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!selected) return;
      event.preventDefault();
      deleteSelected();
      canvasRef.current?.focus({ preventScroll: true });
      return;
    }
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = nudge[event.key];
    if (direction && selected && node === canvasRef.current) {
      event.preventDefault();
      const step = (event.shiftKey ? 10 : 1) * imagePerCss;
      const id = selected.id;
      apply((all) => updateMark(all, id, (mark) => moveMark(mark, direction[0] * step, direction[1] * step)));
      return;
    }
    const next = event.shiftKey ? undefined : TOOL_FOR_CODE[event.code];
    if (next) {
      event.preventDefault();
      chooseTool(next);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  /* ---------- Render ---------- */

  const count = marks.length;
  const canvasLabel =
    count === 0 ? t('markup.canvasEmpty') : count === 1 ? t('markup.canvasOne') : t('markup.canvas', { count });

  const labelStyle = editingMark && isStyled(editingMark) ? editingMark : { color, size };
  const layout = textLayout(labelStyle.size, scale);
  const fontPx = Math.max(12, layout.fontSize / imagePerCss);
  const padX = (layout.padX / layout.fontSize) * fontPx;
  const padY = (layout.padY / layout.fontSize) * fontPx;
  const inputLeft = editing ? editing.at.x / imagePerCss : 0;
  const inputTop = editing ? editing.at.y / imagePerCss : 0;
  const typed = editing?.text || t('markup.textPlaceholder');
  const inputWidth = Math.min(
    Math.max(48, viewWidth - inputLeft),
    Math.ceil((measure ?? estimateTextWidth)(typed, fontPx) + padX * 2 + 6),
  );

  return (
    <div ref={rootRef} className={styles.editor} data-testid="markup-editor">
      <div className={styles.toolbar}>
        <div role="radiogroup" aria-label={t('markup.tools')} className={styles.tools}>
          {MARKUP_TOOLS.map((item, index) => (
            <button
              key={item}
              ref={(element) => {
                toolRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={tool === item}
              aria-label={t(TOOL_KEYS[item])}
              data-tooltip={t(TOOL_KEYS[item])}
              data-shortcut={TOOL_SHORTCUTS[item]}
              data-autofocus={tool === item || undefined}
              data-testid={`markup-tool-${item}`}
              tabIndex={tool === item ? 0 : -1}
              className={styles.tool}
              onClick={() => chooseTool(item)}
              onKeyDown={(event) => {
                const next = radioTarget(event, index, MARKUP_TOOLS.length);
                if (next === null) return;
                event.preventDefault();
                chooseTool(MARKUP_TOOLS[next]!);
                toolRefs.current[next]?.focus();
              }}
            >
              <Icon name={TOOL_ICONS[item]} size={17} />
            </button>
          ))}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        {/* While a label is typed, picking a colour or width keeps the focus in its field. */}
        <fieldset
          className={styles.styleControls}
          disabled={styleDisabled}
          onMouseDown={(event) => {
            if (editingRef.current) event.preventDefault();
          }}
        >
          <div role="radiogroup" aria-label={t('markup.colors')} className={styles.swatches}>
            {MARKUP_COLORS.map((item, index) => (
              <button
                key={item}
                ref={(element) => {
                  colorRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={shownColor === item}
                aria-label={t(COLOR_KEYS[item])}
                data-tooltip={t(COLOR_KEYS[item])}
                data-testid={`markup-color-${item}`}
                tabIndex={shownColor === item ? 0 : -1}
                className={styles.swatch}
                onClick={() => chooseColor(item)}
                onKeyDown={(event) => {
                  const next = radioTarget(event, index, MARKUP_COLORS.length);
                  if (next === null) return;
                  event.preventDefault();
                  chooseColor(MARKUP_COLORS[next]!);
                  colorRefs.current[next]?.focus();
                }}
              >
                <span className={styles.dot} style={{ background: COLOR_VALUES[item] }} />
              </button>
            ))}
          </div>
          <Segmented
            size="sm"
            label={t('markup.size')}
            value={shownSize}
            options={MARKUP_SIZES.map((item) => ({ value: item, label: t(SIZE_KEYS[item]) }))}
            onChange={chooseSize}
          />
        </fieldset>

        <div className={styles.actions}>
          <IconButton
            icon="undo"
            size="sm"
            label={t('markup.undo')}
            shortcut={modShortcut('Z')}
            disabled={!canUndo(history)}
            data-testid="markup-undo"
            onClick={() => afterAction(props.onUndo)}
          />
          <IconButton
            icon="redo"
            size="sm"
            label={t('markup.redo')}
            shortcut={isMac() ? '⇧⌘Z' : 'Ctrl Y'}
            disabled={!canRedo(history)}
            data-testid="markup-redo"
            onClick={() => afterAction(props.onRedo)}
          />
          <span className={styles.divider} aria-hidden="true" />
          <IconButton
            icon="trash"
            size="sm"
            tone="danger"
            label={t('markup.delete')}
            shortcut={isMac() ? '⌫' : 'Del'}
            disabled={!selected}
            data-testid="markup-delete"
            onClick={() => afterAction(deleteSelected)}
          />
          <IconButton
            icon="eraser"
            size="sm"
            tone="danger"
            label={t('markup.clear')}
            disabled={count === 0}
            data-testid="markup-clear"
            onClick={() =>
              afterAction(() => {
                finishEditing(false, false);
                apply(() => []);
                setSelectedId(null);
              })
            }
          />
        </div>
      </div>

      <div ref={stageRef} className={styles.stage}>
        <div className={styles.frame} style={{ width: viewWidth, height: viewHeight }}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={backingWidth}
            height={backingHeight}
            role="img"
            aria-label={canvasLabel}
            aria-describedby={hintId}
            tabIndex={0}
            data-tool={tool}
            data-testid="markup-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onDoubleClick={onDoubleClick}
          />
          {editing && (
            <input
              ref={inputRef}
              className={styles.textInput}
              aria-label={t('markup.textLabel')}
              placeholder={t('markup.textPlaceholder')}
              value={editing.text}
              spellCheck={false}
              autoComplete="off"
              data-testid="markup-text-input"
              style={{
                left: inputLeft,
                top: inputTop,
                width: inputWidth,
                fontSize: fontPx,
                padding: `${padY}px ${padX}px`,
                borderRadius: (layout.radius / layout.fontSize) * fontPx,
                background: COLOR_VALUES[labelStyle.color],
                color: textColorOn(labelStyle.color),
              }}
              onChange={(event) => {
                const value = { ...editing, text: event.target.value };
                editingRef.current = value;
                setEditing(value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  finishEditing(true, true);
                } else if (event.key === 'Escape') {
                  // Cancels the label only; the dialog stays open.
                  event.preventDefault();
                  event.stopPropagation();
                  finishEditing(false, true);
                }
              }}
              onBlur={() => finishEditing(true, false)}
            />
          )}
        </div>
      </div>

      <p id={hintId} className={styles.hint}>
        {t('markup.hint')}
      </p>
    </div>
  );
}
