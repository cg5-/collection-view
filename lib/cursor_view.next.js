
CV.CursorView = class CursorView extends CV.OrderedView {

	constructor(cursor) {
		this._cursor = cursor;
		super();
	}

	observe(callbacks) {
		let observer = Tracker.nonreactive(() => this._cursor.observe(callbacks));
		return CV.makeStopper(() => {
			observer.stop();
		});
	}

	forEach(callback) {
		if (_.isFunction(this._cursor.forEach)) {
			this._cursor.forEach(callback);
		} else {
			for (let object in this._cursor.fetch()) {
				callback(object);
			}
		}
	}

	fetch() {
		if (_.isFunction(this._cursor.fetch)) {
			return this._cursor.fetch();
		} else {
			let result = [];
			this._cursor.forEach((doc) => {
				result.push(doc);
			});
			return result;
		}
	}
}
