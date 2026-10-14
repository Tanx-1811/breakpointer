import { VISION_MATRICES, visionFilterId } from '../../state/vision';

/**
 * The SVG colour matrices that `filter: url(#…)` refers to for the colour
 * vision simulations (state/vision.ts). Rendered once in the workspace.
 */
export function VisionFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {(Object.keys(VISION_MATRICES) as (keyof typeof VISION_MATRICES)[]).map((mode) => (
          <filter key={mode} id={visionFilterId(mode)}>
            <feColorMatrix type="matrix" values={VISION_MATRICES[mode].join(' ')} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
