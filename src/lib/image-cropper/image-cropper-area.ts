import { Component, ElementRef, NgZone, Input, OnDestroy, ChangeDetectionStrategy, Inject, ViewChild, OnInit } from '@angular/core';
import { normalizePassiveListenerOptions } from '@angular/cdk/platform';
import { Style, WithStyles, StyleRenderer, lyl } from '@alyle/ui';
import { STYLES, LyImageCropper } from './image-cropper';
import { DOCUMENT } from '@angular/common';

const activeEventOptions = normalizePassiveListenerOptions({passive: false});

const pos = (100 * Math.sqrt(2) - 100) / 2 / Math.sqrt(2);

@Component({
  selector: 'ly-cropper-area',
  templateUrl: './image-cropper-area.html',
  providers: [
    StyleRenderer
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'lyCropperArea'
})
export class LyCropperArea implements WithStyles, OnInit, OnDestroy {
  readonly classes = this.sRenderer.renderSheet(STYLES, 'area');

  private _isSliding: boolean;
  /** Keeps track of the last pointer event that was captured by the crop area. */
  private _lastPointerEvent: MouseEvent | TouchEvent | null;
  private _startPointerEvent: {
    x: number
    y: number
  } | null;
  private _currentWidth: number;
  private _currentHeight: number;

  /** Used to subscribe to global move and end events */
  protected _document: Document;

  @ViewChild('resizer', { static: true }) readonly _resizer: ElementRef;

  @Input() resizableArea: boolean;
  @Input() keepAspectRatio: boolean;
  @Input()
  @Style<boolean, LyCropperArea>(
    (_value, { classes: __ }) => ({ after }) => lyl `{
      border-radius: 50%
      .${__.resizer} {
        ${after}: ${pos}%
        bottom: ${pos}%
      }
    }`
  ) round: boolean;

  constructor(
    readonly sRenderer: StyleRenderer,
    private _el: ElementRef,
    private _ngZone: NgZone,
    readonly _cropper: LyImageCropper,
    @Inject(DOCUMENT) _document: any
  ) {
    this._document = _document;
  }

  ngOnInit() {
    this._ngZone.runOutsideAngular(() => {
      const element = this._resizer.nativeElement;
      element.addEventListener('mousedown', this._pointerDown, activeEventOptions);
      element.addEventListener('touchstart', this._pointerDown, activeEventOptions);
    });
  }

  ngOnDestroy() {
    const element = this._resizer.nativeElement;
    this._lastPointerEvent = null;
    this._removeGlobalEvents();
    element.removeEventListener('mousedown', this._pointerDown, activeEventOptions);
    element.removeEventListener('touchstart', this._pointerDown, activeEventOptions);
  }

  private _pointerDown = (event: MouseEvent | TouchEvent) => {
    // Don't do anything if the
    // user is using anything other than the main mouse button.
    if (this._isSliding || (!isTouchEvent(event) && event.button !== 0)) {
      return;
    }

    event.preventDefault();

    this._ngZone.run(() => {
      this._isSliding = true;
      this._lastPointerEvent = event;
      this._startPointerEvent = getGesturePointFromEvent(event);
      event.preventDefault();
      this._bindGlobalEvents(event);
    });

  }

  private _pointerMove = (event: MouseEvent | TouchEvent) => {
    if (this._isSliding) {
      event.preventDefault();
      this._lastPointerEvent = event;
      const element: HTMLDivElement = this._el.nativeElement;
      const { width, height } = this._cropper.config;
      const point = getGesturePointFromEvent(event);
      const deltaX = point.x - this._startPointerEvent!.x;
      const deltaY = point.y - this._startPointerEvent!.y;
      let newWidth = 0;
      let newHeight = 0;
      if (this.round) {
        const originX = ((width / 2 / Math.sqrt(2)) + deltaX);
        const originY = ((height / 2 / Math.sqrt(2)) + deltaY);
        const radius = Math.sqrt(originX ** 2 + originY ** 2);
        newWidth = newHeight = radius * 2;
      } else if (this._cropper.config.keepAspectRatio) {
        const m = Math.max(width + deltaX * 2, height + deltaY * 2);
        newWidth = newHeight = m;
      } else {
        newWidth = width + deltaX * 2;
        newHeight = height + deltaY * 2;
      }
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
      this._currentWidth = newWidth;
      this._currentHeight = newHeight;
      // console.log({deltaX, deltaY, width, height, newWidth, newHeight});
    }
  }

  /** Called when the user has lifted their pointer. */
  private _pointerUp = (event: TouchEvent | MouseEvent) => {
    if (this._isSliding) {
      event.preventDefault();
      this._removeGlobalEvents();
      this._cropper.config.width = this._currentWidth;
      this._cropper.config.height = this._currentHeight;
      this._cropper.config = this._cropper.config;
      this._isSliding = false;
      this._startPointerEvent = null;
    }
  }

  /** Called when the window has lost focus. */
  private _windowBlur = () => {
    // If the window is blurred while dragging we need to stop dragging because the
    // browser won't dispatch the `mouseup` and `touchend` events anymore.
    if (this._lastPointerEvent) {
      this._pointerUp(this._lastPointerEvent);
    }
  }

  private _bindGlobalEvents(triggerEvent: TouchEvent | MouseEvent) {
    const element = this._document;
    const isTouch = isTouchEvent(triggerEvent);
    const moveEventName = isTouch ? 'touchmove' : 'mousemove';
    const endEventName = isTouch ? 'touchend' : 'mouseup';
    element.addEventListener(moveEventName, this._pointerMove, activeEventOptions);
    element.addEventListener(endEventName, this._pointerUp, activeEventOptions);

    if (isTouch) {
      element.addEventListener('touchcancel', this._pointerUp, activeEventOptions);
    }

    const window = this._getWindow();

    if (typeof window !== 'undefined' && window) {
      window.addEventListener('blur', this._windowBlur);
    }
  }

  /** Removes any global event listeners that we may have added. */
  private _removeGlobalEvents() {
    const element = this._document;
    element.removeEventListener('mousemove', this._pointerMove, activeEventOptions);
    element.removeEventListener('mouseup', this._pointerUp, activeEventOptions);
    element.removeEventListener('touchmove', this._pointerMove, activeEventOptions);
    element.removeEventListener('touchend', this._pointerUp, activeEventOptions);
    element.removeEventListener('touchcancel', this._pointerUp, activeEventOptions);

    const window = this._getWindow();

    if (typeof window !== 'undefined' && window) {
      window.removeEventListener('blur', this._windowBlur);
    }
  }

  /** Use defaultView of injected document if available or fallback to global window reference */
  private _getWindow(): Window {
    return this._document.defaultView || window;
  }

  static ngAcceptInputType: boolean;
}

function getGesturePointFromEvent(event: TouchEvent | MouseEvent) {

  // `touches` will be empty for start/end events so we have to fall back to `changedTouches`.
  const point = isTouchEvent(event)
    ? (event.touches[0] || event.changedTouches[0])
    : event;

  return {
    x: point.clientX,
    y: point.clientY
  };
}

/** Returns whether an event is a touch event. */
function isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
  return event.type[0] === 't';
}

