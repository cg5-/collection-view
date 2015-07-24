
CV.FilterView = class FilterView extends CV.SuspendView {
	constructor(underlying, pred) {
		if (!_.isFunction(pred)) {
			let matcher = new Minimongo.Matcher(pred);
			pred = doc => matcher.documentMatches(doc).result;
		}
		this._underlying = underlying;
		this._pred = pred;
		super();
	}

	_start(cbs) {
		this._observer = this._underlying.observeAfter({
			added: (doc) => {
				if (this._pred(EJSON.clone(doc))) cbs.added(doc);
			},
			changed: (doc, oldDoc) => {
				let docPasses = this._pred(EJSON.clone(doc));
				let oldDocPasses = this._pred(EJSON.clone(oldDoc));
				if (docPasses && oldDocPasses) {
					cbs.changed(doc, oldDoc);
				} else if (docPasses && !oldDocPasses) {
					cbs.added(doc);
				} else if (!docPasses && oldDocPasses) {
					cbs.removed(oldDoc);
				}
			},
			removed: (doc) => {
				if (this._pred(EJSON.clone(doc)))
					cbs.removed(doc);
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		this._underlying.forEachNonreactive((doc) => {
			if (this._pred(EJSON.clone(doc)))
				cb(doc);
		});
	}

	explain() {
		this._underlying.explain();
		console.log(`.filter(${this._pred.toString()})`)
	}
}
