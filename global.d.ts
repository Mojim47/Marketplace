declare module '@google/model-viewer' {
  export class ModelViewerElement extends HTMLElement {
    src: string;
    poster?: string;
    alt?: string;
    ar?: boolean;
    arModes?: string;
    cameraControls?: boolean;
    exposure?: number;
    'environment-image'?: string;
    loading?: 'eager' | 'lazy';
    'auto-rotate'?: boolean;
    'rotation-per-second'?: string;
    'shadow-intensity'?: number;
    'shadow-softness'?: number;
  }

  export const ModelViewerElement: {
    prototype: ModelViewerElement;
    new (): ModelViewerElement;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      src?: string;
      poster?: string;
      alt?: string;
      ar?: boolean | 'true' | 'false';
      'ar-modes'?: string;
      'camera-controls'?: boolean | 'true' | 'false';
      exposure?: number | string;
      'environment-image'?: string;
      loading?: 'eager' | 'lazy';
      'auto-rotate'?: boolean | 'true' | 'false';
      'rotation-per-second'?: string;
      'shadow-intensity'?: number | string;
      'shadow-softness'?: number | string;
      onLoad?: React.ReactEventHandler<HTMLElement>;
      onError?: React.ReactEventHandler<HTMLElement>;
      onArStatusChange?: React.ReactEventHandler<HTMLElement>;
    }, HTMLElement>;
  }
}
