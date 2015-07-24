
/* If true, print stuff to the console whenever a SuspendView starts up or suspends. */
const DEBUG_SUSPEND_VIEW = false;

/* Abstract base class for views which use an auto-suspend. Subclasses must implement
 * forEachNonreactive and _start({added, changed, removed}) */
CV.SuspendView = class SuspendView extends CV.View {
	constructor() {
		this._idCounter = 0;
		this._numKeepAlives = 0;

		this._addeds = {};
		this._changeds = {};
		this._removeds = {};

		this._active = false;
		super();
	}

	_start(callbacker) {
		throw new Error(this.constructor.name + ": must implement _start");
	}

	_suspend() {
		throw new Error(this.constructor.name + ": must implement _suspend");
	}

	_makeCallbacker() {
		return {
			added: (doc) => {
				for (let key in this._addeds)
					if (this._addeds.hasOwnProperty(key))
						this._addeds[key](doc);
			},
			changed: (doc, oldDoc) => {
				for (let key in this._changeds)
					if (this._changeds.hasOwnProperty(key))
						this._changeds[key](doc, oldDoc);
			},
			removed: (doc) => {
				for (let key in this._removeds)
					if (this._removeds.hasOwnProperty(key))
						this._removeds[key](doc);
			}
		}
	}

	keepAlive() {
		if (!this._active) {
			if (DEBUG_SUSPEND_VIEW) console.log("starting up " + this.constructor.name);
			CV._activeViews++;
			Tracker.nonreactive(() => {
				this._start(this._makeCallbacker());
			});
			this._active = true;
		}
		this._numKeepAlives++;

		return CV.makeStopper(() => {
			this._numKeepAlives--;

			if (this._numKeepAlives === 0) {
				CV.afterFlush(() => {
					if (this._active && this._numKeepAlives === 0) {
						if (DEBUG_SUSPEND_VIEW) console.log("suspending " + this.constructor.name);
						CV._activeViews--;
						this._suspend();
						this._active = false;
					}
				});
			}
		});
	}

	forEachNonreactive(callback) {
		throw new Error(this.constructor.name + ": must implement forEachNonreactive");
	}
	
	observeAfter(callbacks) {
		if (callbacks.addedAt || callbacks.changedAt || callbacks.removedAt || callbacks.movedTo)
			return this.order().observeAfter(callbacks);

		let keepAliveHandle = this.keepAlive();

		let id = this._idCounter++;
		
		if (callbacks.added) this._addeds[id] = callbacks.added;
		if (callbacks.changed) this._changeds[id] = callbacks.changed;
		if (callbacks.removed) this._removeds[id] = callbacks.removed;

		return CV.makeStopper(() => {
			delete this._addeds[id];
			delete this._changeds[id];
			delete this._removeds[id];

			keepAliveHandle.stop();
		});
	}
}

CV.OrderedSuspendView = class OrderedSuspendView extends CV.OrderedView {
	constructor() {
		this._idCounter = 0;
		this._numKeepAlives = 0;

		this._addeds = {};
		this._addedAts = {};
		this._changeds = {};
		this._changedAts = {};
		this._removeds = {};
		this._removedAts = {};
		this._movedTos = {};

		this._active = false;
		super();
	}

	_start(callbacker) {
		throw new Error(this.constructor.name + ": must implement _start");
	}

	_suspend() {
		throw new Error(this.constructor.name + ": must implement _suspend");
	}

	_makeCallbacker() {
		return {
			addedAt: (doc, index, before) => {
				for (let key in this._addeds)
					if (this._addeds.hasOwnProperty(key))
						this._addeds[key](doc);
				for (let key in this._addedAts)
					if (this._addedAts.hasOwnProperty(key))
						this._addedAts[key](doc, index, before);
			},
			changedAt: (doc, oldDoc, index) => {
				for (let key in this._changeds)
					if (this._changeds.hasOwnProperty(key))
						this._changeds[key](doc, oldDoc);
				for (let key in this._changedAts)
					if (this._changedAts.hasOwnProperty(key))
						this._changedAts[key](doc, oldDoc, index);
			},
			removedAt: (doc, index) => {
				for (let key in this._removeds)
					if (this._removeds.hasOwnProperty(key))
						this._removeds[key](doc);
				for (let key in this._removedAts)
					if (this._removedAts.hasOwnProperty(key))
						this._removedAts[key](doc, index);
			},
			movedTo: (doc, fromIndex, toIndex, before) => {
				for (let key in this._movedTos)
					if (this._movedTos.hasOwnProperty(key))
						this._movedTos[key](doc, fromIndex, toIndex, before);
			}
		}
	}

	keepAlive() {
		if (!this._active) {
			if (DEBUG_SUSPEND_VIEW) console.log("starting up " + this.constructor.name)
			Tracker.nonreactive(() => {
				this._start(this._makeCallbacker());
			});
			this._active = true;
		}
		this._numKeepAlives++;

		return CV.makeStopper(() => {
			this._numKeepAlives--;

			if (this._numKeepAlives === 0) {
				Tracker.afterFlush(() => {
					if (this._active && this._numKeepAlives === 0) {
						if (DEBUG_SUSPEND_VIEW) console.log("suspending " + this.constructor.name);
						this._active = false;
						this._suspend();
					}
				});
			}
		})
	}

	forEachNonreactive(callback) {
		throw new Error(this.constructor.name + ": must implement forEachNonreactive");
	}
	
	observeAfter(callbacks) {
		let keepAliveHandle = this.keepAlive();

		let id = this._idCounter++;
		
		if (callbacks.added) this._addeds[id] = callbacks.added;
		if (callbacks.addedAt) this._addedAts[id] = callbacks.addedAt;
		if (callbacks.changed) this._changeds[id] = callbacks.changed;
		if (callbacks.changedAt) this._changedAts[id] = callbacks.changedAt;
		if (callbacks.removed) this._removeds[id] = callbacks.removed;
		if (callbacks.removedAt) this._removedAts[id] = callbacks.removedAt;
		if (callbacks.movedTo) this._movedTos[id] = callbacks.movedTo;

		return CV.makeStopper(() => {
			delete this._addeds[id];
			delete this._addedAts[id];
			delete this._changeds[id];
			delete this._changedAts[id];
			delete this._removeds[id];
			delete this._removedAts[id];
			delete this._movedTos[id];

			keepAliveHandle.stop();
		});
	}
}
