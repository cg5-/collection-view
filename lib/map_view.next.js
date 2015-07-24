
CV.MapView = class MapView extends CV.SuspendView {
	constructor(underlying, mapFunc) {
		this._underlying = underlying;
		this._mapFunc = mapFunc;
		super();
	}

	_applyMapFunc(doc) {
		let _id = doc._id;
		return _.extend(this._mapFunc(doc), {_id});
	}

	_start(cbs) {
		this._observer = this._underlying.observeAfter({
			added: (doc) => {
				cbs.added(this._applyMapFunc(doc));
			},
			changed: (doc, oldDoc) => {
				let doc2 = this._applyMapFunc(doc);
				let oldDoc2 = this._applyMapFunc(oldDoc);
				if (!EJSON.equals(doc2, oldDoc2)) {
					cbs.changed(doc2, oldDoc2);
				}
			},
			removed: (doc) => {
				cbs.removed(this._applyMapFunc(doc));
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		this._underlying.forEachNonreactive((doc) => {
			cb(this._applyMapFunc(doc));
		});
	}

	explain() {
		this._underlying.explain();
		console.log(`.map(${this._mapFunc.toString()})`)
	}
}
