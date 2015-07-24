
// In UnionView, we need to encode _ids to ensure uniqueness. For example,
// CV.union(collection, collection) will have two copies of each document in collection,
// and they must have unique _ids.
function encodeId(idx, _id) {
	if (_.isString(_id)) {
		return idx + "s" + _id;
	} else if (_id instanceof Mongo.ObjectID) {
		return idx + "o" + _id.toHexString();
	}
	throw new Error("_id field not a string or ObjectID: " + EJSON.stringify(_id));
}

CV.UnionView = class UnionView extends CV.SuspendView {
	constructor(...views) {
		if (views.length === 1 && _.isArray(views[0])) views = views[0];
		this._views = _.map(views, CV);
		super();
	}

	_start(cbs) {
		this._observers = [];
		for (let i = 0; i < this._views.length; i++) {
			let view = this._views[i];
			let observer = view.observeAfter({
				added: (doc) => {
					cbs.added(_.extend(doc, {_id: encodeId(i, doc._id)}));
				},
				changed: (doc, oldDoc) => {
					cbs.changed(_.extend(doc, {_id: encodeId(i, doc._id)}), _.extend(oldDoc, {_id: encodeId(i, oldDoc._id)}));
				},
				removed: (doc) => {
					cbs.removed(_.extend(doc, {_id: encodeId(i, doc._id)}));
				}
			});
			this._observers.push(observer);
		}
	}

	_suspend() {
		for (let observer of this._observers) {
			observer.stop();
		}
		this._observers = null;
	}

	forEachNonreactive(cb) {
		for (let i = 0; i < this._views.length; i++) {
			this._views[i].forEachNonreactive((doc) => {
				cb(_.extend(doc, {_id: encodeId(i, doc._id)}))
			});
		}
	}

	explain() {
		console.log("union(");
		for (let view of this._views) {
			view.explain();
			console.log("---");
		}
		console.log(")");
	}
}
