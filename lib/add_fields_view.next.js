
CV.AddFieldsView = class AddFieldsView extends CV.SuspendView {
	constructor(underlying, newFields) {
		this._underlying = underlying;
		this._newFields = newFields;
		if (newFields._id) throw new Error("addFields: can't add _id");
		super();
	}

	_addFields(doc) {
		let newFields = {};
		for (let key in this._newFields) {
			if (this._newFields.hasOwnProperty(key)) {
				newFields[key] = this._newFields[key](doc);
			}
		}
		return _.extend(doc, newFields);
	}

	_start(cbs) {
		this._observer = this._underlying.observeAfter({
			added: (doc) => {
				cbs.added(this._addFields(doc));
			},
			changed: (doc, oldDoc) => {
				cbs.changed(this._addFields(doc), this._addFields(oldDoc));
			},
			removed: (doc) => {
				cbs.removed(this._addFields(doc));
			}
		});
	}

	_suspend() {
		this._observer.stop();
	}

	forEachNonreactive(cb) {
		this._underlying.forEachNonreactive((doc) => {
			cb(this._addFields(doc));
		});
	}

	/*
	pick(...picked) {
		if (picked.length === 1 && _.isArray(picked[0])) picked = picked[0];
		let keys = _.keys(this._newFields);
		let difference = _.difference(keys, picked);
		if (difference.length > 0) {
			return this._underlying.addFields(_.omit(this._newFields, difference)).pick(...picked);
		} else {
			return super.pick(...picked);
		}
	}*/

	explain() {
		this._underlying.explain();
		console.log(`.addFields(${_.keys(this._newFields).join(",")})`);
	}
}
