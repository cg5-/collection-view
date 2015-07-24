
CV.CollectionView = class CollectionView extends CV.OrderedView {
	constructor(collection, selectors = [], fields = [], fieldsType = 0, sort = null) {
		// fieldsType = 1: fields is a whitelist
		// fieldsType = 0: fields is a blacklist
		this._selectors = selectors;
		this._fields = fields;
		this._fieldsType = fieldsType;
		this._collection = collection;
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

	_createCursor() {
		this._cursor = this._collection.find(this._finalSelector, this._otherArgs);
	}

	observe(callbacks) {
		if (!this._cursor) this._createCursor();
		let observer = Tracker.nonreactive(() => this._cursor.observe(callbacks));
		return CV.makeStopper(() => {
			observer.stop();
		});
	}

	forEach(callback) {
		if (!this._cursor) this._createCursor();
		this._cursor.forEach(callback);
	}

	fetch() {
		if (!this._cursor) this._createCursor();
		return this._cursor.fetch();
	}

	filter(selector) {
		if (_.isFunction(selector)) return super.filter(selector);
		// FIXME: CV(collection).omit("x").filter({x: 1}) should be empty set,
		// but it does collection.find({x: 1}, {fields: {x: 0}})
		if (_.isString(selector)) selector = {_id: selector};
		return new CV.CollectionView(this._collection, this._selectors.concat([selector]), this._fields, this._fieldsType, this._sort);
	}

	pick(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		if (this._fieldsType === 1) {
			return new CV.CollectionView(this._collection, this._selectors, _.intersection(fields, this._fields), 1, this._sort);
		} else {
			return new CV.CollectionView(this._collection, this._selectors, _.difference(fields, this._fields), 1, this._sort);
		}
	}

	omit(...fields) {
		if (fields.length === 0 && _.isArray(fields[0])) fields = fields[0];
		if (this._fieldsType === 1) {
			return new CV.CollectionView(this._collection, this._selectors, _.difference(this._fields, fields), 1, this._sort);
		} else {
			return new CV.CollectionView(this._collection, this._selectors, _.union(fields, this._fields), 0, this._sort);
		}
	}

	sort(sortSpecifier) {
		return new CV.CollectionView(this._collection, this._selectors, this._fields, this._fieldsType, sortSpecifier);
	}

	reify() {
		if (this._selectors.length === 0 && this._fields.length === 0 && this._fieldsType === 0 && this._sort == null) {
			return this;
		} else {
			return super.reify();
		}
	}

	explain() {
		console.log(`${this._collection._name || "collection"}.find(${JSON.stringify(this._finalSelector)}, ${JSON.stringify(this._otherArgs)})`);
	}
}
