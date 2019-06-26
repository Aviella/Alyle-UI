import { Component, ChangeDetectionStrategy, ElementRef, Renderer2, Input, OnInit, forwardRef, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { LyTheme2, ThemeVariables, toBoolean, LY_COMMON_STYLES, getLyThemeStyleUndefinedError } from '@alyle/ui';
import { SliderVariables } from './slider.config';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

interface ThemeVariablesWithSlider extends ThemeVariables {
  slider: SliderVariables;
}

export const LY_SLIDER_CONTROL_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => LySlider),
  multi: true
};

const STYLE_PRIORITY = 2;
const STYLES = (theme: ThemeVariablesWithSlider) => ({
  $priority: STYLE_PRIORITY,
  root: {
    display: 'inline-block',
    position: 'relative',
    boxSizing: 'border-box',
    outline: 0,
    cursor: 'pointer',
    '& {track}, & {bg}': {
      ...LY_COMMON_STYLES.fill,
      margin: 'auto'
    },
    '&': theme.slider ? theme.slider.root : null
  },
  wrapper: {
    display: 'flex',
    alignItems: 'baseline',
    cursor: 'pointer',
    padding: '16px 0'
  },

  track: { },
  bg: { },
  thumbContainer: {
    width: 0,
    height: 0,
    position: 'absolute',
    margin: 'auto',
    '&::before': {
      content: `''`,
      position: 'absolute',
      opacity: .6
    }
  },
  thumb: {
    position: 'absolute',
    width: '12px',
    height: '12px',
    left: '-6px',
    top: '-6px',
    borderRadius: '50% 50% 0%'
  },
  thumbLabel: {
    position: 'absolute',
    width: '28px',
    height: '28px',
    borderRadius: '50% 50% 0%'
  },
  thumbLabelValue: {
    display: 'flex',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#fff'
  },

  horizontal: {
    width: '96px',
    height: '2px',
    padding: '10px 0',
    '& {track}, & {bg}': {
      height: '2px',
      width: '100%'
    },
    '& {thumb}': {
      transform: 'rotateZ(-135deg)'
    },
    '& {thumbLabel}': {
      left: '-14px',
      top: '-50px',
      transform: 'rotateZ(45deg)'
    },
    '& {thumbLabelValue}': {
      transform: 'rotateZ(-45deg)'
    },
    '{thumbContainer}': {
      top: 0,
      bottom: 0,
    },
    '{thumbContainer}::before': {
      width: '2px',
      height: '24px',
      left: '-1px',
      top: '-24px'
    }
  },
  vertical: {
    width: '2px',
    height: '96px',
    padding: '0 10px',
    '& {track}, & {bg}': {
      height: '100%',
      width: '2px'
    },
    '& {thumb}': {
      transform: 'rotateZ(135deg)'
    },
    '& {thumbLabel}': {
      left: '-50px',
      top: '-14px',
      transform: 'rotateZ(-45deg)'
    },
    '& {thumbLabelValue}': {
      transform: 'rotateZ(45deg)'
    },
    '{thumbContainer}': {
      left: 0,
      right: 0
    },
    '{thumbContainer}::before': {
      width: '24px',
      height: '2px',
      left: '-24px',
      top: '-1px'
    }
  }
});

/** A change event emitted by the LySlider component. */
export class LySliderChange {

  constructor(
      /** The LySlider that changed. */
    public source: LySlider,
    /** The new value of the source slider. */
    public value: number | (number | null)[] | null,
  ) {

  }
}

@Component({
  selector: 'ly-slider',
  templateUrl: 'slider.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'lySlider',
  providers: [LY_SLIDER_CONTROL_VALUE_ACCESSOR]
})
export class LySlider implements OnInit, ControlValueAccessor {
  static и = 'LySlider';
  readonly classes = this._theme.addStyleSheet(STYLES);

  private _disabled: boolean;
  private _color: string;
  private _colorClass: string;

