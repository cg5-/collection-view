
CV.GroupView = class GroupView extends CV.SuspendView {
	constructor(underlying, {groupBy, aggregate} = {}) {
		this._underlying = underlying;
		this._groupBy = groupBy;
		this._aggregate = aggregate || {};

		// map from EJSON.stringified group-key values to aggregated object
		this._values = null;
		this._counts = null;
		super();
	}

	_start(callbacks) {
		this._values = {};
		this._counts = {};

		let firstRun = true;
		this._observer = this._underlying.observe({
			added: (doc) => {
				this._addToGroup(callbacks, _.pick(doc, this._groupBy), doc, firstRun);
			},
			changed: (doc, oldDoc) => {
				let oldGroup = _.pick(oldDoc, this._groupBy);
				let newGroup = _.pick(doc, this._groupBy);
				if (!EJSON.equals(oldGroup, newGroup)) {
					this._removeFromGroup(callbacks, oldGroup, oldDoc);
					this._addToGroup(callbacks, newGroup, doc);
				} else if (!_.isEmpty(this._aggregate)) {
					this._updateInGroup(callbacks, _.pick(doc, this._groupBy), doc, oldDoc);
				}
			},
			removed: (doc) => {
				this._removeFromGroup(callbacks, _.pick(doc, this._groupBy), doc);
			}
		});
		firstRun = false;
	}

	_addToGroup(callbacks, group, doc, firstRun) {
		let stringified = EJSON.stringify(group, {canonical: true});
		let existing = this._values[stringified];
		if (existing) {
			let old = EJSON.clone(existing);
			this._counts[stringified]++;
			let changed = false;
			for (let key in this._aggregate) {
				existing[key] = this._aggregate[key].add(existing[key], doc);
				if (!changed && !EJSON.equals(existing[key], old[key])) changed = true;
			}
			if (!firstRun && changed) callbacks.changed(EJSON.clone(existing), old);
		} else {
			let initial = _.extend({_id: Meteor.uuid()}, group);
			for (let key in this._aggregate) {
				initial[key] = this._aggregate[key].initial(doc);
			}
			this._values[stringified] = initial;
			this._counts[stringified] = 1;
			if (!firstRun) callbacks.added(EJSON.clone(initial));
		}
	}

	_updateInGroup(callbacks, group, doc, oldDoc) {
		let stringified = EJSON.stringify(group, {canonical: true});
		let existing = this._values[stringified];
		let old = EJSON.clone(existing);
		let changed = false;
		for (let key in this._aggregate) {
			existing[key] = this._aggregate[key].subtract(existing[key], oldDoc);
			existing[key] = this._aggregate[key].add(existing[key], doc);
			if (!changed && !EJSON.equals(existing[key], old[key])) changed = true;
		}
		if (changed) callbacks.changed(EJSON.clone(existing), old);
	}

	_removeFromGroup(callbacks, group, doc) {
		let stringified = EJSON.stringify(group, {canonical: true});
		let existing = this._values[stringified];
		if (this._counts[stringified] === 1) {
			delete this._values[stringified];
			delete this._counts[stringified];
			callbacks.removed(existing);
		} else {
			let old = EJSON.clone(existing);
			this._counts[stringified]--;
			let changed = false;
			for (let key in this._aggregate) {
				existing[key] = this._aggregate[key].subtract(existing[key], doc);
				if (!changed && !EJSON.equals(existing[key], old[key])) changed = true;
			}
			if (changed) callbacks.changed(EJSON.clone(existing), old);
		}
	}

	_suspend() {
		this._values = null;
		this._counts = null;
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		CV.nonreactive(() => {
			let keepAliveHandle = this.keepAlive();
			for (let key in this._values) {
				cb(EJSON.clone(this._values[key]));
			}
			keepAliveHandle.stop();
		});
	}

	explain() {
		this._underlying.explain();
		console.log(`.group(${JSON.stringify(this._groupBy)})`);
	}
}

CV.sum = (fieldName) => ({
	initial: (doc) => doc[fieldName],
	add: (total, doc) => total + doc[fieldName],
	subtract: (total, doc) => total - doc[fieldName]
});

CV.count = {
	initial: () => 1,
	add: (total, doc) => total + 1,
	subtract: (total, doc) => total - 1
}
