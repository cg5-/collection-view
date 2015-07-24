
CV.PickView = class PickView extends CV.SuspendView {
	constructor(underlying, fields) {
		this._underlying = underlying;
		this._fields = _.without(_.uniq(fields), "_id");
		super();
	}

	_pick(object) {
		let result = _.pick(object, this._fields);
		result._id = object._id;
		return result;
	}

	_start(cbs) {
		this._observer = this._underlying.observeAfter({
			added: (doc) => {
				cbs.added(this._pick(doc));
			},
			changed: (doc, oldDoc) => {
				let different = false
				for (let field of this._fields) {
					if (!EJSON.equals(doc[field], oldDoc[field])) {
						different = true;
						break;
					}
				}
				if (different) {
					cbs.changed(this._pick(doc), this._pick(oldDoc));
				}
			},
			removed: (doc) => {
				cbs.removed(this._pick(doc));
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		this._underlying.forEachNonreactive((doc) => {
			cb(this._pick(doc));
		});
	}

	pick(...fields) {
		if (fields.length === 1 && _.isArray(fields[0])) fields = fields[0];
		return new CV.PickView(this._underlying, _.intersection(this._fields, fields));
	}

	omit(...fields) {
		if (fields.length === 1 && _.isArray(fields[0])) fields = fields[0];
		if (fields.length === 0) return this;
		if (_.contains(fields, "_id")) {
			throw new Error("Can't omit _id");
		}
		return new CV.PickView(this._underlying, _.difference(this._fields, fields));
	}

	explain() {
		this._underlying.explain();
		console.log(`.pick(${_.map(this._fields, JSON.stringify).join(",")})`);
	}
}

CV.OmitView = class OmitView extends CV.SuspendView {
	constructor(underlying, fields) {
		this._underlying = underlying;
		this._fields = _.without(_.uniq(fields), "_id");
		super();
	}

	_start(cbs) {
		this._observer = this._underlying.observeAfter({
			added: (doc) => {
				cbs.added(_.omit(doc, this._fields));
			},
			changed: (doc, oldDoc) => {
				let doc2 = _.omit(doc, this._fields);
				let oldDoc2 = _.omit(oldDoc, this._fields);

				if (!EJSON.equals(doc2, oldDoc2)) {
					cbs.changed(doc2, oldDoc2);
				}
			},
			removed: (doc) => {
				cbs.removed(_.omit(doc, this._fields));
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		this._underlying.forEachNonreactive((doc) => {
			cb(_.omit(doc, this._fields));
		});
	}

	pick(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		return new CV.PickView(this._underlying, _.difference(fields, this._fields));
	}

	omit(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		if (fields.length === 0) return this;
		if (_.contains(fields, "_id")) {
			throw new Error("Can't omit _id");
		}
		return new CV.OmitView(this._underlying, _.union(this._fields, fields));
	}

	explain() {
		this._underlying.explain();
		console.log(`.omit(${_.map(this._fields, JSON.stringify).join(",")})`);
	}
}
