
/* Abstract base class for ordered views. */
CV.OrderedView = class OrderedView extends CV.View {
	constructor() {
		super();
	}

	observeAfter(callbacks) {
		let firstRun = true;
		let observer = this.observe({
			added: callbacks.added ? (x) => {
				if (!firstRun) callbacks.added(x);
			} : void(0),
			addedAt: callbacks.addedAt ? (doc, index, before) => {
				if (!firstRun) callbacks.addedAt(doc, index, before);
			} : void(0),
			changed: callbacks.changed,
			changedAt: callbacks.changedAt,
			removed: callbacks.removed,
			removedAt: callbacks.removedAt,
			movedTo: callbacks.movedTo
		});
		firstRun = false;
		return observer;
	}

	observe(callbacks) {
		let index = 0;
		if (callbacks.added || callbacks.addedAt) {
			this.forEachNonreactive((doc) => {
				if (callbacks.added) callbacks.added(doc);
				if (callbacks.addedAt) callbacks.addedAt(doc, index, null);
				index++;
			});
		}
		return this.observeAfter(callbacks);
	}

	order() {
		return this;
	}

	isOrdered() {
		return true;
	}
}
