/**
 * Implements a special case of events which supports only one callback and
 * fires only when the last call to the callback function is settled.
 * 
 * This event is called non-stackable, because if the {@linkcode fire} method
 * is called multiple times while the callback job is still in progress, the
 * callback will be called only *once* after finishing its job (whether
 * fulfilled or rejected).
 */
export class NonStackableEvent {
    private _shouldRunAgain = false;
    private _callbackPromise: Promise<void> | undefined;

    constructor(readonly callback: () => Promise<void>) { }

    /**
     * Returns the currently running callback, if any.
     */
    getPromise() {
        return this._callbackPromise;
    }

    fire() {
        if (this._callbackPromise) {
            this._shouldRunAgain = true;
            return;
        }

        this._callbackPromise = this.callback().finally(() => {
            this._callbackPromise = undefined;
            if (this._shouldRunAgain) {
                this._shouldRunAgain = false;
                this.fire();
            }
        });
    }
}
