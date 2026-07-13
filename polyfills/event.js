if (typeof global.Event === 'undefined') {
  class Event {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = !!options.bubbles;
      this.cancelable = !!options.cancelable;
      this.composed = !!options.composed;
      this.defaultPrevented = false;
      this.target = null;
      this.currentTarget = null;
      this.timeStamp = Date.now();
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true;
      }
    }

    stopPropagation() {}
    stopImmediatePropagation() {}
  }

  global.Event = Event;
}

if (typeof global.CustomEvent === 'undefined') {
  class CustomEvent extends global.Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail =
        options.detail !== undefined
          ? options.detail
          : null;
    }
  }

  global.CustomEvent = CustomEvent;
}