  private _vertical: boolean;
  private _verticalClass?: string | null;

  private _appearance: string;
  private _appearanceClass: string;

  private _value: number | (number | null)[] | null = null;

  private _hasThumbLabel: boolean;

  private _min: number = 0;
  private _max: number = 100;

  private _step: number = 1;
  private _stepPrecision?: number | null;

  /** @docs-private */
  _thumbs: {
    value: number
    styles: { [key: string]: string } | null
  }[] = [];

  /** Event emitted when the slider value has changed. */
  @Output() readonly change: EventEmitter<LySliderChange> = new EventEmitter<LySliderChange>();

  /** Event emitted when the slider thumb moves. */
  @Output() readonly input: EventEmitter<LySliderChange> = new EventEmitter<LySliderChange>();

  /** @docs-private */
  @Output() readonly valueChange: EventEmitter<number | (number | null)[] | null> = new EventEmitter<number | (number | null)[] | null>();

  /**
   * The registered callback function called when a blur event occurs on the input element.
   */
  onTouched = () => {};

  private _controlValueAccessorChangeFn: (value: any) => void = () => {};

  @Input()
  get disabled() {
    return this._disabled;
  }
  set disabled(val: boolean) {
    this._disabled = toBoolean(val);
  }

  @Input()
  get hasThumbLabel() {
    return this._hasThumbLabel;
  }
  set hasThumbLabel(val: boolean) {
    this._hasThumbLabel = toBoolean(val);
  }

  /** The maximum value that the slider can have. */
  @Input()
  get max(): number {
    return this._max;
  }
  set max(v: number) {
    this._max = Number(v) || this._max;
    this._updateThumbs();

    this._cd.markForCheck();
  }

  /** The minimum value that the slider can have. */
  @Input()
  get min(): number {
    return this._min;
  }
  set min(v: number) {
    this._min = Number(v) || this._min;

    // If the value wasn't explicitly set by the user, set it to the min.
    if (this._value === null) {
      this.value = this._min;
    }
    this._updateThumbs();

    this._cd.markForCheck();
  }

  /** The field appearance style. */
  @Input()
  set appearance(val: string) {
    if (val !== this.appearance) {
      this._appearance = val;
      this._appearanceClass = this._theme.addStyle(`${LySlider.и}.appearance:${val}`, (theme: ThemeVariablesWithSlider) => {
        const styleFn = theme.slider.appearance![val].appearance;
        if (!styleFn) {
          throw getLyThemeStyleUndefinedError(LySlider.и, 'appearance', val);
        }
        return styleFn(theme, val);
      }, this._el.nativeElement, this._appearanceClass, STYLE_PRIORITY, STYLES);
    }
  }
  get appearance() {
    return this._appearance;
  }

  /** Color of component */
  @Input()
  get color() {
    return this._color;
  }
  set color(val: string) {
    this._color = val;
    const appearance = this.appearance;
    const styleKey = `${LySlider.и}.color:${val}`;
    if (!this._theme.existStyle(styleKey)) {

    }
    const newStyle = (theme: ThemeVariablesWithSlider) => {
      const color = theme.colorOf(val);
      return theme.slider.appearance![appearance].color(theme, color);
    };
    this._colorClass = this._theme.addStyle(
      styleKey,
      newStyle,
      this._el.nativeElement,
      this._colorClass,
      STYLE_PRIORITY + 1, STYLES);
  }

  /** Whether the slider is vertical. */
  @Input()
  get vertical() {
    return this._vertical;
  }
  set vertical(val: boolean) {
    const newVal = toBoolean(val);
    this._vertical = newVal;

    const newClass = newVal
      ? this.classes.vertical
      : this.classes.horizontal;

    this._verticalClass = this._theme.updateClass(
      this._el.nativeElement,
      this._renderer,
      newClass,
      this._verticalClass as any);

  }

