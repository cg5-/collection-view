
/* Given a function func, create an object with a "stop" method, which when called
 * for the first time, calls func. If called from inside a computation, automatically
 * call stop when the computation is invalidated. */
CV.makeStopper = function (func) {
	let stopped = false;
	let stopper = { stop() {
		if (!stopped) func();
		stopped = true;
	} };
	if (!Meteor.isServer && Tracker.active) {
		Tracker.onInvalidate(stopper.stop);
	}
	return stopper;
};

CV.makeTestObserver = function (name = "") {
	return {
		added(doc) {
			console.log(name, "added", doc);
		},
		changed(doc, oldDoc) {
			console.log(name, "changed", oldDoc, "->", doc);
		},
		removed(doc) {
			console.log(name, "removed", doc);
		}
	}
};

CV.makeTestOrderedObserver = function (name = "") {
	return {
		addedAt(doc, idx, before) {
			console.log(name, "added", doc, "at " + idx);
		},
		changedAt(doc, oldDoc, idx) {
			console.log(name, "changed", oldDoc, "->", doc, "at " + idx);
		},
		removedAt(doc, idx) {
			console.log(name, "removed", doc, "at " + idx);
		},
		movedTo(doc, fromIdx, toIdx, before) {
			console.log(name, "moved", doc, fromIdx + " -> " + toIdx);
		}
	}
};

if (Meteor.isServer) {
	CV.afterFlush = func => { func(); };
	CV.nonreactive = func => { func(); };
} else {
	CV.afterFlush = Tracker.afterFlush;
	CV.nonreactive = Tracker.nonreactive;
}
