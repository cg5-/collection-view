
const DEBUG_REIFIED_VIEW = false;

// mongo doesn't allow fields starting with $
// minimongo does, and doing collection.update(oldDoc._id, newDoc), expecting
// to replace the entire document, when newDoc contains fields like "$set" could be disastrous
function stripDollarFields(doc) {
	let result = {};
	for (let key in doc) {
		if (key.charAt(0) === "$") {
			result["dollar_" + key.slice(1)] = doc[key];
		} else {
			result[key] = doc[key];
		}
	}
	return result;
}

CV.Reifier = class Reifier {

	constructor() {
		this._numKeepAlives = 0;
		this._active = false;
	}

	_start(collection) {
		throw new Error(this.constructor.name + ": must implement _start");
	}

	_suspend() {
		throw new Error(this.constructor.name + ": must implement _suspend");
	}

	keepAlive() {
		if (!this._active) {
			if (DEBUG_REIFIED_VIEW) console.log("starting up " + this.constructor.name);
			CV._activeViews++;
			this._collection = new LocalCollection();
			Tracker.nonreactive(() => {
				this._start(this._collection);
			});
			this._active = true;
		}
		this._numKeepAlives++;

		return CV.makeStopper(() => {
			this._numKeepAlives--;

			if (this._numKeepAlives === 0) {
				CV.afterFlush(() => {
					if (this._active && this._numKeepAlives === 0) {
						if (DEBUG_REIFIED_VIEW) console.log("suspending " + this.constructor.name);
						CV._activeViews--;
						this._suspend();
						this._collection = null;
						this._active = false;
					}
				});
			}
		});
	}
}

CV.ReifierView = class ReifierView extends CV.OrderedView {

	constructor(reifier, selectors = [], fields = [], fieldsType = 0, sort = null) {
		this._reifier = reifier;
		this._selectors = selectors;
		this._fields = fields;
		this._fieldsType = fieldsType;
		this._sort = sort;

		this._finalSelector = this._makeSelector();
		this._otherArgs = this._makeOtherArgs();

		super();
	}

	_makeSelector() {
		if (this._selectors.length === 0) {
			return {};
		} else if (this._selectors.length === 1) {
			return this._selectors[0];
		} else {
			return {$and: this._selectors};
		}
	}

	_makeOtherArgs() {
		let result = {};
		if (this._fields.length) {
			let projection = {};
			for (let field of this._fields) {
				if (field.indexOf(".") !== -1) {
					throw new Error("Can't have a dot in a field name");
				}
				if (field === "_id" && this._fieldsType === 0) {
					throw new Error("Can't omit _id");
				}
				if (field !== "_id") {
					projection[field] = this._fieldsType;
				}
			}
			result.fields = projection;
		} else if (this._fieldsType === 1) {
			result.fields = {_id: 1};
		}

		if (this._sort) {
			result.sort = this._sort;
		}
		return result;
	}

	observe(callbacks) {
		let keepAliveHandle = this._reifier.keepAlive();
		let cursor = this._reifier._collection.find(this._finalSelector, this._otherArgs);
		let observer = Tracker.nonreactive(() => cursor.observe(callbacks));
		return CV.makeStopper(() => {
			observer.stop();
			keepAliveHandle.stop();
		});
	}

	forEach(callback) {
		let keepAliveHandle = this._reifier.keepAlive();
		this._reifier._collection.find(this._finalSelector, this._otherArgs).forEach(callback);
		if (Meteor.isServer || !Tracker.active) {
			keepAliveHandle.stop();
		} else {
			Tracker.onInvalidate(() => {
				keepAliveHandle.stop();
			});
		}
	}

	fetch() {
		let keepAliveHandle = this._reifier.keepAlive();
		let result = this._reifier._collection.find(this._finalSelector, this._otherArgs).fetch();
		if (Meteor.isServer || !Tracker.active) {
			keepAliveHandle.stop();
		} else {
			Tracker.onInvalidate(() => {
				keepAliveHandle.stop();
			});
		}
		return result;
	}

	keepAlive() {
		return this._reifier.keepAlive();
	}

	filter(selector) {
		if (_.isFunction(selector)) return super.filter(selector);
		// FIXME: reifierView.omit("x").filter({x: 1}) should be empty set,
		// but it does collection.find({x: 1}, {fields: {x: 0}})
		if (_.isString(selector)) selector = {_id: selector};
		return new CV.ReifierView(this._reifier, this._selectors.concat([selector]), this._fields, this._fieldsType, this._sort)
	}

	pick(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		if (this._fieldsType === 1) {
			return new CV.ReifierView(this._reifier, this._selectors, _.intersection(fields, this._fields), 1, this._sort);
		} else {
			return new CV.ReifierView(this._reifier, this._selectors, _.difference(fields, this._fields), 1, this._sort);
		}
	}

	omit(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		if (this._fieldsType === 1) {
			return new CV.ReifierView(this._reifier, this._selectors, _.difference(this._fields, fields), 1, this._sort);
		} else {
			return new CV.ReifierView(this._reifier, this._selectors, _.union(fields, this._fields), 0, this._sort);
		}
	}

	reify() {
		if (this._selectors.length === 0 && this._fields.length === 0 && this._fieldsType === 0 && this._sort == null) {
			return this;
		} else {
			return super.reify();
		}
	}

	sort(sortSpecifier) {
		return new CV.ReifierView(this._reifier, this._selectors, this._fields, this._fieldsType, sortSpecifier);
	}

	explain() {
		this._reifier.explain()
		console.log(`.find(${JSON.stringify(this._makeSelector())}, ${JSON.stringify(this._makeOtherArgs())})`);
	}
}


CV.SimpleReifier = class SimpleReifier extends CV.Reifier {

	constructor(underlying) {
		this._underlying = underlying;
		super();
	}

	_start(collection) {
		this._observer = this._underlying.observe({
			added(doc) {
				collection.insert(doc);
			},
			changed(doc, oldDoc) {
				collection.update(oldDoc._id, stripDollarFields(doc));
			},
			removed(doc) {
				collection.remove(doc._id);
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	explain() {
		this._underlying.explain();
		console.log("-> reify into Minimongo");
	}
}