  /** The values at which the thumb will snap. */
  @Input()
  get step(): number { return this._step; }
  set step(v: number) {
    this._step = Number(v) || this._step;

    this._stepPrecision = this._step % 1 !== 0
      ? this._step.toString().split('.')[1].length
      : null;

    this._cd.markForCheck();
  }

  @Input()
  get value() {
    return this._value;
  }
  set value(val: number | (number | null)[] | null) {
    if (val !== this._value) {
      const valueIsArray = Array.isArray(val);
      if (typeof val === 'number') {
        let newValue = Number(val);
        if (this._stepPrecision) {
          newValue = parseFloat(newValue.toFixed(this._stepPrecision));
        }
        this._value = newValue;
      } else if (valueIsArray && !arrayEquals(this._value, val)) {
        let newValue = val as number[];
        if (this._stepPrecision) {
          newValue = newValue.map(
            _val => _val === null
            ? _val
            : parseFloat(_val.toFixed(this._stepPrecision as number)));
        }
        this._value = newValue;
      }
      this._thumbs = (valueIsArray ?
        this._value as (number | null)[]
        : [this._value as number | null]).map(v => ({
          value: v || 0,
          styles: null
        }));

      this._updateThumbs();

      this._cd.markForCheck();
    }
  }

  constructor(
    private _theme: LyTheme2,
    private _el: ElementRef,
    private _renderer: Renderer2,
    private _cd: ChangeDetectorRef
  ) {
    _renderer.addClass(_el.nativeElement, this.classes.root);
  }

  ngOnInit() {

    /**
     * TODO: update thumbs & trail on change direction (RTL/LTR)
     */

    /** Set default appearance */
    if (this.appearance == null) {
      this.appearance = (
        this._theme.variables as ThemeVariablesWithSlider).slider.defaultConfig!.appearance!;
    }

    /** Set horizontal slider */
    if (this.vertical == null) {
      this.vertical = false;
    }

    /** Set default color */
    if (this.color == null) {
      this.color = 'accent';
    }
  }

  writeValue(value: any): void {
    this.value = value;
  }

  /**
   * Registers a function called when the control value changes.
   *
   * @param fn The callback function
   */
  registerOnChange(fn: (value: any) => any): void {
    this._controlValueAccessorChangeFn = fn;
  }

  /**
   * Registers a function called when the control is touched.
   *
   * @param fn The callback function
   */
  registerOnTouched(fn: () => any): void {
    this.onTouched = fn;
  }

  /**
   * Disables the select. Part of the ControlValueAccessor interface required
   * to integrate with Angular's core forms API.
   *
   * @param isDisabled Sets whether the component is disabled.
   */
  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  private _updateThumbs() {
    this._thumbs.forEach(thumb => {
      const val = clamp(thumb.value, this.min, this.max);
      const percent = valueToPercent(val, this.min, this.max);
      const styles: {
        [key: string]: string;
    } = {};
      const direction = this._theme.variables.direction === 'rtl' ? 'right' : 'left';
      const pos = `${percent}%`;
      if (this.vertical) {
        styles.top = pos;
      } else {
        styles[direction] = pos;
      }
      thumb.value = val;
      thumb.styles = styles;
    });
  }

  /** Emits a change event. */
  private _emitChangeEvent() {
    this._controlValueAccessorChangeFn(this.value);
    this.valueChange.emit(this.value);
    this.change.emit(this._createChangeEvent());
  }

  private _createChangeEvent(value = this.value) {

    return new LySliderChange(this, value);
  }
}

function valueToPercent(value: number, min: number, max: number) {
  return ((value - min) * 100) / (max - min);
}

// function percentToValue(percent, min, max) {
//   return (max - min) * percent + min;
// }

function arrayEquals(array1: any, array2: any) {
  return Array.isArray(array1) && Array.isArray(array2) && array1.length === array2.length
    && array1.every((value, index) => value === array2[index]);
}

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
