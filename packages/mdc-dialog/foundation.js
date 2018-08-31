/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {MDCFoundation} from '@material/base/index';
import MDCDialogAdapter from './adapter';
import {cssClasses, numbers, strings} from './constants';

export default class MDCDialogFoundation extends MDCFoundation {
  static get cssClasses() {
    return cssClasses;
  }

  static get strings() {
    return strings;
  }

  static get numbers() {
    return numbers;
  }

  /** @return {!MDCDialogAdapter} */
  static get defaultAdapter() {
    return new MDCDialogAdapter();
  }

  constructor(adapter = MDCDialogFoundation.defaultAdapter()) {
    super(adapter);

    /**
     * @type {boolean}
     * @private
     */
    this.isOpen_ = false;

    this.timerId_ = 0;

    window._foundation = this;

    this.clickHandler_ = (evt) => this.handleDialogClick_(evt);
    this.resizeHandler_ = () => this.handleWindowResize_();

    this.documentKeydownHandler_ = (evt) => {
      if (evt.key && evt.key === 'Escape' || evt.keyCode === 27) {
        this.close('escape');
      }
    };
  };

  destroy() {
    // Ensure that dialog is cleaned up when destroyed
    if (this.isOpen_) {
      this.close();
    }
    // Final cleanup of animating class in case the timer has not completed.
    this.adapter_.removeClass(cssClasses.ANIMATING);
    clearTimeout(this.timerId_);
  }

  open() {
    this.adapter_.notifyOpening();
    this.isOpen_ = true;
    this.disableScroll_();
    this.adapter_.registerDocumentKeydownHandler(this.documentKeydownHandler_);
    this.adapter_.registerWindowResizeHandler(this.resizeHandler_);
    this.adapter_.registerInteractionHandler('click', this.clickHandler_);
    this.adapter_.addClass(cssClasses.ANIMATING);
    this.adapter_.addClass(cssClasses.OPEN);

    this.layout();

    clearTimeout(this.timerId_);
    this.timerId_ = setTimeout(() => {
      this.handleAnimationTimerEnd_();
      this.adapter_.notifyOpened();
    }, numbers.DIALOG_ANIMATION_TIME_MS);
  }

  close(action = undefined) {
    this.adapter_.notifyClosing(action);
    this.isOpen_ = false;
    this.enableScroll_();
    this.adapter_.deregisterDocumentKeydownHandler(this.documentKeydownHandler_);
    this.adapter_.deregisterWindowResizeHandler(this.resizeHandler_);
    this.adapter_.deregisterInteractionHandler('click', this.clickHandler_);
    this.adapter_.untrapFocusOnSurface();
    this.adapter_.addClass(cssClasses.ANIMATING);
    this.adapter_.removeClass(cssClasses.OPEN);
    this.adapter_.removeClass(cssClasses.STACKED);
    this.adapter_.removeClass(cssClasses.SCROLLABLE);

    clearTimeout(this.timerId_);
    this.timerId_ = setTimeout(() => {
      this.handleAnimationTimerEnd_();
      this.adapter_.notifyClosed(action);
    }, numbers.DIALOG_ANIMATION_TIME_MS);
  }

  isOpen() {
    return this.isOpen_;
  }

  layout() {
    requestAnimationFrame(() => {
      this.detectStackedButtons_();
      this.detectScrollableContent_();
    });
  }

  /** @private */
  detectStackedButtons_() {
    // Remove the class first to let us measure the buttons' natural positions.
    this.adapter_.removeClass(cssClasses.STACKED);
    if (this.adapter_.areButtonsStacked()) {
      this.adapter_.addClass(cssClasses.STACKED);
    }
  }

  /** @private */
  detectScrollableContent_() {
    this.detectScrollableContentImpl_();
    this.detectScrollableContentInIE_();
  }

  /** @private */
  detectScrollableContentImpl_() {
    if (this.adapter_.isContentScrollable()) {
      this.adapter_.addClass(cssClasses.SCROLLABLE);
    } else {
      this.adapter_.removeClass(cssClasses.SCROLLABLE);
    }
  }

  /**
   * TODO(acdvorak): Only run this in IE 11?
   * CAUTION: Deep voodoo magic below. Modify at your own risk.
   * The *exact* sequence of rAF and addClass/removeClass calls is necessary to fix a flexbox bug in IE 11.
   * See https://github.com/philipwalton/flexbugs/issues/216
   * @private
   */
  detectScrollableContentInIE_() {
    const toggleIEClass = () => {
      requestAnimationFrame(() => {
        this.adapter_.addClass(cssClasses.FIX_IE_OVERFLOW);
        requestAnimationFrame(() => {
          this.adapter_.removeClass(cssClasses.FIX_IE_OVERFLOW);
          this.detectScrollableContentImpl_();
        });
      });
    };

    // No joke, this is the only thing I've found that reliably "fixes" IE.
    for (let i = 0; i < 5; i++) {
      setTimeout(() => toggleIEClass(), i * 100);
    }
  }

  /**
   * @param {!Event} evt
   * @private
   */
  handleDialogClick_(evt) {
    const {target} = evt;
    const action = this.adapter_.getAction(target);
    if (action) {
      this.close(action);
    }
  }

  /** @private */
  handleWindowResize_() {
    requestAnimationFrame(() => this.layout());
  }

  /** @private */
  handleAnimationTimerEnd_() {
    this.adapter_.removeClass(cssClasses.ANIMATING);
    if (this.isOpen_) {
      this.adapter_.trapFocusOnSurface();
      this.layout();
    }
  }

  /** @private */
  disableScroll_() {
    this.adapter_.addBodyClass(cssClasses.SCROLL_LOCK);
  }

  /** @private */
  enableScroll_() {
    this.adapter_.removeBodyClass(cssClasses.SCROLL_LOCK);
  }
}
